"""
core/file_handling.py
Shared utilities for every router:
  - MIME / magic-byte validation
  - Temp file creation (in-flight processing only — NOT for persistence)
  - Secure file delivery via Supabase Storage
  - Background cleanup loop (local /tmp + Supabase Storage)
  - Consistent error helpers

Secure file-handling contract
──────────────────────────────
INPUT files
  Uploaded bytes are read into memory, validated, then written to a
  short-lived local temp path so CLI tools (Ghostscript, LibreOffice,
  etc.) can operate on them. The path is always removed in a finally
  block inside the router — it never outlives a single request.

OUTPUT files
  After conversion the router calls ``storage_response()``, which:
    1. Uploads the output to Supabase Storage under outputs/{user_id}/{uuid}.
    2. Deletes the local file immediately.
    3. Fetches the bytes back via a short-lived signed URL.
    4. Returns the bytes to the client with Content-Disposition headers.
    5. Schedules deletion of the Supabase object as a BackgroundTask.

  If Supabase is not configured (dev / unit-test env), ``storage_response``
  falls back to a standard FileResponse served from local disk with a
  BackgroundTask that deletes it after the response is sent.

SECURITY — Filename Sanitization
  safe_download_name() is called on every user-supplied filename stem
  before it is used in a Content-Disposition header or as a download name.
  The internal Supabase storage key is always a server-generated UUID —
  the original filename never touches the storage layer.

SECURITY — MIME Validation
  read_and_validate() checks magic bytes for PDF, image, and Office files.
  Extension alone is not trusted; the actual file header is verified.
"""
import re
import uuid
import asyncio
import logging
import time
from pathlib import Path
from typing import Literal

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from starlette.background import BackgroundTask

from core.config import (
    TEMP_DIR,
    MAX_FILE_SIZE_BYTES,
    MAX_FILE_SIZE_MB,
    CLEANUP_AFTER_SECONDS,
)

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

# Office formats share two magic signatures:
#   ZIP-based  (.docx / .xlsx / .pptx / .odt / .ods / .odp): PK\x03\x04
#   OLE2-based (.doc  / .xls  / .ppt              ): \xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1
OFFICE_MAGIC_ZIP  = b"PK\x03\x04"
OFFICE_MAGIC_OLE2 = b"\xD0\xCF\x11\xE0"

ACCEPTED_EXTENSIONS: dict[str, set[str]] = {
    "pdf":    {".pdf"},
    "image":  {".jpg", ".jpeg", ".png", ".gif", ".webp"},
    "office": {".docx", ".xlsx", ".pptx", ".doc", ".xls", ".ppt", ".odt", ".ods", ".odp"},
}

# ── Safe download name ────────────────────────────────────────────────────────
# Characters allowed in a Content-Disposition filename stem.
_SAFE_NAME_RE = re.compile(r"[^\w\-]")
_MAX_STEM_LEN = 80


def safe_download_name(user_filename: str, fallback: str = "file") -> str:
    """
    SECURITY — Filename Sanitization.

    Derive a safe stem from a user-supplied filename for use in
    Content-Disposition headers and friendly download names.

    Rules:
      • Strip all path components (basename only).
      • Keep only word characters (letters, digits, underscore) and hyphens.
      • Collapse runs of underscores/hyphens to a single underscore.
      • Truncate to _MAX_STEM_LEN characters.
      • Fall back to ``fallback`` if nothing safe remains.

    The result is NEVER used as an on-disk path or Supabase storage key —
    those always use server-generated UUIDs.
    """
    stem = Path(user_filename).stem if user_filename else ""
    stem = _SAFE_NAME_RE.sub("_", stem)
    stem = re.sub(r"[_\-]{2,}", "_", stem).strip("_")
    stem = stem[:_MAX_STEM_LEN].strip("_")
    return stem if stem else fallback


# ── Temp path factory ─────────────────────────────────────────────────────────
def temp_path(ext: str) -> Path:
    """Return a unique temp path under TEMP_DIR.

    Use this only for files needed by CLI tools during active processing.
    Always remove the path in a finally block — never let it outlive the request.
    """
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

    SECURITY — MIME Validation:
      We check both file extension AND magic bytes (file header).
      Extension alone can be trivially spoofed; magic bytes provide a
      server-side check that the file is actually the claimed format.

      • pdf    — must start with %PDF
      • image  — checked against format-specific magic bytes
      • office — must start with ZIP magic (docx/xlsx/pptx/odt family)
                 OR OLE2 magic (doc/xls/ppt legacy formats)

    We read at most MAX_FILE_SIZE_BYTES + 1 bytes. If we get that many bytes
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
    elif kind == "office":
        _check_office_magic(content, suffix)

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


