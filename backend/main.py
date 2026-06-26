"""
main.py
DocShift API — FastAPI app entry point.

Routers are imported here; actual endpoint logic lives in routers/ and services/.
Add new routers here as you complete each Phase.
"""
import asyncio
import logging
import re

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware

from core.config import ALLOWED_ORIGINS, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB
from core.rate_limit import limiter
from core.file_handling import cleanup_loop

# ── Routers ───────────────────────────────────────────────────────────────────
from routers.from_pdf import router as from_pdf_router   # Phase 1 + 2
from routers.organize  import router as organize_router  # Phase 2
from routers.security  import router as security_router  # Phase 2
from routers.to_pdf    import router as to_pdf_router    # Phase 2
from routers.cleanup   import router as cleanup_router   # Phase 3
from auth import router as auth_router                   # Sign up / Log in

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# Regex that covers every Vercel preview deployment for this project.
VERCEL_PREVIEW_ORIGIN_RE = re.compile(r"https://pdf-converter-.*\.vercel\.app")


def _origin_allowed(origin: str) -> bool:
    """Return True if the origin is in ALLOWED_ORIGINS or matches the Vercel preview regex."""
    if ALLOWED_ORIGINS == ["*"]:
        return True
    if origin in ALLOWED_ORIGINS:
        return True
    if VERCEL_PREVIEW_ORIGIN_RE.fullmatch(origin):
        return True
    return False


# ── Request body size middleware ──────────────────────────────────────────────
class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    """
    Fast-path rejection of oversized uploads using the Content-Length header.

    This fires before any route handler reads the body, so a client that
    declares a payload larger than MAX_FILE_SIZE_BYTES gets a 413 immediately
    without the bytes ever being buffered.  The actual byte-level enforcement
    (for clients that lie about Content-Length) lives in read_and_validate()
    inside core/file_handling.py.

    CORS headers are added manually here because CORSMiddleware only processes
    responses that pass through it — a short-circuited 413 would reach the
    browser without CORS headers and show up as a misleading CORS error.
    """

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length is not None:
            try:
                declared_size = int(content_length)
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"error": "Invalid Content-Length header.", "code": "BAD_REQUEST"},
                )
            if declared_size > MAX_FILE_SIZE_BYTES:
                response = JSONResponse(
                    status_code=413,
                    content={
                        "error": (
                            f"Payload too large. "
                            f"Maximum upload size is {MAX_FILE_SIZE_MB} MB."
                        ),
                        "code": "PAYLOAD_TOO_LARGE",
                    },
                )
                origin = request.headers.get("origin")
                if origin and _origin_allowed(origin):
                    response.headers["Access-Control-Allow-Origin"] = origin
                    response.headers["Access-Control-Allow-Credentials"] = "true"
                return response
        return await call_next(request)


# ── Lifespan: start background cleanup task ───────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_loop())
    logger.info("DocShift API started — cleanup task running.")
    yield
    task.cancel()
    logger.info("DocShift API shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DocShift API",
    description=(
        "Every PDF tool you need — free, no sign-up, no watermarks. "
        "Convert, organize, protect, compress, and more."
    ),
    version="2.0.0",
    lifespan=lifespan,
    debug=False,  # Never expose tracebacks or internal details to clients.
)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middlewares ───────────────────────────────────────────────────────────────
# Starlette builds the middleware stack in reverse add_middleware order, so the
# last call here becomes the outermost wrapper.  We want:
#   CORS (outer) → MaxBodySize (inner) → route handler
# so that CORS headers are present on every response including 413s.
# MaxBodySize also adds CORS headers manually for the short-circuited case.
app.add_middleware(MaxBodySizeMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://pdf-converter-.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Replace FastAPI's default 422 response (which echoes Pydantic field-level
    errors including internal model names) with a generic message.
    Full details are still logged server-side for debugging.
    """
    logger.warning("Validation error on %s: %s", request.url, exc.errors())
    return JSONResponse(
        status_code=422,
        content={"error": "Invalid request data.", "code": "VALIDATION_ERROR"},
    )


# NOTE: FastAPI exception handlers bypass CORSMiddleware, so we must manually
# add CORS headers here — otherwise any 500 looks like a CORS error in browsers.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catch-all for any unhandled Python exception.  Logs the full traceback
    server-side but returns only a generic message to the client so no
    internal details (file paths, stack frames, library versions) are leaked.
    """
    logger.error("Unhandled exception on %s: %s", request.url, exc, exc_info=True)
    response = JSONResponse(
        status_code=500,
        content={"error": "An unexpected server error occurred.", "code": "INTERNAL_ERROR"},
    )
    origin = request.headers.get("origin")
    if origin and _origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


# 404 / 405 also bypass CORSMiddleware — without this, a missing or
# wrong-method route looks like a CORS error in the browser console.
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: Exception):
    response = JSONResponse(
        status_code=404,
        content={"error": "Not found.", "code": "NOT_FOUND"},
    )
    origin = request.headers.get("origin")
    if origin and _origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


@app.exception_handler(405)
async def method_not_allowed_handler(request: Request, exc: Exception):
    response = JSONResponse(
        status_code=405,
        content={"error": "Method not allowed.", "code": "METHOD_NOT_ALLOWED"},
    )
    origin = request.headers.get("origin")
    if origin and _origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(from_pdf_router, prefix="/tools", tags=["Convert from PDF"])
app.include_router(organize_router, prefix="/tools", tags=["Organize PDF"])
app.include_router(security_router, prefix="/tools", tags=["Security"])
app.include_router(to_pdf_router,   prefix="/tools", tags=["Convert to PDF"])
app.include_router(cleanup_router,  prefix="/tools", tags=["Edit & Optimize"])
app.include_router(auth_router)  # already has its own "/auth" prefix


# ── Utility routes ────────────────────────────────────────────────────────────
@app.get("/health", tags=["Utility"])
async def health():
    return {"status": "ok", "version": app.version}


@app.get("/tools", tags=["Utility"])
async def list_tools():
    """
    Returns the list of available tool slugs so the frontend
    can verify which endpoints are live.
    """
    routes = [
        r.path.removeprefix("/tools/")
        for r in app.routes
        if hasattr(r, "methods") and "POST" in r.methods
        and r.path.startswith("/tools/")
    ]
    return {"tools": sorted(routes)}