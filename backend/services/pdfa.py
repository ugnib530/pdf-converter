import logging
from pathlib import Path

from core.config import GS_BIN, ICC_PROFILE_PATH
from core.file_handling import temp_path
from core.shell import run_subprocess

logger = logging.getLogger(__name__)

_PDFA_DEF_TEMPLATE = """%!
[ /Title (Converted to PDF/A by DocShift)
  /DOCINFO pdfmark

/ICCProfile ({icc_path})
def

[/_objdef {{icc_PDFA}} /type /stream /OBJ pdfmark
[{{icc_PDFA}}

  /N currentpagedevice /ProcessColorModel get
    dup /DeviceGray eq {{pop 1}}{{
    dup /DeviceRGB eq {{pop 3}}{{
    dup /DeviceCMYK eq {{pop 4}}{{pop 3}} ifelse}} ifelse}} ifelse
>> /PUT pdfmark
[{{icc_PDFA}} ICCProfile (r) file /PUT pdfmark
[/_objdef {{OutputIntent_PDFA}} /type /dict /OBJ pdfmark
[{{OutputIntent_PDFA}} 
  /Type /OutputIntent
  /S /GTS_PDFA1
  /DestOutputProfile {{icc_PDFA}}
  /OutputConditionIdentifier (sRGB)
>> /PUT pdfmark
[{{Catalog}} <</OutputIntents [ {{OutputIntent_PDFA}} ]>> /PUT pdfmark
"""


async def pdf_to_pdfa(pdf_path: Path, out_path: Path) -> None:
    if not ICC_PROFILE_PATH:
        raise RuntimeError(
            "PDF/A conversion needs an ICC colour profile, and none was found on this server. "
            "Set ICC_PROFILE_PATH to a valid .icc file."
        )

    prefix_path = temp_path("ps")
    prefix_path.write_text(_PDFA_DEF_TEMPLATE.format(icc_path=ICC_PROFILE_PATH))

    cmd = [
        GS_BIN, "-dPDFA=2", "-dBATCH", "-dNOPAUSE", "-dQUIET",
        "-sColorConversionStrategy=RGB", "-sDEVICE=pdfwrite",
        "-dPDFACompatibilityPolicy=1",
        f"--permit-file-read={ICC_PROFILE_PATH}",
        f"-sOutputFile={out_path}",
        str(prefix_path), str(pdf_path),
    ]

    try:
        await run_subprocess(cmd, timeout=180)
    finally:
        prefix_path.unlink(missing_ok=True)

    if not out_path.exists() or out_path.stat().st_size == 0:
        raise RuntimeError("PDF/A conversion produced an empty file.")