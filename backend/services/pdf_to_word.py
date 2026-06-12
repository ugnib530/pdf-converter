"""
services/pdf_to_word.py
Converts a PDF file to a Word (.docx) document using pdf2docx.

Called by routers/from_pdf.py → pdf_to_word endpoint.
The heavy work runs in a thread pool so it does not block the event loop.
"""
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _do_convert(pdf_path: Path, docx_path: Path) -> None:
    """
    Synchronous conversion — runs inside run_in_executor.
    Importing pdf2docx here (not at module level) keeps startup fast
    and isolates the import to threads that actually need it.
    """
    from pdf2docx import Converter

    cv = Converter(str(pdf_path))
    try:
        cv.convert(str(docx_path), start=0, end=None)
    finally:
        cv.close()


async def convert_pdf_to_word(pdf_path: Path, docx_path: Path) -> None:
    """
    Async wrapper — offloads the synchronous pdf2docx work to a thread pool.

    Args:
        pdf_path:  Path to the source PDF (must already exist on disk).
        docx_path: Destination path for the output DOCX.
    Raises:
        Any exception raised by pdf2docx (caller logs + wraps into HTTPException).
    """
    loop = asyncio.get_event_loop()
    logger.info(f"Starting PDF→DOCX: {pdf_path.name} → {docx_path.name}")
    await loop.run_in_executor(None, _do_convert, pdf_path, docx_path)
    logger.info(f"PDF→DOCX complete: {docx_path.stat().st_size:,} bytes")