def _check_office_magic(content: bytes, suffix: str) -> None:
    """
    SECURITY — MIME Validation for Office files.

    ZIP-based formats (.docx, .xlsx, .pptx, .odt, .ods, .odp) must start
    with the ZIP magic bytes PK\\x03\\x04.

    Legacy OLE2 formats (.doc, .xls, .ppt) must start with the Compound
    Document magic bytes \\xD0\\xCF\\x11\\xE0.

    A file that claims to be a Word document but is actually a script or
    executable will fail this check before any library ever opens it.
    """
    zip_based  = {".docx", ".xlsx", ".pptx", ".odt", ".ods", ".odp"}
    ole2_based = {".doc", ".xls", ".ppt"}

    if suffix in zip_based:
        if not content.startswith(OFFICE_MAGIC_ZIP):
            raise HTTPException(
                400,
                f"The uploaded file does not appear to be a valid {suffix.upper()} document "
                "(expected ZIP-based Office format). Make sure the file is not corrupted.",
            )
    elif suffix in ole2_based:
        if not content.startswith(OFFICE_MAGIC_OLE2):
            raise HTTPException(
                400,
                f"The uploaded file does not appear to be a valid {suffix.upper()} document "
                "(expected legacy OLE2 Office format). Make sure the file is not corrupted.",
            )
    # Unknown suffix falls through — extension check already ran above


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


# ── Secure file delivery ──────────────────────────────────────────────────────
async def storage_response(
    local_path: Path,
    download_name: str,
    media_type: str,
    user_id: int,
) -> Response:
    """
    Secure output-file delivery pipeline.

    SECURITY — File Ownership:
      All Supabase objects are stored under outputs/{user_id}/{uuid}/…
      so that no object key can be guessed or collide across users.
      The user_id comes from the verified JWT (get_current_user_id).

    SECURITY — Filename Sanitization:
      ``download_name`` is the friendly name shown in the browser's save
      dialog (Content-Disposition filename). It must already be sanitised
      by the caller via safe_download_name(). It is NEVER used as the
      on-disk storage key — that is always a server-generated UUID.

    Production (Supabase configured)
    ─────────────────────────────────
      1. Upload *local_path* to Supabase Storage under a UUID key scoped
         to the requesting user_id.
      2. Delete the local file immediately — nothing persists in /tmp.
      3. Fetch the bytes back via a short-lived signed URL.
      4. Return the file to the client with Content-Disposition headers.
      5. Delete the Supabase object in a BackgroundTask.

    Development fallback (Supabase NOT configured)
    ───────────────────────────────────────────────
      Serve the file directly from disk with a BackgroundTask that
      removes it after the response is sent. Not suitable for production.
    """
    from core import storage  # local import avoids circular dependency at module load

    if not storage.storage_configured():
        logger.warning(
            "Supabase Storage is not configured — serving '%s' from local disk. "
            "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET "
            "for secure production file handling.",
            download_name,
        )
        return FileResponse(
            path=str(local_path),
            media_type=media_type,
            filename=download_name,
            background=BackgroundTask(local_path.unlink, missing_ok=True),
        )

    try:
        # Step 1 — upload to Supabase Storage under a user-scoped UUID key
        object_key = await storage.upload_file(local_path, download_name, user_id)

        # Step 2 — delete local file immediately; no data lingers in /tmp
        local_path.unlink(missing_ok=True)

        # Step 3 — fetch back via a short-lived signed URL (server-side only,
        # so CORS on the bucket is irrelevant and the URL never reaches the browser)
        signed_url = await storage.get_signed_url(object_key)
        data = await storage.fetch_object(signed_url)

        # Step 4 — stream to client with proper download headers
        return Response(
            content=data,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{download_name}"',
                "Content-Length": str(len(data)),
            },
            # Step 5 — clean up the Supabase object after the response is sent
            background=BackgroundTask(storage.delete_object, object_key),
        )

    except Exception as exc:
        # Ensure local file is removed even if the upload / fetch fails
        local_path.unlink(missing_ok=True)
        logger.error("storage_response failed for '%s': %s", download_name, exc)
        raise api_error(500, "Failed to deliver the processed file.", "STORAGE_ERROR")


# ── Background cleanup task ───────────────────────────────────────────────────
async def cleanup_loop() -> None:
    """
    Runs as a background asyncio task (started in the FastAPI lifespan).

    Every 60 seconds it:
      • Removes any files / empty sub-directories in TEMP_DIR that are
        older than CLEANUP_AFTER_SECONDS (safety net for any temp file
        that was not cleaned up by a finally block).
      • Calls Supabase Storage cleanup to delete old output objects
        (second safety net in case a BackgroundTask was interrupted).
    """
    from core import storage  # local import

    while True:
        await asyncio.sleep(60)

        # ── Local /tmp cleanup (safety net only) ──────────────────────────
        try:
            now = time.time()
            for item in TEMP_DIR.iterdir():
                try:
                    age_seconds = now - item.stat().st_mtime
                    if age_seconds < CLEANUP_AFTER_SECONDS:
                        continue
                    if item.is_file():
                        item.unlink(missing_ok=True)
                        logger.debug("Cleaned up stray temp file: %s", item.name)
                    elif item.is_dir():
                        if not any(item.iterdir()):
                            item.rmdir()
                            logger.debug("Cleaned up empty temp dir: %s", item.name)
                        else:
                            for child in item.iterdir():
                                if now - child.stat().st_mtime > CLEANUP_AFTER_SECONDS:
                                    child.unlink(missing_ok=True)
                except Exception as item_err:
                    logger.warning("Local cleanup skipped %s: %s", item, item_err)
        except Exception as exc:
            logger.error("Local cleanup loop error: %s", exc)

        # ── Supabase Storage cleanup (safety net) ─────────────────────────
        try:
            await storage.cleanup_old_storage_objects()
        except Exception as exc:
            logger.error("Supabase cleanup loop error: %s", exc)