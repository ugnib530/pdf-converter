"""
core/file_handling.py
Shared utilities for every router:
  - MIME / magic-byte validation
  - Temp file creation
  - Background cleanup loop
  - Consistent error helpers
"""
import uuid
import asyncio
import logging
import time
from pathlib import Path
from typing import Literal

from fastapi import HTTPException, UploadFile

from core.config import TEMP_DIR, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB, CLEANUP_AFTER_SECONDS

logger = logging.getLogger(__name__)

# ── Accepted MIME sets (per file category) ───────────────────────────────────
PDF_MAGIC = b"%PDF"
IMAGE_MAGICS: dict[str, bytes] = {
    "jpg":  b"\xff\xd8\xff",
    "jpeg": b"\xff\xd8\xff",
    "png":  b"\x89PNG",
    "gif":  b"GIF8",
    "webp": b"RIFF",   # RIFF....WEBP — checked separately below
}
ACCEPTED_EXTENSIONS: dict[str, set[str]] = {
    "pdf":    {".pdf"},
    "image":  {".jpg", ".jpeg", ".png", ".gif", ".webp"},
    "office": {".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt", ".odt", ".ods", ".odp"},
}


# ── Temp path factory ─────────────────────────────────────────────────────────
def temp_path(ext: str) -> Path:
    """Return a unique temp path under TEMP_DIR.  Caller writes to it."""
    return TEMP_DIR / f"{uuid.uuid4()}.{ext.lstrip('.')}"


def temp_dir_for_job() -> Path:
    """Return a unique sub-directory (useful for multi-file outputs like PDF→JPG)."""
    d = TEMP_DIR / uuid.uuid4().hex
    d.mkdir(parents=True, exist_ok=True)
    return d


# ── Validation ────────────────────────────────────────────────────────────────
async def read_and_validate(
    file: UploadFile,
    kind: Literal["pdf", "image", "office", "any"] = "pdf",
) -> bytes:
    """
    Read the upload into memory and validate it.
    Returns raw bytes on success; raises HTTPException on failure.

    We read at most MAX_FILE_SIZE_BYTES + 1 bytes.  If we get that many bytes
    back we know the file exceeds the limit without having to load the whole
    thing first — this prevents OOM from clients that omit or spoof the
    Content-Length header (the middleware catches declared-size violations
    earlier, but this is the hard byte-level enforcement).

    Args:
        file:  The FastAPI UploadFile.
        kind:  Which category to validate against.
               "any" skips extension/magic checks (use with caution).
    """
    # Read one byte beyond the limit so we can detect oversized files
    # without buffering everything into memory first.
    content = await file.read(MAX_FILE_SIZE_BYTES + 1)

    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            413,
            f"File too large. Maximum allowed size is {MAX_FILE_SIZE_MB} MB.",
        )

    if kind == "any":
        return content

    filename = (file.filename or "").lower()
    suffix = Path(filename).suffix

    allowed_exts = ACCEPTED_EXTENSIONS.get(kind, set())
    if allowed_exts and suffix not in allowed_exts:
        raise HTTPException(
            400,
            f"Unsupported file type '{suffix}'. "
            f"Expected one of: {', '.join(sorted(allowed_exts))}",
        )

    # Magic-byte checks
    if kind == "pdf":
        _check_pdf_magic(content, filename)
    elif kind == "image":
        _check_image_magic(content, suffix)
    # "office" files are ZIP-based (docx/xlsx/pptx) or legacy binary —
    # magic checks are less reliable; skip for now and let the library raise.

    return content


def _check_pdf_magic(content: bytes, filename: str) -> None:
    if not content.startswith(PDF_MAGIC):
        raise HTTPException(
            400,
            "The uploaded file does not appear to be a valid PDF "
            "(bad magic bytes).  Make sure the file is not corrupted.",
        )


def _check_image_magic(content: bytes, suffix: str) -> None:
    if suffix == ".webp":
        if not (content[:4] == b"RIFF" and content[8:12] == b"WEBP"):
            raise HTTPException(400, "File is not a valid WebP image.")
        return
    magic = IMAGE_MAGICS.get(suffix.lstrip("."))
    if magic and not content.startswith(magic):
        raise HTTPException(400, f"File does not appear to be a valid {suffix.upper()} image.")


# ── Consistent error response shape ──────────────────────────────────────────
def api_error(status: int, message: str, code: str | None = None) -> HTTPException:
    """
    Return an HTTPException whose detail is a dict with 'error' and 'code'
    so the frontend can key on 'code' for user-facing messages.

    Usage:
        raise api_error(400, "Wrong password", "WRONG_PASSWORD")
    """
    detail = {"error": message}
    if code:
        detail["code"] = code
    return HTTPException(status_code=status, detail=detail)


# ── Background cleanup task ───────────────────────────────────────────────────
async def cleanup_loop() -> None:
    """
    Runs as a background asyncio task (started in the FastAPI lifespan).
    Deletes every file / empty sub-directory in TEMP_DIR that is older
    than CLEANUP_AFTER_SECONDS.
    """
    while True:
        await asyncio.sleep(60)
        try:
            now = time.time()

            for item in TEMP_DIR.iterdir():
                try:
                    age_seconds = now - item.stat().st_mtime
                    if age_seconds < CLEANUP_AFTER_SECONDS:
                        continue
                    if item.is_file():
                        item.unlink(missing_ok=True)
                        logger.debug(f"Cleaned up file: {item.name}")
                    elif item.is_dir():
                        if not any(item.iterdir()):
                            item.rmdir()
                            logger.debug(f"Cleaned up empty dir: {item.name}")
                        else:
                            for child in item.iterdir():
                                child_age = now - child.stat().st_mtime
                                if child_age > CLEANUP_AFTER_SECONDS:
                                    child.unlink(missing_ok=True)
                except Exception as item_err:
                    logger.warning(f"Cleanup skipped {item}: {item_err}")

        except Exception as e:
            logger.error(f"Cleanup loop error: {e}")