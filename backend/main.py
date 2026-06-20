"""
main.py
DocShift API — FastAPI app entry point.

Routers are imported here; actual endpoint logic lives in routers/ and services/.
Add new routers here as you complete each Phase.
"""
import asyncio
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from contextlib import asynccontextmanager

from core.config import ALLOWED_ORIGINS
from core.rate_limit import limiter
from core.file_handling import cleanup_loop

# ── Routers (uncomment as each Phase is completed) ────────────────────────────
from routers.from_pdf import router as from_pdf_router   # Phase 1 + 2
from routers.organize  import router as organize_router  # Phase 2
from routers.security  import router as security_router  # Phase 2
from routers.to_pdf    import router as to_pdf_router    # Phase 2
from routers.cleanup   import router as cleanup_router  # Phase 3
from auth import router as auth_router                  # Sign up / Log in

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


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
)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Global error handler — keeps response shape consistent ───────────────────
# NOTE: FastAPI exception handlers bypass CORSMiddleware, so we must manually
# add CORS headers here — otherwise any 500 looks like a CORS error in browsers.
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.url}: {exc}", exc_info=True)
    response = JSONResponse(
        status_code=500,
        content={"error": "An unexpected server error occurred.", "code": "INTERNAL_ERROR"},
    )
    origin = request.headers.get("origin")
    if origin:
        if ALLOWED_ORIGINS == ["*"] or origin in ALLOWED_ORIGINS:
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
