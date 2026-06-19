const isLocal = typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Set VITE_API_URL in your Vercel project settings to your Railway backend URL.
export const API_URL = import.meta.env.VITE_API_URL || (isLocal ? 'http://localhost:8000' : '');
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

if (!isLocal && !import.meta.env.VITE_API_URL) {
  console.warn('[DocShift] VITE_API_URL is not set — API calls will fail in production.');
}