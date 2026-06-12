/**
 * FileDropzone.jsx
 * Drag-drop + click-to-upload zone used by every tool page.
 *
 * Props:
 *   accept      string[]   e.g. [".pdf"] — passed to <input accept>
 *   multiFile   boolean    allow selecting multiple files
 *   files       File[]     current file list (controlled)
 *   onChange    (File[]) => void  called when files change
 *   maxMB       number     client-side size guard (default 50)
 */
import { useRef, useState, useCallback } from 'react';

const MAX_MB_DEFAULT = 50;

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileDropzone({
  accept = ['.pdf'],
  multiFile = false,
  files = [],
  onChange,
  maxMB = MAX_MB_DEFAULT,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState('');

  const acceptString = accept.join(',');

  const handleFiles = useCallback(
    (incoming) => {
      setSizeError('');
      const tooBig = Array.from(incoming).filter(
        (f) => f.size > maxMB * 1024 * 1024,
      );
      if (tooBig.length) {
        setSizeError(
          `${tooBig[0].name} exceeds the ${maxMB} MB limit. Please use a smaller file.`,
        );
        return;
      }
      const next = multiFile
        ? [...files, ...Array.from(incoming)]
        : [incoming[0]];
      onChange(next);
    },
    [files, multiFile, maxMB, onChange],
  );

  const onInputChange = (e) => {
    if (e.target.files?.length) handleFiles(e.target.files);
    e.target.value = '';          // reset so same file can be re-selected
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeFile = (idx) => {
    onChange(files.filter((_, i) => i !== idx));
    setSizeError('');
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : '#d1d5db'}`,
          borderRadius: 12,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'var(--accent-light, #f0f9ff)' : '#fafafa',
          transition: 'border-color 0.2s, background 0.2s',
          userSelect: 'none',
        }}
      >
        {/* Upload icon */}
        <svg
          width="40" height="40" viewBox="0 0 24 24" fill="none"
          stroke={dragging ? 'var(--accent)' : '#9ca3af'}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ margin: '0 auto 12px' }}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>

        <p style={{ margin: 0, fontWeight: 600, color: '#374151', fontSize: 15 }}>
          {dragging
            ? 'Drop to upload'
            : `Click to select${multiFile ? ' files' : ' a file'}`}
        </p>
        <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: 13 }}>
          or drag &amp; drop · {accept.join(', ')} · max {maxMB} MB
          {multiFile && ' · multiple files allowed'}
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={acceptString}
          multiple={multiFile}
          onChange={onInputChange}
          style={{ display: 'none' }}
          tabIndex={-1}
        />
      </div>

      {/* Size error */}
      {sizeError && (
        <p style={{
          marginTop: 8, color: '#dc2626', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {sizeError}
        </p>
      )}

      {/* File list */}
      {files.length > 0 && (
        <ul style={{
          listStyle: 'none', margin: '12px 0 0', padding: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {files.map((f, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 12px', background: '#f3f4f6', borderRadius: 8,
              fontSize: 13, color: '#374151',
            }}>
              {/* file icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>
                {formatSize(f.size)}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                aria-label={`Remove ${f.name}`}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 2, color: '#9ca3af', display: 'flex', alignItems: 'center',
                  borderRadius: 4, transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.color = '#9ca3af'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
