/**
 * pages/Login.jsx
 * Dedicated sign up / log in page. Supports email+password and Google Sign-In.
 * Visit /login for log in, /login?mode=signup to land on the signup form.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { setAuth } from '../utils/auth';
import { API_URL, GOOGLE_CLIENT_ID } from '../config/config';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef(null);
  const navigate = useNavigate();

 const completeLogin = (data) => {
    setAuth(data.access_token, data.email);
    navigate('/');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!API_URL) {
      setError('Server not configured. Set VITE_API_URL and redeploy.');
      setLoading(false);
      return;
    }
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
      completeLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleResponse = async (response) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/google`, {
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

  // Render Google's official button once the GIS script (added in index.html) is ready
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 280,
      });
    };

    if (window.google) {
      renderGoogleButton();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          renderGoogleButton();
        }
      }, 200);
      const timeout = setTimeout(() => clearInterval(interval), 8000); // give up after 8s
      return () => { clearInterval(interval); clearTimeout(timeout); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
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
            minLength={6}
            required
          />

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.submitButton} type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>
        </form>

        <p
          style={styles.switchText}
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError('');
          }}
        >
          {mode === 'login' ? "Need an account? Sign up" : 'Already have an account? Log in'}
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg)',
  },
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    padding: '36px 32px',
    borderRadius: 14,
    width: 340,
    boxShadow: 'var(--shadow-md)',
  },
  logoLink: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, color: 'var(--text)' },
  logoMark: {
    width: 26, height: 26, borderRadius: 7,
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heading: { margin: '0 0 20px 0', fontSize: 20, color: 'var(--text)' },
  googleButtonWrap: { display: 'flex', justifyContent: 'center', minHeight: 44 },
  divider: { display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' },
  dividerLine: { flex: 1, height: 1, background: 'var(--border)' },
  dividerText: { fontSize: 12, color: 'var(--subtle)' },
  input: {
    display: 'block',
    width: '100%',
    margin: '10px 0',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text)',
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  submitButton: {
    width: '100%',
    padding: '10px 0',
    marginTop: 6,
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    fontFamily: 'inherit',
  },
  error: { color: 'var(--danger)', fontSize: 13, margin: '6px 0' },
  switchText: {
    marginTop: 18,
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: 13,
    textAlign: 'center',
  },
};