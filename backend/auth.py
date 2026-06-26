"""
auth.py — drop into backend/ (next to main.py)

Adds:
  POST /auth/signup         (email + password → sends verification email)
  GET  /auth/verify/{token} (click link in email to verify account)
  POST /auth/login          (email + password, must be verified)
  POST /auth/google         (Google Sign-In — auto-verified, no email needed)
  GET  /auth/me             (requires Bearer token)

Env vars needed:
  DATABASE_URL      Supabase Postgres connection string
  JWT_SECRET        secret for signing tokens   (REQUIRED — no default; app crashes on startup if missing)
  GOOGLE_CLIENT_ID  your Google OAuth client ID (optional)
  RESEND_API_KEY    your Resend API key         (optional — skips email if not set)
  APP_URL           your frontend URL           (e.g. https://pdf-converter-eight-rouge.vercel.app)
  BACKEND_URL       your backend URL            (e.g. https://pdf-converter-production-a181.up.railway.app)
  FROM_EMAIL        verified sender address     (e.g. noreply@yourdomain.com)

Verification token expiry:
  Tokens expire 24 hours after signup. Expired tokens are cleared from the DB
  and the user must sign up again with the same email.

Account lockout:
  After MAX_LOGIN_ATTEMPTS consecutive failures, the account is locked for
  LOCKOUT_SECONDS. The counter resets to 0 on a successful login.
  Override defaults via env vars:
    MAX_LOGIN_ATTEMPTS=5
    LOCKOUT_SECONDS=900   (15 minutes)

Rate limits (all per IP via slowapi):
  POST /auth/login   — 5 attempts / 15 minutes (brute-force protection)
  POST /auth/signup  — 5 attempts / 15 minutes (signup-spam protection)
  POST /auth/google  — 10 attempts / minute    (slightly more lenient for SSO flows)

  Override any limit without redeploying via env vars:
    LOGIN_RATE_LIMIT, SIGNUP_RATE_LIMIT, GOOGLE_RATE_LIMIT
    e.g. LOGIN_RATE_LIMIT=10/minute
"""

import os
import math
import re
import secrets
import time
import logging

import httpx
import jwt
import psycopg2
import psycopg2.extras
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

from core.rate_limit import limiter

logger = logging.getLogger(__name__)

# JWT_SECRET is REQUIRED. Using os.environ[] (not .get()) means the application
# will raise a KeyError and refuse to start if the variable is missing — which
# is the correct behaviour; a missing secret would silently fall back to a weak
# default and sign tokens that any attacker who knows the default can forge.
SECRET_KEY: str = os.environ["JWT_SECRET"]

ALGORITHM                   = "HS256"
TOKEN_EXPIRE_SECONDS        = 60 * 60 * 24 * 7  # 7 days
VERIFICATION_EXPIRE_SECONDS = 60 * 60 * 24      # 24 hours
RESET_EXPIRE_SECONDS        = 60 * 60            # 1 hour

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
DATABASE_URL     = os.environ.get("DATABASE_URL", "")
RESEND_API_KEY   = os.environ.get("RESEND_API_KEY", "")
APP_URL          = os.environ.get("APP_URL", "http://localhost:5173")
BACKEND_URL      = os.environ.get("BACKEND_URL", "http://localhost:8000")
FROM_EMAIL       = os.environ.get("FROM_EMAIL", "noreply@docshift.app")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL env var is not set — cannot start without a database")

# ── Account lockout config ────────────────────────────────────────────────────
MAX_LOGIN_ATTEMPTS = int(os.environ.get("MAX_LOGIN_ATTEMPTS", "5"))
LOCKOUT_SECONDS    = int(os.environ.get("LOCKOUT_SECONDS", str(15 * 60)))  # 15 minutes

