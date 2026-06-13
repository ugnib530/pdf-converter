/**
 * ToolCard.jsx
 * One card in the tool grid (homepage / category pages).
 *
 * Props:
 *   tool        Tool config object from tools.js
 *   onClick     () => void   navigate to the tool page
 */
import ToolIcon from './ToolIcon';
import { CATEGORIES } from '../config/tools';

export default function ToolCard({ tool, onClick }) {
  const category = CATEGORIES[tool.category];
  const accent   = category?.color || '#6366f1';
  const isLive   = tool.phase <= 2;

  return (
    <button
      onClick={isLive ? onClick : undefined}
      title={isLive ? tool.description : `Coming soon`}
      className="tool-card"
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'flex-start',
        gap:           12,
        padding:       '18px',
        background:    'var(--bg-card)',
        border:        '1px solid var(--border)',
        borderRadius:  12,
        cursor:        isLive ? 'pointer' : 'default',
        opacity:       isLive ? 1 : 0.5,
        textAlign:     'left',
        transition:    'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
        position:      'relative',
        width:         '100%',
        minHeight:     104,
      }}
    >
      {/* AI badge */}
      {tool.aiPowered && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          background: 'var(--warning-bg)', color: '#f59e0b',
          fontSize: 10, fontWeight: 700, borderRadius: 4,
          padding: '2px 6px', letterSpacing: '0.04em',
        }}>AI</span>
      )}

      {/* Coming soon badge */}
      {!isLive && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          background: 'var(--bg-card-hover)', color: 'var(--subtle)',
          fontSize: 10, fontWeight: 600, borderRadius: 4,
          padding: '2px 6px',
        }}>Soon</span>
      )}

      {/* Icon bubble */}
      <span style={{
        width: 40, height: 40,
        borderRadius: 10,
        background: `${accent}1f`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
        flexShrink: 0,
      }}>
        <ToolIcon icon={tool.icon} size={20} />
      </span>

      {/* Title */}
      <span style={{
        fontSize: 14, fontWeight: 700, color: 'var(--text)',
        lineHeight: 1.3,
      }}>
        {tool.title}
      </span>
    </button>
  );
}
