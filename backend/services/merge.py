"""
services/merge.py
Merges multiple PDF files into one, preserving page order.
Uses pypdf (pure Python, no system binaries).
"""
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _do_merge(pdf_paths: list[Path], out_path: Path) -> None:
    from pypdf import PdfWriter

    writer = PdfWriter()
    for path in pdf_paths:
        writer.append(str(path))

    with open(str(out_path), "wb") as f:
        writer.write(f)

    writer.close()


async def merge_pdfs(pdf_paths: list[Path], out_path: Path) -> None:
    """
    Merge the PDFs at `pdf_paths` (in order) into a single PDF at `out_path`.

    Args:
        pdf_paths: Ordered list of source PDF paths (must already exist on disk).
        out_path:  Destination path for the merged PDF.
    """
    loop = asyncio.get_event_loop()
    total = sum(p.stat().st_size for p in pdf_paths)
    logger.info(f"Merging {len(pdf_paths)} PDFs ({total:,} bytes total)")
    await loop.run_in_executor(None, _do_merge, pdf_paths, out_path)
    logger.info(f"Merge complete: {out_path.stat().st_size:,} bytes")
