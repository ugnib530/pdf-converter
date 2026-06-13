/**
 * Header.jsx
 * Sticky top header with logo, optional nav links, and a subtle separator.
 *
 * Props:
 *   onHome  () => void   navigate to homepage
 */
export default function Header({ onHome }) {
  return (
    <header style={{
      position:   'sticky',
      top:        0,
      zIndex:     100,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #e5e7eb',
      padding: '0 24px',
    }}>
      <div style={{
        maxWidth: 1120,
        margin: '0 auto',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <button
          onClick={onHome}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, padding: 0,
          }}
        >
          {/* Simple PDF "D" mark */}
          <span style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </span>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#111827', letterSpacing: '-0.02em' }}>
            Doc<span style={{ color: '#6366f1' }}>Shift</span>
          </span>
        </button>

        {/* Nav */}
        <nav style={{ display: 'flex', gap: 4 }}>
          <NavLink onClick={onHome}>All Tools</NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: 500, color: '#6b7280',
        padding: '6px 10px', borderRadius: 6,
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = '#111827';
        e.currentTarget.style.background = '#f3f4f6';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = '#6b7280';
        e.currentTarget.style.background = 'none';
      }}
    >
      {children}
    </button>
  );
}
