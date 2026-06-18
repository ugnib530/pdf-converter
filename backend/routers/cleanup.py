import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse

from core.config import DEFAULT_RATE_LIMIT, HEAVY_RATE_LIMIT
from core.file_handling import read_and_validate, temp_path, api_error
from core.rate_limit import limiter

from services.compress import compress_pdf, QUALITY_PRESETS
from services.repair import repair_pdf
from services.flatten import flatten_pdf
from services.pdfa import pdf_to_pdfa

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/compress")
@limiter.limit(HEAVY_RATE_LIMIT)
async def compress(request: Request, file: UploadFile = File(...), quality: str = Form("ebook")):
    if quality not in QUALITY_PRESETS:
        raise api_error(400, f"Quality must be one of: {', '.join(QUALITY_PRESETS)}.", "INVALID_QUALITY")
    content = await read_and_validate(file, kind="pdf")
    pdf_path, out_path = temp_path("pdf"), temp_path("pdf")
    try:
        pdf_path.write_bytes(content)
        await compress_pdf(pdf_path, out_path, quality)
        stem = Path(file.filename or "document").stem
        return FileResponse(path=str(out_path), media_type="application/pdf", filename=f"{stem}_compressed.pdf")
    except ValueError as exc:
        raise api_error(422, str(exc), "INVALID_QUALITY")
    except Exception as exc:
        if hasattr(exc, "status_code"): raise
        raise api_error(500, f"Compression failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


@router.post("/repair")
@limiter.limit(HEAVY_RATE_LIMIT)
async def repair(request: Request, file: UploadFile = File(...)):
    content = await read_and_validate(file, kind="pdf")
    pdf_path, out_path = temp_path("pdf"), temp_path("pdf")
    try:
        pdf_path.write_bytes(content)
        await repair_pdf(pdf_path, out_path)
        stem = Path(file.filename or "document").stem
        return FileResponse(path=str(out_path), media_type="application/pdf", filename=f"{stem}_repaired.pdf")
    except ValueError as exc:
        raise api_error(422, str(exc), "UNREPAIRABLE")
    except Exception as exc:
        if hasattr(exc, "status_code"): raise
        raise api_error(500, f"Repair failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


@router.post("/flatten")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def flatten(request: Request, file: UploadFile = File(...)):
    content = await read_and_validate(file, kind="pdf")
    pdf_path, out_path = temp_path("pdf"), temp_path("pdf")
    try:
        pdf_path.write_bytes(content)
        await flatten_pdf(pdf_path, out_path)
        stem = Path(file.filename or "document").stem
        return FileResponse(path=str(out_path), media_type="application/pdf", filename=f"{stem}_flattened.pdf")
    except Exception as exc:
        if hasattr(exc, "status_code"): raise
        raise api_error(500, f"Flatten failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


@router.post("/pdfa")
@limiter.limit(HEAVY_RATE_LIMIT)
async def to_pdfa(request: Request, file: UploadFile = File(...)):
    content = await read_and_validate(file, kind="pdf")
    pdf_path, out_path = temp_path("pdf"), temp_path("pdf")
    try:
        pdf_path.write_bytes(content)
        await pdf_to_pdfa(pdf_path, out_path)
        stem = Path(file.filename or "document").stem
        return FileResponse(path=str(out_path), media_type="application/pdf", filename=f"{stem}_pdfa.pdf")
    except RuntimeError as exc:
        raise api_error(503, str(exc), "PDFA_UNAVAILABLE")
    except Exception as exc:
        if hasattr(exc, "status_code"): raise
        raise api_error(500, f"PDF/A conversion failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)