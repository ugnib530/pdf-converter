"""
routers/to_pdf.py
Endpoints that produce a PDF (or PPTX) from other formats.

  POST /tools/images-to-pdf      JPG/PNG/WebP/GIF → PDF
  POST /tools/powerpoint         PDF → PPTX (page-as-image)
  POST /tools/word-to-pdf        DOCX/DOC → PDF (LibreOffice)
  POST /tools/excel-to-pdf       XLSX/XLS → PDF (LibreOffice)
  POST /tools/powerpoint-to-pdf  PPTX/PPT → PDF (LibreOffice)

Office→PDF runs in-process via headless LibreOffice (see
services/office_to_pdf.py) — no separate microservice required.
"""
import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from typing import List, Optional

from core.config import DEFAULT_RATE_LIMIT, HEAVY_RATE_LIMIT
from core.file_handling import read_and_validate, temp_path, api_error
from core.rate_limit import limiter

from services.images_to_pdf import images_to_pdf
from services.pdf_to_pptx   import pdf_to_pptx
from services.office_to_pdf import office_to_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Images → PDF ──────────────────────────────────────────────────────────────
@router.post("/images-to-pdf")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def images_to_pdf_endpoint(
    request: Request,
    files: List[UploadFile] = File(...),
):
    """
    Combine one or more images (JPG, PNG, WebP, GIF) into a single PDF.
    Images are placed in upload order, one per page.
    """
    if not files:
        raise api_error(400, "Please upload at least one image.", "NO_FILES")

    image_paths: list[Path] = []
    out_path = temp_path("pdf")

    try:
        for f in files:
            content = await read_and_validate(f, kind="image")
            suffix  = Path(f.filename or "img.jpg").suffix.lower() or ".jpg"
            p = temp_path(suffix.lstrip("."))
            p.write_bytes(content)
            image_paths.append(p)

        await images_to_pdf(image_paths, out_path)

        name = "image" if len(files) == 1 else f"{len(files)}_images"
        return FileResponse(
            path=str(out_path),
            media_type="application/pdf",
            filename=f"{name}.pdf",
            background=BackgroundTask(out_path.unlink, missing_ok=True),
        )
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Images→PDF failed: {exc}")
        raise api_error(500, "Conversion failed.", "CONVERSION_ERROR")
    finally:
        for p in image_paths:
            p.unlink(missing_ok=True)


# ── PDF → PowerPoint ──────────────────────────────────────────────────────────
@router.post("/powerpoint")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def pdf_to_powerpoint(
    request: Request,
    file: UploadFile = File(...),
    dpi: Optional[int] = Form(150),
):
    """
    Convert a PDF to a PowerPoint file.
    Each page is rendered as a full-bleed slide image at the specified DPI.
    Note: slides are images — text is not editable in the output.
    """
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pptx")

    try:
        pdf_path.write_bytes(content)
        await pdf_to_pptx(pdf_path, out_path, dpi=dpi or 150)

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(out_path),
            media_type=(
                "application/vnd.openxmlformats-officedocument"
                ".presentationml.presentation"
            ),
            filename=f"{stem}.pptx",
            background=BackgroundTask(out_path.unlink, missing_ok=True),
        )
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"PDF→PPTX failed: {exc}")
        raise api_error(500, "Conversion failed.", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Office → PDF (shared implementation) ──────────────────────────────────────
async def _office_to_pdf_endpoint(
    file: UploadFile,
    allowed_exts: set[str],
    label: str,
) -> FileResponse:
    """
    Shared body for word-to-pdf / excel-to-pdf / powerpoint-to-pdf.
    `allowed_exts` restricts what each specific tool will accept so users
    get a clear error instead of LibreOffice silently "converting" the
    wrong document type.
    """
    filename = file.filename or "document"
    suffix = Path(filename).suffix.lower()
    if suffix not in allowed_exts:
        raise api_error(
            400,
            f"Unsupported file type '{suffix}' for {label}. "
            f"Expected one of: {', '.join(sorted(allowed_exts))}",
            "UNSUPPORTED_FILE_TYPE",
        )

    content = await read_and_validate(file, kind="office")
    in_path  = temp_path(suffix.lstrip("."))
    out_path = temp_path("pdf")

    try:
        in_path.write_bytes(content)
        await office_to_pdf(in_path, out_path)

        stem = Path(filename).stem
        return FileResponse(
            path=str(out_path),
            media_type="application/pdf",
            filename=f"{stem}.pdf",
            background=BackgroundTask(out_path.unlink, missing_ok=True),
        )
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"{label} failed: {exc}")
        raise api_error(500, "Conversion failed.", "CONVERSION_ERROR")
    finally:
        in_path.unlink(missing_ok=True)


@router.post("/word-to-pdf")
@limiter.limit(HEAVY_RATE_LIMIT)
async def word_to_pdf(request: Request, file: UploadFile = File(...)):
    """Convert a Word document (.docx, .doc) to PDF."""
    return await _office_to_pdf_endpoint(file, {".docx", ".doc"}, "Word to PDF")


@router.post("/excel-to-pdf")
@limiter.limit(HEAVY_RATE_LIMIT)
async def excel_to_pdf(request: Request, file: UploadFile = File(...)):
    """Convert an Excel spreadsheet (.xlsx, .xls) to PDF."""
    return await _office_to_pdf_endpoint(file, {".xlsx", ".xls"}, "Excel to PDF")


@router.post("/powerpoint-to-pdf")
@limiter.limit(HEAVY_RATE_LIMIT)
async def powerpoint_to_pdf(request: Request, file: UploadFile = File(...)):
    """Convert a PowerPoint presentation (.pptx, .ppt) to PDF."""
    return await _office_to_pdf_endpoint(file, {".pptx", ".ppt"}, "PowerPoint to PDF")