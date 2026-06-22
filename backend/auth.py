"""
auth.py — drop into backend/ (next to main.py)

Adds:
  POST /auth/signup         (email + password → sends verification email)
  GET  /auth/verify/{token} (click link in email to verify account)
  POST /auth/login          (email + password, must be verified)
  POST /auth/google         (Google Sign-In — auto-verified, no email needed)
  GET  /auth/me             (requires Bearer token)

Env vars needed:
  AUTH_DB_PATH      path to sqlite db          (default: users.db)
  JWT_SECRET        secret for signing tokens   (default: dev-secret-change-me)
  GOOGLE_CLIENT_ID  your Google OAuth client ID (optional)
  RESEND_API_KEY    your Resend API key         (optional — skips email if not set)
  APP_URL           your frontend URL           (e.g. https://pdf-converter-eight-rouge.vercel.app)
  BACKEND_URL       your backend URL            (e.g. https://pdf-converter-production-a181.up.railway.app)
  FROM_EMAIL        verified sender address     (e.g. noreply@yourdomain.com)
"""

import os
import secrets
import sqlite3
import time

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

SECRET_KEY      = os.environ.get("JWT_SECRET", "dev-secret-change-me")
ALGORITHM       = "HS256"
TOKEN_EXPIRE_SECONDS = 60 * 60 * 24 * 7  # 7 days

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
DB_PATH          = os.environ.get("AUTH_DB_PATH", "users.db")
RESEND_API_KEY   = os.environ.get("RESEND_API_KEY", "")
APP_URL          = os.environ.get("APP_URL", "http://localhost:5173")
BACKEND_URL      = os.environ.get("BACKEND_URL", "http://localhost:8000")
FROM_EMAIL       = os.environ.get("FROM_EMAIL", "noreply@docshift.app")

pwd_context   = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
router        = APIRouter(prefix="/auth", tags=["auth"])


# ── DB setup ──────────────────────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            email               TEXT UNIQUE NOT NULL,
            password_hash       TEXT,
            provider            TEXT NOT NULL DEFAULT 'local',
            created_at          REAL,
            is_verified         INTEGER DEFAULT 0,
            verification_token  TEXT
        )
    """)
    # Safe migration for databases created before verification was added
    for col, definition in [
        ("is_verified",        "INTEGER DEFAULT 0"),
        ("verification_token", "TEXT"),
    ]:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col} {definition}")
        except sqlite3.OperationalError:
            pass  # column already exists
    conn.commit()
    conn.close()


init_db()


import logging
logger = logging.getLogger(__name__)

# ── Email ─────────────────────────────────────────────────────────────────────

def send_verification_email(email: str, token: str):
    """Send a verification link via Resend."""
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping verification email")
        return

    # Uses BACKEND_URL (not APP_URL) because this link must hit the backend API,
    # not the frontend. Set BACKEND_URL in your environment to match wherever
    # this server is deployed (e.g. https://pdf-converter-production-a181.up.railway.app).
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


def _get_user_row(conn, email):
    return conn.execute(
        "SELECT password_hash, provider, is_verified FROM users WHERE email = ?", (email,)
    ).fetchone()


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

    conn = sqlite3.connect(DB_PATH)

    if _get_user_row(conn, data.email):
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash       = pwd_context.hash(data.password[:72])
    verification_token  = secrets.token_urlsafe(32)
    # If no email service is configured, auto-verify so the app stays usable
    is_verified         = 0 if RESEND_API_KEY else 1

    conn.execute(
        """INSERT INTO users
           (email, password_hash, provider, created_at, is_verified, verification_token)
           VALUES (?, ?, 'local', ?, ?, ?)""",
        (data.email, password_hash, time.time(), is_verified, verification_token),
    )
    conn.commit()
    conn.close()

    if RESEND_API_KEY:
        send_verification_email(data.email, verification_token)
        return {"message": "Account created! Check your email to verify your account."}

    # No email service — log them in immediately
    token = create_token(data.email)
    return {"access_token": token, "token_type": "bearer", "email": data.email}


@router.get("/verify/{token}", response_class=HTMLResponse)
def verify_email(token: str):
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT email FROM users WHERE verification_token = ? AND is_verified = 0", (token,)
    ).fetchone()

    if not row:
        conn.close()
        return HTMLResponse(f"""
            <html><body style="font-family:sans-serif;text-align:center;padding:60px">
              <h2>&#10060; Invalid or already used link</h2>
              <p>This verification link is invalid or your account is already verified.</p>
              <a href="{APP_URL}/login">Go to login</a>
            </body></html>
        """, status_code=400)

    conn.execute(
        "UPDATE users SET is_verified = 1, verification_token = NULL WHERE verification_token = ?",
        (token,),
    )
    conn.commit()
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
    conn = sqlite3.connect(DB_PATH)
    row = _get_user_row(conn, data.email)
    conn.close()

    if not row or row[1] != "local" or not row[0] or not pwd_context.verify(data.password[:72], row[0]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not row[2]:  # is_verified
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

    conn = sqlite3.connect(DB_PATH)
    if not _get_user_row(conn, email):
        conn.execute(
            """INSERT INTO users (email, password_hash, provider, created_at, is_verified)
               VALUES (?, NULL, 'google', ?, 1)""",
            (email, time.time()),
        )
        conn.commit()
    conn.close()

    # Google accounts are auto-verified — Google already confirmed the email
    token = create_token(email)
    return {"access_token": token, "token_type": "bearer", "email": email}


@router.get("/me")
def me(current_user: str = Depends(get_current_user)):
    return {"email": current_user}

# END