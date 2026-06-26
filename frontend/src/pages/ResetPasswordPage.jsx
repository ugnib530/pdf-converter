/**
 * pages/ResetPasswordPage.jsx
 * Reads ?token= from the URL, lets the user pick a new password.
 * Includes the same password strength meter as the signup form.
 */
import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config/config';

// ── Password strength logic (same rules as Login.jsx / backend) ───────────────

const RULES = [
  { key: 'length',  label: 'At least 8 characters',       test: (p) => p.length >= 8 },
  { key: 'upper',   label: 'One uppercase letter (A–Z)',   test: (p) => /[A-Z]/.test(p) },
  { key: 'lower',   label: 'One lowercase letter (a–z)',   test: (p) => /[a-z]/.test(p) },
  { key: 'number',  label: 'One number (0–9)',             test: (p) => /\d/.test(p) },
  { key: 'special', label: 'One special character (!@#…)', test: (p) => /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~;'@£]/.test(p) },
];

function getStrength(password) {
  if (!password) return { score: 0, passed: [] };
  const passed = RULES.filter((r) => r.test(password)).map((r) => r.key);
  return { score: passed.length, passed };
}

const STRENGTH_LABELS = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
const STRENGTH_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a'];

function PasswordStrengthMeter({ password }) {
  const { score, passed } = getStrength(password);
  if (!password) return null;
  return (
    <div style={meterStyles.wrap}>
      <div style={meterStyles.barTrack}>
        {RULES.map((_, i) => (
          <div
            key={i}
            style={{
              ...meterStyles.barSegment,
              background: i < score ? STRENGTH_COLORS[score] : 'var(--border)',
              transition: 'background 0.25s',
            }}
          />
        ))}
      </div>
      <span style={{ ...meterStyles.label, color: STRENGTH_COLORS[score] }}>
        {STRENGTH_LABELS[score]}
      </span>
      <ul style={meterStyles.list}>
        {RULES.map((rule) => {
          const ok = passed.includes(rule.key);
          return (
            <li key={rule.key} style={{ ...meterStyles.item, color: ok ? '#22c55e' : 'var(--subtle)' }}>
              <span style={meterStyles.icon}>{ok ? '✓' : '○'}</span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const meterStyles = {
  wrap:       { marginTop: 8, marginBottom: 4 },
  barTrack:   { display: 'flex', gap: 4, marginBottom: 6 },
  barSegment: { flex: 1, height: 4, borderRadius: 99 },
  label:      { fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase' },
  list:       { listStyle: 'none', padding: 0, margin: '8px 0 0 0' },
  item:       { fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, transition: 'color 0.2s' },
  icon:       { width: 14, textAlign: 'center', flexShrink: 0 },
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const [searchParams]          = useSearchParams();
  const navigate                = useNavigate();
  const token                   = searchParams.get('token') || '';

  const [password, setPassword]   = useState('');
  const [confirm,  setConfirm]    = useState('');
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState('');
  const [success,  setSuccess]    = useState(false);

  const { score } = getStrength(password);
  const allRulesMet  = score === RULES.length;
  const passwordsMatch = password === confirm;
  const canSubmit = allRulesMet && passwordsMatch && !loading;

  // No token in URL — show helpful error
  if (!token) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <Logo />
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, color: 'var(--text)' }}>Invalid link</h2>
            <p style={{ fontSize: 14, color: 'var(--subtle)', lineHeight: 1.6 }}>
              This reset link is missing or malformed. Please request a new one.
            </p>
            <Link to="/login?mode=forgot" style={{ ...styles.button, display: 'inline-block', marginTop: 16, textDecoration: 'none', textAlign: 'center' }}>
              Request new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Success screen
  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <Logo />
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, color: 'var(--text)' }}>Password updated!</h2>
            <p style={{ fontSize: 14, color: 'var(--subtle)', lineHeight: 1.6 }}>
              Your password has been changed. Redirecting you to login…
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!allRulesMet) {
      setError('Please meet all password requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <Logo />
        <h1 style={styles.heading}>Set a new password</h1>
        <form onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <PasswordStrengthMeter password={password} />

          <input
            style={{
              ...styles.input,
              marginTop: 12,
              borderColor: confirm && !passwordsMatch ? 'var(--danger)' : 'var(--border)',
            }}
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {confirm && !passwordsMatch && (
            <p style={styles.error}>Passwords don't match</p>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{
              ...styles.button,
              opacity: canSubmit ? 1 : 0.5,
              cursor:  canSubmit ? 'pointer' : 'not-allowed',
              marginTop: 14,
            }}
            type="submit"
            disabled={!canSubmit}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <p style={styles.backLink}>
          <Link to="/login" style={{ color: 'var(--accent)', fontSize: 13 }}>← Back to login</Link>
        </p>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, color: 'var(--text)', textDecoration: 'none' }}>
      <span style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </span>
      <span style={{ fontWeight: 800, fontSize: 15 }}>Doc<span style={{ color: 'var(--accent)' }}>Shift</span></span>
    </Link>
  );
}

const styles = {
  page:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  card:    { background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '36px 32px', borderRadius: 14, width: 340, boxShadow: 'var(--shadow-md)' },
  heading: { margin: '0 0 20px 0', fontSize: 20, color: 'var(--text)' },
  input:   { display: 'block', width: '100%', margin: '10px 0 0', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' },
  button:  { width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', transition: 'opacity 0.2s' },
  error:   { color: 'var(--danger)', fontSize: 13, margin: '6px 0 0' },
  backLink:{ marginTop: 18, textAlign: 'center' },
};