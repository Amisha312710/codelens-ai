import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import RepositoryInput from '../components/RepositoryInput.js';
import { getActiveRepoUrl, setActiveRepoUrl } from '../services/api.js';
import '../styles/landing.css';

/**
 * Landing Page
 * Visual Source: Stitch Design Screen 1
 */
export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('');
  const navigate = useNavigate();
  const activeRepo = getActiveRepoUrl();

  const handleAnalyze = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const clean = repoUrl.trim();
    if (clean) {
      setActiveRepoUrl(clean);
      navigate('/analysis', { state: { repoUrl: clean } });
    }
  };

  const displayActiveName = activeRepo
    ? activeRepo.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '')
    : '';

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

          {/* Active Repository Resume Notice if already selected */}
          {displayActiveName && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '20px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              <span className="badge-dot" style={{ backgroundColor: 'var(--accent-green)' }} />
              <span>
                Active repository: <strong style={{ color: 'var(--text-primary)' }}>{displayActiveName}</strong>
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard', { state: { repoUrl: activeRepo } })}
                style={{ fontSize: '11px', padding: '3px 10px', marginLeft: '6px' }}
              >
                Open Overview &rarr;
              </button>
            </div>
          )}

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
        </div>
      </main>
    </div>
  );
}
