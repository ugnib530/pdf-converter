"""
routers/security.py
Endpoints that add or remove PDF security.

  POST /tools/protect   Add a password (AES-256)
  POST /tools/unlock    Remove a known password
  POST /tools/redact    Permanently black out text/areas

SECURITY
  • File Ownership:   Every endpoint requires a valid JWT via
    get_current_user_id(). The returned user_id is passed into
    storage_response() so that all Supabase objects are namespaced under
    outputs/{user_id}/… and can never be accessed by another user.
  • Filename Sanitization: safe_download_name() strips unsafe characters
    from user-supplied filenames before they appear in Content-Disposition
    headers. The internal storage key is always a UUID.
  • MIME Validation: read_and_validate(kind="pdf") checks the %PDF magic
    bytes in addition to the file extension.
"""
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from auth import get_current_user_id
from core.config import DEFAULT_RATE_LIMIT
from core.file_handling import (
    read_and_validate,
    temp_path,
    api_error,
    storage_response,
    safe_download_name,
)
from core.rate_limit import limiter

from services.protect import protect_pdf
from services.unlock  import unlock_pdf
from services.redact  import redact_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Protect ───────────────────────────────────────────────────────────────────
@router.post("/protect")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def protect(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(...),
    user_id: int = Depends(get_current_user_id),
):
    """
    Encrypt a PDF with AES-256 using the provided password.
    The document will require this password to open.
    """
    if not password.strip():
        raise api_error(400, "Password cannot be empty.", "EMPTY_PASSWORD")

    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await protect_pdf(pdf_path, out_path, password)

        stem = safe_download_name(file.filename or "", fallback="document")
        return await storage_response(
            out_path,
            f"{stem}_protected.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except ValueError as exc:
        out_path.unlink(missing_ok=True)
        raise api_error(422, str(exc), "PROTECT_ERROR")
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Protect failed: %s", exc)
        raise api_error(500, "Protection failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Unlock ────────────────────────────────────────────────────────────────────
@router.post("/unlock")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def unlock(
    request: Request,
    file: UploadFile = File(...),
    password: Optional[str] = Form(""),
    user_id: int = Depends(get_current_user_id),
):
    """
    Remove encryption from a PDF.
    Requires the current password if the file is encrypted.
    Cannot crack or brute-force unknown passwords.
    """
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await unlock_pdf(pdf_path, out_path, password or "")

        stem = safe_download_name(file.filename or "", fallback="document")
        return await storage_response(
            out_path,
            f"{stem}_unlocked.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except ValueError as exc:
        out_path.unlink(missing_ok=True)
        raise api_error(403, str(exc), "WRONG_PASSWORD")
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Unlock failed: %s", exc)
        raise api_error(500, "Unlock failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Redact ────────────────────────────────────────────────────────────────────
@router.post("/redact")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def redact(
    request: Request,
    file: UploadFile = File(...),
    terms: str = Form(...),
    user_id: int = Depends(get_current_user_id),
):
    """Permanently black out all occurrences of the specified terms."""
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await redact_pdf(pdf_path, out_path, terms)

        stem = safe_download_name(file.filename or "", fallback="document")
        return await storage_response(
            out_path,
            f"{stem}_redacted.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except ValueError as exc:
        out_path.unlink(missing_ok=True)
        raise api_error(422, str(exc), "NO_MATCHES_FOUND")
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Redact failed: %s", exc)
        raise api_error(500, "Redaction failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)