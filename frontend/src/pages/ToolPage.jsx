/**
 * ToolPage.jsx
 * Generic page for every DocShift tool.
 * All tool-specific behaviour is driven by the config object from tools.js —
 * no new component needed when adding a tool.
 *
 * Props:
 *   tool     Tool config object from tools.js
 *   onBack   () => void   navigate back to homepage
 */
import { useState, useCallback, useEffect } from 'react';
import FileDropzone      from '../components/FileDropzone';
import ToolOptionsPanel  from '../components/ToolOptionsPanel';
import PdfPageGrid       from '../components/PdfPageGrid';
import ToolIcon          from '../components/ToolIcon';
import { CATEGORIES }    from '../config/tools';
import { convertFiles, downloadBlob, ApiError } from '../api/client';
import { rangeStringFromIndices } from '../utils/pageRanges';

// ── Stage constants ────────────────────────────────────────────────────────────
const STAGE = { UPLOAD: 'upload', PROCESSING: 'processing', DONE: 'done', ERROR: 'error' };

export default function ToolPage({ tool, onBack }) {
  const [files,   setFiles]   = useState([]);
  const [options, setOptions] = useState(() => buildDefaultOptions(tool.options));
  const [stage,   setStage]   = useState(STAGE.UPLOAD);
  const [result,  setResult]  = useState(null);   // { blob, filename }
  const [error,   setError]   = useState('');

  // ── Page-grid state (Delete Pages / Rotate, etc.) ────────────────────────────
  const isPageGrid = tool.uiMode === 'page-grid';
  const [removedPages,  setRemovedPages]  = useState(() => new Set());
  const [rotations,     setRotations]     = useState(() => new Map());
  const [pageCount,     setPageCount]     = useState(0);

  // Reset grid selection whenever the uploaded file changes
  useEffect(() => {
    setRemovedPages(new Set());
    setRotations(new Map());
    setPageCount(0);
  }, [files]);

  const accent = CATEGORIES[tool.category]?.color || '#6366f1';

  const handleOptionChange = useCallback((key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleConvert = useCallback(async () => {
    if (!files.length) return;

    // Page-grid tools (e.g. Delete Pages) compute their options from the
    // visual selection rather than ToolOptionsPanel inputs.
    let submitOptions = options;
    if (isPageGrid && tool.gridMode === 'delete') {
      if (removedPages.size === 0) {
        setError('Tap the X on at least one page to mark it for deletion.');
        setStage(STAGE.ERROR);
        return;
      }
      if (removedPages.size === pageCount) {
        setError('You cannot delete every page — at least one page must remain.');
        setStage(STAGE.ERROR);
        return;
      }
      submitOptions = { ...options, pages: rangeStringFromIndices(removedPages) };
    }

    setStage(STAGE.PROCESSING);
    setError('');

    try {
      const res = await convertFiles(tool.endpoint, files, submitOptions);
      setResult(res);
      downloadBlob(res.blob, res.filename);
      setStage(STAGE.DONE);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setError(msg);
      setStage(STAGE.ERROR);
    }
  }, [files, options, tool.endpoint, isPageGrid, tool.gridMode, removedPages, pageCount]);

  const handleReset = () => {
    setFiles([]);
    setOptions(buildDefaultOptions(tool.options));
    setRemovedPages(new Set());
    setRotations(new Map());
    setPageCount(0);
    setStage(STAGE.UPLOAD);
    setResult(null);
    setError('');
  };

  const canSubmit = files.length > 0 && stage === STAGE.UPLOAD
    && (!isPageGrid || tool.gridMode !== 'delete' || removedPages.size > 0);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>

      {/* ── Back link ──────────────────────────────────────────────────────── */}
      <button
        onClick={onBack}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          color: '#6b7280', fontSize: 14, fontWeight: 500, marginBottom: 24,
          padding: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        All Tools
      </button>

      {/* ── Tool heading ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <span style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${accent}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, flexShrink: 0,
        }}>
          <ToolIcon icon={tool.icon} size={26} />
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#111827' }}>
            {tool.title}
          </h1>
          {tool.aiPowered && (
            <span style={{
              display: 'inline-block', marginTop: 4,
              background: '#fef3c7', color: '#92400e',
              fontSize: 11, fontWeight: 700, borderRadius: 4,
              padding: '2px 6px',
            }}>AI-powered</span>
          )}
        </div>
      </div>
      <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
        {tool.description}
      </p>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        border: '1.5px solid #e5e7eb',
        borderRadius: 16,
        padding: 24,
      }}>

        {/* UPLOAD stage */}
        {(stage === STAGE.UPLOAD || stage === STAGE.ERROR) && (
          <>
            <FileDropzone
              accept={tool.accept}
              multiFile={tool.multiFile}
              files={files}
              onChange={setFiles}
            />

            {isPageGrid && files.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <PdfPageGrid
                  file={files[0]}
                  mode={tool.gridMode}
                  removed={removedPages}
                  onRemovedChange={setRemovedPages}
                  rotations={rotations}
                  onRotationsChange={setRotations}
                  onLoaded={setPageCount}
                  onError={(msg) => { setError(msg); setStage(STAGE.ERROR); }}
                />
              </div>
            )}

            {!isPageGrid && tool.options.length > 0 && files.length > 0 && (
              <ToolOptionsPanel
                options={tool.options}
                values={options}
                onChange={handleOptionChange}
              />
            )}

            {error && (
              <div style={{
                marginTop: 16, padding: '12px 14px',
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, color: '#dc2626', fontSize: 13,
                display: 'flex', gap: 8, alignItems: 'flex-start',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleConvert}
              disabled={!canSubmit}
              style={{
                marginTop: 20, width: '100%',
                padding: '13px 20px',
                background: canSubmit ? accent : '#e5e7eb',
                color: canSubmit ? '#fff' : '#9ca3af',
                border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
                transition: 'opacity 0.15s, transform 0.1s',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => canSubmit && (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {tool.title}
            </button>
          </>
        )}

        {/* PROCESSING stage */}
        {stage === STAGE.PROCESSING && (
          <div style={{
            padding: '48px 0',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 16, color: '#6b7280',
          }}>
            <Spinner color={accent} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
              Processing your file…
            </p>
            <p style={{ margin: 0, fontSize: 13 }}>
              This may take a moment for larger documents.
            </p>
          </div>
        )}

        {/* DONE stage */}
        {stage === STAGE.DONE && result && (
          <div style={{
            padding: '32px 0',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 20, textAlign: 'center',
          }}>
            {/* Success check */}
            <span style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#d1fae5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>

            <div>
              <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, color: '#111827' }}>
                Done! Your file is downloading.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
                {result.filename}
              </p>
            </div>

            {/* Re-download */}
            <button
              onClick={() => downloadBlob(result.blob, result.filename)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 18px',
                background: accent, color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download again
            </button>

            {/* Convert another */}
            <button
              onClick={handleReset}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#6b7280', fontSize: 14, textDecoration: 'underline',
                padding: 0,
              }}
            >
              Convert another file
            </button>
          </div>
        )}
      </div>

      {/* ── Privacy note ──────────────────────────────────────────────────── */}
      <p style={{
        marginTop: 16, textAlign: 'center', fontSize: 12, color: '#9ca3af',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        Files are automatically deleted from our servers within 5 minutes.
      </p>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildDefaultOptions(optionDescriptors) {
  return Object.fromEntries(
    optionDescriptors.map(o => [o.key, o.default ?? '']),
  );
}

function Spinner({ color = '#6366f1' }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      border: `3px solid ${color}30`,
      borderTopColor: color,
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}
