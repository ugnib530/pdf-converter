/**
 * AppShell.jsx
 * Persistent layout shell: TopBar + Sidebar + content area (via <Outlet/>).
 * Handles the ⌘K / Ctrl+K global search shortcut and the mobile sidebar drawer.
 */
import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import SearchModal from './SearchModal';

export default function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopBar
        onOpenSearch={() => setSearchOpen(true)}
        onMenuClick={() => setSidebarOpen(o => !o)}
      />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main
        className="app-content"
        style={{
          marginLeft: 'var(--sidebar-w)',
          paddingTop: 'var(--topbar-h)',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </main>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
