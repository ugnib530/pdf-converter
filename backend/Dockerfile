FROM python:3.11-slim

# ── System packages ───────────────────────────────────────────────────────────
# Phase 1 (required now):
#   libgl1, libglib2.0-0, libsm6, libxext6, libxrender1, libgomp1
#     → needed by pdf2docx / OpenCV transitive deps
#
# Phase 2 additions (uncomment when Tier-2 tools are implemented):
#   ghostscript   → compress, print-ready, pdf/a conversion
#   qpdf          → pikepdf backend; repair, protect, unlock
#   poppler-utils → pdfinfo / pdftotext (optional, useful for debugging)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    # ghostscript \
    # qpdf \
    # poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────────────────────────
COPY main.py .
COPY core/ core/
COPY routers/ routers/
COPY services/ services/

# ── Temp directory ────────────────────────────────────────────────────────────
RUN mkdir -p /tmp/docshift

EXPOSE 8000

# Railway injects $PORT at runtime; fall back to 8000 locally.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
