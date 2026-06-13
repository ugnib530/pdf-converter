/**
 * HistoryPage.jsx
 * Lists recent conversions stored in localStorage.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ToolIcon from '../components/ToolIcon';
import { CATEGORIES, TOOLS } from '../config/tools';
import { getHistory, clearHistory, formatTimeAgo } from '../utils/history';

export default function HistoryPage() {
  const [history, setHistory] = useState(() => getHistory());
  const navigate = useNavigate();

  const handleClear = () => {
    clearHistory();
    setHistory([]);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 80px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--subtle)', marginBottom: 20,
      }}>
        <Link to="/" style={{ color: 'var(--subtle)' }}>Home</Link>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>History</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
          Recent conversions
        </h1>
        {history.length > 0 && (
          <button
            onClick={handleClear}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 8,
              padding: '6px 12px', fontSize: 12.5, fontWeight: 600,
              color: 'var(--muted)', cursor: 'pointer',
            }}
          >
            Clear history
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div style={{
          padding: '48px 0', textAlign: 'center', color: 'var(--subtle)',
          border: '1px dashed var(--border)', borderRadius: 12, fontSize: 14,
        }}>
          No conversions yet. Files you convert will show up here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.map((entry, i) => {
            const accent = CATEGORIES[entry.category]?.color || '#6366f1';
            const tool = TOOLS[entry.slug];
            return (
              <button
                key={i}
                onClick={() => tool && navigate(`/${entry.slug}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px', borderRadius: 10,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  cursor: tool ? 'pointer' : 'default', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 38, height: 38, borderRadius: 9,
                  background: `${accent}1f`, color: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <ToolIcon icon={entry.icon} size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                    {entry.title}
                  </span>
                  <span style={{
                    display: 'block', fontSize: 12.5, color: 'var(--subtle)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.filename}
                  </span>
                </span>
                <span style={{ fontSize: 12, color: 'var(--subtle)', flexShrink: 0 }}>
                  {formatTimeAgo(entry.timestamp)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
