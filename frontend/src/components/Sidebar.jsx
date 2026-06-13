/**
 * Sidebar.jsx
 * Persistent left navigation: tool categories, recent history, account.
 *
 * Props:
 *   open      boolean   for mobile drawer state
 *   onClose   () => void
 */
import { NavLink } from 'react-router-dom';

const ICON_PROPS = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none',
  stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
};

const Icons = {
  grid: (
    <svg {...ICON_PROPS}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
  ),
  layers: (
    <svg {...ICON_PROPS}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
  ),
  swap: (
    <svg {...ICON_PROPS}><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
  ),
  shield: (
    <svg {...ICON_PROPS}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
  ),
  edit: (
    <svg {...ICON_PROPS}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
  ),
  sparkles: (
    <svg {...ICON_PROPS}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/></svg>
  ),
  clock: (
    <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  settings: (
    <svg {...ICON_PROPS}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.7.18 1.51.7 1.51 1z"/></svg>
  ),
};

const NAV_ITEMS = [
  { to: '/',             label: 'All tools', icon: 'grid',     exact: true },
  { to: '/c/organize',    label: 'Organize',  icon: 'layers' },
  { to: '/c/convert',     label: 'Convert',   icon: 'swap' },
  { to: '/c/security',    label: 'Security',  icon: 'shield' },
  { to: '/c/edit',        label: 'Edit',      icon: 'edit' },
  { to: '/c/ai',          label: 'AI tools',  icon: 'sparkles' },
];

export default function Sidebar({ open = false, onClose }) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 90, display: 'none',
          }}
          className="sidebar-overlay"
        />
      )}

      <aside
        className="app-sidebar"
        style={{
          position: 'fixed',
          top: 'var(--topbar-h)',
          left: 0,
          bottom: 0,
          width: 'var(--sidebar-w)',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border)',
          padding: '20px 12px',
          overflowY: 'auto',
          zIndex: 80,
          transform: open ? 'translateX(0)' : undefined,
        }}
      >
        <NavSection title="Tools">
          {NAV_ITEMS.map(item => (
            <SidebarLink key={item.to} {...item} onClick={onClose} />
          ))}
        </NavSection>

        <NavSection title="Recent">
          <SidebarLink to="/history" label="History" icon="clock" onClick={onClose} />
        </NavSection>

        <NavSection title="Account">
          <SidebarLink to="/settings" label="Settings" icon="settings" onClick={onClose} />
        </NavSection>
      </aside>
    </>
  );
}

function NavSection({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <p style={{
        margin: '0 0 8px', padding: '0 10px',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        color: 'var(--subtle)', textTransform: 'uppercase',
      }}>
        {title}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </div>
    </div>
  );
}

function SidebarLink({ to, label, icon, exact, onClick }) {
  return (
    <NavLink
      to={to}
      end={exact}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 8,
        fontSize: 13.5, fontWeight: 600,
        color: isActive ? 'var(--accent)' : 'var(--text-2)',
        background: isActive ? 'var(--accent-light)' : 'transparent',
        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        transition: 'background 0.12s, color 0.12s',
      })}
      className="sidebar-link"
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>{Icons[icon]}</span>
      {label}
    </NavLink>
  );
}
