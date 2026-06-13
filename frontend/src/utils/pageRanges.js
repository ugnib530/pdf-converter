/**
 * utils/pageRanges.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts between:
 *   - a Set/array of 0-indexed page numbers (how PdfPageGrid tracks selection)
 *   - the 1-indexed, comma/dash range string the backend expects
 *     (e.g. "2,4-6,9" — see backend/core/page_ranges.py)
 *
 * Used by ToolPage when a tool's UI is a visual page grid instead of a
 * text-based page-range input, so the existing backend endpoints need
 * zero changes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Convert a collection of 0-indexed page numbers into a compact
 * 1-indexed range string, e.g. [1, 3, 4, 5, 8] → "2,4-6,9"
 *
 * @param {Iterable<number>} indices     0-indexed page numbers
 * @returns {string}                     Range string, or "" if empty
 */
export function rangeStringFromIndices(indices) {
  const sorted = [...new Set(indices)].sort((a, b) => a - b).map(i => i + 1); // → 1-indexed
  if (!sorted.length) return '';

  const parts = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = prev = n;
  }
  parts.push(start === prev ? `${start}` : `${start}-${prev}`);

  return parts.join(',');
}

/**
 * Inverse of rangeStringFromIndices — parse a 1-indexed range string
 * back into a Set of 0-indexed page numbers. Lenient: ignores malformed
 * segments rather than throwing, since this is only used for restoring
 * UI state.
 *
 * @param {string} rangeStr
 * @returns {Set<number>}
 */
export function indicesFromRangeString(rangeStr) {
  const result = new Set();
  if (!rangeStr || !rangeStr.trim()) return result;

  for (const rawPart of rangeStr.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;

    if (part.includes('-')) {
      const [a, b] = part.split('-', 2).map(s => s.trim());
      const start = a ? parseInt(a, 10) : 1;
      const end = b ? parseInt(b, 10) : start;
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      for (let p = start; p <= end; p++) result.add(p - 1);
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n)) result.add(n - 1);
    }
  }
  return result;
}
