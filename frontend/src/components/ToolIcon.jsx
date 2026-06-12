/**
 * ToolIcon.jsx
 * Maps icon keys (from tools.js) to inline SVG elements.
 * All icons are 24×24 viewBox, stroke-based, consistent weight.
 */

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: "1.8",
                 strokeLinecap: "round", strokeLinejoin: "round" };

const icons = {
  word: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 13l1.5 4 1.5-4 1.5 4 1.5-4"/>
    </svg>
  ),
  excel: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="16" y2="17"/>
      <line x1="10" y1="9" x2="10" y2="21"/>
      <line x1="14" y1="9" x2="14" y2="21"/>
    </svg>
  ),
  powerpoint: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <circle cx="10" cy="14" r="2"/>
      <path d="M10 12v-2m4 4h-4"/>
    </svg>
  ),
  upi: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/>
      <path d="M7 15h2"/><path d="M12 15h5"/>
    </svg>
  ),
  image: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  imageToPdf: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <rect x="3" y="3" width="13" height="13" rx="1"/>
      <circle cx="7.5" cy="7.5" r="1.5"/>
      <polyline points="16 11 11 6 3 16"/>
      <path d="M16 8h5v13H8v-5"/>
    </svg>
  ),
  merge: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M8 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3"/>
      <path d="M8 3h8v4H8z"/>
      <path d="M12 12v5m-2-2l2 2 2-2"/>
    </svg>
  ),
  split: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="4" y1="14" x2="20" y2="14" strokeDasharray="3 2"/>
    </svg>
  ),
  delete: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="14" x2="15" y2="14"/>
    </svg>
  ),
  rotate: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M10 16.5a3 3 0 1 0 4 0" />
      <polyline points="14 14 14 17 17 17"/>
    </svg>
  ),
  compress: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="8 16 12 12 16 16"/>
      <line x1="12" y1="12" x2="12" y2="19"/>
    </svg>
  ),
  repair: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3-3a1 1 0 0 0 0-1.4l-1.6-1.6a1 1 0 0 0-1.4 0l-3 3Z"/>
      <path d="m16.5 5.5-4.4 4.4L7 15l-4 5 5-4 5.1-5.1L17.5 6.5"/>
    </svg>
  ),
  flatten: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  ),
  archive: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <polyline points="21 8 21 21 3 21 3 8"/>
      <rect x="1" y="3" width="22" height="5"/>
      <line x1="10" y1="12" x2="14" y2="12"/>
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  unlock: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>
  ),
  redact: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <rect x="7" y="13" width="10" height="3" fill="currentColor" stroke="none"/>
    </svg>
  ),
  extract: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <rect x="7" y="11" width="5" height="5" rx="1"/>
      <polyline points="14 13 16 13 16 18 14 18"/>
    </svg>
  ),
  pdf: (
    <svg viewBox="0 0 24 24" {...STROKE}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
};

/**
 * @param {{ icon: string, size?: number, className?: string }} props
 */
export default function ToolIcon({ icon, size = 24, className = '' }) {
  const svg = icons[icon] || icons.pdf;
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}
    >
      {svg}
    </span>
  );
}
