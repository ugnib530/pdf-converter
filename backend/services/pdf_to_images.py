"""
services/pdf_to_images.py
Renders each page of a PDF as a raster image (JPEG or PNG)
and returns the results in a ZIP archive.  Uses PyMuPDF (fitz).

Single-page PDFs: the ZIP still contains one file for a consistent
API contract — the router returns it as a direct image download instead.
"""
import asyncio
import logging
import zipfile
from io import BytesIO
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

ImageFormat = Literal["jpg", "png"]


def _do_render(
    pdf_path: Path,
    zip_path: Path,
    fmt: ImageFormat,
    dpi: int,
) -> int:
    """Returns the number of pages rendered."""
    import fitz  # PyMuPDF

    doc   = fitz.open(str(pdf_path))
    pages = len(doc)
    mat   = fitz.Matrix(dpi / 72, dpi / 72)   # 72 dpi is fitz's default

    colorspace = fitz.csRGB
    pix_kwargs  = {}

    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
        for page_num in range(pages):
            page = doc.load_page(page_num)
            pix  = page.get_pixmap(matrix=mat, colorspace=colorspace, alpha=False)

            if fmt == "jpg":
                img_bytes = pix.tobytes("jpeg", jpg_quality=92)
                filename  = f"page_{page_num + 1:04d}.jpg"
            else:
                img_bytes = pix.tobytes("png")
                filename  = f"page_{page_num + 1:04d}.png"

            zf.writestr(filename, img_bytes)

    doc.close()
    return pages


async def pdf_to_images(
    pdf_path: Path,
    zip_path: Path,
    fmt: ImageFormat = "jpg",
    dpi: int = 150,
) -> int:
    """
    Render PDF pages as images and write them to a ZIP.

    Args:
        pdf_path:  Source PDF.
        zip_path:  Destination ZIP.
        fmt:       "jpg" or "png".
        dpi:       Render resolution (72 / 150 / 300).

    Returns:
        Number of pages (= number of images) in the ZIP.
    """
    if dpi not in (72, 150, 300):
        dpi = 150   # safe fallback

    loop = asyncio.get_event_loop()
    logger.info(f"Rendering {pdf_path.name} as {fmt.upper()} at {dpi} DPI")
    count = await loop.run_in_executor(None, _do_render, pdf_path, zip_path, fmt, dpi)
    logger.info(f"Render complete: {count} page(s) → {zip_path.stat().st_size:,} bytes")
    return count
