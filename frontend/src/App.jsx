/**
 * App.jsx
 * Root component — sets up React Router routes inside the AppShell.
 */
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import AppShell from './components/AppShell';
import Home from './pages/Home';
import ToolPage from './pages/ToolPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';

export default function App() {
  return (
    <ThemeProvider>
      <Routes>
        {/* Standalone — no TopBar/Sidebar chrome */}
        <Route path="/login" element={<Login />} />

        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/c/:category" element={<Home />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/:slug" element={<ToolPage />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}