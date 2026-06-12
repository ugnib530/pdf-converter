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
"""
import logging
import os
from pathlib import Path

from fastapi import APIRouter, File, Request, UploadFile
from fastapi.responses import FileResponse

from core.config import DEFAULT_RATE_LIMIT, HEAVY_RATE_LIMIT, GEMINI_API_KEY
from core.file_handling import read_and_validate, temp_path, api_error
from core.rate_limit import limiter

from services.pdf_to_word import convert_pdf_to_word
from services.pdf_to_excel import convert_pdf_to_excel
from services.upi_tracker import run_upi_tracker

logger = logging.getLogger(__name__)
router = APIRouter()


# ── PDF → Word ────────────────────────────────────────────────────────────────
@router.post("/word")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def pdf_to_word(request: Request, file: UploadFile = File(...)):
    """Convert a PDF to an editable Word document (.docx)."""
    content = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    docx_path = temp_path("docx")

    try:
        pdf_path.write_bytes(content)
        logger.info(f"PDF→DOCX: {file.filename} ({len(content):,} bytes)")

        await convert_pdf_to_word(pdf_path, docx_path)

        if not docx_path.exists() or docx_path.stat().st_size == 0:
            raise api_error(500, "Conversion produced an empty file.", "EMPTY_OUTPUT")

        stem = Path(file.filename or "output").stem
        return FileResponse(
            path=str(docx_path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"{stem}.docx",
        )
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"PDF→DOCX failed: {exc}")
        raise api_error(500, f"Conversion failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── PDF → Excel ───────────────────────────────────────────────────────────────
@router.post("/excel")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def pdf_to_excel(request: Request, file: UploadFile = File(...)):
    """Extract tables from a PDF and place them in an Excel workbook (.xlsx)."""
    content = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    xlsx_path = temp_path("xlsx")

    try:
        pdf_path.write_bytes(content)
        logger.info(f"PDF→XLSX: {file.filename} ({len(content):,} bytes)")

        await convert_pdf_to_excel(pdf_path, xlsx_path)

        stem = Path(file.filename or "output").stem
        return FileResponse(
            path=str(xlsx_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{stem}.xlsx",
        )
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"PDF→XLSX failed: {exc}")
        raise api_error(500, f"Conversion failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── UPI Tracker (AI-powered) ──────────────────────────────────────────────────
@router.post("/upi-tracker")
@limiter.limit(HEAVY_RATE_LIMIT)
async def upi_tracker(request: Request, file: UploadFile = File(...)):
    """
    Parse a bank statement PDF and produce a categorised UPI spending Excel.
    Requires the GEMINI_API_KEY environment variable to be set.
    """
    if not GEMINI_API_KEY:
        raise api_error(503, "UPI Tracker is not configured on this server.", "SERVICE_UNAVAILABLE")

    content = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    xlsx_path = temp_path("xlsx")

    try:
        pdf_path.write_bytes(content)
        logger.info(f"UPI Tracker: {file.filename} ({len(content):,} bytes)")

        await run_upi_tracker(pdf_path, xlsx_path, content, GEMINI_API_KEY)

        stem = Path(file.filename or "statement").stem
        return FileResponse(
            path=str(xlsx_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{stem}_upi_spending.xlsx",
        )
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"UPI Tracker failed: {exc}")
        raise api_error(500, f"Processing failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Phase 2 stubs (uncomment + wire service when ready) ──────────────────────

# @router.post("/powerpoint")
# @limiter.limit(DEFAULT_RATE_LIMIT)
# async def pdf_to_powerpoint(request: Request, file: UploadFile = File(...)):
#     """Render each PDF page as a slide image in a PPTX file."""
#     from services.pdf_to_pptx import convert_pdf_to_pptx
#     content = await read_and_validate(file, kind="pdf")
#     ...

# @router.post("/jpg")
# @limiter.limit(DEFAULT_RATE_LIMIT)
# async def pdf_to_jpg(request: Request, file: UploadFile = File(...)):
#     """Render each PDF page as a JPEG; returns a ZIP for multi-page docs."""
#     from services.pdf_to_images import convert_pdf_to_images
#     content = await read_and_validate(file, kind="pdf")
#     ...

# @router.post("/png")
# @limiter.limit(DEFAULT_RATE_LIMIT)
# async def pdf_to_png(request: Request, file: UploadFile = File(...)):
#     """Render each PDF page as a PNG; returns a ZIP for multi-page docs."""
#     from services.pdf_to_images import convert_pdf_to_images
#     content = await read_and_validate(file, kind="pdf")
#     ...

# @router.post("/extract-images")
# @limiter.limit(DEFAULT_RATE_LIMIT)
# async def extract_images(request: Request, file: UploadFile = File(...)):
#     """Extract images embedded in the PDF and return them as a ZIP."""
#     from services.extract_images import extract_pdf_images
#     content = await read_and_validate(file, kind="pdf")
#     ...
