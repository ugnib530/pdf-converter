"""
services/images_to_pdf.py
Combines one or more images (JPG, PNG, GIF, WebP) into a single PDF.

Primary:  img2pdf  — lossless embedding, fastest, best quality for photos.
Fallback: PyMuPDF  — handles formats img2pdf doesn't support (e.g. WebP, GIF).
"""
import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# img2pdf can't handle WebP or GIF — route those through PyMuPDF
_MUPDF_EXTS = {".webp", ".gif"}


def _do_convert(image_paths: list[Path], out_path: Path) -> None:
    # Split images into two groups
    mupdf_paths = [p for p in image_paths if p.suffix.lower() in _MUPDF_EXTS]
    img2pdf_paths = [p for p in image_paths if p.suffix.lower() not in _MUPDF_EXTS]

    if not mupdf_paths:
        # Pure img2pdf path — all images are compatible
        _via_img2pdf(img2pdf_paths, out_path)
    elif not img2pdf_paths:
        # All images need PyMuPDF
        _via_mupdf(mupdf_paths, out_path)
    else:
        # Mixed: convert WebP/GIF to PNG first, then merge everything via img2pdf
        import tempfile, os

        converted: list[Path] = []
        try:
            for mp in mupdf_paths:
                png_path = Path(tempfile.mktemp(suffix=".png"))
                _webp_to_png(mp, png_path)
                converted.append(png_path)
            all_paths = img2pdf_paths + converted
            _via_img2pdf(all_paths, out_path)
        finally:
            for p in converted:
                p.unlink(missing_ok=True)


def _via_img2pdf(image_paths: list[Path], out_path: Path) -> None:
    import img2pdf

    with open(str(out_path), "wb") as f:
        f.write(img2pdf.convert([str(p) for p in image_paths]))


def _via_mupdf(image_paths: list[Path], out_path: Path) -> None:
    import fitz  # PyMuPDF

    doc = fitz.open()
    for img_path in image_paths:
        img_doc = fitz.open(str(img_path))
        rect    = img_doc[0].rect
        page    = doc.new_page(width=rect.width, height=rect.height)
        page.insert_image(rect, filename=str(img_path))
        img_doc.close()
    doc.save(str(out_path))
    doc.close()


def _webp_to_png(webp_path: Path, png_path: Path) -> None:
    import fitz  # PyMuPDF

    doc = fitz.open(str(webp_path))
    pix = doc[0].get_pixmap()
    pix.save(str(png_path))
    doc.close()


async def images_to_pdf(image_paths: list[Path], out_path: Path) -> None:
    """
    Convert one or more images to a single PDF.

    Args:
        image_paths: Ordered list of image files (must exist on disk).
        out_path:    Destination PDF path.
    """
    loop = asyncio.get_event_loop()
    logger.info(f"Converting {len(image_paths)} image(s) → PDF")
    await loop.run_in_executor(None, _do_convert, image_paths, out_path)
    logger.info(f"Image→PDF complete: {out_path.stat().st_size:,} bytes")
