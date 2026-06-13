"""
services/extract_images.py
Extracts all images embedded inside a PDF's content streams and returns
them as a ZIP archive.  Uses PyMuPDF (fitz).
"""
import asyncio
import logging
import zipfile
from pathlib import Path

logger = logging.getLogger(__name__)


def _do_extract(pdf_path: Path, zip_path: Path) -> int:
    """
    Returns the total number of images written into the ZIP.
    Raises ValueError if the PDF contains no extractable images.
    """
    import fitz  # PyMuPDF

    doc   = fitz.open(str(pdf_path))
    count = 0

    with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
        for page_num in range(len(doc)):
            for img_idx, img_info in enumerate(doc.get_page_images(page_num, full=True)):
                xref      = img_info[0]
                base_image = doc.extract_image(xref)
                img_bytes  = base_image["image"]
                ext        = base_image["ext"]          # e.g. "png", "jpeg", "jp2"
                filename   = f"page{page_num + 1}_img{img_idx + 1}.{ext}"
                zf.writestr(filename, img_bytes)
                count += 1

    doc.close()

    if count == 0:
        raise ValueError(
            "No extractable images were found in this PDF. "
            "The file may contain only text or vector graphics."
        )

    return count


async def extract_pdf_images(pdf_path: Path, zip_path: Path) -> int:
    """
    Extract embedded images from a PDF and write them to a ZIP.

    Args:
        pdf_path:  Source PDF.
        zip_path:  Destination ZIP.

    Returns:
        Number of images extracted.
    """
    loop = asyncio.get_event_loop()
    logger.info(f"Extracting images from {pdf_path.name}")
    count = await loop.run_in_executor(None, _do_extract, pdf_path, zip_path)
    logger.info(f"Extracted {count} image(s) → {zip_path.stat().st_size:,} bytes")
    return count
