"""
services/split.py
Splits a PDF into multiple PDFs and returns them as a ZIP.

Two modes:
  ranges_str = ""        → split every page into its own file  (page_1.pdf, page_2.pdf …)
  ranges_str = "1-3, 5" → extract those ranges as named chunks  (chunk_1-3.pdf, chunk_5.pdf …)

Uses pypdf (pure Python) + zipfile (stdlib).
"""
import asyncio
import logging
import zipfile
from io import BytesIO
from pathlib import Path

from core.page_ranges import parse_page_ranges

logger = logging.getLogger(__name__)


def _do_split(pdf_path: Path, zip_path: Path, ranges_str: str) -> int:
    """
    Returns the number of output files written into the ZIP.
    """
    from pypdf import PdfReader, PdfWriter

    reader      = PdfReader(str(pdf_path))
    total_pages = len(reader.pages)

    # Build a list of (label, [0-indexed page numbers]) chunks
    if not ranges_str.strip():
        # Split every page
        chunks = [(f"page_{i + 1}", [i]) for i in range(total_pages)]
    else:
        # Parse the ranges; each comma-separated part → one output file
        chunk_list = []
        for part in ranges_str.split(","):
            part = part.strip()
            if not part:
                continue
            indices = parse_page_ranges(part, total_pages)
            if indices:
                # Label: e.g. "pages_1-3" or "page_5"
                if len(indices) == 1:
                    label = f"page_{indices[0] + 1}"
                else:
                    label = f"pages_{indices[0] + 1}-{indices[-1] + 1}"
                chunk_list.append((label, indices))
        chunks = chunk_list

    if not chunks:
        raise ValueError("No valid page ranges produced any output files.")

    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
        for label, indices in chunks:
            writer = PdfWriter()
            for idx in indices:
                writer.add_page(reader.pages[idx])
            buf = BytesIO()
            writer.write(buf)
            writer.close()
            zf.writestr(f"{label}.pdf", buf.getvalue())

    return len(chunks)


async def split_pdf(pdf_path: Path, zip_path: Path, ranges_str: str) -> int:
    """
    Split a PDF and write the pieces into a ZIP file.

    Args:
        pdf_path:   Source PDF.
        zip_path:   Destination ZIP.
        ranges_str: Page ranges (e.g. "1-3, 5") or "" to split every page.

    Returns:
        Number of output files in the ZIP.
    """
    loop = asyncio.get_event_loop()
    logger.info(f"Splitting {pdf_path.name} with ranges='{ranges_str or 'every page'}'")
    count = await loop.run_in_executor(None, _do_split, pdf_path, zip_path, ranges_str)
    logger.info(f"Split complete: {count} file(s) → {zip_path.stat().st_size:,} bytes")
    return count
