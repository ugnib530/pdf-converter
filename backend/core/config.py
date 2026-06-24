"""
core/config.py
Centralised settings — read from environment variables where possible
so nothing is hard-coded between dev / Railway / prod.
"""
import os
from pathlib import Path

# ── Temp storage (used ONLY during active processing, not for persistence) ────
# Output files are uploaded to Supabase Storage immediately after conversion
# and deleted from disk — this directory is only for in-flight work.
TEMP_DIR = Path(os.environ.get("TEMP_DIR", "/tmp/docshift"))
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# ── File limits ───────────────────────────────────────────────────────────────
MAX_FILE_SIZE_MB: int = int(os.environ.get("MAX_FILE_SIZE_MB", "50"))
MAX_FILE_SIZE_BYTES: int = MAX_FILE_SIZE_MB * 1024 * 1024

# ── Cleanup ───────────────────────────────────────────────────────────────────
# How long (seconds) before a temp file / Supabase object is eligible for deletion.
CLEANUP_AFTER_SECONDS: int = int(os.environ.get("CLEANUP_AFTER_SECONDS", "300"))

# ── CORS ──────────────────────────────────────────────────────────────────────
# Comma-separated list in the env var, e.g.:
#   ALLOWED_ORIGINS=https://docshift.vercel.app,https://docshift.io
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: list[str] = (
    ["*"] if _raw_origins.strip() == "*"
    else [o.strip() for o in _raw_origins.split(",") if o.strip()]
)

# ── Rate limits ───────────────────────────────────────────────────────────────
# Expressed as slowapi limit strings, e.g. "10/minute"
DEFAULT_RATE_LIMIT: str = os.environ.get("DEFAULT_RATE_LIMIT", "10/minute")
HEAVY_RATE_LIMIT: str = os.environ.get("HEAVY_RATE_LIMIT", "5/minute")

# ── External services ─────────────────────────────────────────────────────────
GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")

# ── Second API base (office-to-PDF service, Phase 5) ─────────────────────────
# Leave empty until api-office is deployed.
API_OFFICE_URL: str = os.environ.get("API_OFFICE_URL", "")

# ── Ghostscript / qpdf / LibreOffice binary paths ────────────────────────────
# Override if binaries are not on PATH (unlikely on Railway/Docker, but handy locally).
GS_BIN: str = os.environ.get("GS_BIN", "gs")
QPDF_BIN: str = os.environ.get("QPDF_BIN", "qpdf")
SOFFICE_BIN: str = os.environ.get("SOFFICE_BIN", "soffice")

# Max concurrent LibreOffice conversions. LibreOffice is heavy (its own
# process + a user profile) and a free-tier dyno doesn't have much RAM —
# keep this at 1 unless you know you have headroom.
OFFICE_CONVERSION_CONCURRENCY: int = int(
    os.environ.get("OFFICE_CONVERSION_CONCURRENCY", "1")
)

_ICC_CANDIDATES = [
    os.environ.get("ICC_PROFILE_PATH", ""),
    "/usr/share/color/icc/ghostscript/default_rgb.icc",
    "/usr/share/ghostscript/icc/srgb.icc",
    "/usr/local/share/ghostscript/iccprofiles/srgb.icc",
]
ICC_PROFILE_PATH: str = next((p for p in _ICC_CANDIDATES if p and Path(p).is_file()), "")

# ── Supabase Storage ──────────────────────────────────────────────────────────
# Required in production. When unset, output files fall back to being served
# directly from local disk (fine for local dev, NOT safe for production).
#
#   SUPABASE_URL              — e.g. https://<project>.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY — service-role JWT (never expose to clients)
#   SUPABASE_STORAGE_BUCKET   — bucket name, default "pdf-outputs"
#
# The bucket must exist in your Supabase project before deployment.
# Run:  supabase storage create-bucket pdf-outputs --public=false
SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_STORAGE_BUCKET: str = os.environ.get("SUPABASE_STORAGE_BUCKET", "pdf-outputs")