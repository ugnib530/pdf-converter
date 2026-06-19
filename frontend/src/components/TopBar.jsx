/**
 * TopBar.jsx
 * Sticky top bar: logo, global search (opens SearchModal / ⌘K), theme toggle,
 * sign in / get started buttons, mobile menu trigger.
 *
 * Props:
 *   onOpenSearch  () => void
 *   onMenuClick   () => void   toggles the mobile sidebar drawer
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { getAuth, clearAuth } from '../utils/auth';

export default function TopBar({ onOpenSearch, onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [authEmail, setAuthEmail] = useState(null);

  useEffect(() => {
    const sync = () => setAuthEmail(getAuth().email);
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  const handleLogout = () => {
    clearAuth();
    setAuthEmail(null);
    navigate('/');
  };

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: 'var(--topbar-h)', zIndex: 100,
      background: 'var(--bg-elevated)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12,
    }}>
      {/* Mobile menu */}
      <button
        onClick={onMenuClick}
        className="mobile-menu-btn"
        aria-label="Toggle menu"
        style={iconButtonStyle}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      {/* Logo */}
      <Link to="/" style={{
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0, width: 'calc(var(--sidebar-w) - 28px)',
      }}>
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
        <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
          Doc<span style={{ color: 'var(--accent)' }}>Shift</span>
        </span>
      </Link>

      {/* Search trigger */}
      <button
        onClick={onOpenSearch}
        style={{
          flex: 1, maxWidth: 460, margin: '0 auto',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8,
          background: 'var(--bg-input)', border: '1px solid var(--border)',
          color: 'var(--subtle)', fontSize: 13, cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span style={{ flex: 1 }}>Search tools…</span>
        <kbd style={{
          fontSize: 11, padding: '2px 6px', borderRadius: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          color: 'var(--subtle)', fontFamily: 'inherit',
        }}>⌘K</kbd>
      </button>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <button onClick={toggleTheme} aria-label="Toggle theme" style={iconButtonStyle}>
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          )}
        </button>

        {authEmail ? (
          <>
            <span
              className="signin-btn-visible"
              style={{ fontSize: 13.5, color: 'var(--text-2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {authEmail}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                padding: '7px 14px', fontSize: 13.5, fontWeight: 600,
                color: 'var(--text-2)', cursor: 'pointer',
              }}
            >
              Log out
            </button>
          </>
        ) : (
          <>
            <button
              className="signin-btn-visible"
              onClick={() => navigate('/login')}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                padding: '7px 14px', fontSize: 13.5, fontWeight: 600,
                color: 'var(--text-2)', cursor: 'pointer',
              }}
            >
              Sign in
            </button>

            <button
              onClick={() => navigate('/login?mode=signup')}
              style={{
                background: 'var(--accent)', border: 'none', borderRadius: 8,
                padding: '8px 16px', fontSize: 13.5, fontWeight: 700,
                color: '#fff', cursor: 'pointer',
              }}
            >
              Get started free
            </button>
          </>
        )}
      </div>
    </header>
  );
}

const iconButtonStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 36, height: 36, borderRadius: 8,
  background: 'none', border: '1px solid var(--border)',
  color: 'var(--text-2)', cursor: 'pointer', flexShrink: 0,
};