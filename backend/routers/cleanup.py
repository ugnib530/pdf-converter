"""
routers/cleanup.py
Endpoints that clean up, repair, or convert PDF structure.

  POST /tools/compress   Reduce file size via Ghostscript
  POST /tools/repair     Attempt to repair a damaged PDF
  POST /tools/flatten    Flatten form fields / annotations
  POST /tools/pdfa       Convert to PDF/A (archival format)
"""
import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile

from core.config import DEFAULT_RATE_LIMIT, HEAVY_RATE_LIMIT
from core.file_handling import read_and_validate, temp_path, api_error, storage_response
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

        stem = Path(file.filename or "document").stem
        return await storage_response(out_path, f"{stem}_compressed.pdf", "application/pdf")
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
async def repair(request: Request, file: UploadFile = File(...)):
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await repair_pdf(pdf_path, out_path)

        stem = Path(file.filename or "document").stem
        return await storage_response(out_path, f"{stem}_repaired.pdf", "application/pdf")
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
async def flatten(request: Request, file: UploadFile = File(...)):
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await flatten_pdf(pdf_path, out_path)

        stem = Path(file.filename or "document").stem
        return await storage_response(out_path, f"{stem}_flattened.pdf", "application/pdf")
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
async def to_pdfa(request: Request, file: UploadFile = File(...)):
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await pdf_to_pdfa(pdf_path, out_path)

        stem = Path(file.filename or "document").stem
        return await storage_response(out_path, f"{stem}_pdfa.pdf", "application/pdf")
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