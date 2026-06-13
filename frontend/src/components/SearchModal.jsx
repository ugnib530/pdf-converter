/**
 * SearchModal.jsx
 * ⌘K global search overlay. Fuzzy-filters tools and navigates on select.
 *
 * Props:
 *   open      boolean
 *   onClose   () => void
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchTools, CATEGORIES } from '../config/tools';
import ToolIcon from './ToolIcon';

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const results = searchTools(query).filter(t => t.phase <= 2).slice(0, 8);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const select = (tool) => {
    if (!tool) return;
    navigate(`/${tool.slug}`);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); select(results[activeIndex]); }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '14vh 16px',
        animation: 'fadeIn 0.12s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--subtle)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tools…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text)',
            }}
          />
          <kbd style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 4,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            color: 'var(--subtle)', fontFamily: 'inherit',
          }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: 6 }}>
          {results.length === 0 && (
            <p style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--subtle)', fontSize: 13.5 }}>
              No tools match "{query}"
            </p>
          )}
          {results.map((tool, i) => {
            const accent = CATEGORIES[tool.category]?.color || '#6366f1';
            const active = i === activeIndex;
            return (
              <button
                key={tool.slug}
                onClick={() => select(tool)}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 10px', borderRadius: 8, border: 'none',
                  background: active ? 'var(--accent-light)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: `${accent}22`, color: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <ToolIcon icon={tool.icon} size={17} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--text)' }}>
                    {tool.title}
                  </span>
                  <span style={{
                    display: 'block', fontSize: 12, color: 'var(--subtle)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {tool.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
