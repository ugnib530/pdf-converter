import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _do_flatten(pdf_path: Path, out_path: Path) -> None:
    import pikepdf
    pdf = pikepdf.open(str(pdf_path))
    try:
        pdf.flatten_annotations("all")
        pdf.save(str(out_path))
    finally:
        pdf.close()


async def flatten_pdf(pdf_path: Path, out_path: Path) -> None:
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _do_flatten, pdf_path, out_path)
    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError("Flatten produced an empty file.")