import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import RepositoryInput from '../components/RepositoryInput.js';
import '../styles/landing.css';

/**
 * Landing Page
 * Visual Source: Stitch Design Screen 1
 */
export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('https://github.com/kennethreitz/samplemod');
  const navigate = useNavigate();

  const handleAnalyze = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (repoUrl.trim()) {
      navigate('/analysis', { state: { repoUrl: repoUrl.trim() } });
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
            <RepositoryInput
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onSubmit={handleAnalyze}
            />
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
