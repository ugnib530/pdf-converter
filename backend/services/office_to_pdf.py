"""
services/office_to_pdf.py
Converts Office documents (Word/Excel/PowerPoint, legacy .doc/.xls/.ppt,
and OpenDocument .odt/.ods/.odp) to PDF using headless LibreOffice.

Why LibreOffice: it's the only practical way to get pixel-faithful
Office→PDF conversion without paying for a third-party API. There's no
pure-Python library that reliably renders real-world .docx/.xlsx/.pptx
(fonts, layout, charts, merged cells, etc.) to PDF.

Two things make headless LibreOffice tricky to run as a server, both
handled below:
  1. Concurrent `soffice` invocations sharing a user profile fight over a
     lock file and fail ("Error: Could not start soffice").
     → Fix: give every conversion its own throwaway profile dir via
       `-env:UserInstallation=file://...`, AND serialize conversions with
       a semaphore since each LibreOffice instance is fairly memory-heavy.
  2. `--convert-to` writes the output using the *input's* filename stem
     into `--outdir`, not to a path you choose.
     → Fix: convert into a scratch directory, then move the result to
       the caller's chosen out_path.
"""
import asyncio
import logging
import shutil
import uuid
from pathlib import Path

from core.config import SOFFICE_BIN, TEMP_DIR, OFFICE_CONVERSION_CONCURRENCY
from core.shell import run_subprocess, ShellError

logger = logging.getLogger(__name__)

# Shared across all requests in this process — caps how many soffice
# instances can run at once, regardless of how many requests come in.
_conversion_semaphore = asyncio.Semaphore(max(1, OFFICE_CONVERSION_CONCURRENCY))


async def office_to_pdf(input_path: Path, out_path: Path, timeout: float = 120.0) -> None:
    """
    Convert a single Office document to PDF.

    Args:
        input_path: Source file (.docx, .doc, .xlsx, .xls, .pptx, .ppt,
                     .odt, .ods, .odp — anything LibreOffice can open).
        out_path:   Destination PDF path. Caller owns this path.
        timeout:    Seconds to allow soffice before killing it. Large
                    spreadsheets/decks can be slow — 120s is a sane default.

    Raises:
        RuntimeError if LibreOffice fails or produces no output.
    """
    profile_dir = TEMP_DIR / f"lo_profile_{uuid.uuid4().hex}"
    scratch_dir = TEMP_DIR / f"lo_out_{uuid.uuid4().hex}"
    scratch_dir.mkdir(parents=True, exist_ok=True)

    cmd = [
        SOFFICE_BIN,
        "--headless",
        "--invisible",
        "--nodefault",
        "--nofirststartwizard",
        "--nolockcheck",
        "--norestore",
        f"-env:UserInstallation=file://{profile_dir}",
        "--convert-to", "pdf",
        "--outdir", str(scratch_dir),
        str(input_path),
    ]

    async with _conversion_semaphore:
        logger.info(f"Office→PDF: {input_path.name} (via LibreOffice)")
        try:
            await run_subprocess(cmd, timeout=timeout)
        except ShellError as exc:
            logger.error(f"LibreOffice failed on {input_path.name}: {exc}")
            raise RuntimeError(
                "LibreOffice could not convert this file. It may be "
                "corrupted, password-protected, or in an unsupported format."
            ) from exc
        finally:
            shutil.rmtree(profile_dir, ignore_errors=True)

    # soffice names the output after the *input* stem inside scratch_dir —
    # find it (don't assume the exact name in case of stem-sanitization).
    produced = scratch_dir / f"{input_path.stem}.pdf"
    if not produced.exists():
        candidates = list(scratch_dir.glob("*.pdf"))
        produced = candidates[0] if candidates else None

    if not produced or not produced.exists():
        shutil.rmtree(scratch_dir, ignore_errors=True)
        raise RuntimeError(
            "Conversion finished but no PDF was produced. "
            "The source file may be corrupted or password-protected."
        )

    shutil.move(str(produced), str(out_path))
    shutil.rmtree(scratch_dir, ignore_errors=True)

    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError("Conversion produced an empty file.")
