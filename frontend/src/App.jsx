import { useState, useRef, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''
const MAX_MB = 50

const IconUpload = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const IconWord = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M9 13l1.5 4 1.5-4 1.5 4 1.5-4"/>
  </svg>
)

const IconExcel = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="16" y2="17"/>
    <line x1="10" y1="9" x2="10" y2="21"/>
    <line x1="14" y1="9" x2="14" y2="21"/>
  </svg>
)

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="0"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 16, height: 16,
      border: '2px solid rgba(255,255,255,0.2)',
      borderTopColor: '#111', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

// ── Converter Widget (reused in hero) ─────────────────────────────────────────
function ConverterWidget() {
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [converting, setConverting] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = useCallback((f) => {
    setError(null); setResult(null)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are supported.'); return }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`File too large. Max is ${MAX_MB} MB.`); return }
    setFile(f)
  }, [])

  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }

  const convert = async (format) => {
    if (!file || converting) return
    setError(null); setResult(null); setConverting(format)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${API_BASE}/convert/${format === 'word' ? 'word' : 'excel'}`, { method: 'POST', body })
      if (!res.ok) {
        let msg = `Error ${res.status}`
        try { const j = await res.json(); msg = j.detail || msg } catch {}
        if (res.status === 429) msg = 'Rate limit reached. Please wait a minute.'
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const stem = file.name.replace(/\.pdf$/i, '')
      setResult({ url, name: `${stem}.${format === 'word' ? 'docx' : 'xlsx'}`, format })
    } catch (err) {
      setError(err.message || 'Conversion failed.')
    } finally {
      setConverting(null)
    }
  }

  const reset = () => { setFile(null); setResult(null); setError(null); if (inputRef.current) inputRef.current.value = '' }

  const download = () => {
    if (!result) return
    const a = document.createElement('a'); a.href = result.url; a.download = result.name; a.click()
  }

  const isConverting = converting !== null

  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #2a2a2a' }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#fff', marginBottom: 2 }}>Convert your PDF</div>
        <div style={{ fontSize: 12, color: '#666' }}>Drop a file or click to browse</div>
      </div>

      {!result ? (
        <>
          <div
            onClick={() => !isConverting && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            style={{
              padding: '36px 24px', borderBottom: '1px solid #2a2a2a',
              textAlign: 'center', cursor: isConverting ? 'not-allowed' : 'pointer',
              background: drag ? '#222' : '#161616',
              outline: drag ? '2px solid #f5c400' : 'none', outlineOffset: -2,
            }}
          >
            {file ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left' }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#ddd', wordBreak: 'break-all' }}>{file.name}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#555', marginTop: 3 }}>{formatSize(file.size)}</div>
                </div>
                {!isConverting && (
                  <button onClick={(e) => { e.stopPropagation(); reset() }}
                    style={{ background: 'none', border: '1px solid #333', color: '#666', cursor: 'pointer', padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <IconX /> Remove
                  </button>
                )}
              </div>
            ) : (
              <>
                <div style={{ color: '#555', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><IconUpload /></div>
                <div style={{ fontSize: 13, color: '#ccc', fontWeight: 500, marginBottom: 4 }}>Drop your PDF here</div>
                <div style={{ fontSize: 11, color: '#555' }}>PDF files up to {MAX_MB} MB</div>
              </>
            )}
            <input ref={inputRef} type="file" accept=".pdf,application/pdf"
              onChange={(e) => handleFile(e.target.files?.[0])} style={{ display: 'none' }} disabled={isConverting} />
          </div>

          {error && (
            <div style={{ padding: '12px 24px', background: '#1f0000', borderBottom: '1px solid #2a2a2a', fontSize: 12, color: '#ff6b6b', fontFamily: 'JetBrains Mono, monospace' }}>
              ⚠ {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {[
              { fmt: 'word', label: 'To Word', Icon: IconWord },
              { fmt: 'excel', label: 'To Excel', Icon: IconExcel },
            ].map(({ fmt, label, Icon }) => {
              const disabled = !file || isConverting
              const active = converting === fmt
              return (
                <button key={fmt} onClick={() => convert(fmt)} disabled={disabled}
                  style={{
                    padding: '16px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
                    background: active ? '#f5c400' : disabled ? '#141414' : '#1a1a1a',
                    color: active ? '#111' : disabled ? '#444' : '#ccc',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                    borderRight: fmt === 'word' ? '1px solid #2a2a2a' : 'none',
                    transition: 'background 0.15s, color 0.15s',
                  }}>
                  {active ? <Spinner /> : <Icon />}
                  {active ? 'Converting…' : label}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, background: '#f5c400', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <IconCheck />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Conversion complete</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{result.name}</div>
            </div>
          </div>
          <button onClick={download}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, background: '#f5c400', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#111', fontFamily: 'Inter, sans-serif' }}>
            <IconDownload /> Download {result.format === 'word' ? 'Word' : 'Excel'} file
          </button>
          <button onClick={reset}
            style={{ padding: 12, background: 'none', border: '1px solid #2a2a2a', cursor: 'pointer', fontSize: 13, color: '#666', fontFamily: 'Inter, sans-serif' }}>
            Convert another file
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#fff', color: '#111' }}>

      {/* Nav */}
      <nav style={{ background: '#111', height: 60, padding: '0 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>
          PDF<span style={{ color: '#f5c400' }}>.</span>Tech
        </div>
        <div style={{ display: 'flex', gap: 32 }}>
          {['Features', 'How it works', 'Support'].map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(' ', '-')}`}
              style={{ color: '#777', fontSize: 13, textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <a href="#converter" style={{ background: '#f5c400', color: '#111', padding: '8px 20px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          Convert Now
        </a>
      </nav>

      {/* Hero */}
      <section id="converter" style={{ background: '#111', padding: '80px 48px 72px', display: 'flex', alignItems: 'flex-start', gap: 64, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 280, paddingTop: 8 }}>
          <div style={{ display: 'inline-block', background: '#1e1e1e', color: '#f5c400', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', padding: '5px 12px', marginBottom: 24, textTransform: 'uppercase' }}>
            PDF Converter
          </div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.05, letterSpacing: '-0.03em', color: '#fff', marginBottom: 20 }}>
            Convert PDF to<br /><span style={{ color: '#f5c400' }}>Word & Excel</span><br />in seconds.
          </h1>
          <p style={{ fontSize: 15, color: '#888', lineHeight: 1.7, marginBottom: 32, maxWidth: 400 }}>
            Upload your PDF and get a clean, editable Word document or structured Excel spreadsheet — instantly. No account required.
          </p>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['No sign-up', '#f5c400'], ['Up to 50 MB', '#f5c400'], ['Files deleted instantly', '#f5c400']].map(([label, color]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#777' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                {label}
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 380, flexShrink: 0, minWidth: 280 }}>
          <ConverterWidget />
        </div>
      </section>

      {/* Stats strip */}
      <div style={{ background: '#f5f5f5', borderTop: '1px solid #e8e8e8', borderBottom: '1px solid #e8e8e8', display: 'flex', flexWrap: 'wrap' }}>
        {[
          ['50 MB', 'Maximum file size'],
          ['< 60s', 'Avg. conversion time'],
          ['2', 'Output formats'],
          ['0', 'Files stored'],
        ].map(([num, label], i, arr) => (
          <div key={label} style={{ flex: 1, minWidth: 140, padding: '24px 32px', borderRight: i < arr.length - 1 ? '1px solid #e8e8e8' : 'none', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 24, color: '#111' }}>{num}</div>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <section id="features" style={{ padding: '72px 48px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#f5c400', textTransform: 'uppercase', marginBottom: 12 }}>Features</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: '#111', letterSpacing: '-0.02em', marginBottom: 48 }}>Everything you need, nothing you don't.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1, background: '#e8e8e8', border: '1px solid #e8e8e8' }}>
          {[
            { icon: <IconWord />, title: 'PDF to Word', desc: 'Preserves text, headings, and document structure for clean .docx output.' },
            { icon: <IconExcel />, title: 'PDF to Excel', desc: 'Extracts tables and structured data into formatted spreadsheet sheets.' },
            { icon: <IconLock />, title: 'Privacy first', desc: 'Files are processed on-server and deleted immediately after conversion.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ background: '#fff', padding: '28px 24px' }}>
              <div style={{ width: 36, height: 36, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, color: '#f5c400' }}>
                {icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" style={{ padding: '72px 48px', background: '#f9f9f9', borderTop: '1px solid #eee', borderBottom: '1px solid #eee' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: '#f5c400', textTransform: 'uppercase', marginBottom: 12 }}>How it works</div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 32, color: '#111', letterSpacing: '-0.02em', marginBottom: 48 }}>Three steps, that's it.</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32 }}>
          {[
            { n: '01', title: 'Upload your PDF', desc: 'Drag and drop your file onto the converter or click to browse. Up to 50 MB.' },
            { n: '02', title: 'Choose a format', desc: 'Pick Word (.docx) for text documents or Excel (.xlsx) for data and tables.' },
            { n: '03', title: 'Download your file', desc: 'Conversion takes seconds. Your file downloads immediately when it\'s ready.' },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ borderTop: '3px solid #f5c400', paddingTop: 20 }}>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36, color: '#f5c400', marginBottom: 12 }}>{n}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111', marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section style={{ background: '#111', padding: '64px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: '#fff', letterSpacing: '-0.02em' }}>Ready to convert your PDF?</h2>
          <p style={{ fontSize: 14, color: '#666', marginTop: 8 }}>No account needed. Just upload and go.</p>
        </div>
        <a href="#converter" style={{ background: '#f5c400', color: '#111', padding: '14px 32px', fontWeight: 700, fontSize: 14, textDecoration: 'none', flexShrink: 0 }}>
          Convert a PDF Now
        </a>
      </section>

      {/* Footer */}
      <footer style={{ background: '#0a0a0a', padding: '32px 48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: '#fff' }}>
          PDF<span style={{ color: '#f5c400' }}>.</span>Tech
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Privacy', 'Support'].map(l => (
            <a key={l} href="#" style={{ fontSize: 12, color: '#555', textDecoration: 'none' }}>{l}</a>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#444' }}>© 2026 PDFTech</div>
      </footer>
    </div>
  )
}
