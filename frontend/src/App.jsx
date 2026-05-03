import { useState, useRef, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''
const MAX_MB = 50

// ── Icons ────────────────────────────────────────────────────────────────────
const IconUpload = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
)
const IconWord = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <path d="M9 13l1.5 4 1.5-4 1.5 4 1.5-4"/>
  </svg>
)
const IconExcel = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const IconPDF = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
)
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
)
const IconZap = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
)
const IconStar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Spinner() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: '2.5px solid rgba(255,255,255,0.3)',
      borderTopColor: '#fff',
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

function ProgressBar({ value }) {
  return (
    <div style={{ height: 3, background: '#e2e5f0', borderRadius: 2, overflow: 'hidden', marginTop: 16 }}>
      <div style={{
        height: '100%', width: `${value}%`,
        background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
        borderRadius: 2, transition: 'width 0.3s ease',
        animation: value < 100 ? 'shimmer 1.5s infinite linear' : 'none',
        backgroundSize: '600px 100%',
        backgroundImage: value < 100
          ? 'linear-gradient(90deg, #2563eb 0%, #60a5fa 50%, #2563eb 100%)'
          : undefined,
      }} />
    </div>
  )
}

export default function App() {
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [converting, setConverting] = useState(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)
  const progressRef = useRef(null)

  const startFakeProgress = useCallback(() => {
    setProgress(0)
    let p = 0
    progressRef.current = setInterval(() => {
      p += Math.random() * 9
      if (p >= 90) { clearInterval(progressRef.current); p = 90 }
      setProgress(Math.round(p))
    }, 300)
  }, [])

  const stopProgress = useCallback((ok) => {
    clearInterval(progressRef.current)
    setProgress(ok ? 100 : 0)
  }, [])

  const handleFile = useCallback((f) => {
    setError(null); setResult(null)
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are accepted.'); return }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`File too large. Maximum is ${MAX_MB} MB.`); return }
    setFile(f)
  }, [])

  const onDrop = (e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }

  const convert = async (format) => {
    if (!file || converting) return
    setError(null); setResult(null); setConverting(format); startFakeProgress()
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${API_BASE}/convert/${format}`, { method: 'POST', body })
      if (!res.ok) {
        let msg = `Server error (${res.status})`
        try { const j = await res.json(); msg = j.detail || msg } catch {}
        if (res.status === 429) msg = 'Rate limit reached. Please wait a minute.'
        throw new Error(msg)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const ext = format === 'word' ? 'docx' : 'xlsx'
      stopProgress(true)
      setResult({ url, name: `${file.name.replace(/\.pdf$/i, '')}.${ext}`, format })
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

  const isConverting = converting !== null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>

      {/* ── NAV ── */}
      <nav style={{
        borderBottom: '1px solid var(--border)',
        padding: '0 40px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#fff', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 0 #e2e5f0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 2v6h6" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 18, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            DocShift
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1,2,3,4,5].map(i => <span key={i} style={{ color: '#f59e0b' }}><IconStar /></span>)}
          </div>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font)' }}>Free PDF Tools</span>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(160deg, #f0f5ff 0%, #fff 50%)',
        borderBottom: '1px solid var(--border)',
        padding: '64px 24px 56px',
        textAlign: 'center',
        animation: 'fadeUp 0.5s ease',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#eff4ff', border: '1px solid #bfdbfe',
          borderRadius: 100, padding: '5px 14px',
          marginBottom: 24,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#2563eb' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', fontFamily: 'var(--font)', letterSpacing: '0.03em' }}>
            100% FREE — NO SIGN UP REQUIRED
          </span>
        </div>

        <h1 style={{
          fontFamily: 'var(--font)', fontWeight: 800,
          fontSize: 'clamp(32px, 5.5vw, 58px)',
          lineHeight: 1.1, letterSpacing: '-0.03em',
          color: 'var(--text)', marginBottom: 18, maxWidth: 700, margin: '0 auto 18px',
        }}>
          Convert PDF to Word<br />
          <span style={{ color: '#2563eb' }}>& Excel</span> — Instantly Free
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--muted)', maxWidth: 520,
          margin: '0 auto 40px', lineHeight: 1.6, fontFamily: 'var(--font-body)',
        }}>
          No watermarks, no file storage, no account needed.
          Your files are processed and deleted immediately.
        </p>

        {/* ── UPLOAD CARD ── */}
        <div style={{
          maxWidth: 640, margin: '0 auto',
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 20,
          boxShadow: 'var(--shadow-lg)',
          padding: 32,
          textAlign: 'left',
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
                  border: `2px dashed ${drag ? '#2563eb' : file ? '#93c5fd' : '#c8cde0'}`,
                  borderRadius: 14,
                  padding: '32px 24px',
                  textAlign: 'center',
                  cursor: isConverting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  background: drag ? '#eff4ff' : file ? '#f8fbff' : 'var(--bg2)',
                }}
              >
                {file ? (
                  <div style={{ animation: 'slideIn 0.2s ease' }}>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      background: '#fff', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '10px 16px',
                      marginBottom: 12,
                    }}>
                      <span style={{ color: '#dc2626' }}><IconPDF /></span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>{formatSize(file.size)}</span>
                    </div>
                    <div>
                      {!isConverting && (
                        <button onClick={(e) => { e.stopPropagation(); reset() }} style={{
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: 6, padding: '4px 12px', fontSize: 12,
                          color: 'var(--muted)', cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontFamily: 'var(--font-body)',
                        }}>
                          <IconX /> Remove file
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ color: '#93c5fd', marginBottom: 14 }}><IconUpload size={36} /></div>
                    <p style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>
                      Drop your PDF here
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                      or <span style={{ color: '#2563eb', fontWeight: 600 }}>browse files</span> — up to {MAX_MB} MB
                    </p>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} disabled={isConverting} />
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  marginTop: 14, padding: '12px 16px',
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 10, color: '#dc2626', fontSize: 13,
                  animation: 'slideIn 0.2s ease', fontFamily: 'var(--font-body)',
                }}>
                  ⚠ {error}
                </div>
              )}

              {/* Progress */}
              {isConverting && <ProgressBar value={progress} />}

              {/* Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
                {[
                  { fmt: 'word', label: 'Convert to Word', Icon: IconWord, bg: '#2563eb', hover: '#1d4ed8', light: '#eff4ff', ext: 'DOCX' },
                  { fmt: 'excel', label: 'Convert to Excel', Icon: IconExcel, bg: '#16a34a', hover: '#15803d', light: '#f0fdf4', ext: 'XLSX' },
                ].map(({ fmt, label, Icon, bg, light, ext }) => {
                  const active = converting === fmt
                  const disabled = !file || isConverting
                  return (
                    <button
                      key={fmt}
                      onClick={() => convert(fmt)}
                      disabled={disabled}
                      style={{
                        padding: '14px 20px',
                        background: disabled ? 'var(--bg2)' : active ? bg : bg,
                        border: `1.5px solid ${disabled ? 'var(--border)' : bg}`,
                        borderRadius: 12,
                        color: disabled ? 'var(--muted)' : '#fff',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        fontFamily: 'var(--font)',
                        fontWeight: 700, fontSize: 15,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                        transition: 'all 0.15s',
                        opacity: disabled && !active ? 0.6 : 1,
                        boxShadow: !disabled ? `0 4px 14px ${bg}40` : 'none',
                      }}
                    >
                      {active ? <Spinner /> : <Icon />}
                      {active ? 'Converting…' : label}
                    </button>
                  )
                })}
              </div>

              {isConverting && (
                <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                  Processing your file — this may take up to 60 seconds for large PDFs
                </p>
              )}
            </>
          ) : (
            /* ── SUCCESS ── */
            <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
              <div style={{
                position: 'relative', display: 'inline-flex',
                width: 72, height: 72, borderRadius: '50%',
                background: '#f0fdf4', color: '#16a34a',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}>
                <IconCheck />
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '2px solid #86efac',
                  animation: 'pulse-ring 1.5s ease-out infinite',
                }} />
              </div>
              <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 22, marginBottom: 6, color: 'var(--text)' }}>
                Conversion Complete!
              </h2>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
                Your file is ready to download
              </p>
              <div style={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                marginBottom: 20, textAlign: 'left',
              }}>
                {result.format === 'word' ? <IconWord /> : <IconExcel />}
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {result.name}
                </span>
              </div>
              <button
                onClick={() => { const a = document.createElement('a'); a.href = result.url; a.download = result.name; a.click() }}
                style={{
                  width: '100%', padding: '14px',
                  background: result.format === 'word' ? '#2563eb' : '#16a34a',
                  border: 'none', borderRadius: 12,
                  color: '#fff', fontWeight: 700, fontSize: 16,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  marginBottom: 12, fontFamily: 'var(--font)',
                  boxShadow: result.format === 'word' ? '0 4px 14px #2563eb40' : '0 4px 14px #16a34a40',
                }}>
                <IconDownload /> Download {result.format === 'word' ? 'Word (.docx)' : 'Excel (.xlsx)'}
              </button>
              <button onClick={reset} style={{
                width: '100%', padding: '12px',
                background: 'none', border: '1.5px solid var(--border)',
                borderRadius: 12, color: 'var(--text2)',
                cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 600,
              }}>
                Convert another file
              </button>
            </div>
          )}
        </div>

        {/* Trust row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 28, marginTop: 28, flexWrap: 'wrap',
        }}>
          {[
            { icon: '🔒', text: 'Files deleted instantly' },
            { icon: '✅', text: 'No watermarks' },
            { icon: '🚀', text: 'No account needed' },
            { icon: '📦', text: 'Up to 50 MB' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', fontFamily: 'var(--font)' }}>
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ padding: '72px 24px', background: '#fff', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'var(--font)' }}>
          How It Works
        </p>
        <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 'clamp(24px, 4vw, 36px)', color: 'var(--text)', marginBottom: 48, letterSpacing: '-0.02em' }}>
          Convert in 3 simple steps
        </h2>
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 900, margin: '0 auto' }}>
          {[
            { step: '01', title: 'Upload your PDF', desc: 'Drag & drop or click to browse. Supports files up to 50 MB.', color: '#eff4ff', border: '#bfdbfe', num: '#2563eb' },
            { step: '02', title: 'Choose output format', desc: 'Click Convert to Word for .docx, or Convert to Excel to extract tables.', color: '#f0fdf4', border: '#bbf7d0', num: '#16a34a' },
            { step: '03', title: 'Download your file', desc: 'Your converted file downloads instantly. No email, no waiting.', color: '#fef9eb', border: '#fde68a', num: '#d97706' },
          ].map(({ step, title, desc, color, border, num }) => (
            <div key={step} style={{
              flex: '1 1 220px', maxWidth: 260,
              background: color, border: `1px solid ${border}`,
              borderRadius: 16, padding: '28px 24px', textAlign: 'left',
            }}>
              <div style={{
                fontFamily: 'var(--font)', fontWeight: 800, fontSize: 36,
                color: num, marginBottom: 14, opacity: 0.25, lineHeight: 1,
              }}>{step}</div>
              <h3 style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div style={{ padding: '72px 24px', background: 'var(--bg2)', textAlign: 'center' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'var(--font)' }}>
          What You Get
        </p>
        <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 'clamp(24px, 4vw, 36px)', color: 'var(--text)', marginBottom: 48, letterSpacing: '-0.02em' }}>
          Professional conversions, completely free
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
          {[
            { Icon: IconWord, title: 'PDF to Word', desc: 'Preserves fonts, headings, paragraphs and layout. Best for text-heavy documents.', color: '#2563eb', light: '#eff4ff' },
            { Icon: IconExcel, title: 'PDF to Excel', desc: 'Extracts tables and structured data into formatted, multi-sheet spreadsheets.', color: '#16a34a', light: '#f0fdf4' },
            { Icon: IconShield, title: 'Privacy First', desc: 'Zero file storage. Your PDF is processed in memory and wiped within 5 minutes.', color: '#7c3aed', light: '#f5f3ff' },
            { Icon: IconZap, title: 'Fast Processing', desc: 'Most files convert in under 30 seconds. No queue, no waiting room.', color: '#d97706', light: '#fffbeb' },
          ].map(({ Icon, title, desc, color, light }) => (
            <div key={title} style={{
              background: '#fff', border: '1px solid var(--border)',
              borderRadius: 16, padding: '28px 24px', textAlign: 'left',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: light, display: 'grid', placeItems: 'center',
                color, marginBottom: 16,
              }}>
                <Icon />
              </div>
              <h3 style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── LIMITATIONS ── */}
      <div style={{ padding: '48px 24px', background: '#fff', maxWidth: 680, margin: '0 auto', width: '100%' }}>
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14, padding: '20px 24px' }}>
          <p style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚠ Good to Know
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              'Scanned/image-only PDFs may not convert accurately (OCR not included)',
              'Complex multi-column layouts may need minor cleanup in Word',
              'Excel extraction works best with clearly formatted tables',
              'Password-protected PDFs are not supported',
            ].map(note => (
              <li key={note} style={{ fontSize: 13, color: '#78350f', display: 'flex', alignItems: 'flex-start', gap: 8, lineHeight: 1.5 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}>•</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid var(--border)', padding: '24px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12, background: '#fff', marginTop: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#2563eb', display: 'grid', placeItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>DocShift</span>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>— Free PDF Converter</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>No sign-up · No watermarks · No storage · 100% Free</p>
      </footer>

    </div>
  )
}
