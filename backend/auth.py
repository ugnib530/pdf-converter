"""
auth.py — drop into backend/ (next to main.py)

Adds:
  POST /auth/signup    (email + password)
  POST /auth/login     (email + password)
  POST /auth/google    (Google Sign-In ID token)
  GET  /auth/me        (requires Bearer token)
"""

import os
import sqlite3
import time

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

SECRET_KEY = os.environ.get("JWT_SECRET", "dev-secret-change-me")
ALGORITHM = "HS256"
TOKEN_EXPIRE_SECONDS = 60 * 60 * 24 * 7  # 7 days

# Set this to your Google OAuth Client ID (same value used on the frontend)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

DB_PATH = os.environ.get("AUTH_DB_PATH", "users.db")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

router = APIRouter(prefix="/auth", tags=["auth"])


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            provider TEXT NOT NULL DEFAULT 'local',
            created_at REAL
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str  # ID token returned by Google's Sign-In button


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
        "SELECT password_hash, provider FROM users WHERE email = ?", (email,)
    ).fetchone()


@router.post("/signup")
def signup(data: SignupRequest):
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    conn = sqlite3.connect(DB_PATH)
    if _get_user_row(conn, data.email):
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = pwd_context.hash(data.password)
    conn.execute(
        "INSERT INTO users (email, password_hash, provider, created_at) VALUES (?, ?, 'local', ?)",
        (data.email, password_hash, time.time()),
    )
    conn.commit()
    conn.close()

    token = create_token(data.email)
    return {"access_token": token, "token_type": "bearer", "email": data.email}


@router.post("/login")
def login(data: LoginRequest):
    conn = sqlite3.connect(DB_PATH)
    row = _get_user_row(conn, data.email)
    conn.close()

    if not row or row[1] != "local" or not row[0] or not pwd_context.verify(data.password, row[0]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

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
            "INSERT INTO users (email, password_hash, provider, created_at) VALUES (?, NULL, 'google', ?)",
            (email, time.time()),
        )
        conn.commit()
    conn.close()

    token = create_token(email)
    return {"access_token": token, "token_type": "bearer", "email": email}


@router.get("/me")
def me(current_user: str = Depends(get_current_user)):
    return {"email": current_user}