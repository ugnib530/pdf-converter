/**
 * api/client.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin wrapper around fetch() for DocShift API calls.
 *
 * Two base URLs:
 *   VITE_API_URL         → api-core  (Tier 1-3 tools, always deployed)
 *   VITE_API_OFFICE_URL  → api-office (LibreOffice tools, Phase 5)
 *
 * All tool endpoints accept multipart/form-data and return either:
 *   • A file stream (download)
 *   • A JSON error  { error: string, code?: string }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { API_URL } from '../config/config';
const API_CORE   = API_URL;
const API_OFFICE = import.meta.env.VITE_API_OFFICE_URL || API_CORE;

/**
 * Determine which base URL to use for a given endpoint path.
 * Office-to-PDF tools (Phase 5) hit api-office; everything else hits api-core.
 */
function baseFor(endpoint) {
  const officeEndpoints = [
    '/tools/word-to-pdf',
    '/tools/excel-to-pdf',
    '/tools/powerpoint-to-pdf',
    '/tools/openoffice-to-pdf',
    '/tools/ebook-to-pdf',
  ];
  return officeEndpoints.includes(endpoint) ? API_OFFICE : API_CORE;
}

/**
 * Convert one or more files with an optional options object.
 *
 * @param {string}   endpoint  - Tool endpoint path, e.g. "/tools/merge"
 * @param {File[]}   files     - Array of File objects (single or multi-upload)
 * @param {object}   [options] - Extra form fields (password, angle, etc.)
 * @param {Function} [onProgress] - Called with a progress string (upload only)
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function convertFiles(endpoint, files, options = {}, onProgress) {
  const form = new FormData();

  // The backend expects the field name "file" for single-file tools
  // and "files" for multi-file tools (merge, images-to-pdf).
  // We always send "files" when multiFile mode produced >1 file,
  // and "file" for single uploads — matching FastAPI's parameter names.
  if (files.length === 1) {
    form.append('file', files[0]);
  } else {
    files.forEach(f => form.append('files', f));
  }
  // Note: /tools/merge and /tools/images-to-pdf both declare
  // `files: List[UploadFile]` so the plural field name is correct.

  // Append each option as a separate form field
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      form.append(key, String(value));
    }
  });

  const url = baseFor(endpoint) + endpoint;

  let response;
  try {
    response = await fetch(url, { method: 'POST', body: form });
  } catch (networkErr) {
    throw new ApiError('Network error — check your connection.', 'NETWORK_ERROR', 0);
  }

  if (!response.ok) {
    // Try to parse a structured error body; fall back to status text.
    let errorBody = {};
    try {
      const ct = response.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        errorBody = await response.json();
      }
    } catch (_) { /* ignore */ }

    const message =
      (errorBody.detail?.error)    ||
      (typeof errorBody.detail === 'string' ? errorBody.detail : null) ||
      errorBody.error               ||
      response.statusText           ||
      'An unknown error occurred.';

    const code =
      errorBody.detail?.code || errorBody.code || `HTTP_${response.status}`;

    throw new ApiError(message, code, response.status);
  }

  // Derive a download filename from the Content-Disposition header.
  const disposition = response.headers.get('content-disposition') || '';
  const filenameMatch = disposition.match(/filename\*?=["']?([^"';\n]+)["']?/i);
  const filename = filenameMatch
    ? decodeURIComponent(filenameMatch[1])
    : 'output' + extensionFor(response.headers.get('content-type'));

  const blob = await response.blob();
  return { blob, filename };
}

/**
 * Trigger a browser download for the given blob.
 *
 * @param {Blob}   blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Ping /health on the core API. */
export async function checkHealth() {
  try {
    const r = await fetch(API_CORE + '/health');
    return r.ok;
  } catch {
    return false;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function extensionFor(contentType) {
  const map = {
    'application/pdf':              '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':       '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'image/jpeg':                   '.jpg',
    'image/png':                    '.png',
    'application/zip':              '.zip',
  };
  const base = (contentType || '').split(';')[0].trim();
  return map[base] || '';
}

// ── Custom error class ────────────────────────────────────────────────────────
export class ApiError extends Error {
  /**
   * @param {string} message  Human-readable message
   * @param {string} code     Machine-readable code (e.g. "WRONG_PASSWORD")
   * @param {number} status   HTTP status code (0 = network error)
   */
  constructor(message, code, status) {
    super(message);
    this.name   = 'ApiError';
    this.code   = code;
    this.status = status;
  }
}
