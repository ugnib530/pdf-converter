"""
routers/security.py
Endpoints that add or remove PDF security.

  POST /tools/protect   Add a password (AES-256)
  POST /tools/unlock    Remove a known password

Phase 3 addition (stub below):
  POST /tools/redact    Permanently black out text/areas
"""
import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from typing import Optional

from core.config import DEFAULT_RATE_LIMIT
from core.file_handling import read_and_validate, temp_path, api_error
from core.rate_limit import limiter

from services.protect import protect_pdf
from services.unlock  import unlock_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Protect ───────────────────────────────────────────────────────────────────
@router.post("/protect")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def protect(
    request: Request,
    file: UploadFile = File(...),
    password: str = Form(...),
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

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(out_path),
            media_type="application/pdf",
            filename=f"{stem}_protected.pdf",
        )
    except ValueError as exc:
        raise api_error(422, str(exc), "PROTECT_ERROR")
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Protect failed: {exc}")
        raise api_error(500, f"Protection failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Unlock ────────────────────────────────────────────────────────────────────
@router.post("/unlock")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def unlock(
    request: Request,
    file: UploadFile = File(...),
    password: Optional[str] = Form(""),
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

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(out_path),
            media_type="application/pdf",
            filename=f"{stem}_unlocked.pdf",
        )
    except ValueError as exc:
        raise api_error(403, str(exc), "WRONG_PASSWORD")
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Unlock failed: {exc}")
        raise api_error(500, f"Unlock failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Redact (Phase 3 stub) ─────────────────────────────────────────────────────
# @router.post("/redact")
# @limiter.limit(DEFAULT_RATE_LIMIT)
# async def redact(
#     request: Request,
#     file: UploadFile = File(...),
#     terms: str = Form(...),   # comma-separated words/phrases to redact
# ):
#     """Permanently remove (not just visually cover) specified text from a PDF."""
#     from services.redact import redact_pdf
#     content = await read_and_validate(file, kind="pdf")
#     ...
