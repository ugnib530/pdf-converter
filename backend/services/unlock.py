"""
services/unlock.py
Removes encryption from a PDF when the password is known (or absent).
Uses pikepdf.

IMPORTANT: This tool cannot crack or brute-force unknown passwords.
The UI should make this limitation explicit.
"""
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _do_unlock(pdf_path: Path, out_path: Path, password: str) -> None:
    import pikepdf

    try:
        pdf = pikepdf.open(str(pdf_path), password=password)
    except pikepdf.PasswordError:
        raise ValueError(
            "Incorrect password. "
            "This tool can only remove a password you already know — "
            "it cannot crack unknown passwords."
        )

    # Save without encryption
    pdf.save(str(out_path))
    pdf.close()


async def unlock_pdf(pdf_path: Path, out_path: Path, password: str = "") -> None:
    """
    Decrypt a PDF and save it without encryption.

    Args:
        pdf_path:  Source PDF (may or may not be encrypted).
        out_path:  Destination unencrypted PDF.
        password:  Known password (empty string for owner-only-locked files).

    Raises:
        ValueError: If the password is wrong.
    """
    loop = asyncio.get_event_loop()
    logger.info(f"Unlocking {pdf_path.name}")
    await loop.run_in_executor(None, _do_unlock, pdf_path, out_path, password)
    logger.info(f"Unlock complete: {out_path.stat().st_size:,} bytes")
