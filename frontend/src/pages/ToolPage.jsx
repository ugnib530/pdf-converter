/**
 * ToolPage.jsx
 * Generic two-column page for every DocShift tool.
 * Left panel: breadcrumb, heading, step tracker, options.
 * Right panel: dropzone / page grid and the result.
 *
 * All tool-specific behaviour is driven by the config object from tools.js —
 * no new component needed when adding a tool.
 */
import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import FileDropzone      from '../components/FileDropzone';
import ToolOptionsPanel  from '../components/ToolOptionsPanel';
import PdfPageGrid       from '../components/PdfPageGrid';
import ToolIcon          from '../components/ToolIcon';
import { CATEGORIES, TOOLS } from '../config/tools';
import { convertFiles, downloadBlob, ApiError } from '../api/client';
import { rangeStringFromIndices } from '../utils/pageRanges';
import { addHistoryEntry } from '../utils/history';

const STAGE = { UPLOAD: 'upload', PROCESSING: 'processing', DONE: 'done', ERROR: 'error' };

const STEPS = [
  { key: 'upload',  label: 'Upload' },
  { key: 'options', label: 'Configure' },
  { key: 'convert', label: 'Convert' },
  { key: 'done',    label: 'Download' },
];

export default function ToolPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const tool = TOOLS[slug];

  const [files,   setFiles]   = useState([]);
  const [options, setOptions] = useState(() => buildDefaultOptions(tool?.options ?? []));
  const [stage,   setStage]   = useState(STAGE.UPLOAD);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState('');

  const isPageGrid = tool?.uiMode === 'page-grid';
  const [removedPages, setRemovedPages] = useState(() => new Set());
  const [rotations,    setRotations]    = useState(() => new Map());
  const [pageCount,    setPageCount]    = useState(0);

  useEffect(() => {
    setRemovedPages(new Set());
    setRotations(new Map());
    setPageCount(0);
  }, [files]);

  // Redirect away from unknown / not-yet-available tools
  useEffect(() => {
    if (!tool || tool.phase > 2) {
      navigate('/', { replace: true });
    }
  }, [tool, navigate]);

  if (!tool || tool.phase > 2) return null;

  const accent = CATEGORIES[tool.category]?.color || '#6366f1';

  const handleOptionChange = useCallback((key, value) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleConvert = useCallback(async () => {
    if (!files.length) return;

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
      addHistoryEntry({
        slug: tool.slug, title: tool.title, icon: tool.icon,
        category: tool.category, filename: res.filename,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setError(msg);
      setStage(STAGE.ERROR);
    }
  }, [files, options, tool, isPageGrid, removedPages, pageCount]);

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

  const hasOptions = !isPageGrid && tool.options.length > 0;

  // Determine current step index for the tracker
  let currentStep = 0;
  if (stage === STAGE.PROCESSING) currentStep = 2;
  else if (stage === STAGE.DONE) currentStep = 3;
  else if (files.length > 0) currentStep = hasOptions || isPageGrid ? 1 : 1;
  const visibleSteps = hasOptions ? STEPS : STEPS.filter(s => s.key !== 'options');

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 24px 80px' }}>

      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--subtle)', marginBottom: 20,
      }}>
        <Link to="/" style={{ color: 'var(--subtle)' }}>Home</Link>
        <span>›</span>
        <Link to="/" style={{ color: 'var(--subtle)' }}>All tools</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{tool.title}</span>
      </div>

      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <span style={{
          width: 48, height: 48, borderRadius: 12,
          background: `${accent}1f`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, flexShrink: 0,
        }}>
          <ToolIcon icon={tool.icon} size={26} />
        </span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
              {tool.title}
            </h1>
            {tool.aiPowered && (
              <span style={{
                background: 'var(--warning-bg)', color: '#f59e0b',
                fontSize: 11, fontWeight: 700, borderRadius: 4,
                padding: '2px 6px',
              }}>AI-powered</span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 13.5, lineHeight: 1.5 }}>
            {tool.description}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="tool-columns" style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>

        {/* Left panel — step tracker + options */}
        <div className="tool-col-left" style={{
          width: 280, flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 20,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 18,
          }}>
            <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Steps
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(() => {
                const activeKey = STEPS[currentStep]?.key;
                let activeVisibleIndex = visibleSteps.findIndex(s => s.key === activeKey);
                if (activeVisibleIndex === -1) activeVisibleIndex = 0;
                return visibleSteps.map((step, i) => {
                  const active = stage === STAGE.DONE ? true : i <= activeVisibleIndex;
                  return (
                    <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                        background: active ? accent : 'var(--bg-card-hover)',
                        color: active ? '#fff' : 'var(--subtle)',
                      }}>
                        {i + 1}
                      </span>
                      <span style={{
                        fontSize: 13.5, fontWeight: 600,
                        color: active ? 'var(--text)' : 'var(--subtle)',
                      }}>
                        {step.label}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {hasOptions && files.length > 0 && (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 18,
            }}>
              <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: 'var(--subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Options
              </p>
              <ToolOptionsPanel
                options={tool.options}
                values={options}
                onChange={handleOptionChange}
              />
            </div>
          )}

          <p style={{
            margin: 0, textAlign: 'center', fontSize: 12, color: 'var(--subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Files are deleted from our servers within 5 minutes.
          </p>
        </div>

        {/* Right panel — dropzone / page grid / result */}
        <div className="tool-col-right" style={{
          flex: 1, minWidth: 0,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 16, padding: 24,
        }}>

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

              {error && (
                <div style={{
                  marginTop: 16, padding: '12px 14px',
                  background: 'var(--danger-bg)', border: '1px solid var(--danger)',
                  borderRadius: 8, color: 'var(--danger)', fontSize: 13,
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
                  background: canSubmit ? accent : 'var(--bg-card-hover)',
                  color: canSubmit ? '#fff' : 'var(--subtle)',
                  border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
                  transition: 'opacity 0.15s',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => canSubmit && (e.currentTarget.style.opacity = '0.88')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {tool.title}
              </button>
            </>
          )}

          {stage === STAGE.PROCESSING && (
            <div style={{
              padding: '64px 0',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 16, color: 'var(--muted)',
            }}>
              <Spinner color={accent} />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: 'var(--text)' }}>
                Processing your file…
              </p>
              <p style={{ margin: 0, fontSize: 13 }}>
                This may take a moment for larger documents.
              </p>
            </div>
          )}

          {stage === STAGE.DONE && result && (
            <div style={{
              padding: '48px 0',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 20, textAlign: 'center',
            }}>
              <span style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--success-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                  stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>

              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
                  Done! Your file is downloading.
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  {result.filename}
                </p>
              </div>

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

              <button
                onClick={handleReset}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 14, textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Convert another file
              </button>
            </div>
          )}
        </div>
      </div>
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
