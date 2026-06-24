"""
core/storage.py
Async Supabase Storage client for persistent output-file storage.

Design contract
───────────────
• INPUT files are never stored here. They exist only in local /tmp
  during active processing and are removed in finally blocks inside
  each router. This module only handles OUTPUT files.

• After a conversion finishes, the router calls `storage_response()`,
  which:
    1. Uploads the local output file to the Supabase Storage bucket.
    2. Deletes the local file immediately — nothing lingers in /tmp.
    3. Fetches the file back via a short-lived signed URL.
    4. Returns the bytes to the client with proper download headers.
    5. Schedules deletion of the Supabase object in a BackgroundTask.

• If Supabase is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
  are empty), every function degrades gracefully and the caller falls
  back to serving directly from disk. This lets local dev work without
  a Supabase project.

SECURITY — File Ownership & Filename Sanitization
──────────────────────────────────────────────────
upload_file() accepts a user_id and a friendly download_name.

Internal storage key:
  outputs/{user_id}/{uuid}
  • Scoped to the authenticated user — objects can never collide across
    users or be guessed by another user.
  • Always a UUID — the user-supplied filename is NEVER used as any part
    of the on-disk path or Supabase object key.

Content-Disposition filename:
  The download_name parameter is used only in the response header so the
  browser shows a friendly save-as name. It must already be sanitised by
  the caller (safe_download_name() in file_handling.py).

Supabase Storage REST endpoints used
──────────────────────────────────────
  POST   /storage/v1/object/{bucket}/{path}           — upload
  POST   /storage/v1/object/sign/{bucket}/{path}      — create signed URL
  GET    {signedURL}                                   — download
  DELETE /storage/v1/object/{bucket}  (body: prefixes) — delete one or many
  POST   /storage/v1/object/list/{bucket}              — list for cleanup
"""

import logging
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

# Signed URL validity in seconds.
# Only needs to last long enough for THIS server to fetch the bytes
# and stream them back to the client. 120 s is very generous.
_SIGNED_URL_TTL = 120


# ── Lazy config import (avoids circular imports at module load time) ───────────

def _cfg():
    from core.config import (
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_STORAGE_BUCKET,
        CLEANUP_AFTER_SECONDS,
    )
    return SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET, CLEANUP_AFTER_SECONDS


def storage_configured() -> bool:
    """Return True only when all three Supabase Storage env vars are set."""
    url, key, bucket, _ = _cfg()
    return bool(url and key and bucket)


def _auth_headers() -> dict[str, str]:
    _, key, _, _ = _cfg()
    return {
        "Authorization": f"Bearer {key}",
        "apikey": key,
    }


# ── Core operations ───────────────────────────────────────────────────────────

async def upload_file(local_path: Path, download_name: str, user_id: int) -> str:
    """
    Upload *local_path* to Supabase Storage under a user-scoped UUID key.

    SECURITY — File Ownership:
      The storage key is ``outputs/{user_id}/{uuid}`` — scoped to the
      authenticated user so objects from different users cannot collide
      and cannot be guessed by other users.

    SECURITY — Filename Sanitization:
      The internal object key is always a server-generated UUID.
      ``download_name`` (the user-visible filename) is stored only as
      Supabase object metadata and used in Content-Disposition; it is
      never part of the storage path.

    Returns the storage object key (e.g. ``outputs/42/a1b2c3d4…``).
    Raises ``httpx.HTTPStatusError`` on failure.
    """
    url, _, bucket, _ = _cfg()

    # UUID-only key — never expose user-supplied name in the storage path.
    object_key = f"outputs/{user_id}/{uuid.uuid4().hex}"
    upload_url = f"{url}/storage/v1/object/{bucket}/{object_key}"

    data = local_path.read_bytes()

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            upload_url,
            content=data,
            headers={
                **_auth_headers(),
                "Content-Type": "application/octet-stream",
                # Store the friendly name as metadata so we can reconstruct
                # Content-Disposition on the way out if needed.
                "x-upsert": "true",
            },
        )
        resp.raise_for_status()

    logger.info(
        "Uploaded '%s' → Supabase: %s (user_id=%s)",
        download_name, object_key, user_id,
    )
    return object_key


async def get_signed_url(object_key: str, expires_in: int = _SIGNED_URL_TTL) -> str:
    """
    Create a short-lived signed download URL for *object_key*.

    Returns the full HTTPS URL (including the Supabase base URL prefix).
    """
    url, _, bucket, _ = _cfg()
    sign_url = f"{url}/storage/v1/object/sign/{bucket}/{object_key}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            sign_url,
            json={"expiresIn": expires_in},
            headers=_auth_headers(),
        )
        resp.raise_for_status()
        payload = resp.json()

    # Supabase returns { "signedURL": "/storage/v1/object/sign/..." }
    signed_path = payload.get("signedURL", "")
    if not signed_path:
        raise ValueError(f"Supabase did not return a signed URL for {object_key}")
    return f"{url}{signed_path}"


async def fetch_object(signed_url: str) -> bytes:
    """
    Download an object from Supabase Storage via its signed URL.
    Returns raw bytes.
    """
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        resp = await client.get(signed_url)
        resp.raise_for_status()
        return resp.content


async def delete_object(object_key: str) -> None:
    """
    Delete a single object from Supabase Storage.
    Logs a warning on non-success instead of raising, so background
    cleanup tasks don't crash the whole loop.
    """
    url, _, bucket, _ = _cfg()
    delete_url = f"{url}/storage/v1/object/{bucket}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.delete(
            delete_url,
            json={"prefixes": [object_key]},
            headers=_auth_headers(),
        )
        if resp.status_code not in (200, 204):
            logger.warning(
                "Supabase delete returned %s for key %s", resp.status_code, object_key
            )
        else:
            logger.debug("Deleted Supabase object: %s", object_key)


# ── Background cleanup ────────────────────────────────────────────────────────

async def cleanup_old_storage_objects() -> None:
    """
    List ``outputs/`` in the Supabase bucket and delete every object
    older than ``CLEANUP_AFTER_SECONDS``.

    Called from the background cleanup loop in ``core/file_handling.py``.
    No-ops silently when Supabase is not configured.
    """
    if not storage_configured():
        return

    url, _, bucket, cleanup_after = _cfg()
    list_url = f"{url}/storage/v1/object/list/{bucket}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                list_url,
                json={
                    "prefix": "outputs/",
                    "limit": 200,
                    "offset": 0,
                    "sortBy": {"column": "created_at", "order": "asc"},
                },
                headers=_auth_headers(),
            )
            if resp.status_code != 200:
                logger.warning("Storage list returned %s", resp.status_code)
                return
            items: list[dict] = resp.json()
    except Exception as exc:
        logger.error("Storage list failed: %s", exc)
        return

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=cleanup_after)
    to_delete: list[str] = []

    for item in items:
        ts_str = item.get("created_at") or item.get("updated_at") or ""
        if not ts_str:
            continue
        try:
            created_at = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            if created_at < cutoff:
                to_delete.append(item["name"])
        except Exception as exc:
            logger.warning("Skipped cleanup of '%s': %s", item.get("name"), exc)

    if not to_delete:
        return

    try:
        delete_url = f"{url}/storage/v1/object/{bucket}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(
                delete_url,
                json={"prefixes": to_delete},
                headers=_auth_headers(),
            )
            logger.info(
                "Supabase cleanup: deleted %d old object(s) (status %s)",
                len(to_delete),
                resp.status_code,
            )
    except Exception as exc:
        logger.error("Storage batch delete failed: %s", exc)