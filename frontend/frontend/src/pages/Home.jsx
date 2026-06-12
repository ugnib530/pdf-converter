/**
 * Home.jsx
 * DocShift homepage — hero + search + tool grid grouped by category.
 *
 * Props:
 *   onSelectTool  (tool) => void   navigate to a tool page
 */
import { useState, useMemo } from 'react';
import ToolCard from '../components/ToolCard';
import { CATEGORIES, TOOLS_LIST, searchTools, getToolsByCategory } from '../config/tools';

export default function Home({ onSelectTool }) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchTools(query), [query]);

  const grouped = useMemo(() => {
    if (query.trim()) return null;   // flat list when searching
    return getToolsByCategory();
  }, [query]);

  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '40px 16px 80px' }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{
          fontSize: 'clamp(26px, 5vw, 42px)',
          fontWeight: 900,
          color: '#111827',
          lineHeight: 1.15,
          margin: '0 0 12px',
          letterSpacing: '-0.03em',
        }}>
          Every PDF tool you need,<br />
          <span style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>free and instant</span>
        </h1>
        <p style={{
          margin: '0 auto 28px',
          maxWidth: 520,
          color: '#6b7280',
          fontSize: 16,
          lineHeight: 1.6,
        }}>
          No sign-up. No watermarks. Files deleted within 5 minutes.
        </p>

        {/* Search */}
        <div style={{
          position: 'relative', maxWidth: 420, margin: '0 auto',
        }}>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tools…"
            style={{
              width: '100%',
              padding: '11px 14px 11px 40px',
              borderRadius: 10,
              border: '1.5px solid #e5e7eb',
              fontSize: 14,
              color: '#111827',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = '#e5e7eb'}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', display: 'flex', padding: 2, borderRadius: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Search results ─────────────────────────────────────────────────── */}
      {query.trim() && (
        <section style={{ marginBottom: 40 }}>
          <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: 13 }}>
            {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
          </p>
          {results.length ? (
            <ToolGrid tools={results} onSelect={onSelectTool} />
          ) : (
            <div style={{
              textAlign: 'center', padding: '48px 0',
              color: '#9ca3af', fontSize: 14,
            }}>
              No tools match "{query}" — try a different keyword.
            </div>
          )}
        </section>
      )}

      {/* ── Category sections ─────────────────────────────────────────────── */}
      {!query.trim() && grouped && Object.entries(CATEGORIES).map(([key, cat]) => {
        const tools = grouped[key];
        if (!tools?.length) return null;
        return (
          <section key={key} style={{ marginBottom: 40 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 16,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: cat.color, flexShrink: 0,
              }} />
              <h2 style={{
                margin: 0, fontSize: 15, fontWeight: 700,
                color: '#374151', letterSpacing: '-0.01em',
              }}>
                {cat.label}
              </h2>
              <span style={{
                fontSize: 12, color: '#9ca3af', fontWeight: 500,
              }}>
                {tools.filter(t => t.phase === 1).length} available
                {tools.filter(t => t.phase > 1).length > 0 &&
                  ` · ${tools.filter(t => t.phase > 1).length} coming soon`}
              </span>
            </div>
            <ToolGrid tools={tools} onSelect={onSelectTool} />
          </section>
        );
      })}
    </main>
  );
}

function ToolGrid({ tools, onSelect }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
      gap: 10,
    }}>
      {tools.map(tool => (
        <ToolCard
          key={tool.slug}
          tool={tool}
          onClick={() => onSelect(tool)}
        />
      ))}
    </div>
  );
}
