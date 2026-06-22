FROM python:3.11-slim

# ── System packages ───────────────────────────────────────────────────────────
# Phase 1 (required now):
#   libgl1, libglib2.0-0, libsm6, libxext6, libxrender1, libgomp1
#     → needed by pdf2docx / OpenCV transitive deps
#
# Phase 2 additions:
#   ghostscript   → compress, print-ready, pdf/a conversion
#   qpdf          → pikepdf backend; repair, protect, unlock
#   poppler-utils → pdfinfo / pdftotext (optional, useful for debugging)
#
# Phase 5 additions (Office → PDF, services/office_to_pdf.py):
#   libreoffice-writer / -calc / -impress → docx/xlsx/pptx (+ legacy doc/xls/ppt
#     and odt/ods/odp) rendering, headless, via `soffice --convert-to pdf`
#   fonts-liberation, fonts-dejavu-core   → metric-compatible substitutes for
#     Times New Roman / Arial / Calibri so converted PDFs don't reflow badly
#     when the real MS fonts aren't licensed for the container
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    ghostscript \
    qpdf \
    libreoffice-writer \
    libreoffice-calc \
    libreoffice-impress \
    fonts-liberation \
    fonts-dejavu-core \
    # poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ───────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Application code ──────────────────────────────────────────────────────────
COPY main.py .
COPY auth.py .
COPY core/ core/
COPY routers/ routers/
COPY services/ services/

# ── Temp directory ────────────────────────────────────────────────────────────
RUN mkdir -p /tmp/docshift

EXPOSE 8000

# Railway injects $PORT at runtime; fall back to 8000 locally.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]