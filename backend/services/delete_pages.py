"""
services/delete_pages.py
Removes specific pages from a PDF and returns the remainder.
Uses pypdf (pure Python, no system binaries).
"""
import asyncio
import logging
from pathlib import Path

from core.page_ranges import parse_page_ranges, invert_pages

logger = logging.getLogger(__name__)


def _do_delete(pdf_path: Path, out_path: Path, pages_str: str) -> int:
    """
    Returns the number of pages remaining after deletion.
    Raises ValueError if all pages would be deleted.
    """
    from pypdf import PdfReader, PdfWriter

    reader      = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)

    to_delete = parse_page_ranges(pages_str, total_pages)
    to_keep   = invert_pages(to_delete, total_pages)

    if not to_keep:
        raise ValueError(
            "Deleting those pages would leave an empty document. "
            "At least one page must remain."
        )

    writer = PdfWriter()
    for idx in to_keep:
        writer.add_page(reader.pages[idx])

    with open(str(out_path), "wb") as f:
        writer.write(f)

    writer.close()
    return len(to_keep)


async def delete_pages(pdf_path: Path, out_path: Path, pages_str: str) -> int:
    """
    Delete pages specified by `pages_str` and write the result to `out_path`.

    Args:
        pdf_path:   Source PDF.
        out_path:   Destination PDF (pages removed).
        pages_str:  Human-readable page list, e.g. "2, 4-6".

    Returns:
        Number of pages in the output document.
    """
    loop = asyncio.get_event_loop()
    logger.info(f"Deleting pages '{pages_str}' from {pdf_path.name}")
    remaining = await loop.run_in_executor(None, _do_delete, pdf_path, out_path, pages_str)
    logger.info(f"Delete complete: {remaining} page(s) remain → {out_path.stat().st_size:,} bytes")
    return remaining