# ── Rate limit strings ────────────────────────────────────────────────────────
LOGIN_RATE_LIMIT   = os.environ.get("LOGIN_RATE_LIMIT",  "5/15 minutes")
SIGNUP_RATE_LIMIT  = os.environ.get("SIGNUP_RATE_LIMIT", "5/15 minutes")
GOOGLE_RATE_LIMIT  = os.environ.get("GOOGLE_RATE_LIMIT", "10/minute")
FORGOT_RATE_LIMIT  = os.environ.get("FORGOT_RATE_LIMIT", "3/hour")
RESET_RATE_LIMIT   = os.environ.get("RESET_RATE_LIMIT",  "5/hour")

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
router        = APIRouter(prefix="/auth", tags=["auth"])


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_conn():
    """Open a new Postgres connection. Caller is responsible for closing it."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def init_db():
    """Create the users table if it doesn't exist, and migrate existing tables."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id                       SERIAL PRIMARY KEY,
                email                    TEXT UNIQUE NOT NULL,
                password_hash            TEXT,
                provider                 TEXT NOT NULL DEFAULT 'local',
                created_at               DOUBLE PRECISION,
                is_verified              BOOLEAN DEFAULT FALSE,
                verification_token       TEXT,
                verification_expires_at  DOUBLE PRECISION,
                failed_login_count       INTEGER DEFAULT 0,
                locked_until             DOUBLE PRECISION
            )
        """)
        for ddl in [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at DOUBLE PRECISION",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until DOUBLE PRECISION",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires_at DOUBLE PRECISION",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at DOUBLE PRECISION",
        ]:
            cur.execute(ddl)
    conn.commit()
    conn.close()


init_db()


# ── Email ─────────────────────────────────────────────────────────────────────

def send_verification_email(email: str, token: str):
    """Send a verification link via Resend."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping verification email")
        return

    verify_url = f"{BACKEND_URL}/auth/verify/{token}"

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": email,
                "subject": "Verify your DocShift account",
                "html": f"""
                <div style="font-family:sans-serif;max-width:480px;margin:auto">
                  <h2 style="color:#6366f1">Verify your DocShift account</h2>
                  <p>Click the button below to confirm your email address.</p>
                  <a href="{verify_url}"
                     style="display:inline-block;padding:12px 24px;background:#6366f1;
                            color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
                    Verify my email
                  </a>
                  <p style="color:#888;font-size:13px;margin-top:24px">
                    Link expires in 24 hours. If you didn't create an account, ignore this email.
                  </p>
                </div>
                """,
            },
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.error(f"Resend API error {resp.status_code}: {resp.text}")
        else:
            logger.info(f"Verification email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {e}")


