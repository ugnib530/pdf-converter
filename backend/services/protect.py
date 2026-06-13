"""
services/protect.py
Adds a user password (required to open) to a PDF.
Uses pikepdf, which wraps the qpdf library.

The owner password is set to the same value as the user password for
simplicity — users can override by passing owner_password separately
(not exposed in the UI for now).
"""
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def _do_protect(
    pdf_path: Path,
    out_path: Path,
    password: str,
    owner_password: str | None,
) -> None:
    import pikepdf

    owner_pw = owner_password or password

    pdf = pikepdf.open(str(pdf_path))
    pdf.save(
        str(out_path),
        encryption=pikepdf.Encryption(
            user=password,
            owner=owner_pw,
            R=6,            # AES-256 (PDF 2.0 compatible)
            allow=pikepdf.Permissions(
                extract=False,
                modify_annotation=False,
                modify_form=False,
                modify_other=False,
                print_highres=True,
                print_lowres=True,
            ),
        ),
    )
    pdf.close()


async def protect_pdf(
    pdf_path: Path,
    out_path: Path,
    password: str,
    owner_password: str | None = None,
) -> None:
    """
    Encrypt a PDF with AES-256 (R=6).

    Args:
        pdf_path:        Source PDF.
        out_path:        Destination protected PDF.
        password:        User (open) password.
        owner_password:  Owner password (defaults to same as user password).
    """
    if not password:
        raise ValueError("Password cannot be empty.")
    loop = asyncio.get_event_loop()
    logger.info(f"Protecting {pdf_path.name}")
    await loop.run_in_executor(None, _do_protect, pdf_path, out_path, password, owner_password)
    logger.info(f"Protect complete: {out_path.stat().st_size:,} bytes")
