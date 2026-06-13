"""
services/rotate.py
Rotates one or more pages in a PDF by 90 / 180 / 270 degrees.
Uses pypdf (pure Python, no system binaries).
"""
import asyncio
import logging
from pathlib import Path

from core.page_ranges import parse_page_ranges

logger = logging.getLogger(__name__)

VALID_ANGLES = {90, 180, 270}


def _do_rotate(pdf_path: Path, out_path: Path, angle: int, pages_str: str) -> None:
    from pypdf import PdfReader, PdfWriter

    if angle not in VALID_ANGLES:
        raise ValueError(f"Invalid rotation angle {angle}. Must be 90, 180, or 270.")

    reader      = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)

    # Which pages to rotate (0-indexed). Empty → rotate all.
    if pages_str.strip():
        to_rotate = set(parse_page_ranges(pages_str, total_pages))
    else:
        to_rotate = set(range(total_pages))

    writer = PdfWriter()
    for idx, page in enumerate(reader.pages):
        if idx in to_rotate:
            page.rotate(angle)
        writer.add_page(page)

    with open(str(out_path), "wb") as f:
        writer.write(f)

    writer.close()


async def rotate_pdf(pdf_path: Path, out_path: Path, angle: int, pages_str: str) -> None:
    """
    Rotate pages and write the result to `out_path`.

    Args:
        pdf_path:   Source PDF.
        out_path:   Destination PDF.
        angle:      90, 180, or 270 (clockwise degrees).
        pages_str:  Page range string, or "" to rotate all pages.
    """
    loop = asyncio.get_event_loop()
    target = pages_str.strip() or "all pages"
    logger.info(f"Rotating {target} by {angle}° in {pdf_path.name}")
    await loop.run_in_executor(None, _do_rotate, pdf_path, out_path, angle, pages_str)
    logger.info(f"Rotate complete: {out_path.stat().st_size:,} bytes")
