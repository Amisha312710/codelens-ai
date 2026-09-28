import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import LandingPage from './pages/LandingPage.js';
import AnalysisPage from './pages/AnalysisPage.js';
import Dashboard from './pages/Dashboard.js';
import AskAIPage from './pages/AskAIPage.js';
import ExplorePage from './pages/ExplorePage.js';
import CodeFlowPage from './pages/CodeFlowPage.js';
import WalkthroughPage from './pages/WalkthroughPage.js';

const THEME_STORAGE_KEY = 'codelens_theme';

export function getInitialTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch (e) {
    // localStorage not accessible
  }
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

// Early application on initial script evaluation to prevent theme flash
if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = getInitialTheme();
}

/**
 * CodeLens AI - Root Application
 * Configures client-side routing across all 6 core product pages.
 * Owns global theme state ("dark" | "light") and keeps document/localStorage in sync.
 */
export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  // Sync theme changes to document element and localStorage
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      // Ignore storage errors
    }
  }, [theme]);

  // Listen for toggle events dispatched across the application
  useEffect(() => {
    const handleToggle = (e) => {
      const explicit = e?.detail?.theme;
      if (explicit === 'dark' || explicit === 'light') {
        setTheme(explicit);
      } else {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
      }
    };
    window.addEventListener('codelens-theme-toggle', handleToggle);
    return () => window.removeEventListener('codelens-theme-toggle', handleToggle);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/ask" element={<AskAIPage />} />
        <Route path="/flow" element={<CodeFlowPage />} />
        <Route path="/walkthrough" element={<WalkthroughPage />} />
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

