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
const IconBank = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="10" width="18" height="11" rx="1"/>
    <path d="M3 10l9-7 9 7"/>
    <line x1="12" y1="3" x2="12" y2="10"/>
    <line x1="7" y1="14" x2="7" y2="18"/>
    <line x1="12" y1="14" x2="12" y2="18"/>
    <line x1="17" y1="14" x2="17" y2="18"/>
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
const IconImage = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)
const IconAI = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Spinner({ color = '#fff' }) {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: '50%',
      border: `2.5px solid ${color}30`,
      borderTopColor: color,
      animation: 'spin 0.7s linear infinite', flexShrink: 0,
    }} />
  )
}

function ProgressBar({ value, color = '#2563eb' }) {
  return (
    <div style={{ height: 3, background: '#e2e5f0', borderRadius: 2, overflow: 'hidden', marginTop: 16 }}>
      <div style={{
        height: '100%', width: `${value}%`,
        background: color, borderRadius: 2,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

// ── Shared DropZone ───────────────────────────────────────────────────────────
function DropZone({ file, onFile, onReset, isConverting, accept, acceptLabel }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback((f) => {
    if (!f) return
    const name = f.name.toLowerCase()
    const ok = accept.some(ext => name.endsWith(ext))
    if (!ok) { onFile(null, `Invalid file type. Accepted: ${acceptLabel}`); return }
    if (f.size > MAX_MB * 1024 * 1024) { onFile(null, `File too large. Max ${MAX_MB} MB.`); return }
    onFile(f, null)
  }, [accept, acceptLabel, onFile])

  return (
    <div
      onClick={() => !isConverting && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
      style={{
        border: `2px dashed ${drag ? '#2563eb' : file ? '#93c5fd' : '#c8cde0'}`,
        borderRadius: 14, padding: '32px 24px', textAlign: 'center',
        cursor: isConverting ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        background: drag ? '#eff4ff' : file ? '#f8fbff' : '#f7f8fc',
      }}
    >
      {file ? (
        <div style={{ animation: 'slideIn 0.2s ease' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: '#fff', border: '1px solid #e2e5f0',
            borderRadius: 10, padding: '10px 16px', marginBottom: 10,
          }}>
            <span style={{ color: '#dc2626' }}>{file.name.match(/\.(pdf)$/i) ? <IconPDF /> : <IconImage />}</span>
            <span style={{ fontWeight: 600, fontSize: 14, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
            <span style={{ fontSize: 12, color: '#6b7394', flexShrink: 0 }}>{formatSize(file.size)}</span>
          </div>
          {!isConverting && (
            <div>
              <button onClick={(e) => { e.stopPropagation(); onReset() }} style={{
                background: 'none', border: '1px solid #e2e5f0', borderRadius: 6,
                padding: '4px 12px', fontSize: 12, color: '#6b7394', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}><IconX /> Remove</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ color: '#93c5fd', marginBottom: 14 }}><IconUpload size={36} /></div>
          <p style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 16, color: '#0f1523', marginBottom: 6 }}>
            Drop your file here
          </p>
          <p style={{ fontSize: 13, color: '#6b7394' }}>
            or <span style={{ color: '#2563eb', fontWeight: 600 }}>browse</span> — {acceptLabel}, up to {MAX_MB} MB
          </p>
        </>
      )}
      <input ref={inputRef} type="file" accept={accept.join(',')} onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} disabled={isConverting} />
    </div>
  )
}

// ── PDF Converter Tab ─────────────────────────────────────────────────────────
function PDFConverter() {
  const [file, setFile] = useState(null)
  const [converting, setConverting] = useState(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const progressRef = useRef(null)

  const startProgress = () => {
    setProgress(0)
    let p = 0
    progressRef.current = setInterval(() => {
      p += Math.random() * 9
      if (p >= 90) { clearInterval(progressRef.current); p = 90 }
      setProgress(Math.round(p))
    }, 300)
  }
  const stopProgress = (ok) => { clearInterval(progressRef.current); setProgress(ok ? 100 : 0) }

  const handleFile = (f, err) => { setError(err); setResult(null); setFile(f) }
  const reset = () => { setFile(null); setResult(null); setError(null); setProgress(0) }

  const convert = async (format) => {
    if (!file || converting) return
    setError(null); setResult(null); setConverting(format); startProgress()
    try {
      const body = new FormData(); body.append('file', file)
      const res = await fetch(`${API_BASE}/convert/${format}`, { method: 'POST', body })
      if (!res.ok) { let m = `Error ${res.status}`; try { const j = await res.json(); m = j.detail || m } catch {} throw new Error(m) }
      const blob = await res.blob()
      const ext = format === 'word' ? 'docx' : 'xlsx'
      stopProgress(true)
      setResult({ url: URL.createObjectURL(blob), name: `${file.name.replace(/\.pdf$/i, '')}.${ext}`, format })
    } catch (e) { stopProgress(false); setError(e.message) } finally { setConverting(null) }
  }

  const isConverting = converting !== null

  if (result) return (
    <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'inline-flex', width: 72, height: 72, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
        <IconCheck />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #86efac', animation: 'pulse-ring 1.5s ease-out infinite' }} />
      </div>
      <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Conversion Complete!</h2>
      <p style={{ color: '#6b7394', fontSize: 14, marginBottom: 24 }}>Your file is ready</p>
      <button onClick={() => { const a = document.createElement('a'); a.href = result.url; a.download = result.name; a.click() }}
        style={{ width: '100%', padding: '14px', background: result.format === 'word' ? '#2563eb' : '#16a34a', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, fontFamily: 'var(--font)' }}>
        <IconDownload /> Download {result.format === 'word' ? 'Word (.docx)' : 'Excel (.xlsx)'}
      </button>
      <button onClick={reset} style={{ width: '100%', padding: '12px', background: 'none', border: '1.5px solid #e2e5f0', borderRadius: 12, color: '#3d4663', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 600 }}>
        Convert another file
      </button>
    </div>
  )

  return (
    <>
      <DropZone file={file} onFile={handleFile} onReset={reset} isConverting={isConverting} accept={['.pdf']} acceptLabel="PDF only" />
      {error && <div style={{ marginTop: 14, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>⚠ {error}</div>}
      {isConverting && <ProgressBar value={progress} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
        {[
          { fmt: 'word', label: 'Convert to Word', Icon: IconWord, bg: '#2563eb' },
          { fmt: 'excel', label: 'Convert to Excel', Icon: IconExcel, bg: '#16a34a' },
        ].map(({ fmt, label, Icon, bg }) => {
          const active = converting === fmt
          const disabled = !file || isConverting
          return (
            <button key={fmt} onClick={() => convert(fmt)} disabled={disabled} style={{
              padding: '14px 20px', background: disabled ? '#f7f8fc' : bg,
              border: `1.5px solid ${disabled ? '#e2e5f0' : bg}`, borderRadius: 12,
              color: disabled ? '#6b7394' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)', fontWeight: 700, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              boxShadow: !disabled ? `0 4px 14px ${bg}40` : 'none',
            }}>
              {active ? <Spinner /> : <Icon />}
              {active ? 'Converting…' : label}
            </button>
          )
        })}
      </div>
      {isConverting && <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#6b7394' }}>Processing — may take up to 60s for large files…</p>}
    </>
  )
}

// ── Bank Statement Tab ────────────────────────────────────────────────────────
function BankStatement() {
  const [file, setFile] = useState(null)
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const progressRef = useRef(null)

  const startProgress = () => {
    setProgress(0); let p = 0
    progressRef.current = setInterval(() => {
      p += Math.random() * 5
      if (p >= 85) { clearInterval(progressRef.current); p = 85 }
      setProgress(Math.round(p))
    }, 400)
  }
  const stopProgress = (ok) => { clearInterval(progressRef.current); setProgress(ok ? 100 : 0) }
  const handleFile = (f, err) => { setError(err); setResult(null); setFile(f) }
  const reset = () => { setFile(null); setResult(null); setError(null); setProgress(0) }

  const convert = async () => {
    if (!file || converting) return
    setError(null); setResult(null); setConverting(true); startProgress()
    try {
      const body = new FormData(); body.append('file', file)
      const res = await fetch(`${API_BASE}/convert/bank-statement`, { method: 'POST', body })
      if (!res.ok) { let m = `Error ${res.status}`; try { const j = await res.json(); m = j.detail || m } catch {} throw new Error(m) }
      const blob = await res.blob()
      stopProgress(true)
      setResult({ url: URL.createObjectURL(blob), name: `${file.name.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, '')}_transactions.xlsx` })
    } catch (e) { stopProgress(false); setError(e.message) } finally { setConverting(false) }
  }

  if (result) return (
    <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease' }}>
      <div style={{ display: 'inline-flex', width: 72, height: 72, borderRadius: '50%', background: '#f0fdf4', color: '#16a34a', alignItems: 'center', justifyContent: 'center', marginBottom: 20, position: 'relative' }}>
        <IconCheck />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #86efac', animation: 'pulse-ring 1.5s ease-out infinite' }} />
      </div>
      <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 22, marginBottom: 6 }}>Extraction Complete!</h2>
      <p style={{ color: '#6b7394', fontSize: 14, marginBottom: 8 }}>All transactions extracted into a spreadsheet</p>
      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#166534' }}>
        ✅ Dates · Amounts · Descriptions · Categories · Balance — all extracted automatically
      </div>
      <button onClick={() => { const a = document.createElement('a'); a.href = result.url; a.download = result.name; a.click() }}
        style={{ width: '100%', padding: '14px', background: '#16a34a', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, fontFamily: 'var(--font)' }}>
        <IconDownload /> Download Excel Spreadsheet
      </button>
      <button onClick={reset} style={{ width: '100%', padding: '12px', background: 'none', border: '1.5px solid #e2e5f0', borderRadius: 12, color: '#3d4663', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font)', fontWeight: 600 }}>
        Process another statement
      </button>
    </div>
  )

  return (
    <>
      {/* AI badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#eff4ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 14px', marginBottom: 20 }}>
        <span style={{ color: '#2563eb' }}><IconAI /></span>
        <span style={{ fontSize: 13, color: '#1e40af', fontWeight: 600, fontFamily: 'var(--font)' }}>Powered by Claude AI — reads any bank, any format</span>
      </div>

      <DropZone
        file={file} onFile={handleFile} onReset={reset} isConverting={converting}
        accept={['.pdf', '.jpg', '.jpeg', '.png', '.webp']}
        acceptLabel="PDF or Image (JPG, PNG)"
      />

      {/* What gets extracted */}
      {!file && !converting && (
        <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['📅 Date', '💰 Amount', '📝 Description', '🏷️ Category', '⚖️ Balance', '🔖 Reference ID'].map(tag => (
            <span key={tag} style={{ fontSize: 12, background: '#f7f8fc', border: '1px solid #e2e5f0', borderRadius: 6, padding: '4px 10px', color: '#3d4663' }}>{tag}</span>
          ))}
        </div>
      )}

      {error && <div style={{ marginTop: 14, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#dc2626', fontSize: 13 }}>⚠ {error}</div>}
      {converting && (
        <>
          <ProgressBar value={progress} color="#7c3aed" />
          <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: '#6b7394' }}>
            AI is reading and extracting all transactions… this takes 15–45 seconds
          </p>
        </>
      )}

      <button onClick={convert} disabled={!file || converting} style={{
        width: '100%', marginTop: 20, padding: '15px',
        background: !file || converting ? '#f7f8fc' : 'linear-gradient(135deg, #7c3aed, #2563eb)',
        border: `1.5px solid ${!file || converting ? '#e2e5f0' : '#7c3aed'}`,
        borderRadius: 12, color: !file || converting ? '#6b7394' : '#fff',
        cursor: !file || converting ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font)', fontWeight: 700, fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: file && !converting ? '0 4px 20px #7c3aed40' : 'none',
      }}>
        {converting ? <><Spinner color="#7c3aed" /> Extracting transactions…</> : <><IconAI /> Extract to Excel</>}
      </button>

      <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#6b7394' }}>
        Works with SBI, HDFC, ICICI, Axis, Kotak and all major Indian banks
      </p>
    </>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('pdf')

  const tabs = [
    { id: 'pdf',  label: 'PDF Converter', Icon: IconPDF },
    { id: 'bank', label: 'Bank Statement', Icon: IconBank },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>

      {/* NAV */}
      <nav style={{ borderBottom: '1px solid #e2e5f0', padding: '0 40px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'grid', placeItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg>
          </div>
          <span style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 18, color: '#0f1523' }}>DocShift</span>
        </div>
        <span style={{ fontSize: 12, background: '#eff4ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 100, padding: '4px 12px', fontWeight: 700, fontFamily: 'var(--font)' }}>
          100% FREE
        </span>
      </nav>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(160deg, #f0f5ff 0%, #fff 60%)', borderBottom: '1px solid #e2e5f0', padding: '52px 24px 48px', textAlign: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1, letterSpacing: '-0.03em', color: '#0f1523', marginBottom: 16 }}>
          Free Document Tools<br />
          <span style={{ color: '#2563eb' }}>for Everyone</span>
        </h1>
        <p style={{ fontSize: 17, color: '#6b7394', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Convert PDFs · Extract bank statements · No sign-up · No watermarks · Files deleted instantly
        </p>

        {/* TABS */}
        <div style={{ display: 'inline-flex', background: '#f7f8fc', border: '1px solid #e2e5f0', borderRadius: 14, padding: 5, gap: 4, marginBottom: 36 }}>
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: '10px 24px', borderRadius: 10,
              background: tab === id ? '#fff' : 'none',
              border: 'none',
              boxShadow: tab === id ? '0 1px 6px rgba(0,0,0,0.1)' : 'none',
              color: tab === id ? '#0f1523' : '#6b7394',
              fontFamily: 'var(--font)', fontWeight: 700, fontSize: 14,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
            }}>
              <span style={{ color: tab === id ? '#2563eb' : '#6b7394' }}><Icon /></span>
              {label}
              {id === 'bank' && <span style={{ fontSize: 10, background: '#7c3aed', color: '#fff', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>AI</span>}
            </button>
          ))}
        </div>

        {/* CARD */}
        <div style={{ maxWidth: 600, margin: '0 auto', background: '#fff', border: '1px solid #e2e5f0', borderRadius: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.1)', padding: 32, textAlign: 'left' }}>
          {tab === 'pdf' ? <PDFConverter /> : <BankStatement />}
        </div>

        {/* Trust row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 24, flexWrap: 'wrap' }}>
          {['🔒 Files deleted instantly', '✅ No watermarks', '🚀 No account needed', '🏦 All Indian banks supported'].map(t => (
            <span key={t} style={{ fontSize: 13, color: '#6b7394', fontFamily: 'var(--font)' }}>{t}</span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div style={{ padding: '64px 24px', background: '#f7f8fc', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font)', fontWeight: 800, fontSize: 'clamp(22px, 4vw, 34px)', color: '#0f1523', marginBottom: 40, letterSpacing: '-0.02em' }}>
          Two powerful tools in one place
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, maxWidth: 860, margin: '0 auto' }}>
          {[
            { Icon: IconWord, title: 'PDF → Word', desc: 'Preserves fonts, headings and layout. Best for text documents and reports.', color: '#2563eb', light: '#eff4ff' },
            { Icon: IconExcel, title: 'PDF → Excel', desc: 'Extracts tables from PDFs into clean formatted spreadsheets automatically.', color: '#16a34a', light: '#f0fdf4' },
            { Icon: IconBank, title: 'Bank Statement → Excel', desc: 'AI reads any bank statement — image or PDF — and extracts every transaction into a spreadsheet.', color: '#7c3aed', light: '#f5f3ff' },
            { Icon: IconAI, title: 'AI-Powered Extraction', desc: 'Works with SBI, HDFC, ICICI, Axis, Kotak, Yes Bank and all other Indian banks automatically.', color: '#d97706', light: '#fffbeb' },
          ].map(({ Icon, title, desc, color, light }) => (
            <div key={title} style={{ background: '#fff', border: '1px solid #e2e5f0', borderRadius: 16, padding: '24px', textAlign: 'left', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: light, display: 'grid', placeItems: 'center', color, marginBottom: 14 }}><Icon /></div>
              <h3 style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 15, color: '#0f1523', marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 13, color: '#6b7394', lineHeight: 1.65 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #e2e5f0', padding: '20px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, background: '#fff', marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: '#2563eb', display: 'grid', placeItems: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/></svg>
          </div>
          <span style={{ fontFamily: 'var(--font)', fontWeight: 700, fontSize: 14 }}>DocShift</span>
        </div>
        <p style={{ fontSize: 12, color: '#6b7394' }}>Free · No sign-up · No storage · Files deleted instantly</p>
      </footer>
    </div>
  )
}
