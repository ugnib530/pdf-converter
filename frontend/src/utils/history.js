/**
 * history.js
 * Tiny localStorage-backed "recent conversions" log.
 * Stored as a JSON array of { slug, title, icon, category, filename, timestamp }.
 */

const KEY = 'docshift_history';
const MAX_ITEMS = 30;

export function getHistory() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addHistoryEntry(entry) {
  try {
    const current = getHistory();
    const next = [
      { ...entry, timestamp: Date.now() },
      ...current,
    ].slice(0, MAX_ITEMS);
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return getHistory();
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function formatTimeAgo(timestamp) {
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
