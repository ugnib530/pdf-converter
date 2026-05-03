import { useState, useRef, useCallback } from 'react'

// ── Constants ────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || ''
const MAX_MB = 50

// ── Icons (inline SVG) ───────────────────────────────────────────────────────
const IconUpload = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)

const IconPDF = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)

const IconWord = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M9 13l1.5 4 1.5-4 1.5 4 1.5-4"/>
  </svg>
)

const IconExcel = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="8" y1="13" x2="16" y2="13"/>
    <line x1="8" y1="17" x2="16" y2="17"/>
    <line x1="10" y1="9" x2="10" y2="21"/>
    <line x1="14" y1="9" x2="14" y2="21"/>
  </svg>
)

const IconCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// ── Sub-components ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{
      width: 22, height: 22,
      border: '2.5px solid rgba(255,255,255,0.15)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.75s linear infinite',
      flexShrink: 0,
    }} />
  )
}

function ProgressBar({ value }) {
  return (
    <div style={{
      height: 4, background: 'var(--border)',
      borderRadius: 2, overflow: 'hidden',
      marginTop: 12,
    }}>
      <div style={{
        height: '100%',
        width: `${value}%`,
        background: 'linear-gradient(90deg, var(--accent), #a78bfa)',
        borderRadius: 2,
        transition: 'width 0.3s ease',
        backgroundSize: '400px 100%',
        animation: value < 100 ? 'shimmer 1.5s infinite linear' : 'none',
        backgroundImage: value < 100
          ? 'linear-gradient(90deg, var(--accent) 0%, #a78bfa 50%, var(--accent) 100%)'
          : 'linear-gradient(90deg, var(--accent), #a78bfa)',
      }} />
    </div>
  )
}

function Badge({ children, color }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      fontWeight: 500,
      letterSpacing: '0.05em',
      background: color === 'green' ? 'rgba(22,163,74,0.15)' : 'rgba(239,68,68,0.15)',
      color: color === 'green' ? '#4ade80' : '#f87171',
      border: `1px solid ${color === 'green' ? 'rgba(22,163,74,0.3)' : 'rgba(239,68,68,0.3)'}`,
    }}>{children}</span>
  )
}

