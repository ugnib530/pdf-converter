/**
 * SettingsPage.jsx
 * Minimal settings — theme toggle and app info.
 */
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 24px 80px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--subtle)', marginBottom: 20,
      }}>
        <Link to="/" style={{ color: 'var(--subtle)' }}>Home</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>Settings</span>
      </div>

      <h1 style={{ margin: '0 0 18px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
        Settings
      </h1>

      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 18,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            Appearance
          </p>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--subtle)' }}>
            Switch between dark and light themes.
          </p>
        </div>
        <button
          onClick={toggleTheme}
          style={{
            background: 'var(--bg-card-hover)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
            color: 'var(--text)', cursor: 'pointer',
          }}
        >
          {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        </button>
      </div>

      <p style={{ marginTop: 24, fontSize: 12.5, color: 'var(--subtle)', textAlign: 'center' }}>
        DocShift · Free PDF tools · No files stored · No sign-up needed
      </p>
    </div>
  );
}
