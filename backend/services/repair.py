import logging
from pathlib import Path

from core.config import GS_BIN, QPDF_BIN
from core.shell import run_subprocess, ShellError

logger = logging.getLogger(__name__)


def _page_count(pdf_path: Path) -> int:
    import fitz
    try:
        with fitz.open(str(pdf_path)) as doc:
            return doc.page_count
    except Exception:
        return 0


async def repair_pdf(pdf_path: Path, out_path: Path) -> str:
    logger.info(f"Repairing {pdf_path.name} (attempt 1: qpdf)")
    try:
        await run_subprocess(
            [QPDF_BIN, "--decode-level=all", str(pdf_path), str(out_path)],
            timeout=120,
        )
        if out_path.exists() and out_path.stat().st_size > 0 and _page_count(out_path) > 0:
            return "qpdf"
    except ShellError as exc:
        logger.warning(f"qpdf repair failed, falling back to Ghostscript: {exc}")
    except Exception as exc:
        logger.warning(f"qpdf repair errored, falling back togit push -u origin main Ghostscript: {exc}")

    out_path.unlink(missing_ok=True)
    try:
        await run_subprocess(
            [
                GS_BIN, "-o", str(out_path), "-sDEVICE=pdfwrite",
                "-dPDFSETTINGS=/prepress", "-dNOPAUSE", "-dBATCH", "-dQUIET",
                str(pdf_path),
            ],
            timeout=180,
        )
    except Exception as exc:
        raise ValueError(
            f"Unable to repair this PDF — the file appears to be too badly damaged to recover ({exc})."
        )

    if not out_path.exists() or out_path.stat().st_size == 0 or _page_count(out_path) == 0:
        raise ValueError("Unable to repair this PDF — no readable pages could be recovered.")

    return "ghostscript"