function FeatureChip({ icon, text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 14px',
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      fontSize: 13,
      color: 'var(--muted)',
      fontFamily: 'var(--font-mono)',
    }}>
      <span style={{ color: '#4ade80', fontSize: 15 }}>{icon}</span>
      {text}
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [converting, setConverting] = useState(null)   // 'word' | 'excel' | null
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)           // { url, name, format }
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const progressRef = useRef(null)

  // Fake smooth progress animation
  const startFakeProgress = useCallback(() => {
    setProgress(0)
    let p = 0
    progressRef.current = setInterval(() => {
      p += Math.random() * 8
      if (p >= 90) { clearInterval(progressRef.current); p = 90 }
      setProgress(Math.round(p))
    }, 300)
  }, [])

  const stopProgress = useCallback((success) => {
    clearInterval(progressRef.current)
    setProgress(success ? 100 : 0)
  }, [])

  const handleFile = useCallback((f) => {
    setError(null)
    setResult(null)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.')
      return
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is too large. Maximum size is ${MAX_MB} MB.`)
      return
    }
    setFile(f)
  }, [])

  const onInputChange = (e) => handleFile(e.target.files?.[0])
  const onDrop = (e) => {
    e.preventDefault(); setDrag(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const convert = async (format) => {
    if (!file || converting) return
    setError(null)
    setResult(null)
    setConverting(format)
    startFakeProgress()

    try {
      const body = new FormData()
      body.append('file', file)

      const endpoint = format === 'word' ? '/convert/word' : '/convert/excel'
      const url = `${API_BASE}${endpoint}`

      const res = await fetch(url, { method: 'POST', body })

      if (!res.ok) {
        let msg = `Server error (${res.status})`
        try { const j = await res.json(); msg = j.detail || msg } catch {}
        if (res.status === 429) msg = 'Rate limit reached. Please wait a minute and try again.'
        throw new Error(msg)
      }

      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const stem = file.name.replace(/\.pdf$/i, '')
      const ext = format === 'word' ? 'docx' : 'xlsx'

      stopProgress(true)
      setResult({ url: objUrl, name: `${stem}.${ext}`, format })
    } catch (err) {
      stopProgress(false)
      setError(err.message || 'Conversion failed. Please try again.')
    } finally {
      setConverting(null)
    }
  }

  const reset = () => {
    setFile(null); setResult(null); setError(null); setProgress(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const downloadResult = () => {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.url
    a.download = result.name
    a.click()
  }

  const isConverting = converting !== null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Glow orbs ── */}
      <div style={{
        position: 'fixed', top: -200, left: '20%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,108,255,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: -100, right: '10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ── Header ── */}
      <header style={{
        position: 'relative', zIndex: 2,
        borderBottom: '1px solid var(--border)',
        padding: '18px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(12,12,15,0.8)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
            display: 'grid', placeItems: 'center', fontSize: 16,
          }}>⟁</div>
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>
            Doc<span style={{ color: 'var(--accent)' }}>Shift</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge color="green">FREE</Badge>
          <Badge color="green">NO SIGNUP</Badge>
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{
        flex: 1, position: 'relative', zIndex: 2,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '60px 24px 80px',
        animation: 'fadeUp 0.5s ease forwards',
      }}>

        {/* Hero text */}
        <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 600 }}>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--accent)', letterSpacing: '0.15em',
            textTransform: 'uppercase', marginBottom: 16,
          }}>
            PDF Converter — 100% Free · No Limits
          </p>
          <h1 style={{
            fontFamily: 'var(--font-head)', fontWeight: 800,
            fontSize: 'clamp(36px, 6vw, 64px)',
            lineHeight: 1.05, letterSpacing: '-0.03em',
            marginBottom: 18,
          }}>
            Convert PDFs to<br />
            <span style={{
              background: 'linear-gradient(90deg, #5b6cff, #a78bfa)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Word & Excel</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 16, lineHeight: 1.6 }}>
            No cloud storage. Files are processed on the server and deleted instantly.
            Nothing is ever saved.
          </p>
        </div>

        {/* Feature chips */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
          marginBottom: 48,
        }}>
          <FeatureChip icon="🔒" text="No storage" />
          <FeatureChip icon="⚡" text="Instant" />
          <FeatureChip icon="🚫" text="No watermarks" />
          <FeatureChip icon="📦" text="Up to 50 MB" />
        </div>

        {/* ── Card ── */}
        <div style={{
          width: '100%', maxWidth: 560,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}>

          {!result ? (
            <>
              {/* Drop zone */}
              <div
                onClick={() => !isConverting && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${drag ? 'var(--accent)' : file ? 'var(--border2)' : 'var(--border)'}`,
                  borderRadius: 14,
                  padding: '36px 24px',
                  textAlign: 'center',
                  cursor: isConverting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  background: drag ? 'rgba(91,108,255,0.05)' : 'var(--surface2)',
                  position: 'relative',
                  overflow: 'hidden',
                }}>

                {file ? (
                  /* File selected state */
                  <div style={{ animation: 'slideIn 0.25s ease' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 52, height: 52, borderRadius: 12,
                      background: 'rgba(239,68,68,0.12)',
                      color: '#f87171', marginBottom: 14,
                    }}>
                      <IconPDF />
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 13,
                      color: 'var(--text)', marginBottom: 6,
                      wordBreak: 'break-all',
                    }}>
                      {file.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
                      {formatSize(file.size)}
                    </div>
                    {!isConverting && (
                      <button
                        onClick={(e) => { e.stopPropagation(); reset() }}
                        style={{
                          marginTop: 12,
                          background: 'none', border: '1px solid var(--border)',
                          color: 'var(--muted)', cursor: 'pointer',
                          borderRadius: 6, padding: '4px 12px', fontSize: 12,
                          fontFamily: 'var(--font-mono)',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}>
                        <IconX /> Remove
                      </button>
                    )}
                  </div>
                ) : (
                  /* Empty state */
                  <>
                    <div style={{ color: 'var(--muted)', marginBottom: 14 }}>
                      <IconUpload />
                    </div>
                    <p style={{ fontWeight: 600, marginBottom: 6 }}>
                      Drop your PDF here
                    </p>
                    <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                      or click to browse — PDF up to {MAX_MB} MB
                    </p>
                  </>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={onInputChange}
                  style={{ display: 'none' }}
                  disabled={isConverting}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 10,
                  color: '#f87171',
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  animation: 'slideIn 0.2s ease',
                }}>
                  ⚠ {error}
                </div>
              )}

              {/* Progress */}
              {isConverting && <ProgressBar value={progress} />}

              {/* Action buttons */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
                marginTop: 20,
              }}>
                {[
                  {
                    fmt: 'word',
                    label: 'Convert to Word',
                    Icon: IconWord,
                    color: 'var(--word)',
                    glow: 'var(--word-glow)',
                    ext: '.DOCX',
                  },
                  {
                    fmt: 'excel',
                    label: 'Convert to Excel',
                    Icon: IconExcel,
                    color: 'var(--excel)',
                    glow: 'var(--excel-glow)',
                    ext: '.XLSX',
                  },
                ].map(({ fmt, label, Icon, color, glow, ext }) => {
                  const active = converting === fmt
                  const disabled = !file || isConverting
                  return (
                    <button
                      key={fmt}
                      onClick={() => convert(fmt)}
                      disabled={disabled}
                      style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 8,
                        padding: '16px 18px',
                        background: disabled
                          ? 'var(--surface2)'
                          : active
                            ? color
                            : `${color}18`,
                        border: `1px solid ${disabled ? 'var(--border)' : color}`,
                        borderRadius: 12,
                        color: disabled ? 'var(--muted)' : active ? '#fff' : color,
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'var(--font-body)',
                        boxShadow: active ? `0 0 20px ${glow}` : 'none',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {active ? <Spinner /> : <Icon />}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.7 }}>{ext}</span>
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>
                        {active ? 'Converting…' : label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {isConverting && (
                <p style={{
                  textAlign: 'center', marginTop: 14,
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  color: 'var(--muted)',
                }}>
                  This may take 10–60 seconds for large files…
                </p>
              )}
            </>
          ) : (
            /* ── Result card ── */
            <div style={{ textAlign: 'center', animation: 'fadeUp 0.35s ease' }}>
              <div style={{
                position: 'relative', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center',
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(74,222,128,0.12)',
                color: '#4ade80', marginBottom: 20,
              }}>
                <IconCheck />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid rgba(74,222,128,0.4)',
                  animation: 'pulse-ring 1.5s ease-out infinite',
                }} />
              </div>

              <h2 style={{
                fontFamily: 'var(--font-head)', fontWeight: 700,
                fontSize: 24, marginBottom: 8,
              }}>
                Conversion Complete
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
                Your file is ready to download.
              </p>

              <div style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20, textAlign: 'left',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {result.format === 'word' ? <IconWord /> : <IconExcel />}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>
                    {result.name}
                  </span>
                </div>
                <IconArrow />
              </div>

              <button
                onClick={downloadResult}
                style={{
                  width: '100%', padding: '14px',
                  background: result.format === 'word' ? 'var(--word)' : 'var(--excel)',
                  border: 'none', borderRadius: 12,
                  color: '#fff', fontWeight: 600, fontSize: 16,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  marginBottom: 14,
                  boxShadow: result.format === 'word'
                    ? '0 0 24px var(--word-glow)'
                    : '0 0 24px var(--excel-glow)',
                  fontFamily: 'var(--font-body)',
                }}>
                <IconDownload /> Download {result.format === 'word' ? 'Word' : 'Excel'} File
              </button>

              <button
                onClick={reset}
                style={{
                  width: '100%', padding: '12px',
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 12, color: 'var(--muted)',
                  cursor: 'pointer', fontSize: 14,
                  fontFamily: 'var(--font-body)',
                }}>
                Convert another file
              </button>
            </div>
          )}
        </div>

        {/* ── Info section ── */}
        <div style={{
          marginTop: 64, width: '100%', maxWidth: 800,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {[
              {
                title: 'PDF → Word',
                desc: 'Preserves text, headings, and layout. Best for text-heavy documents and reports.',
                color: 'var(--word)',
              },
              {
                title: 'PDF → Excel',
                desc: 'Extracts tables and structured data from your PDF into formatted spreadsheet sheets.',
                color: 'var(--excel)',
              },
              {
                title: 'Privacy First',
                desc: 'Files are processed in memory and deleted from the server within 5 minutes.',
                color: 'var(--accent)',
              },
            ].map(({ title, desc, color }) => (
              <div key={title} style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: 22,
              }}>
                <div style={{
                  width: 4, height: 18, borderRadius: 2,
                  background: color, marginBottom: 12,
                }} />
                <h3 style={{
                  fontFamily: 'var(--font-head)', fontWeight: 700,
                  fontSize: 16, marginBottom: 8,
                }}>{title}</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Limitations note */}
        <div style={{
          marginTop: 40, maxWidth: 560,
          padding: '16px 20px',
          background: 'rgba(91,108,255,0.06)',
          border: '1px solid rgba(91,108,255,0.2)',
          borderRadius: 12,
          fontSize: 13, color: 'var(--muted)', lineHeight: 1.7,
        }}>
          <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
            NOTES
          </strong><br />
          • Scanned/image PDFs require OCR and may not convert accurately with the free engine.<br />
          • Complex layouts (multi-column, graphics) may need manual cleanup in Word.<br />
          • Excel extraction works best with clearly formatted tables.
        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={{
        position: 'relative', zIndex: 2,
        borderTop: '1px solid var(--border)',
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(12,12,15,0.6)',
        backdropFilter: 'blur(8px)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          DocShift — Free & open source. Built with FastAPI + React.
        </p>
      </footer>

    </div>
  )
}
