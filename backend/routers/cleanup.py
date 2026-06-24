"""
routers/cleanup.py
Endpoints that clean up, repair, or convert PDF structure.

  POST /tools/compress   Reduce file size via Ghostscript
  POST /tools/repair     Attempt to repair a damaged PDF
  POST /tools/flatten    Flatten form fields / annotations
  POST /tools/pdfa       Convert to PDF/A (archival format)

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

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from auth import get_current_user_id
from core.config import DEFAULT_RATE_LIMIT, HEAVY_RATE_LIMIT
from core.file_handling import (
    read_and_validate,
    temp_path,
    api_error,
    storage_response,
    safe_download_name,
)
from core.rate_limit import limiter

from services.compress import compress_pdf, QUALITY_PRESETS
from services.repair   import repair_pdf
from services.flatten  import flatten_pdf
from services.pdfa     import pdf_to_pdfa

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/compress")
@limiter.limit(HEAVY_RATE_LIMIT)
async def compress(
    request: Request,
    file: UploadFile = File(...),
    quality: str = Form("ebook"),
    user_id: int = Depends(get_current_user_id),
):
    if quality not in QUALITY_PRESETS:
        raise api_error(
            400,
            f"Quality must be one of: {', '.join(QUALITY_PRESETS)}.",
            "INVALID_QUALITY",
        )
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await compress_pdf(pdf_path, out_path, quality)

        stem = safe_download_name(file.filename or "", fallback="document")
        return await storage_response(
            out_path,
            f"{stem}_compressed.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except ValueError as exc:
        out_path.unlink(missing_ok=True)
        raise api_error(422, str(exc), "INVALID_QUALITY")
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Compress failed: %s", exc)
        raise api_error(500, "Compression failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


@router.post("/repair")
@limiter.limit(HEAVY_RATE_LIMIT)
async def repair(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await repair_pdf(pdf_path, out_path)

        stem = safe_download_name(file.filename or "", fallback="document")
        return await storage_response(
            out_path,
            f"{stem}_repaired.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except ValueError as exc:
        out_path.unlink(missing_ok=True)
        raise api_error(422, str(exc), "UNREPAIRABLE")
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Repair failed: %s", exc)
        raise api_error(500, "Repair failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


@router.post("/flatten")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def flatten(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await flatten_pdf(pdf_path, out_path)

        stem = safe_download_name(file.filename or "", fallback="document")
        return await storage_response(
            out_path,
            f"{stem}_flattened.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Flatten failed: %s", exc)
        raise api_error(500, "Flatten failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


@router.post("/pdfa")
@limiter.limit(HEAVY_RATE_LIMIT)
async def to_pdfa(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await pdf_to_pdfa(pdf_path, out_path)

        stem = safe_download_name(file.filename or "", fallback="document")
        return await storage_response(
            out_path,
            f"{stem}_pdfa.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except RuntimeError as exc:
        out_path.unlink(missing_ok=True)
        raise api_error(503, str(exc), "PDFA_UNAVAILABLE")
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("PDF/A conversion failed: %s", exc)
        raise api_error(500, "PDF/A conversion failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)