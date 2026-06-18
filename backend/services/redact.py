import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)
REDACT_FILL = (0, 0, 0)


def _do_redact(pdf_path: Path, out_path: Path, terms: list[str]) -> int:
    import fitz
    doc = fitz.open(str(pdf_path))
    total_hits = 0
    try:
        for page in doc:
            page_hits = 0
            for term in terms:
                for rect in page.search_for(term):
                    page.add_redact_annot(rect, fill=REDACT_FILL)
                    page_hits += 1
            if page_hits:
                page.apply_redactions()
                total_hits += page_hits
        doc.save(str(out_path), garbage=4, deflate=True)
    finally:
        doc.close()
    return total_hits


async def redact_pdf(pdf_path: Path, out_path: Path, terms_str: str) -> int:
    terms = [t.strip() for t in terms_str.split(",") if t.strip()]
    if not terms:
        raise ValueError("Please provide at least one word or phrase to redact.")

    loop = asyncio.get_event_loop()
    hit_count = await loop.run_in_executor(None, _do_redact, pdf_path, out_path, terms)

    if hit_count == 0:
        raise ValueError(
            "None of the specified terms were found in this document's text. "
            "Note: redaction can't find text inside scanned/image pages."
        )
    return hit_count