def send_reset_email(email: str, token: str):
    """Send a password reset link via Resend."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping reset email")
        return

    reset_url = f"{APP_URL}/reset-password?token={token}"

    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "to": email,
                "subject": "Reset your DocShift password",
                "html": f"""
                <div style="font-family:sans-serif;max-width:480px;margin:auto">
                  <h2 style="color:#6366f1">Reset your password</h2>
                  <p>We received a request to reset the password for your DocShift account.</p>
                  <a href="{reset_url}"
                     style="display:inline-block;padding:12px 24px;background:#6366f1;
                            color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
                    Reset my password
                  </a>
                  <p style="color:#888;font-size:13px;margin-top:24px">
                    This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
                  </p>
                </div>
                """,
            },
            timeout=10,
        )
        if resp.status_code >= 400:
            logger.error(f"Resend API error {resp.status_code}: {resp.text}")
        else:
            logger.info(f"Password reset email sent to {email}")
    except Exception as e:
        logger.error(f"Failed to send reset email to {email}: {e}")




def create_token(email: str, user_id: int) -> str:
    """
    Create a JWT embedding the user's email (sub), numeric DB id (uid),
    and issued-at time (iat). iat is checked against password_changed_at
    so that tokens issued before a password reset are automatically rejected.
    """
    now = int(time.time())
    payload = {
        "sub": email,
        "uid": user_id,
        "iat": now,
        "exp": now + TOKEN_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    """Return the authenticated user's email, or raise 401.
    Also rejects tokens that were issued before the user last reset their password.
    """
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email   = payload["sub"]
        iat     = payload.get("iat", 0)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Fix #3 — invalidate pre-reset sessions
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_changed_at FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
        if row and row["password_changed_at"] and iat < row["password_changed_at"]:
            raise HTTPException(
                status_code=401,
                detail="Session expired after a password reset. Please log in again.",
            )
    finally:
        conn.close()

    return email


def get_current_user_id(token: str = Depends(oauth2_scheme)) -> int:
    """
    Return the authenticated user's numeric DB id, or raise 401.

    SECURITY — File Ownership: every tool endpoint depends on this function.
    The returned id is passed into storage.upload_file() so that Supabase
    objects are namespaced under outputs/{user_id}/… and can never be
    served or deleted by a request that belongs to a different user.

    Also rejects tokens issued before a password reset (same check as get_current_user).
    """
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        uid  = payload.get("uid")
        iat  = payload.get("iat", 0)
        email = payload.get("sub")
        if uid is None:
            raise HTTPException(
                status_code=401,
                detail="Token is outdated. Please log in again.",
            )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Fix #3 — invalidate pre-reset sessions
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_changed_at FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
        if row and row["password_changed_at"] and iat < row["password_changed_at"]:
            raise HTTPException(
                status_code=401,
                detail="Session expired after a password reset. Please log in again.",
            )
    finally:
        conn.close()

    return int(uid)


def _get_user_row(cur, email):
    """
    Returns RealDictRow for the given email, including id and lockout fields.
    The 'id' column is required so we can embed the numeric user id in the JWT.
    """
    cur.execute(
        """SELECT id, password_hash, provider, is_verified,
                  failed_login_count, locked_until
           FROM users WHERE email = %s""",
        (email,)
    )
    return cur.fetchone()


# ── Routes ────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


@router.post("/signup")
@limiter.limit(SIGNUP_RATE_LIMIT)
def signup(request: Request, data: SignupRequest, background_tasks: BackgroundTasks):
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r'[A-Z]', data.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', data.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not re.search(r'\d', data.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not re.search(r'[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\\/`~;\'@£]', data.password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if _get_user_row(cur, data.email):
                raise HTTPException(status_code=400, detail="Email already registered")

            password_hash           = pwd_context.hash(data.password[:72])
            verification_token      = secrets.token_urlsafe(32)
            verification_expires_at = time.time() + VERIFICATION_EXPIRE_SECONDS
            is_verified             = False if RESEND_API_KEY else True

            cur.execute(
                """INSERT INTO users
                   (email, password_hash, provider, created_at, is_verified,
                    verification_token, verification_expires_at)
                   VALUES (%s, %s, 'local', %s, %s, %s, %s)
                   RETURNING id""",
                (data.email, password_hash, time.time(), is_verified,
                 verification_token, verification_expires_at),
            )
            new_user_id = cur.fetchone()["id"]
        conn.commit()
    finally:
        conn.close()

    if RESEND_API_KEY:
        background_tasks.add_task(send_verification_email, data.email, verification_token)
        return {"message": "Account created! Check your email to verify your account."}

    token = create_token(data.email, new_user_id)
    return {"access_token": token, "token_type": "bearer", "email": data.email}


@router.get("/verify/{token}", response_class=HTMLResponse)
def verify_email(token: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT email, verification_expires_at
                   FROM users
                   WHERE verification_token = %s AND is_verified = FALSE""",
                (token,)
            )
            row = cur.fetchone()

            if not row:
                return HTMLResponse(f"""
                    <html><body style="font-family:sans-serif;text-align:center;padding:60px">
                      <h2>&#10060; Invalid or already used link</h2>
                      <p>This verification link is invalid or your account is already verified.</p>
                      <a href="{APP_URL}/login">Go to login</a>
                    </body></html>
                """, status_code=400)

            if row["verification_expires_at"] and time.time() > row["verification_expires_at"]:
                cur.execute(
                    """UPDATE users
                       SET verification_token = NULL, verification_expires_at = NULL
                       WHERE verification_token = %s""",
                    (token,),
                )
                conn.commit()
                return HTMLResponse(f"""
                    <html><body style="font-family:sans-serif;text-align:center;padding:60px">
                      <h2>&#9203; Verification link expired</h2>
                      <p>This link was valid for 24 hours and has now expired.</p>
                      <p>Please sign up again to receive a new verification email.</p>
                      <a href="{APP_URL}/signup"
                         style="display:inline-block;padding:12px 24px;background:#6366f1;
                                color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
                        Sign up again
                      </a>
                    </body></html>
                """, status_code=410)

            cur.execute(
                """UPDATE users
                   SET is_verified = TRUE, verification_token = NULL, verification_expires_at = NULL
                   WHERE verification_token = %s""",
                (token,),
            )
        conn.commit()
    finally:
        conn.close()

    return HTMLResponse(f"""
        <html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2 style="color:#6366f1">&#10003; Email verified!</h2>
          <p>Your account is now active. You can log in.</p>
          <a href="{APP_URL}/login"
             style="display:inline-block;padding:12px 24px;background:#6366f1;
                    color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
            Go to login
          </a>
        </body></html>
    """)


@router.post("/login")
@limiter.limit(LOGIN_RATE_LIMIT)
def login(request: Request, data: LoginRequest):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            row = _get_user_row(cur, data.email)

            if not row or row["provider"] != "local" or not row["password_hash"]:
                raise HTTPException(status_code=401, detail="Invalid email or password")

            locked_until = row["locked_until"]
            if locked_until and time.time() < locked_until:
                retry_in = math.ceil(locked_until - time.time())
                minutes  = retry_in // 60
                seconds  = retry_in % 60
                raise HTTPException(
                    status_code=423,
                    detail=(
                        f"Account locked due to too many failed attempts. "
                        f"Try again in {minutes}m {seconds}s."
                    ),
                )

            if not pwd_context.verify(data.password[:72], row["password_hash"]):
                new_count = (row["failed_login_count"] or 0) + 1
                if new_count >= MAX_LOGIN_ATTEMPTS:
                    cur.execute(
                        """UPDATE users
                           SET failed_login_count = %s,
                               locked_until       = %s
                           WHERE email = %s""",
                        (new_count, time.time() + LOCKOUT_SECONDS, data.email),
                    )
                    conn.commit()
                    raise HTTPException(
                        status_code=423,
                        detail=(
                            f"Too many failed attempts. "
                            f"Account locked for {LOCKOUT_SECONDS // 60} minutes."
                        ),
                    )
                else:
                    remaining = MAX_LOGIN_ATTEMPTS - new_count
                    cur.execute(
                        "UPDATE users SET failed_login_count = %s WHERE email = %s",
                        (new_count, data.email),
                    )
                    conn.commit()
                    raise HTTPException(
                        status_code=401,
                        detail=(
                            f"Invalid email or password. "
                            f"{remaining} attempt{'s' if remaining != 1 else ''} remaining."
                        ),
                    )

            if not row["is_verified"]:
                raise HTTPException(
                    status_code=403,
                    detail="Please verify your email before logging in.",
                )

            user_id = row["id"]
            cur.execute(
                "UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE email = %s",
                (data.email,),
            )
            conn.commit()

    finally:
        conn.close()

    token = create_token(data.email, user_id)
    return {"access_token": token, "token_type": "bearer", "email": data.email}


