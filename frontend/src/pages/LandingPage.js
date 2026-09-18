import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import '../styles/landing.css';

/**
 * Landing Page - Placeholder Shell
 * Visual Source: Stitch Design Screen 1
 */
export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/fastapi/fastapi');
  const navigate = useNavigate();

  const handleAnalyze = (e) => {
    e.preventDefault();
    if (repoUrl.trim()) {
      navigate('/analysis');
    }
  };

  return (
    <div className="app-container">
      <Navbar />

      <main className="landing-page">
        <div className="landing-hero">
          {/* Badge */}
          <div className="landing-badge">
            <span className="badge-dot" />
            AI CODE INTELLIGENCE
          </div>

          {/* Heading */}
          <h1 className="landing-title">
            Understand Any<br />
            Codebase.<br />
            <span className="landing-title-gradient">Visually.</span>
          </h1>

          {/* Subtitle */}
          <p className="landing-subtitle">
            Paste a GitHub repository and CodeLens maps its architecture, explains its code, and reveals how everything connects.
          </p>

          {/* Repository Input Form */}
          <form className="repo-input-wrapper" onSubmit={handleAnalyze}>
            <div className="repo-input-bar">
              <span className="repo-input-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </span>
              <input
                type="text"
                className="repo-input-field"
                placeholder="https://github.com/organization/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <button type="submit" className="repo-input-btn">
                Analyze <span>&rarr;</span>
              </button>
            </div>
          </form>

          {/* Metadata Hint */}
          <div className="landing-meta-hint">
            <span>Public repositories</span>
            <span>&bull;</span>
            <span>Read-only analysis</span>
            <span>&bull;</span>
            <span>No code execution</span>
          </div>

          {/* Flow Indicator */}
          <div className="landing-flow-steps">
            <span>Repository</span>
            <span>&rarr;</span>
            <span>Architecture</span>
            <span>&rarr;</span>
            <span>Code</span>
            <span>&rarr;</span>
            <span>AI</span>
            <span>&rarr;</span>
            <span className="landing-flow-active">Visual Flow</span>
          </div>

          {/* Preview Window Card */}
          <div className="landing-preview-window">
            <div className="preview-window-header">
              <div className="preview-window-dots">
                <span className="window-dot" />
                <span className="window-dot" />
                <span className="window-dot" />
              </div>
              <div className="preview-window-title">fastapi / oauth2.py</div>
            </div>

            <div className="preview-window-body">
              {/* Files preview */}
              <div className="preview-col-files">
                <div className="preview-col-title">Files</div>
                <div className="preview-file-item">&bull; fastapi/</div>
                <div className="preview-file-item active">&nbsp;&nbsp;auth.py</div>
                <div className="preview-file-item">&nbsp;&nbsp;router.py</div>
                <div className="preview-file-item">&nbsp;&nbsp;models.py</div>
                <div className="preview-file-item">&nbsp;&nbsp;dependencies.py</div>
              </div>

              {/* Code preview */}
              <div className="preview-col-code">
                <div className="preview-col-title">OAUTH2.PY</div>
                <div><span className="code-line-num">41</span><span className="code-keyword">class</span> <span className="code-fn">OAuth2PasswordBearer</span>(OAuth2):</div>
                <div><span className="code-line-num">42</span>&nbsp;&nbsp;<span className="code-keyword">def</span> <span className="code-fn">__init__</span>(self, tokenUrl: str):</div>
                <div><span className="code-line-num">43</span>&nbsp;&nbsp;&nbsp;&nbsp;self.tokenUrl = tokenUrl</div>
                <div><span className="code-line-num">44</span>&nbsp;&nbsp;<span className="code-keyword">async def</span> <span className="code-fn">__call__</span>(self, request):</div>
                <div><span className="code-line-num">45</span>&nbsp;&nbsp;&nbsp;&nbsp;header = request.headers.get(<span className="code-str">"Authorization"</span>)</div>
              </div>

              {/* Topology preview */}
              <div className="preview-col-topology">
                <div>
                  <div className="preview-col-title">Topology</div>
                  <div style={{ padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-surface)' }}>
                    <div style={{ color: '#a5b4fc', fontSize: '11px' }}>&bull; OAuth2Bearer</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>&rarr; verify_jwt</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--accent-green)' }}>&bull; Connected</span>
                  <span>4 nodes</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
