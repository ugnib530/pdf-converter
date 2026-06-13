"""
routers/organize.py
Endpoints that reorganise or transform the structure of a PDF.

  POST /tools/merge           Combine multiple PDFs into one
  POST /tools/split           Split a PDF into pieces (ZIP)
  POST /tools/delete-pages    Remove specific pages
  POST /tools/rotate          Rotate one or all pages
  POST /tools/extract-images  Pull embedded images out (ZIP)
  POST /tools/jpg             Render pages as JPEGs (ZIP or single image)
  POST /tools/png             Render pages as PNGs  (ZIP or single image)
"""
import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from typing import List, Optional

from core.config import DEFAULT_RATE_LIMIT
from core.file_handling import read_and_validate, temp_path, api_error
from core.rate_limit import limiter

from services.merge          import merge_pdfs
from services.split          import split_pdf
from services.delete_pages   import delete_pages
from services.rotate         import rotate_pdf
from services.extract_images import extract_pdf_images
from services.pdf_to_images  import pdf_to_images

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Merge ─────────────────────────────────────────────────────────────────────
@router.post("/merge")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def merge(request: Request, files: List[UploadFile] = File(...)):
    """Combine multiple PDF files into one, in upload order."""
    if len(files) < 2:
        raise api_error(400, "Please upload at least 2 PDF files to merge.", "TOO_FEW_FILES")

    pdf_paths = []
    out_path  = temp_path("pdf")

    try:
        for f in files:
            content = await read_and_validate(f, kind="pdf")
            p = temp_path("pdf")
            p.write_bytes(content)
            pdf_paths.append(p)

        await merge_pdfs(pdf_paths, out_path)

        return FileResponse(
            path=str(out_path),
            media_type="application/pdf",
            filename="merged.pdf",
        )
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Merge failed: {exc}")
        raise api_error(500, f"Merge failed: {exc}", "CONVERSION_ERROR")
    finally:
        for p in pdf_paths:
            p.unlink(missing_ok=True)


# ── Split ─────────────────────────────────────────────────────────────────────
@router.post("/split")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def split(
    request: Request,
    file: UploadFile = File(...),
    ranges: Optional[str] = Form(""),
):
    """
    Split a PDF by page ranges (e.g. '1-3, 5, 7-') or every page if blank.
    Returns a ZIP containing one PDF per chunk.
    """
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    zip_path = temp_path("zip")

    try:
        pdf_path.write_bytes(content)
        count = await split_pdf(pdf_path, zip_path, ranges or "")

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(zip_path),
            media_type="application/zip",
            filename=f"{stem}_split_{count}parts.zip",
        )
    except ValueError as exc:
        raise api_error(422, str(exc), "INVALID_PAGE_RANGE")
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Split failed: {exc}")
        raise api_error(500, f"Split failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Delete pages ──────────────────────────────────────────────────────────────
@router.post("/delete-pages")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def delete_pages_endpoint(
    request: Request,
    file: UploadFile = File(...),
    pages: str = Form(...),
):
    """Remove the specified pages from a PDF. At least one page must remain."""
    if not pages.strip():
        raise api_error(400, "Please specify which pages to delete.", "MISSING_PAGES")

    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await delete_pages(pdf_path, out_path, pages)

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(out_path),
            media_type="application/pdf",
            filename=f"{stem}_edited.pdf",
        )
    except ValueError as exc:
        raise api_error(422, str(exc), "INVALID_PAGE_RANGE")
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Delete pages failed: {exc}")
        raise api_error(500, f"Delete pages failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Rotate ────────────────────────────────────────────────────────────────────
@router.post("/rotate")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def rotate(
    request: Request,
    file: UploadFile = File(...),
    angle: int = Form(90),
    pages: Optional[str] = Form(""),
):
    """Rotate one or all pages by 90, 180, or 270 degrees."""
    if angle not in (90, 180, 270):
        raise api_error(400, "Angle must be 90, 180, or 270.", "INVALID_ANGLE")

    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    out_path = temp_path("pdf")

    try:
        pdf_path.write_bytes(content)
        await rotate_pdf(pdf_path, out_path, angle, pages or "")

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(out_path),
            media_type="application/pdf",
            filename=f"{stem}_rotated.pdf",
        )
    except ValueError as exc:
        raise api_error(422, str(exc), "INVALID_PAGE_RANGE")
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Rotate failed: {exc}")
        raise api_error(500, f"Rotate failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── Extract embedded images ───────────────────────────────────────────────────
@router.post("/extract-images")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def extract_images(request: Request, file: UploadFile = File(...)):
    """Extract all images embedded inside a PDF and return them as a ZIP."""
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    zip_path = temp_path("zip")

    try:
        pdf_path.write_bytes(content)
        count = await extract_pdf_images(pdf_path, zip_path)

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(zip_path),
            media_type="application/zip",
            filename=f"{stem}_images_{count}.zip",
        )
    except ValueError as exc:
        raise api_error(422, str(exc), "NO_IMAGES_FOUND")
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"Extract images failed: {exc}")
        raise api_error(500, f"Extraction failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── PDF → JPG ─────────────────────────────────────────────────────────────────
@router.post("/jpg")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def pdf_to_jpg(
    request: Request,
    file: UploadFile = File(...),
    dpi: int = Form(150),
):
    """
    Render each PDF page as a JPEG.
    Single-page PDF → direct .jpg download.
    Multi-page PDF  → ZIP of numbered .jpg files.
    """
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    zip_path = temp_path("zip")

    try:
        pdf_path.write_bytes(content)
        count = await pdf_to_images(pdf_path, zip_path, fmt="jpg", dpi=dpi)

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(zip_path),
            media_type="application/zip",
            filename=f"{stem}_images.zip",
        )
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"PDF→JPG failed: {exc}")
        raise api_error(500, f"Conversion failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)


# ── PDF → PNG ─────────────────────────────────────────────────────────────────
@router.post("/png")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def pdf_to_png(
    request: Request,
    file: UploadFile = File(...),
    dpi: int = Form(150),
):
    """
    Render each PDF page as a PNG.
    Single-page PDF → direct .png download.
    Multi-page PDF  → ZIP of numbered .png files.
    """
    content  = await read_and_validate(file, kind="pdf")
    pdf_path = temp_path("pdf")
    zip_path = temp_path("zip")

    try:
        pdf_path.write_bytes(content)
        count = await pdf_to_images(pdf_path, zip_path, fmt="png", dpi=dpi)

        stem = Path(file.filename or "document").stem
        return FileResponse(
            path=str(zip_path),
            media_type="application/zip",
            filename=f"{stem}_images.zip",
        )
    except Exception as exc:
        if hasattr(exc, "status_code"):
            raise
        logger.error(f"PDF→PNG failed: {exc}")
        raise api_error(500, f"Conversion failed: {exc}", "CONVERSION_ERROR")
    finally:
        pdf_path.unlink(missing_ok=True)
