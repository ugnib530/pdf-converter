/**
 * App.jsx
 * Root component — handles client-side navigation between Home and tool pages.
 * Uses simple state-based routing (no react-router dependency for now).
 */
import { useState } from 'react';
import Header   from './components/Header';
import Home     from './pages/Home';
import ToolPage from './pages/ToolPage';

export default function App() {
  // null = homepage; tool config object = show that tool's page
  const [activeTool, setActiveTool] = useState(null);

  const goHome  = () => setActiveTool(null);
  const goTool  = (tool) => {
    if (tool.phase <= 2) setActiveTool(tool);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      {/* Global spin keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        :root { --accent: #6366f1; --accent-light: #eef2ff; }
        input[type="search"]::-webkit-search-cancel-button { display: none; }
        button:focus-visible { outline: 2px solid #6366f1; outline-offset: 2px; }
      `}</style>

      <Header onHome={goHome} />

      {activeTool
        ? <ToolPage tool={activeTool} onBack={goHome} />
        : <Home onSelectTool={goTool} />
      }

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #e5e7eb',
        padding: '20px 24px',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: 12,
      }}>
        <p style={{ margin: 0 }}>
          DocShift · Free PDF tools · No files stored · No sign-up needed
        </p>
      </footer>
    </div>
  );
}
