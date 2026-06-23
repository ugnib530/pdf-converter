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
  JWT_SECRET        secret for signing tokens   (default: dev-secret-change-me)
  GOOGLE_CLIENT_ID  your Google OAuth client ID (optional)
  RESEND_API_KEY    your Resend API key         (optional — skips email if not set)
  APP_URL           your frontend URL           (e.g. https://pdf-converter-eight-rouge.vercel.app)
  BACKEND_URL       your backend URL            (e.g. https://pdf-converter-production-a181.up.railway.app)
  FROM_EMAIL        verified sender address     (e.g. noreply@yourdomain.com)
"""

import os
import secrets
import time
import logging

import httpx
import jwt
import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

logger = logging.getLogger(__name__)

SECRET_KEY           = os.environ.get("JWT_SECRET", "dev-secret-change-me")
ALGORITHM            = "HS256"
TOKEN_EXPIRE_SECONDS = 60 * 60 * 24 * 7  # 7 days

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
DATABASE_URL     = os.environ.get("DATABASE_URL", "")
RESEND_API_KEY   = os.environ.get("RESEND_API_KEY", "")
APP_URL          = os.environ.get("APP_URL", "http://localhost:5173")
BACKEND_URL      = os.environ.get("BACKEND_URL", "http://localhost:8000")
FROM_EMAIL       = os.environ.get("FROM_EMAIL", "noreply@docshift.app")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL env var is not set — cannot start without a database")

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
router        = APIRouter(prefix="/auth", tags=["auth"])


# ── DB helpers ────────────────────────────────────────────────────────────────

def get_conn():
    """Open a new Postgres connection. Caller is responsible for closing it."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def init_db():
    """Create the users table if it doesn't exist."""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id                  SERIAL PRIMARY KEY,
                email               TEXT UNIQUE NOT NULL,
                password_hash       TEXT,
                provider            TEXT NOT NULL DEFAULT 'local',
                created_at          DOUBLE PRECISION,
                is_verified         BOOLEAN DEFAULT FALSE,
                verification_token  TEXT
            )
        """)
    conn.commit()
    conn.close()


init_db()


# ── Email ─────────────────────────────────────────────────────────────────────

def send_verification_email(email: str, token: str):
    """Send a verification link via Resend."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping verification email")
        return

    # Uses BACKEND_URL (not APP_URL) because this link must hit the backend API,
    # not the frontend.
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


# ── Helpers ───────────────────────────────────────────────────────────────────

def create_token(email: str) -> str:
    payload = {"sub": email, "exp": time.time() + TOKEN_EXPIRE_SECONDS}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def _get_user_row(cur, email):
    """Returns RealDictRow with password_hash, provider, is_verified — or None."""
    cur.execute(
        "SELECT password_hash, provider, is_verified FROM users WHERE email = %s",
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
def signup(data: SignupRequest):
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if _get_user_row(cur, data.email):
                raise HTTPException(status_code=400, detail="Email already registered")

            password_hash      = pwd_context.hash(data.password[:72])
            verification_token = secrets.token_urlsafe(32)
            # If no email service configured, auto-verify so the app stays usable
            is_verified        = False if RESEND_API_KEY else True

            cur.execute(
                """INSERT INTO users
                   (email, password_hash, provider, created_at, is_verified, verification_token)
                   VALUES (%s, %s, 'local', %s, %s, %s)""",
                (data.email, password_hash, time.time(), is_verified, verification_token),
            )
        conn.commit()
    finally:
        conn.close()

    if RESEND_API_KEY:
        send_verification_email(data.email, verification_token)
        return {"message": "Account created! Check your email to verify your account."}

    # No email service — log them in immediately
    token = create_token(data.email)
    return {"access_token": token, "token_type": "bearer", "email": data.email}


@router.get("/verify/{token}", response_class=HTMLResponse)
def verify_email(token: str):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT email FROM users WHERE verification_token = %s AND is_verified = FALSE",
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

            cur.execute(
                "UPDATE users SET is_verified = TRUE, verification_token = NULL WHERE verification_token = %s",
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
def login(data: LoginRequest):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            row = _get_user_row(cur, data.email)
    finally:
        conn.close()

    if not row or row["provider"] != "local" or not row["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not pwd_context.verify(data.password[:72], row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not row["is_verified"]:
        raise HTTPException(status_code=403, detail="Please verify your email before logging in.")

    token = create_token(data.email)
    return {"access_token": token, "token_type": "bearer", "email": data.email}


@router.post("/google")
def google_login(data: GoogleLoginRequest):
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
            if not _get_user_row(cur, email):
                cur.execute(
                    """INSERT INTO users (email, password_hash, provider, created_at, is_verified)
                       VALUES (%s, NULL, 'google', %s, TRUE)""",
                    (email, time.time()),
                )
        conn.commit()
    finally:
        conn.close()

    # Google accounts are auto-verified — Google already confirmed the email
    token = create_token(email)
    return {"access_token": token, "token_type": "bearer", "email": email}


@router.get("/me")
def me(current_user: str = Depends(get_current_user)):
    return {"email": current_user}

# END