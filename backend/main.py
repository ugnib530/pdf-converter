import os
import uuid
import shutil
import asyncio
import logging
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ─── Config ─────────────────────────────────────────────────────────────────
TEMP_DIR = Path("/tmp/pdf_converter")
TEMP_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_MIME = {"application/pdf", "application/octet-stream"}
CLEANUP_AFTER_SECONDS = 300  # 5 minutes


# ─── Lifespan: background cleanup task ──────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()


async def cleanup_loop():
    """Delete temp files older than CLEANUP_AFTER_SECONDS every minute."""
    while True:
        await asyncio.sleep(60)
        try:
            for f in TEMP_DIR.iterdir():
                age = asyncio.get_event_loop().time() - f.stat().st_mtime
                if age > CLEANUP_AFTER_SECONDS:
                    f.unlink(missing_ok=True)
                    logger.info(f"Cleaned up {f.name}")
        except Exception as e:
            logger.error(f"Cleanup error: {e}")


# ─── Rate limiter ────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="PDF Converter API",
    description="Convert PDF files to Word (.docx) or Excel (.xlsx) — 100% free, no storage.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in prod: ["https://yourdomain.com"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Helpers ─────────────────────────────────────────────────────────────────
def validate_pdf(file: UploadFile, content: bytes) -> None:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only .pdf files are accepted.")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(413, f"File too large. Maximum size is {MAX_FILE_SIZE_MB} MB.")
    if not content.startswith(b"%PDF"):
        raise HTTPException(400, "Invalid PDF file (bad magic bytes).")


def temp_path(ext: str) -> Path:
    return TEMP_DIR / f"{uuid.uuid4()}.{ext}"


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/convert/word")
@limiter.limit("10/minute")
async def convert_to_word(request: Request, file: UploadFile = File(...)):
    """Convert PDF → DOCX using pdf2docx (free, offline)."""
    from pdf2docx import Converter

    content = await file.read()
    validate_pdf(file, content)

    pdf_path = temp_path("pdf")
    docx_path = temp_path("docx")

    try:
        pdf_path.write_bytes(content)
        logger.info(f"Converting {file.filename} → DOCX")

        cv = Converter(str(pdf_path))
        cv.convert(str(docx_path), start=0, end=None)
        cv.close()

        if not docx_path.exists() or docx_path.stat().st_size == 0:
            raise HTTPException(500, "Conversion produced an empty file.")

        stem = Path(file.filename).stem
        return FileResponse(
            path=str(docx_path),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename=f"{stem}.docx",
            background=None,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"DOCX conversion failed: {e}")
        raise HTTPException(500, f"Conversion failed: {str(e)}")
    finally:
        pdf_path.unlink(missing_ok=True)
        # docx cleaned up by background task after 5 min


@app.post("/convert/excel")
@limiter.limit("10/minute")
async def convert_to_excel(request: Request, file: UploadFile = File(...)):
    """Convert PDF → XLSX by extracting tables with pdfplumber (free, offline)."""
    import pdfplumber
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    content = await file.read()
    validate_pdf(file, content)

    pdf_path = temp_path("pdf")
    xlsx_path = temp_path("xlsx")

    try:
        pdf_path.write_bytes(content)
        logger.info(f"Converting {file.filename} → XLSX")

        wb = openpyxl.Workbook()
        wb.remove(wb.active)  # remove default sheet

        header_font = Font(bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill("solid", fgColor="1a1a2e")
        alt_fill = PatternFill("solid", fgColor="F2F2F7")
        thin = Side(style="thin", color="CCCCCC")
        border = Border(left=thin, right=thin, top=thin, bottom=thin)
        center = Alignment(horizontal="center", vertical="center", wrap_text=True)

        table_count = 0

        with pdfplumber.open(str(pdf_path)) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                tables = page.extract_tables()

                # Also try to extract text as a fallback sheet for page 1
                if page_num == 1 and not tables:
                    text = page.extract_text()
                    if text:
                        ws = wb.create_sheet(title="Text Content")
                        for i, line in enumerate(text.split("\n"), start=1):
                            ws.cell(row=i, column=1, value=line)
                        ws.column_dimensions["A"].width = 80
                        continue

                for t_idx, table in enumerate(tables):
                    if not table or all(all(c is None for c in row) for row in table):
                        continue

                    table_count += 1
                    sheet_name = f"P{page_num}_T{t_idx+1}" if len(tables) > 1 else f"Page {page_num}"
                    # Excel sheet names max 31 chars
                    ws = wb.create_sheet(title=sheet_name[:31])

                    for r_idx, row in enumerate(table, start=1):
                        for c_idx, cell_val in enumerate(row, start=1):
                            cell = ws.cell(row=r_idx, column=c_idx, value=cell_val or "")
                            cell.border = border
                            cell.alignment = center
                            if r_idx == 1:
                                cell.font = header_font
                                cell.fill = header_fill
                            elif r_idx % 2 == 0:
                                cell.fill = alt_fill

                    # Auto-fit columns (approximate)
                    for col in ws.columns:
                        max_len = max((len(str(c.value)) for c in col if c.value), default=10)
                        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 60)

                    ws.row_dimensions[1].height = 22

        if not wb.sheetnames:
            # No tables found — create info sheet
            ws = wb.create_sheet(title="No Tables Found")
            ws["A1"] = "No tables were detected in this PDF."
            ws["A2"] = "Try the Word conversion to preserve text layout."
            ws.column_dimensions["A"].width = 60

        wb.save(str(xlsx_path))

        stem = Path(file.filename).stem
        return FileResponse(
            path=str(xlsx_path),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename=f"{stem}.xlsx",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"XLSX conversion failed: {e}")
        raise HTTPException(500, f"Conversion failed: {str(e)}")
    finally:
        pdf_path.unlink(missing_ok=True)
