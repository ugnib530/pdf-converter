/**
 * pages/Login.jsx
 * Supports three modes: 'login', 'signup', 'forgot'
 * Signup includes a live password strength meter.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { setAuth } from '../utils/auth';
import { API_URL, GOOGLE_CLIENT_ID } from '../config/config';

// ── Password strength logic ───────────────────────────────────────────────────

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
  const allPassed = score === RULES.length;

  if (!password) return null;

  return (
    <div style={meterStyles.wrap}>
      {/* Bar */}
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

      {/* Label */}
      <span style={{ ...meterStyles.label, color: STRENGTH_COLORS[score] }}>
        {STRENGTH_LABELS[score]}
      </span>

      {/* Checklist */}
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

// ── Main component ────────────────────────────────────────────────────────────

export default function Login() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const googleButtonRef = useRef(null);
  const navigate        = useNavigate();

  const isPasswordReady = mode === 'signup'
    ? getStrength(password).score === RULES.length
    : true;

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setSuccessMsg('');
    setPassword('');
  };

  const completeLogin = (data) => {
    setAuth(data.access_token, data.email);
    navigate('/');
  };

  // ── Submit handlers ──────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!API_URL) {
      setError('Server not configured. Set VITE_API_URL and redeploy.');
      return;
    }

    // Block submission if password doesn't meet requirements on signup
    if (mode === 'signup' && !isPasswordReady) {
      setError('Please meet all password requirements before signing up.');
      return;
    }

    setLoading(true);
    let res;
    try {
      res = await fetch(`${API_URL}/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setError('Could not reach the server. Check your connection or VITE_API_URL.');
      setLoading(false);
      return;
    }
    try {
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      if (data.message) {
        setSuccessMsg(data.message);
      } else {
        completeLogin(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!API_URL) {
      setError('Server not configured. Set VITE_API_URL and redeploy.');
      return;
    }
    setLoading(true);
    try {
      const res  = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      setSuccessMsg(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Google ───────────────────────────────────────────────────────────────

  const handleGoogleResponse = async (response) => {
    setError('');
    try {
      const res  = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Google sign-in failed');
      completeLogin(data);
    } catch (err) {
      setError(err.message || 'Could not reach the server for Google sign-in.');
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const render = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleResponse });
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', width: 280 });
    };
    if (window.google) { render(); return; }
    const interval = setInterval(() => { if (window.google) { clearInterval(interval); render(); } }, 200);
    const timeout  = setTimeout(() => clearInterval(interval), 8000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  const Logo = () => (
    <Link to="/" style={styles.logoLink}>
      <span style={styles.logoMark}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </span>
      <span style={{ fontWeight: 800, fontSize: 15 }}>
        Doc<span style={{ color: 'var(--accent)' }}>Shift</span>
      </span>
    </Link>
  );

  // Success screen (signup verification sent / forgot password email sent)
  if (successMsg) {
    const isForgot = mode === 'forgot';
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <Logo />
          <div style={styles.verifyBox}>
            <div style={styles.verifyIcon}>{isForgot ? '🔑' : '✉️'}</div>
            <h2 style={styles.verifyHeading}>{isForgot ? 'Check your email' : 'Check your email'}</h2>
            <p style={styles.verifyText}>{successMsg}</p>
            {isForgot && (
              <p style={styles.verifyText}>The link expires in 1 hour.</p>
            )}
            <button style={{ ...styles.submitButton, marginTop: 16 }} onClick={() => switchMode('login')}>
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password mode
  if (mode === 'forgot') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <Logo />
          <h1 style={styles.heading}>Reset your password</h1>
          <p style={{ fontSize: 13, color: 'var(--subtle)', marginBottom: 16, marginTop: -8 }}>
            Enter your email and we'll send you a reset link.
          </p>
          <form onSubmit={handleForgotSubmit}>
            <input
              style={styles.input}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p style={styles.error}>{error}</p>}
            <button style={styles.submitButton} type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p style={styles.switchText} onClick={() => switchMode('login')}>
            ← Back to login
          </p>
        </div>
      </div>
    );
  }

  // Login / Signup mode
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <Logo />
        <h1 style={styles.heading}>{mode === 'login' ? 'Log in' : 'Create your account'}</h1>

        {GOOGLE_CLIENT_ID && (
          <>
            <div ref={googleButtonRef} style={styles.googleButtonWrap} />
            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>or</span>
              <span style={styles.dividerLine} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === 'signup' ? 8 : 1}
            required
          />

          {/* Password strength meter — signup only */}
          {mode === 'signup' && <PasswordStrengthMeter password={password} />}

          {/* Forgot password link — login only */}
          {mode === 'login' && (
            <p style={styles.forgotLink} onClick={() => switchMode('forgot')}>
              Forgot password?
            </p>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button
            style={{
              ...styles.submitButton,
              opacity: (mode === 'signup' && !isPasswordReady) ? 0.5 : 1,
              cursor:  (mode === 'signup' && !isPasswordReady) ? 'not-allowed' : 'pointer',
            }}
            type="submit"
            disabled={loading || (mode === 'signup' && !isPasswordReady)}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <p style={styles.switchText} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' },
  card: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '36px 32px', borderRadius: 14, width: 340, boxShadow: 'var(--shadow-md)' },
  logoLink:  { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, color: 'var(--text)', textDecoration: 'none' },
  logoMark:  { width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  heading:   { margin: '0 0 20px 0', fontSize: 20, color: 'var(--text)' },
  googleButtonWrap: { display: 'flex', justifyContent: 'center', minHeight: 44 },
  divider:   { display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' },
  dividerLine: { flex: 1, height: 1, background: 'var(--border)' },
  dividerText: { fontSize: 12, color: 'var(--subtle)' },
  input: {
    display: 'block', width: '100%', margin: '10px 0',
    padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-input)', color: 'var(--text)',
    fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
  },
  submitButton: {
    width: '100%', padding: '10px 0', marginTop: 10, borderRadius: 8,
    border: 'none', background: 'var(--accent)', color: '#fff',
    fontSize: 14, fontWeight: 700, fontFamily: 'inherit', transition: 'opacity 0.2s',
  },
  error:      { color: 'var(--danger)', fontSize: 13, margin: '6px 0' },
  forgotLink: { textAlign: 'right', fontSize: 12, color: 'var(--accent)', cursor: 'pointer', margin: '-4px 0 4px' },
  switchText: { marginTop: 18, color: 'var(--accent)', cursor: 'pointer', fontSize: 13, textAlign: 'center' },
  verifyBox:    { textAlign: 'center', padding: '8px 0' },
  verifyIcon:   { fontSize: 48, marginBottom: 12 },
  verifyHeading:{ margin: '0 0 12px', fontSize: 20, color: 'var(--text)' },
  verifyText:   { fontSize: 14, color: 'var(--subtle)', lineHeight: 1.6, margin: '0 0 8px' },
};