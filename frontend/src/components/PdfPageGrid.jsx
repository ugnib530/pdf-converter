/**
 * PdfPageGrid.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a responsive grid of PDF page thumbnails using pdfjs-dist, entirely
 * client-side (no upload needed just to preview). Each thumbnail can show a
 * mode-specific overlay:
 *
 *   mode="delete"  → X button per page. Click toggles "marked for deletion"
 *                    (dimmed + red strike). Click again to restore.
 *
 *   mode="rotate"  → rotate-right icon per page. Click cycles 0→90→180→270→0,
 *                    visually rotating the thumbnail via CSS transform.
 *                    (Wired into ToolPage in a later phase.)
 *
 * Thumbnails render lazily via IntersectionObserver so large PDFs (100+ pages)
 * don't render every page at once.
 *
 * Props:
 *   file              File        the PDF to render
 *   mode              "delete" | "rotate"
 *   removed           Set<number> 0-indexed pages marked for deletion (delete mode)
 *   onRemovedChange   (Set<number>) => void
 *   rotations         Map<number, number>  0-indexed page → angle (rotate mode)
 *   onRotationsChange (Map<number, number>) => void
 *   onLoaded          (numPages: number) => void   called once the PDF is parsed
 *   onError           (message: string) => void
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const THUMB_SCALE = 0.35; // render scale — small enough to be fast, big enough to read page numbers

export default function PdfPageGrid({
  file,
  mode = 'delete',
  removed = new Set(),
  onRemovedChange = () => {},
  rotations = new Map(),
  onRotationsChange = () => {},
  onLoaded = () => {},
  onError = () => {},
}) {
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ── Load the PDF whenever `file` changes ────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setPdf(null);
    setNumPages(0);

    if (!file) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const buf = await file.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: buf }).promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        onLoaded(doc.numPages);
      } catch (err) {
        if (cancelled) return;
        const msg = 'Could not preview this PDF — it may be corrupted or password-protected.';
        setLoadError(msg);
        onError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const toggleRemoved = useCallback((pageIndex) => {
    const next = new Set(removed);
    if (next.has(pageIndex)) next.delete(pageIndex);
    else next.add(pageIndex);
    onRemovedChange(next);
  }, [removed, onRemovedChange]);

  const cycleRotation = useCallback((pageIndex) => {
    const next = new Map(rotations);
    const current = next.get(pageIndex) || 0;
    const nextAngle = (current + 90) % 360;
    if (nextAngle === 0) next.delete(pageIndex);
    else next.set(pageIndex, nextAngle);
    onRotationsChange(next);
  }, [rotations, onRotationsChange]);

  const selectAll = () => onRemovedChange(new Set(Array.from({ length: numPages }, (_, i) => i)));
  const selectNone = () => onRemovedChange(new Set());
  const selectOdd  = () => onRemovedChange(new Set(Array.from({ length: numPages }, (_, i) => i).filter(i => (i + 1) % 2 === 1)));
  const selectEven = () => onRemovedChange(new Set(Array.from({ length: numPages }, (_, i) => i).filter(i => (i + 1) % 2 === 0)));

  if (loading) {
    return (
      <div style={{
        padding: '32px 0', display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 12, color: '#9ca3af', fontSize: 13,
      }}>
        <Spinner />
        Loading page previews…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{
        marginTop: 12, padding: '12px 14px',
        background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: 8, color: '#dc2626', fontSize: 13,
      }}>
        {loadError}
      </div>
    );
  }

  if (!pdf) return null;

  return (
    <div style={{ marginTop: 4 }}>
      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      {mode === 'delete' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 8, marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
            {removed.size === 0
              ? `${numPages} page${numPages === 1 ? '' : 's'}`
              : `${removed.size} of ${numPages} page${numPages === 1 ? '' : 's'} marked for removal`}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <SmallButton onClick={selectOdd}>Select odd</SmallButton>
            <SmallButton onClick={selectEven}>Select even</SmallButton>
            <SmallButton onClick={selectAll}>Select all</SmallButton>
            <SmallButton onClick={selectNone} disabled={removed.size === 0}>Clear</SmallButton>
          </div>
        </div>
      )}

      {mode === 'rotate' && (
        <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#374151' }}>
          Click a page to rotate it 90° — click again to keep rotating.
        </div>
      )}

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: 12,
        maxHeight: 480,
        overflowY: 'auto',
        padding: 4,
        border: '1px solid #f3f4f6',
        borderRadius: 10,
      }}>
        {Array.from({ length: numPages }, (_, i) => (
          <PageTile
            key={i}
            pdf={pdf}
            pageNumber={i + 1}
            isRemoved={removed.has(i)}
            rotation={rotations.get(i) || 0}
            mode={mode}
            onToggleRemoved={() => toggleRemoved(i)}
            onCycleRotation={() => cycleRotation(i)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single thumbnail tile ──────────────────────────────────────────────────────
function PageTile({ pdf, pageNumber, isRemoved, rotation, mode, onToggleRemoved, onCycleRotation }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  // Lazy-render: only start once the tile is near the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || rendered) return;
    let cancelled = false;

    (async () => {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: THUMB_SCALE });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (!cancelled) setRendered(true);
    })();

    return () => { cancelled = true; };
  }, [visible, rendered, pdf, pageNumber]);

  const onClick = mode === 'rotate' ? onCycleRotation : onToggleRemoved;

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      style={{
        position: 'relative',
        borderRadius: 8,
        border: '1.5px solid #e5e7eb',
        background: '#fff',
        overflow: 'hidden',
        cursor: 'pointer',
        aspectRatio: '3 / 4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s, opacity 0.15s',
        ...(isRemoved ? { opacity: 0.35, borderColor: '#fca5a5' } : {}),
      }}
      onMouseEnter={e => { if (!isRemoved) e.currentTarget.style.borderColor = '#a5b4fc'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isRemoved ? '#fca5a5' : '#e5e7eb'; }}
    >
      {!rendered && (
        <div style={{ width: '60%', height: '60%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner small />
        </div>
      )}

      <canvas
        ref={canvasRef}
        style={{
          display: rendered ? 'block' : 'none',
          maxWidth: '100%',
          maxHeight: '100%',
          transform: rotation ? `rotate(${rotation}deg)` : undefined,
          transition: 'transform 0.2s',
        }}
      />

      {/* Page number badge */}
      <span style={{
        position: 'absolute', bottom: 4, left: 4,
        background: 'rgba(17,24,39,0.7)', color: '#fff',
        fontSize: 11, fontWeight: 600, borderRadius: 4,
        padding: '1px 6px', lineHeight: 1.4,
      }}>
        {pageNumber}
      </span>

      {/* Delete-mode X / restore button */}
      {mode === 'delete' && (
        <span
          aria-label={isRemoved ? `Restore page ${pageNumber}` : `Remove page ${pageNumber}`}
          style={{
            position: 'absolute', top: 4, right: 4,
            width: 22, height: 22, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isRemoved ? '#fff' : 'rgba(255,255,255,0.92)',
            border: `1.5px solid ${isRemoved ? '#dc2626' : '#d1d5db'}`,
            color: isRemoved ? '#dc2626' : '#6b7280',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          {isRemoved ? (
            // restore icon (undo arrow)
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          ) : (
            // X icon
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          )}
        </span>
      )}

      {/* Rotate-mode icon */}
      {mode === 'rotate' && (
        <span style={{
          position: 'absolute', top: 4, right: 4,
          width: 22, height: 22, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: rotation ? 'var(--accent, #6366f1)' : 'rgba(255,255,255,0.92)',
          border: `1.5px solid ${rotation ? 'var(--accent, #6366f1)' : '#d1d5db'}`,
          color: rotation ? '#fff' : '#6b7280',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
        </span>
      )}

      {/* Strike-through line when removed */}
      {isRemoved && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(220,38,38,0.15) 6px, rgba(220,38,38,0.15) 8px)',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  );
}

// ── Small helpers ───────────────────────────────────────────────────────────────
function SmallButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      style={{
        fontSize: 12, fontWeight: 600,
        padding: '5px 10px', borderRadius: 6,
        border: '1.5px solid #e5e7eb',
        background: disabled ? '#f9fafb' : '#fff',
        color: disabled ? '#d1d5db' : '#374151',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Spinner({ small }) {
  const size = small ? 18 : 32;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `${small ? 2 : 3}px solid #e5e7eb`,
      borderTopColor: 'var(--accent, #6366f1)',
      animation: 'spin 0.8s linear infinite',
    }} />
  );
}
