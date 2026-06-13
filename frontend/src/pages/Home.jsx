/**
 * Home.jsx
 * "All tools" page — hero (only on root), breadcrumb, category tabs and
 * a grid of tool cards. Also serves /c/:category routes.
 */
import { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import ToolCard from '../components/ToolCard';
import { TOOLS_LIST, searchTools } from '../config/tools';

const TABS = [
  { key: 'all',      label: 'All',      match: () => true },
  { key: 'organize', label: 'Organize', match: t => t.category === 'organize' },
  { key: 'convert',  label: 'Convert',  match: t => t.category === 'convert_from' || t.category === 'convert_to' },
  { key: 'security', label: 'Security', match: t => t.category === 'security' },
  { key: 'edit',     label: 'Edit',     match: t => t.category === 'edit' },
  { key: 'ai',       label: 'AI',       match: t => t.category === 'ai' },
];

export default function Home({ onSelectTool }) {
  const navigate = useNavigate();
  const { category } = useParams();
  const activeTab = TABS.find(t => t.key === category)?.key || 'all';
  const [query, setQuery] = useState('');

  const select = (tool) => {
    if (tool.phase > 2) return;
    if (onSelectTool) onSelectTool(tool);
    navigate(`/${tool.slug}`);
  };

  const tab = TABS.find(t => t.key === activeTab) || TABS[0];

  const tools = useMemo(() => {
    const base = TOOLS_LIST.filter(tab.match);
    if (!query.trim()) return base;
    const matched = new Set(searchTools(query).map(t => t.slug));
    return base.filter(t => matched.has(t.slug));
  }, [tab, query]);

  const liveCount = tools.filter(t => t.phase <= 2).length;
  const soonCount = tools.filter(t => t.phase > 2).length;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 24px 80px' }}>

      {/* Hero — only on the root "all tools" view */}
      {activeTab === 'all' && (
        <div style={{ marginBottom: 28 }}>
          <h1 style={{
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: 900,
            color: 'var(--text)',
            lineHeight: 1.15,
            margin: '0 0 8px',
            letterSpacing: '-0.03em',
          }}>
            Every PDF tool you need,{' '}
            <span style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>free and instant</span>
          </h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 15, lineHeight: 1.6 }}>
            No sign-up. No watermarks. Files deleted within 5 minutes.
          </p>
        </div>
      )}

      {/* Breadcrumb */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--subtle)', marginBottom: 20,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--subtle)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          Home
        </Link>
        <span>›</span>
        <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>
          {activeTab === 'all' ? 'All tools' : tab.label}
        </span>
      </div>

      {/* Title + counts */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
          {activeTab === 'all' ? 'All PDF tools' : `${tab.label} tools`}
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--subtle)' }}>
          {tools.length} tool{tools.length !== 1 ? 's' : ''} · {liveCount} available now
          {soonCount > 0 && ` · ${soonCount} coming soon`}
        </p>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border)',
        marginBottom: 24, overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const to = t.key === 'all' ? '/' : `/c/${t.key}`;
          const active = t.key === activeTab;
          return (
            <Link
              key={t.key}
              to={to}
              style={{
                padding: '8px 14px',
                fontSize: 14, fontWeight: 600,
                color: active ? 'var(--accent)' : 'var(--muted)',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 360, marginBottom: 22 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--subtle)' }}>
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={`Search ${activeTab === 'all' ? 'all tools' : tab.label.toLowerCase() + ' tools'}…`}
          style={{
            width: '100%', padding: '9px 12px 9px 34px',
            borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-input)', color: 'var(--text)',
            fontSize: 13.5, outline: 'none',
          }}
        />
      </div>

      {/* Tool grid */}
      {tools.length ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
          gap: 12,
        }}>
          {tools.map(t => (
            <ToolCard key={t.slug} tool={t} onClick={() => select(t)} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--subtle)', fontSize: 14 }}>
          No tools match "{query}".
        </div>
      )}
    </div>
  );
}
