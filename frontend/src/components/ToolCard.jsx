/**
 * ToolCard.jsx
 * One card in the homepage tool grid.
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
      title={isLive ? tool.description : `Coming in Phase ${tool.phase}`}
      style={{
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           10,
        padding:       '20px 12px',
        background:    '#fff',
        border:        '1.5px solid #e5e7eb',
        borderRadius:  12,
        cursor:        isLive ? 'pointer' : 'default',
        opacity:       isLive ? 1 : 0.55,
        textAlign:     'center',
        transition:    'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
        position:      'relative',
        width:         '100%',
      }}
      onMouseEnter={isLive ? (e) => {
        e.currentTarget.style.transform   = 'translateY(-2px)';
        e.currentTarget.style.boxShadow   = '0 4px 16px rgba(0,0,0,0.08)';
        e.currentTarget.style.borderColor = accent;
      } : undefined}
      onMouseLeave={isLive ? (e) => {
        e.currentTarget.style.transform   = '';
        e.currentTarget.style.boxShadow   = '';
        e.currentTarget.style.borderColor = '#e5e7eb';
      } : undefined}
    >
      {/* AI badge */}
      {tool.aiPowered && (
        <span style={{
          position: 'absolute', top: 8, right: 8,
          background: '#fef3c7', color: '#92400e',
          fontSize: 10, fontWeight: 700, borderRadius: 4,
          padding: '2px 5px', letterSpacing: '0.04em',
        }}>AI</span>
      )}

      {/* Coming soon badge */}
      {!isLive && (
        <span style={{
          position: 'absolute', top: 8, left: 8,
          background: '#f3f4f6', color: '#6b7280',
          fontSize: 10, fontWeight: 600, borderRadius: 4,
          padding: '2px 5px',
        }}>Soon</span>
      )}

      {/* Icon bubble */}
      <span style={{
        width: 48, height: 48,
        borderRadius: 12,
        background: `${accent}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent,
        flexShrink: 0,
      }}>
        <ToolIcon icon={tool.icon} size={24} />
      </span>

      {/* Title */}
      <span style={{
        fontSize: 13, fontWeight: 600, color: '#111827',
        lineHeight: 1.3,
      }}>
        {tool.title}
      </span>
    </button>
  );
}
