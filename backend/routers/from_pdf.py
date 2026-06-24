"""
routers/from_pdf.py
Endpoints that convert FROM a PDF into another format.

Phase 1 — migrated from legacy main.py:
  POST /tools/word          PDF → DOCX
  POST /tools/excel         PDF → XLSX (table extraction)
  POST /tools/upi-tracker   PDF bank statement → categorised XLSX (Gemini-powered)

Phase 2 additions (stubs below, uncomment when services are ready):
  POST /tools/powerpoint    PDF → PPTX (page-as-image approach)
  POST /tools/jpg           PDF → ZIP of JPEGs
  POST /tools/png           PDF → ZIP of PNGs
  POST /tools/extract-images PDF embedded images → ZIP

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

from fastapi import APIRouter, Depends, File, Request, UploadFile

from auth import get_current_user_id
from core.config import DEFAULT_RATE_LIMIT, HEAVY_RATE_LIMIT, GEMINI_API_KEY
from core.file_handling import (
    read_and_validate,
    temp_path,
    api_error,
    storage_response,
    safe_download_name,
)
from core.rate_limit import limiter

from services.pdf_to_word import convert_pdf_to_word
from services.pdf_to_excel import convert_pdf_to_excel
from services.upi_tracker import run_upi_tracker

logger = logging.getLogger(__name__)
router = APIRouter()


# ── PDF → Word ────────────────────────────────────────────────────────────────
@router.post("/word")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def pdf_to_word(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """Convert a PDF to an editable Word document (.docx)."""
    content   = await read_and_validate(file, kind="pdf")
    pdf_path  = temp_path("pdf")
    docx_path = temp_path("docx")

    try:
        pdf_path.write_bytes(content)
        logger.info("PDF→DOCX: %s (%d bytes) user_id=%s", file.filename, len(content), user_id)

        await convert_pdf_to_word(pdf_path, docx_path)

        if not docx_path.exists() or docx_path.stat().st_size == 0:
            raise api_error(500, "Conversion produced an empty file.", "EMPTY_OUTPUT")

        stem = safe_download_name(file.filename or "", fallback="output")
        return await storage_response(
            docx_path,
            f"{stem}.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            user_id=user_id,
        )
    except Exception as exc:
        docx_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("PDF→DOCX failed: %s", exc)
        raise api_error(500, "Conversion failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── PDF → Excel ───────────────────────────────────────────────────────────────
@router.post("/excel")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def pdf_to_excel(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """Extract tables from a PDF and place them in an Excel workbook (.xlsx)."""
    content   = await read_and_validate(file, kind="pdf")
    pdf_path  = temp_path("pdf")
    xlsx_path = temp_path("xlsx")

    try:
        pdf_path.write_bytes(content)
        logger.info("PDF→XLSX: %s (%d bytes) user_id=%s", file.filename, len(content), user_id)

        await convert_pdf_to_excel(pdf_path, xlsx_path)

        stem = safe_download_name(file.filename or "", fallback="output")
        return await storage_response(
            xlsx_path,
            f"{stem}.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            user_id=user_id,
        )
    except Exception as exc:
        xlsx_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("PDF→XLSX failed: %s", exc)
        raise api_error(500, "Conversion failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── UPI Tracker (AI-powered) ──────────────────────────────────────────────────
@router.post("/upi-tracker")
@limiter.limit(HEAVY_RATE_LIMIT)
async def upi_tracker(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """
    Parse a bank statement PDF and produce a categorised UPI spending Excel.
    Requires the GEMINI_API_KEY environment variable to be set.
    """
    if not GEMINI_API_KEY:
        raise api_error(503, "UPI Tracker is not configured on this server.", "SERVICE_UNAVAILABLE")

    content   = await read_and_validate(file, kind="pdf")
    pdf_path  = temp_path("pdf")
    xlsx_path = temp_path("xlsx")

    try:
        pdf_path.write_bytes(content)
        logger.info("UPI Tracker: %s (%d bytes) user_id=%s", file.filename, len(content), user_id)

        await run_upi_tracker(pdf_path, xlsx_path, content, GEMINI_API_KEY)

        stem = safe_download_name(file.filename or "", fallback="statement")
        return await storage_response(
            xlsx_path,
            f"{stem}_upi_spending.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            user_id=user_id,
        )
    except Exception as exc:
        xlsx_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("UPI Tracker failed: %s", exc)
        raise api_error(500, "Processing failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Phase 2 endpoints moved to routers/organize.py and routers/to_pdf.py ─────
# /tools/jpg, /tools/png, /tools/extract-images  → routers/organize.py
# /tools/powerpoint                               → routers/to_pdf.py