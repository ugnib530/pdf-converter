/**
 * tools.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every DocShift tool.
 *
 * ADDING A NEW TOOL:
 *   1. Add an entry here.
 *   2. Wire up the backend endpoint in the appropriate router.
 *   3. That's it — ToolPage.jsx renders itself from this config.
 *
 * FIELD REFERENCE:
 *   slug        URL path, e.g. "merge-pdf" → route /merge-pdf
 *   title       Human-readable name shown in the card & page heading
 *   description Short sentence shown in the tool card and page subtitle
 *   icon        Key into the ICONS map (see components/ToolIcon.jsx)
 *   category    Groups tools on the homepage; must match a key in CATEGORIES
 *   endpoint    Backend path, relative — e.g. "/tools/merge"
 *   multiFile   true = dropzone accepts multiple files (merge, jpg-to-pdf, etc.)
 *   accept      Array of accepted extensions, e.g. [".pdf"]
 *   options     Array of option descriptor objects (see below)
 *   phase       Which dev phase adds this tool (1-5). Used to mark "Coming Soon".
 *   aiPowered   true = show the AI badge on the card
 *   uiMode      "page-grid" = ToolPage renders <PdfPageGrid> instead of
 *               <ToolOptionsPanel>. Omit for the default options-panel UI.
 *   gridMode    Required when uiMode is "page-grid". One of:
 *                 "delete" — X/restore per page, converted to a `pages`
 *                            range string for the existing delete-pages endpoint.
 *                 "rotate" — per-page rotation, converted to a rotations map
 *                            (requires backend support — see rotate.py).
 *
 * OPTION TYPES:
 *   { type: "select",     key, label, choices: [val, ...], default }
 *   { type: "password",   key, label, required? }
 *   { type: "text",       key, label, placeholder?, required? }
 *   { type: "page-range", key, label }   e.g. "1-3, 5, 7-"
 *   { type: "checkbox",   key, label, default? }
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const CATEGORIES = {
  organize:      { label: "Organize PDF",      color: "#e74c3c" },
  convert_from:  { label: "Convert from PDF",  color: "#8e44ad" },
  convert_to:    { label: "Convert to PDF",    color: "#16a085" },
  edit:          { label: "Edit & Optimize",   color: "#d35400" },
  security:      { label: "Security",          color: "#2980b9" },
  ai:            { label: "AI Tools",          color: "#f39c12" },
};

export const TOOLS = {
  // ── Convert from PDF ────────────────────────────────────────────────────────
  "pdf-to-word": {
    slug: "pdf-to-word",
    title: "PDF to Word",
    description: "Convert PDF files to editable Word documents (.docx).",
    icon: "word",
    category: "convert_from",
    endpoint: "/tools/word",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    phase: 1,
  },
  "pdf-to-excel": {
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    description: "Extract tables from a PDF into a clean Excel spreadsheet.",
    icon: "excel",
    category: "convert_from",
    endpoint: "/tools/excel",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    phase: 1,
  },
  "upi-tracker": {
    slug: "upi-tracker",
    title: "UPI Tracker",
    description: "Parse a bank statement and get a categorised UPI spending report.",
    icon: "upi",
    category: "ai",
    endpoint: "/tools/upi-tracker",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    phase: 1,
    aiPowered: true,
  },
  "pdf-to-jpg": {
    slug: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Convert each PDF page to a high-quality JPEG image.",
    icon: "image",
    category: "convert_from",
    endpoint: "/tools/jpg",
    multiFile: false,
    accept: [".pdf"],
    options: [
      { type: "select", key: "dpi", label: "Image quality (DPI)",
        choices: [72, 150, 300], default: 150 },
    ],
    phase: 2,
  },
  "pdf-to-png": {
    slug: "pdf-to-png",
    title: "PDF to PNG",
    description: "Render each PDF page as a lossless PNG image.",
    icon: "image",
    category: "convert_from",
    endpoint: "/tools/png",
    multiFile: false,
    accept: [".pdf"],
    options: [
      { type: "select", key: "dpi", label: "Image quality (DPI)",
        choices: [72, 150, 300], default: 150 },
    ],
    phase: 2,
  },
  "pdf-to-powerpoint": {
    slug: "pdf-to-powerpoint",
    title: "PDF to PowerPoint",
    description: "Turn PDF pages into slides — each page becomes one slide.",
    icon: "powerpoint",
    category: "convert_from",
    endpoint: "/tools/powerpoint",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    phase: 4,
  },
  "extract-images": {
    slug: "extract-images",
    title: "Extract Images",
    description: "Pull all embedded images out of a PDF as a ZIP file.",
    icon: "extract",
    category: "convert_from",
    endpoint: "/tools/extract-images",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    phase: 2,
  },

  // ── Organize PDF ────────────────────────────────────────────────────────────
  "merge-pdf": {
    slug: "merge-pdf",
    title: "Merge PDF",
    description: "Combine multiple PDF files into one, in the order you choose.",
    icon: "merge",
    category: "organize",
    endpoint: "/tools/merge",
    multiFile: true,
    accept: [".pdf"],
    options: [],
    phase: 2,
  },
  "split-pdf": {
    slug: "split-pdf",
    title: "Split PDF",
    description: "Divide a PDF by page ranges or split every page into its own file.",
    icon: "split",
    category: "organize",
    endpoint: "/tools/split",
    multiFile: false,
    accept: [".pdf"],
    options: [
      { type: "page-range", key: "ranges",
        label: "Page ranges (e.g. 1-3, 5, 7-) — leave blank to split every page" },
    ],
    phase: 2,
  },
  "delete-pages": {
    slug: "delete-pages",
    title: "Delete Pages",
    description: "Remove specific pages from a PDF.",
    icon: "delete",
    category: "organize",
    endpoint: "/tools/delete-pages",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    uiMode: "page-grid",
    gridMode: "delete",
    phase: 2,
  },
  "rotate-pdf": {
    slug: "rotate-pdf",
    title: "Rotate PDF",
    description: "Rotate one or all pages by 90, 180, or 270 degrees.",
    icon: "rotate",
    category: "organize",
    endpoint: "/tools/rotate",
    multiFile: false,
    accept: [".pdf"],
    options: [
      { type: "select", key: "angle", label: "Rotation",
        choices: [90, 180, 270], default: 90 },
      { type: "page-range", key: "pages",
        label: "Pages to rotate (leave blank for all)" },
    ],
    phase: 2,
  },

  // ── Convert to PDF ──────────────────────────────────────────────────────────
  "jpg-to-pdf": {
    slug: "jpg-to-pdf",
    title: "JPG to PDF",
    description: "Combine one or more images (JPG, PNG) into a single PDF.",
    icon: "imageToPdf",
    category: "convert_to",
    endpoint: "/tools/images-to-pdf",
    multiFile: true,
    accept: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    options: [],
    phase: 2,
  },
  "word-to-pdf": {
    slug: "word-to-pdf",
    title: "Word to PDF",
    description: "Convert Word documents (.docx, .doc) to PDF.",
    icon: "word",
    category: "convert_to",
    endpoint: "/tools/word-to-pdf",
    multiFile: false,
    accept: [".docx", ".doc"],
    options: [],
    phase: 5,
  },
  "excel-to-pdf": {
    slug: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Convert Excel spreadsheets (.xlsx, .xls) to PDF.",
    icon: "excel",
    category: "convert_to",
    endpoint: "/tools/excel-to-pdf",
    multiFile: false,
    accept: [".xlsx", ".xls"],
    options: [],
    phase: 5,
  },
  "powerpoint-to-pdf": {
    slug: "powerpoint-to-pdf",
    title: "PowerPoint to PDF",
    description: "Convert PowerPoint presentations (.pptx, .ppt) to PDF.",
    icon: "powerpoint",
    category: "convert_to",
    endpoint: "/tools/powerpoint-to-pdf",
    multiFile: false,
    accept: [".pptx", ".ppt"],
    options: [],
    phase: 5,
  },

  // ── Edit & Optimize ─────────────────────────────────────────────────────────
  "compress-pdf": {
    slug: "compress-pdf",
    title: "Compress PDF",
    description: "Reduce PDF file size by downsampling images and recompressing streams.",
    icon: "compress",
    category: "edit",
    endpoint: "/tools/compress",
    multiFile: false,
    accept: [".pdf"],
    options: [
      { type: "select", key: "quality", label: "Compression level",
        choices: ["screen", "ebook", "printer", "prepress"], default: "ebook" },
    ],
    phase: 3,
  },
  "repair-pdf": {
    slug: "repair-pdf",
    title: "Repair PDF",
    description: "Attempt to fix a corrupted or broken PDF file.",
    icon: "repair",
    category: "edit",
    endpoint: "/tools/repair",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    phase: 3,
  },
  "flatten-pdf": {
    slug: "flatten-pdf",
    title: "Flatten PDF",
    description: "Flatten form fields and annotations into permanent page content.",
    icon: "flatten",
    category: "edit",
    endpoint: "/tools/flatten",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    phase: 3,
  },
  "pdf-to-pdfa": {
    slug: "pdf-to-pdfa",
    title: "PDF to PDF/A",
    description: "Convert a PDF to the archival PDF/A format for long-term preservation.",
    icon: "archive",
    category: "edit",
    endpoint: "/tools/pdfa",
    multiFile: false,
    accept: [".pdf"],
    options: [],
    phase: 3,
  },

  // ── Security ────────────────────────────────────────────────────────────────
  "protect-pdf": {
    slug: "protect-pdf",
    title: "Protect PDF",
    description: "Password-protect a PDF to restrict opening or editing.",
    icon: "lock",
    category: "security",
    endpoint: "/tools/protect",
    multiFile: false,
    accept: [".pdf"],
    options: [
      { type: "password", key: "password", label: "Set password", required: true },
    ],
    phase: 2,
  },
  "unlock-pdf": {
    slug: "unlock-pdf",
    title: "Unlock PDF",
    description: "Remove a known password from a PDF. Cannot crack unknown passwords.",
    icon: "unlock",
    category: "security",
    endpoint: "/tools/unlock",
    multiFile: false,
    accept: [".pdf"],
    options: [
      { type: "password", key: "password", label: "Current password", required: false },
    ],
    phase: 2,
  },
  "redact-pdf": {
    slug: "redact-pdf",
    title: "Redact PDF",
    description: "Permanently black out sensitive text — content is removed, not just hidden.",
    icon: "redact",
    category: "security",
    endpoint: "/tools/redact",
    multiFile: false,
    accept: [".pdf"],
    options: [
      { type: "text", key: "terms",
        label: "Words / phrases to redact (comma-separated)", required: true },
    ],
    phase: 3,
  },
};

/** Ordered array of all tools — useful for iterating. */
export const TOOLS_LIST = Object.values(TOOLS);

/** Tools grouped by category. */
export function getToolsByCategory() {
  return TOOLS_LIST.reduce((acc, tool) => {
    if (!acc[tool.category]) acc[tool.category] = [];
    acc[tool.category].push(tool);
    return acc;
  }, {});
}

/** Return only live tools (phase 1). */
export function getLiveTools() {
  return TOOLS_LIST.filter(t => t.phase === 1);
}

/** Return tools whose title/description fuzzy-matches a query string. */
export function searchTools(query) {
  const q = query.toLowerCase().trim();
  if (!q) return TOOLS_LIST;
  return TOOLS_LIST.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q),
  );
}