@router.post("/google")
@limiter.limit(GOOGLE_RATE_LIMIT)
def google_login(request: Request, data: GoogleLoginRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google sign-in is not configured on the server")

    try:
        info = google_id_token.verify_oauth2_token(
            data.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Google account has no email")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            existing = _get_user_row(cur, email)
            if not existing:
                cur.execute(
                    """INSERT INTO users (email, password_hash, provider, created_at, is_verified)
                       VALUES (%s, NULL, 'google', %s, TRUE)
                       RETURNING id""",
                    (email, time.time()),
                )
                user_id = cur.fetchone()["id"]
            else:
                user_id = existing["id"]
        conn.commit()
    finally:
        conn.close()

    token = create_token(email, user_id)
    return {"access_token": token, "token_type": "bearer", "email": email}


@router.get("/me")
def me(current_user: str = Depends(get_current_user)):
    return {"email": current_user}


# ── Forgot / Reset password ───────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
@limiter.limit(FORGOT_RATE_LIMIT)
def forgot_password(request: Request, data: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """
    Always returns 200 with a generic message to prevent user enumeration.
    Email is sent in the background so response time doesn't reveal
    whether the email exists (fix for timing oracle).
    Only sends an email if the account exists and uses local auth (not Google).
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, provider FROM users WHERE email = %s",
                (data.email,)
            )
            row = cur.fetchone()

            if row and row["provider"] == "local":
                reset_token      = secrets.token_urlsafe(32)
                reset_expires_at = time.time() + RESET_EXPIRE_SECONDS
                cur.execute(
                    """UPDATE users
                       SET reset_token = %s, reset_expires_at = %s
                       WHERE email = %s""",
                    (reset_token, reset_expires_at, data.email),
                )
                conn.commit()
                # Fix #2 & #4 — send in background so response time is constant
                # and the request thread isn't blocked by the Resend API call
                background_tasks.add_task(send_reset_email, data.email, reset_token)
    finally:
        conn.close()

    return {"message": "If an account with that email exists, a reset link has been sent."}


@router.post("/reset-password")
@limiter.limit(RESET_RATE_LIMIT)
def reset_password(request: Request, data: ResetPasswordRequest):
    # Validate new password strength server-side (mirrors signup rules)
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r'[A-Z]', data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one uppercase letter")
    if not re.search(r'[a-z]', data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one lowercase letter")
    if not re.search(r'\d', data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if not re.search(r'[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\\/`~;\'@£]', data.new_password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Fix #1 — SELECT FOR UPDATE locks the row so two simultaneous requests
            # with the same token can't both pass the validity check (TOCTOU fix)
            cur.execute(
                """SELECT email, reset_expires_at
                   FROM users
                   WHERE reset_token = %s
                   FOR UPDATE""",
                (data.token,)
            )
            row = cur.fetchone()

            if not row:
                raise HTTPException(status_code=400, detail="Invalid or already used reset link.")

            if time.time() > row["reset_expires_at"]:
                cur.execute(
                    "UPDATE users SET reset_token = NULL, reset_expires_at = NULL WHERE reset_token = %s",
                    (data.token,)
                )
                conn.commit()
                raise HTTPException(status_code=410, detail="Reset link has expired. Please request a new one.")

            new_hash = pwd_context.hash(data.new_password[:72])
            now      = time.time()
            cur.execute(
                """UPDATE users
                   SET password_hash       = %s,
                       password_changed_at = %s,
                       reset_token         = NULL,
                       reset_expires_at    = NULL,
                       failed_login_count  = 0,
                       locked_until        = NULL
                   WHERE reset_token = %s""",
                (new_hash, now, data.token),
            )
        conn.commit()
    finally:
        conn.close()

    return {"message": "Password updated successfully. You can now log in."}