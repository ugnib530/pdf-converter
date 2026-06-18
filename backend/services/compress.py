import logging
from pathlib import Path

from core.config import GS_BIN
from core.shell import run_subprocess

logger = logging.getLogger(__name__)

QUALITY_PRESETS = {
    "screen": "/screen",
    "ebook": "/ebook",
    "printer": "/printer",
    "prepress": "/prepress",
}


async def compress_pdf(pdf_path: Path, out_path: Path, quality: str = "ebook") -> None:
    setting = QUALITY_PRESETS.get(quality)
    if setting is None:
        raise ValueError(
            f"Unknown quality '{quality}'. Choose one of: {', '.join(QUALITY_PRESETS)}."
        )

    cmd = [
        GS_BIN,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS={setting}",
        "-dNOPAUSE", "-dBATCH", "-dQUIET",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        f"-sOutputFile={out_path}",
        str(pdf_path),
    ]

    logger.info(f"Compressing {pdf_path.name} at quality={quality}")
    await run_subprocess(cmd, timeout=180)

    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError("Compression produced an empty file.")