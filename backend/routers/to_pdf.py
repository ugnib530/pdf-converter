"""
routers/to_pdf.py
Endpoints that produce a PDF (or PPTX) from other formats.

  POST /tools/images-to-pdf   JPG/PNG/WebP/GIF → PDF
  POST /tools/powerpoint      PDF → PPTX (page-as-image)

Phase 5 additions (office-to-PDF, served by api-office service):
  POST /tools/word-to-pdf
  POST /tools/excel-to-pdf
  POST /tools/powerpoint-to-pdf
  POST /tools/openoffice-to-pdf
  POST /tools/ebook-to-pdf
"""
import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from typing import List, Optional

from core.config import DEFAULT_RATE_LIMIT
from core.file_handling import read_and_validate, temp_path, api_error
from core.rate_limit import limiter

from services.images_to_pdf import images_to_pdf
from services.pdf_to_pptx   import pdf_to_pptx

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
        )
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Images→PDF failed: {exc}")
        raise api_error(500, f"Conversion failed: {exc}", "CONVERSION_ERROR")
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
        )
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"PDF→PPTX failed: {exc}")
        raise api_error(500, f"Conversion failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)
