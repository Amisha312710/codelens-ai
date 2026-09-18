import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Pages
import LandingPage from './pages/LandingPage.js';
import AnalysisPage from './pages/AnalysisPage.js';
import Dashboard from './pages/Dashboard.js';
import AskAIPage from './pages/AskAIPage.js';
import CodeFlowPage from './pages/CodeFlowPage.js';
import WalkthroughPage from './pages/WalkthroughPage.js';

/**
 * CodeLens AI - Root Application
 * Configures client-side routing across all 6 core product pages.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/ask" element={<AskAIPage />} />
        <Route path="/flow" element={<CodeFlowPage />} />
        <Route path="/walkthrough" element={<WalkthroughPage />} />
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
