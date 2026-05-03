import { useState, useRef, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''
const MAX_MB = 50

// ── Icons ────────────────────────────────────────────────────────────────────
const IconUpload = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 16, height: 16,
      border: '2px solid rgba(0,0,0,0.15)',
      borderTopColor: '#111',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [converting, setConverting] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = useCallback((f) => {
    setError(null)
    setResult(null)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Maximum is ${MAX_MB} MB.`)
      return
    }
    setFile(f)
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const convert = async (format) => {
    if (!file || converting) return
    setError(null)
    setResult(null)
    setConverting(format)

    try {
      const body = new FormData()
      body.append('file', file)
      const endpoint = format === 'word' ? '/convert/word' : '/convert/excel'
      const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', body })

      if (!res.ok) {
        let msg = `Error ${res.status}`
        try { const j = await res.json(); msg = j.detail || msg } catch {}
        if (res.status === 429) msg = 'Rate limit reached. Please wait a minute.'
        throw new Error(msg)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const stem = file.name.replace(/\.pdf$/i, '')
      const ext = format === 'word' ? 'docx' : 'xlsx'
      setResult({ url, name: `${stem}.${ext}`, format })
    } catch (err) {
      setError(err.message || 'Conversion failed. Please try again.')
    } finally {
      setConverting(null)
    }
  }

  const reset = () => {
    setFile(null); setResult(null); setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const download = () => {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.url
    a.download = result.name
    a.click()
  }

  const isConverting = converting !== null

  // ── Styles (inline, flat) ─────────────────────────────────────────────────
  const s = {
    header: {
      borderBottom: '1px solid #e0e0e0',
      padding: '0 40px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#fff',
    },
    logo: {
      fontFamily: 'Syne, sans-serif',
      fontWeight: 800,
      fontSize: 20,
      letterSpacing: '-0.02em',
      color: '#111',
    },
    logoSpan: {
      background: '#f5c400',
      padding: '2px 6px',
      marginLeft: 2,
    },
    nav: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 12,
      color: '#888',
    },
    main: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '64px 24px 80px',
      background: '#fff',
    },
    hero: {
      textAlign: 'center',
      maxWidth: 520,
      marginBottom: 48,
    },
    h1: {
      fontFamily: 'Syne, sans-serif',
      fontWeight: 800,
      fontSize: 'clamp(32px, 5vw, 52px)',
      lineHeight: 1.1,
      letterSpacing: '-0.03em',
      color: '#111',
      marginBottom: 16,
    },
    subtitle: {
      fontSize: 15,
      color: '#777',
      lineHeight: 1.6,
    },
    card: {
      width: '100%',
      maxWidth: 520,
      border: '1px solid #e0e0e0',
      background: '#fff',
    },
    dropzone: (active, hasFile) => ({
      padding: '48px 32px',
      borderBottom: '1px solid #e0e0e0',
      textAlign: 'center',
      cursor: isConverting ? 'not-allowed' : 'pointer',
      background: active ? '#fffbea' : '#fafafa',
      transition: 'background 0.15s',
      outline: active ? '2px solid #f5c400' : 'none',
      outlineOffset: -2,
    }),
    dropIcon: {
      color: '#aaa',
      marginBottom: 16,
      display: 'flex',
      justifyContent: 'center',
    },
    dropTitle: {
      fontWeight: 600,
      fontSize: 15,
      color: '#111',
      marginBottom: 6,
    },
    dropSub: {
      fontSize: 13,
      color: '#999',
    },
    fileRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    fileName: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 13,
      color: '#111',
      wordBreak: 'break-all',
      textAlign: 'left',
    },
    fileSize: {
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 11,
      color: '#999',
      marginTop: 4,
    },
    removeBtn: {
      background: 'none',
      border: '1px solid #e0e0e0',
      padding: '5px 10px',
      cursor: 'pointer',
      color: '#888',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 12,
      flexShrink: 0,
      fontFamily: 'Inter, sans-serif',
    },
    actions: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
    },
    actionBtn: (fmt, disabled) => ({
      padding: '20px 24px',
      border: 'none',
      borderRight: fmt === 'word' ? '1px solid #e0e0e0' : 'none',
      background: disabled ? '#fafafa' : converting === fmt ? '#f5c400' : '#fff',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontFamily: 'Inter, sans-serif',
      fontWeight: 600,
      fontSize: 14,
      color: disabled ? '#bbb' : converting === fmt ? '#111' : '#111',
      transition: 'background 0.15s',
      textAlign: 'left',
    }),
    errorBox: {
      padding: '14px 20px',
      background: '#fff5f5',
      borderTop: '1px solid #ffd0d0',
      fontSize: 13,
      color: '#cc2222',
      fontFamily: 'JetBrains Mono, monospace',
    },
    resultArea: {
      padding: '32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    successRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    checkCircle: {
      width: 36,
      height: 36,
      background: '#f5c400',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    successLabel: {
      fontWeight: 600,
      fontSize: 15,
      color: '#111',
    },
    successSub: {
      fontSize: 13,
      color: '#888',
      marginTop: 2,
    },
    downloadBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '14px',
      background: '#111',
      color: '#fff',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 600,
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      width: '100%',
    },
    resetBtn: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px',
      background: 'none',
      color: '#888',
      border: '1px solid #e0e0e0',
      cursor: 'pointer',
      fontSize: 13,
      fontFamily: 'Inter, sans-serif',
      width: '100%',
    },
    infoGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 0,
      border: '1px solid #e0e0e0',
      marginTop: 40,
      width: '100%',
      maxWidth: 520,
    },
    infoCell: (last) => ({
      padding: '20px 24px',
      borderRight: last ? 'none' : '1px solid #e0e0e0',
    }),
    infoDot: (color) => ({
      width: 8,
      height: 8,
      background: color,
      marginBottom: 12,
    }),
    infoTitle: {
      fontFamily: 'Syne, sans-serif',
      fontWeight: 700,
      fontSize: 13,
      color: '#111',
      marginBottom: 6,
    },
    infoDesc: {
      fontSize: 12,
      color: '#888',
      lineHeight: 1.6,
    },
    footer: {
      borderTop: '1px solid #e0e0e0',
      padding: '18px 40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#fff',
    },
    footerText: {
      fontSize: 12,
      color: '#aaa',
      fontFamily: 'JetBrains Mono, monospace',
    },
  }

  return (
    <>
      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>
          Doc<span style={s.logoSpan}>Shift</span>
        </div>
        <span style={s.nav}>PDF Converter</span>
      </header>

      {/* Main */}
      <main style={s.main}>
        {/* Hero */}
        <div style={s.hero}>
          <h1 style={s.h1}>
            PDF to Word<br />& Excel
          </h1>
          <p style={s.subtitle}>
            Upload a PDF, choose a format, download your file.<br />
            No sign-up. Files are deleted after conversion.
          </p>
        </div>

        {/* Card */}
        <div style={s.card}>

          {!result ? (
            <>
              {/* Dropzone */}
              <div
                style={s.dropzone(drag, !!file)}
                onClick={() => !isConverting && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
              >
                {file ? (
                  <div style={s.fileRow}>
                    <div>
                      <div style={s.fileName}>{file.name}</div>
                      <div style={s.fileSize}>{formatSize(file.size)}</div>
                    </div>
                    {!isConverting && (
                      <button
                        style={s.removeBtn}
                        onClick={(e) => { e.stopPropagation(); reset() }}
                      >
                        <IconX /> Remove
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={s.dropIcon}><IconUpload /></div>
                    <div style={s.dropTitle}>Drop your PDF here</div>
                    <div style={s.dropSub}>or click to browse — max {MAX_MB} MB</div>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  style={{ display: 'none' }}
                  disabled={isConverting}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={s.errorBox}>⚠ {error}</div>
              )}

              {/* Action buttons */}
              <div style={s.actions}>
                {[
                  { fmt: 'word', label: 'Convert to Word', Icon: IconWord },
                  { fmt: 'excel', label: 'Convert to Excel', Icon: IconExcel },
                ].map(({ fmt, label, Icon }) => {
                  const disabled = !file || isConverting
                  const active = converting === fmt
                  return (
                    <button
                      key={fmt}
                      style={s.actionBtn(fmt, disabled)}
                      onClick={() => convert(fmt)}
                      disabled={disabled}
                    >
                      {active ? <Spinner /> : <Icon />}
                      {active ? 'Converting…' : label}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            /* Result */
            <div style={s.resultArea}>
              <div style={s.successRow}>
                <div style={s.checkCircle}><IconCheck /></div>
                <div>
                  <div style={s.successLabel}>Conversion complete</div>
                  <div style={s.successSub}>{result.name}</div>
                </div>
              </div>
              <button style={s.downloadBtn} onClick={download}>
                <IconDownload />
                Download {result.format === 'word' ? 'Word' : 'Excel'} file
              </button>
              <button style={s.resetBtn} onClick={reset}>
                Convert another file
              </button>
            </div>
          )}
        </div>

        {/* Info strip */}
        <div style={s.infoGrid}>
          {[
            { label: 'PDF → Word', desc: 'Text, headings, and layout preserved. Best for reports and documents.', color: '#f5c400', last: false },
            { label: 'PDF → Excel', desc: 'Extracts tables and structured data into spreadsheet sheets.', color: '#111', last: false },
            { label: 'No storage', desc: 'Files are processed on the server and deleted immediately.', color: '#e0e0e0', last: true },
          ].map(({ label, desc, color, last }) => (
            <div key={label} style={s.infoCell(last)}>
              <div style={s.infoDot(color)} />
              <div style={s.infoTitle}>{label}</div>
              <div style={s.infoDesc}>{desc}</div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={s.footer}>
        <span style={s.footerText}>DocShift</span>
        <span style={s.footerText}>PDF to Word & Excel</span>
      </footer>
    </>
  )
}
