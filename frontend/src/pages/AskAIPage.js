import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import AIChat from '../components/AIChat.js';
import CodeViewer from '../components/CodeViewer.js';
import { getProjectOverview, getSourceCode, resolveRepoUrl } from '../services/api.js';
import '../styles/ai.css';

/**
 * Dedicated Ask CodeLens Page
 * Full-page AI workspace focused on the AIChat experience with
 * dynamic repository context, grounded Q&A, and citation source inspection drawer.
 */
export default function AskAIPage() {
  const location = useLocation();

  // Active repository URL resolved via single source of truth
  const repoUrl = resolveRepoUrl(location);
  const lastRepoRef = useRef(repoUrl);

  let displayRepoName = '';
  if (repoUrl) {
    displayRepoName = repoUrl
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '');
  }

  // Repository-grounded suggested questions
  const [suggestedQuestions, setSuggestedQuestions] = useState(
    location.state?.suggestedQuestions || []
  );

  // Citation code inspection drawer state
  const [activeCitation, setActiveCitation] = useState(null);
  const [citationSource, setCitationSource] = useState({ code: '', language: 'python' });
  const [citationLoading, setCitationLoading] = useState(false);
  const [citationError, setCitationError] = useState(null);
  const sourceCacheRef = useRef(new Map());

  // Wipe repository-specific state when switching repositories
  useEffect(() => {
    if (lastRepoRef.current && lastRepoRef.current !== repoUrl) {
      setSuggestedQuestions([]);
      setActiveCitation(null);
      setCitationSource({ code: '', language: 'python' });
      sourceCacheRef.current.clear();
      setCitationError(null);
    }
    lastRepoRef.current = repoUrl;
  }, [repoUrl]);

  // Fetch suggested questions if not provided in route state
  useEffect(() => {
    if (suggestedQuestions.length > 0 || !repoUrl) return;

    let isMounted = true;
    getProjectOverview(repoUrl)
      .then((overview) => {
        if (isMounted && lastRepoRef.current === repoUrl && overview?.suggested_questions?.length) {
          setSuggestedQuestions(overview.suggested_questions);
        }
      })
      .catch(() => {
        // Silently ignore if overview is unavailable
      });

    return () => {
      isMounted = false;
    };
  }, [repoUrl, suggestedQuestions.length]);

  // Handle citation clicks from AIChat responses or evidence cards
  const handleCitationClick = useCallback((filePath, startLine, endLine) => {
    if (!filePath) return;
    setActiveCitation({
      filePath,
      startLine: Number(startLine) || 1,
      endLine: Number(endLine) || Number(startLine) || 1,
    });
  }, []);

  // Fetch file source when a citation is selected
  useEffect(() => {
    if (!activeCitation?.filePath || !repoUrl) {
      setCitationSource({ code: '', language: 'python' });
      setCitationError(null);
      setCitationLoading(false);
      return;
    }

    const { filePath, startLine, endLine } = activeCitation;

    if (sourceCacheRef.current.has(filePath)) {
      setCitationSource(sourceCacheRef.current.get(filePath));
      setCitationLoading(false);
      setCitationError(null);
      return;
    }

    let isMounted = true;
    setCitationLoading(true);
    setCitationError(null);

    getSourceCode(repoUrl, filePath, startLine, endLine)
      .then((res) => {
        if (isMounted) {
          const sourceData = {
            code: res.source_code || '',
            language: res.language || 'python',
          };
          sourceCacheRef.current.set(filePath, sourceData);
          setCitationSource(sourceData);
          setCitationLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setCitationError(err.message || 'Failed to load source code for citation');
          setCitationLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeCitation, repoUrl]);

  // Dismiss drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeCitation) {
        setActiveCitation(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCitation]);

  return (
    <div className="ask-page-layout">
      <Navbar />

      {/* Top Header */}
      <header className="ask-page-top-header">
        <div className="ask-header-left">
          <Link
            to="/dashboard"
            state={{ repoUrl }}
            className="btn btn-ghost"
            style={{
              fontSize: '12px',
              padding: '5px 10px',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Return to Overview Dashboard"
          >
            <span>&larr;</span> Overview
          </Link>
          <div className="ask-header-text">
            <h1 className="ask-page-heading">
              <span>Ask CodeLens</span>
            </h1>
            <p className="ask-page-subheading">
              Understand this repository through grounded AI answers
            </p>
          </div>
        </div>

        <div className="ask-header-right">
          {displayRepoName ? (
            <div className="ask-header-repo-chip" title={repoUrl}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>{displayRepoName}</span>
              <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
              <span style={{ color: 'var(--accent-cyan)' }}>main</span>
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              No active repository
            </span>
          )}
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="ask-workspace-container">
        <div className="ask-workspace-content">
          {!repoUrl ? (
            <div className="ask-no-repo-card">
              <div className="ask-no-repo-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h2 className="ask-no-repo-title">No Repository Selected</h2>
              <p className="ask-no-repo-desc">
                Please analyze a GitHub repository first to start asking architectural and code-level questions grounded in static AST proofs.
              </p>
              <Link
                to="/"
                className="btn btn-primary"
                style={{ marginTop: '20px', textDecoration: 'none', padding: '10px 20px', fontSize: '13px' }}
              >
                Go to Repository Analyzer &rarr;
              </Link>
            </div>
          ) : (
            <div className="ask-chat-full-card">
              <AIChat
                repoUrl={repoUrl}
                onCitationClick={handleCitationClick}
                suggestedQuestions={suggestedQuestions}
              />
            </div>
          )}
        </div>
      </main>

      {/* Slide-out Citation Code Inspection Drawer */}
      {activeCitation && (
        <div className="ask-citation-drawer-overlay" onClick={() => setActiveCitation(null)}>
          <div className="ask-citation-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="ask-drawer-header">
              <div className="ask-drawer-title-group">
                <span className="ask-drawer-title">{activeCitation.filePath}</span>
                {activeCitation.startLine && (
                  <span className="ask-drawer-lines">
                    Lines {activeCitation.startLine}
                    {activeCitation.endLine && activeCitation.endLine !== activeCitation.startLine
                      ? `-${activeCitation.endLine}`
                      : ''}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="ask-drawer-close-btn"
                onClick={() => setActiveCitation(null)}
                aria-label="Close Code Viewer"
                title="Close (Esc)"
              >
                &times;
              </button>
            </div>
            <div className="ask-drawer-body">
              <CodeViewer
                filePath={activeCitation.filePath}
                code={citationSource.code}
                language={citationSource.language}
                startLine={activeCitation.startLine}
                endLine={activeCitation.endLine}
                loading={citationLoading}
                error={citationError}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
