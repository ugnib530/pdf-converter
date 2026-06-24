"""
routers/to_pdf.py
Endpoints that convert other formats INTO a PDF.

  POST /tools/images-to-pdf   One or more images (JPG/PNG/GIF/WebP) → PDF
  POST /tools/word-to-pdf     Word document (.docx/.doc) → PDF
  POST /tools/excel-to-pdf    Excel spreadsheet (.xlsx/.xls) → PDF

SECURITY
  • File Ownership:   Every endpoint requires a valid JWT via
    get_current_user_id(). The returned user_id is passed into
    storage_response() so that all Supabase objects are namespaced under
    outputs/{user_id}/… and can never be accessed by another user.
  • Filename Sanitization: safe_download_name() strips unsafe characters
    from user-supplied filenames before they appear in Content-Disposition
    headers. The internal storage key is always a UUID.
  • MIME Validation: read_and_validate() checks magic bytes for both image
    and office file kinds — extension alone is not trusted.
"""
import logging
from pathlib import Path
from typing import List

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

from services.images_to_pdf import images_to_pdf
from services.office_to_pdf import office_to_pdf

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Images → PDF ──────────────────────────────────────────────────────────────
@router.post("/images-to-pdf")
@limiter.limit(DEFAULT_RATE_LIMIT)
async def images_to_pdf_endpoint(
    request: Request,
    files: List[UploadFile] = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """
    Combine one or more images (JPG, PNG, GIF, WebP) into a single PDF.
    Images are placed in the order they are uploaded.

    SECURITY — MIME Validation:
      Each image is validated against its magic bytes (not just the extension)
      before any processing begins.
    """
    if not files:
        raise api_error(400, "Please upload at least one image file.", "NO_FILES")

    image_paths = []
    out_path    = temp_path("pdf")

    try:
        for f in files:
            # Validate magic bytes for every image in the batch.
            content = await read_and_validate(f, kind="image")
            suffix  = Path((f.filename or "image.jpg").lower()).suffix.lstrip(".")
            p = temp_path(suffix or "jpg")
            p.write_bytes(content)
            image_paths.append(p)

        logger.info(
            "Images→PDF: %d file(s), user_id=%s",
            len(image_paths), user_id,
        )
        await images_to_pdf(image_paths, out_path)

        if not out_path.exists() or out_path.stat().st_size == 0:
            raise api_error(500, "Conversion produced an empty file.", "EMPTY_OUTPUT")

        # Use the first uploaded filename as the download stem.
        first_stem = safe_download_name(files[0].filename or "", fallback="images")
        return await storage_response(
            out_path,
            f"{first_stem}.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Images→PDF failed: %s", exc)
        raise api_error(500, "Conversion failed.", "CONVERSION_ERROR")
    finally:
        for p in image_paths:
            p.unlink(missing_ok=True)


# ── Word → PDF ────────────────────────────────────────────────────────────────
@router.post("/word-to-pdf")
@limiter.limit(HEAVY_RATE_LIMIT)
async def word_to_pdf(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """
    Convert a Word document (.docx or .doc) to PDF via headless LibreOffice.

    SECURITY — MIME Validation:
      The uploaded file must pass the office magic-byte check:
        .docx → ZIP magic (PK\\x03\\x04)
        .doc  → OLE2 magic (\\xD0\\xCF\\x11\\xE0)
    """
    content   = await read_and_validate(file, kind="office")
    suffix    = Path((file.filename or "document.docx").lower()).suffix
    if suffix not in {".docx", ".doc"}:
        raise api_error(
            400,
            "Please upload a Word document (.docx or .doc).",
            "UNSUPPORTED_FORMAT",
        )

    in_path  = temp_path(suffix.lstrip("."))
    out_path = temp_path("pdf")

    try:
        in_path.write_bytes(content)
        logger.info("Word→PDF: %s (%d bytes) user_id=%s", file.filename, len(content), user_id)

        await office_to_pdf(in_path, out_path)

        if not out_path.exists() or out_path.stat().st_size == 0:
            raise api_error(500, "Conversion produced an empty file.", "EMPTY_OUTPUT")

        stem = safe_download_name(file.filename or "", fallback="document")
        return await storage_response(
            out_path,
            f"{stem}.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except RuntimeError as exc:
        out_path.unlink(missing_ok=True)
        raise api_error(422, str(exc), "CONVERSION_ERROR")
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Word→PDF failed: %s", exc)
        raise api_error(500, "Conversion failed.", "CONVERSION_ERROR")
    finally:
        in_path.unlink(missing_ok=True)


# ── Excel → PDF ───────────────────────────────────────────────────────────────
@router.post("/excel-to-pdf")
@limiter.limit(HEAVY_RATE_LIMIT)
async def excel_to_pdf(
    request: Request,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """
    Convert an Excel spreadsheet (.xlsx or .xls) to PDF via headless LibreOffice.

    SECURITY — MIME Validation:
      The uploaded file must pass the office magic-byte check:
        .xlsx → ZIP magic (PK\\x03\\x04)
        .xls  → OLE2 magic (\\xD0\\xCF\\x11\\xE0)
    """
    content = await read_and_validate(file, kind="office")
    suffix  = Path((file.filename or "spreadsheet.xlsx").lower()).suffix
    if suffix not in {".xlsx", ".xls"}:
        raise api_error(
            400,
            "Please upload an Excel spreadsheet (.xlsx or .xls).",
            "UNSUPPORTED_FORMAT",
        )

    in_path  = temp_path(suffix.lstrip("."))
    out_path = temp_path("pdf")

    try:
        in_path.write_bytes(content)
        logger.info("Excel→PDF: %s (%d bytes) user_id=%s", file.filename, len(content), user_id)

        await office_to_pdf(in_path, out_path)

        if not out_path.exists() or out_path.stat().st_size == 0:
            raise api_error(500, "Conversion produced an empty file.", "EMPTY_OUTPUT")

        stem = safe_download_name(file.filename or "", fallback="spreadsheet")
        return await storage_response(
            out_path,
            f"{stem}.pdf",
            "application/pdf",
            user_id=user_id,
        )
    except RuntimeError as exc:
        out_path.unlink(missing_ok=True)
        raise api_error(422, str(exc), "CONVERSION_ERROR")
    except Exception as exc:
        out_path.unlink(missing_ok=True)
        if hasattr(exc, "status_code"):
            raise
        logger.error("Excel→PDF failed: %s", exc)
        raise api_error(500, "Conversion failed.", "CONVERSION_ERROR")
    finally:
        in_path.unlink(missing_ok=True)