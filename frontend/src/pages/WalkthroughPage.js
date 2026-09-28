import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import Walkthrough from '../components/Walkthrough.js';
import RemotionWalkthrough from '../components/RemotionWalkthrough.js';
import CodeViewer from '../components/CodeViewer.js';
import AIChat from '../components/AIChat.js';
import { getWalkthrough, getSourceCode, resolveRepoUrl } from '../services/api.js';
import '../styles/walkthrough.css';
import '../styles/ai.css';

/**
 * Visual Walkthrough Page - Walkthrough v1
 * Educational visual teaching layer over an analyzed repository.
 * Connects visual concept explanation to real Monaco source code and Ask CodeLens.
 */
export default function WalkthroughPage() {
  const location = useLocation();

  // Active repository URL resolved via single source of truth
  const repoUrl = resolveRepoUrl(location);
  const lastRepoRef = useRef(repoUrl);

  const normalizedRepoUrl = repoUrl.replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase();

  const [walkthroughData, setWalkthroughData] = useState(null);
  const [selectedConceptId, setSelectedConceptId] = useState(null);
  const [loading, setLoading] = useState(Boolean(normalizedRepoUrl));
  const [error, setError] = useState(null);

  // View mode: 'experimental' (Remotion call flow) | 'concepts' (Standard V1)
  const [viewMode, setViewMode] = useState('experimental');
  const [customImplementation, setCustomImplementation] = useState(null);
  const [customChatQuestion, setCustomChatQuestion] = useState(null);

  // Bottom action drawer: 'none' | 'implementation' | 'ask'
  const [activeDrawer, setActiveDrawer] = useState('none');

  // Monaco source code state and cache
  const sourceCacheRef = useRef(new Map());
  const [currentSource, setCurrentSource] = useState({ code: '', language: 'python' });
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);

  const abortControllerRef = useRef(null);
  const activeRequestTokenRef = useRef(0);

  // Wipe repository-specific state when switching repositories
  useEffect(() => {
    if (lastRepoRef.current && lastRepoRef.current !== repoUrl) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setWalkthroughData(null);
      setSelectedConceptId(null);
      setCustomImplementation(null);
      setCustomChatQuestion(null);
      setActiveDrawer('none');
      sourceCacheRef.current.clear();
      setCurrentSource({ code: '', language: 'python' });
      setError(null);
    }
    lastRepoRef.current = repoUrl;
  }, [repoUrl]);

  // Load walkthrough data from backend API with race-condition and cancellation guards
  const loadWalkthrough = useCallback(async () => {
    if (!normalizedRepoUrl) {
      setLoading(false);
      setWalkthroughData(null);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const requestToken = ++activeRequestTokenRef.current;

    setLoading(true);
    setError(null);
    setWalkthroughData(null);
    setCustomImplementation(null);
    setActiveDrawer('none');

    try {
      const data = await getWalkthrough(repoUrl, { signal: controller.signal });
      if (requestToken !== activeRequestTokenRef.current) return;

      // Discard responses for non-active repositories
      const returnedUrl = (data.repository_url || data.project_story?.repo_url || '')
        .trim().replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase();
      if (returnedUrl && returnedUrl !== normalizedRepoUrl) {
        return;
      }

      setWalkthroughData(data);
      if (data.walkthroughs && data.walkthroughs.length > 0) {
        setSelectedConceptId(data.walkthroughs[0].id);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (requestToken === activeRequestTokenRef.current) {
        setError(err.message || 'Failed to load visual walkthrough.');
      }
    } finally {
      if (requestToken === activeRequestTokenRef.current) {
        setLoading(false);
      }
    }
  }, [repoUrl, normalizedRepoUrl]);

  useEffect(() => {
    loadWalkthrough();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadWalkthrough]);

  const selectedConcept = walkthroughData?.walkthroughs?.find(
    (w) => w.id === selectedConceptId
  ) || walkthroughData?.walkthroughs?.[0] || null;

  const activeImplementation =
    customImplementation ||
    (walkthroughData?.project_story?.stages?.[0]?.evidence
      ? {
          file_path: walkthroughData.project_story.stages[0].evidence.file_path,
          symbol: walkthroughData.project_story.stages[0].evidence.symbol,
          start_line: walkthroughData.project_story.stages[0].evidence.start_line,
          end_line: walkthroughData.project_story.stages[0].evidence.end_line,
        }
      : null) ||
    selectedConcept?.implementation ||
    null;

  // Fetch source code whenever View Implementation is open and activeImplementation changes
  useEffect(() => {
    if (activeDrawer !== 'implementation' || !activeImplementation) {
      return;
    }

    const { file_path, start_line, end_line } = activeImplementation;
    const cacheKey = `${file_path}:${start_line}-${end_line}`;

    if (sourceCacheRef.current.has(cacheKey)) {
      setCurrentSource(sourceCacheRef.current.get(cacheKey));
      setSourceLoading(false);
      setSourceError(null);
      return;
    }

    let isMounted = true;
    setSourceLoading(true);
    setSourceError(null);

    getSourceCode(repoUrl, file_path, start_line, end_line)
      .then((res) => {
        if (isMounted) {
          const sourceData = {
            code: res.source_code || '',
            language: res.language || 'python',
          };
          sourceCacheRef.current.set(cacheKey, sourceData);
          setCurrentSource(sourceData);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setSourceError(err.message || 'Failed to load source code.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setSourceLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeDrawer, activeImplementation, repoUrl]);

  const toggleDrawer = (drawerName) => {
    setActiveDrawer((prev) => (prev === drawerName ? 'none' : drawerName));
  };

  const handleRemotionViewImplementation = (impl) => {
    setCustomImplementation(impl);
    setActiveDrawer('implementation');
  };

  const handleRemotionAskCodeLens = (question) => {
    setCustomChatQuestion(question);
    setActiveDrawer('ask');
  };

  const repoName =
    walkthroughData?.project_title ||
    (repoUrl ? repoUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '') : '');

  return (
    <div className="app-container">
      <Navbar />

      <main className="walkthrough-page">
        <div className="walkthrough-container">
          {/* Top Navigation & Repository Pill */}
          {repoUrl && (
            <div className="walkthrough-top-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link
                to="/dashboard"
                state={{ repoUrl }}
                className="btn btn-secondary walkthrough-back-btn"
              >
                <span>&larr;</span> Back to Dashboard
              </Link>
              <a
                href={repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="overview-repo-pill"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>{repoName}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>&nearr;</span>
              </a>
            </div>

            <Link
              to="/flow"
              state={{ repoUrl }}
              className="btn btn-ghost"
              style={{ fontSize: '12px' }}
            >
              Trace Code Flow &rarr;
            </Link>
          </div>
          )}

          {/* Header Area */}
          <div className="walkthrough-header-area">
            <div className="walkthrough-title-block">
              <h1 className="walkthrough-heading">Visual Walkthrough</h1>
              <p className="walkthrough-subheading">
                See how important parts of this project work.
              </p>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="walkthrough-loading-state">
              <div
                className="badge-dot"
                style={{
                  width: '14px',
                  height: '14px',
                  margin: '0 auto 12px',
                  animation: 'pulse 1.5s infinite',
                }}
              />
              <h3>Synthesizing visual walkthrough from repository evidence...</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                Analyzing AST declarations, README workflows, and execution paths.
              </p>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="walkthrough-error-state">
              <strong>Walkthrough Error:</strong> {error}
              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={loadWalkthrough}
                  style={{ fontSize: '12px' }}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {!repoUrl && !loading && (
            <div className="no-workflow-detected-card" style={{ marginTop: '24px' }}>
              <div className="no-workflow-icon">&#9432;</div>
              <h3 className="no-workflow-title">No Active Repository Selected</h3>
              <p className="no-workflow-description">
                Please enter a repository URL or select a repository from the Dashboard to explore its Visual Walkthrough.
              </p>
              <div style={{ marginTop: '16px' }}>
                <Link to="/" className="btn btn-primary" style={{ fontSize: '13px' }}>
                  Analyze a Repository &rarr;
                </Link>
              </div>
            </div>
          )}

          {!loading && walkthroughData && (
            <>
              {/* View Mode Tabs: Standard Concepts vs. Visual Walkthrough — Experimental */}
              <div className="walkthrough-view-mode-tabs">
                <button
                  type="button"
                  className={`view-mode-tab-btn ${viewMode === 'concepts' ? 'active' : ''}`}
                  onClick={() => {
                    setViewMode('concepts');
                    setCustomImplementation(null);
                  }}
                >
                  <span>&#128196;</span>
                  <span>Standard Concepts</span>
                </button>
                <button
                  type="button"
                  className={`view-mode-tab-btn ${viewMode === 'experimental' ? 'active' : ''}`}
                  onClick={() => setViewMode('experimental')}
                >
                  <span>&#9654;</span>
                  <span>Visual Walkthrough &mdash; Experimental</span>
                  <span className="experimental-tag">POC</span>
                </button>
              </div>

              {viewMode === 'experimental' ? (
                /* Experimental Remotion Player Walkthrough */
                <section className="remotion-walkthrough-section">
                  <div className="remotion-experimental-banner">
                    <div className="remotion-banner-left">
                      <span className="remotion-banner-badge">VISUAL WALKTHROUGH &mdash; EXPERIMENTAL</span>
                      <span className="remotion-banner-text">
                        {walkthroughData.project_story ? (
                          <>
                            <strong>How This Project Works:</strong>{' '}
                            {walkthroughData.project_story.project_title} &mdash; {walkthroughData.project_story.project_summary}
                          </>
                        ) : (
                          'Visual Walkthrough — Experimental'
                        )}
                      </span>
                    </div>
                  </div>
                  {walkthroughData.project_story &&
                  (walkthroughData.project_story.repo_url || '').toLowerCase() === normalizedRepoUrl ? (
                    <RemotionWalkthrough
                      story={walkthroughData.project_story}
                      repoName={repoName}
                      onViewImplementation={handleRemotionViewImplementation}
                      onAskCodeLens={handleRemotionAskCodeLens}
                    />
                  ) : (
                    <div className="no-workflow-detected-card">
                      <div className="no-workflow-icon">&#9432;</div>
                      <h3 className="no-workflow-title">
                        Core workflow could not be reliably reconstructed from this repository.
                      </h3>
                      <p className="no-workflow-description">
                        {walkthroughData?.status_message ||
                          `CodeLens analyzed this repository (${repoName}), but could not establish a verifiable multi-stage execution chain.`}
                        {walkthroughData?.reason_code && (
                          <span style={{ display: 'block', marginTop: '8px', fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                            Diagnostic: {walkthroughData.reason_code}
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </section>
              ) : (
                /* Standard Interactive Walkthrough V1 Concepts */
                <>
                  {/* 1. Overall Project Flow Section */}
                  {walkthroughData.overview_flow && walkthroughData.overview_flow.length > 0 && (
                    <section className="overview-flow-section">
                      <div className="overview-flow-label">
                        <span>&#9881;</span> Overall Project Flow
                      </div>
                      <div className="overview-flow-track">
                        {walkthroughData.overview_flow.map((stage, idx) => (
                          <React.Fragment key={idx}>
                            <div className="flow-step-badge">
                              <span className="flow-step-index">{idx + 1}</span>
                              <span className="flow-step-name">{stage}</span>
                            </div>
                            {idx < walkthroughData.overview_flow.length - 1 && (
                              <div className="flow-step-separator">&rarr;</div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 2. Supported Concept Selector */}
                  {walkthroughData.walkthroughs && walkthroughData.walkthroughs.length > 0 && (
                    <section className="concept-selector-section">
                      <div className="concept-selector-label">Supported Concepts</div>
                      <div className="concept-buttons-row">
                        {walkthroughData.walkthroughs.map((concept) => (
                          <button
                            key={concept.id}
                            type="button"
                            className={`concept-tab-btn ${
                              selectedConceptId === concept.id ? 'active' : ''
                            }`}
                            onClick={() => setSelectedConceptId(concept.id)}
                          >
                            <span className="concept-btn-bullet">&bull;</span>
                            <span>{concept.title}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* 3. Walkthrough Animation & Explanation Stage */}
                  <section className="walkthrough-stage-section">
                    <Walkthrough concept={selectedConcept} />
                  </section>

                  {/* 4. Implementation Actions Bar */}
                  {selectedConcept && (
                    <section className="implementation-actions-bar">
                      <div className="actions-info-group">
                        <span className="implementation-label">Connected Implementation:</span>
                        <span className="implementation-symbol-tag">
                          {selectedConcept.implementation.symbol}()
                        </span>
                        <span className="implementation-file-tag">
                          {selectedConcept.implementation.file_path}: L
                          {selectedConcept.implementation.start_line}&ndash;
                          {selectedConcept.implementation.end_line}
                        </span>
                      </div>

                      <div className="actions-button-group">
                        <button
                          type="button"
                          className={`btn ${
                            activeDrawer === 'implementation' ? 'btn-primary' : 'btn-secondary'
                          } action-cta-btn`}
                          onClick={() => {
                            setCustomImplementation(null);
                            toggleDrawer('implementation');
                          }}
                        >
                          <span>&#128187;</span> View Implementation
                        </button>
                        <button
                          type="button"
                          className={`btn ${
                            activeDrawer === 'ask' ? 'btn-primary' : 'btn-secondary'
                          } action-cta-btn`}
                          onClick={() => {
                            setCustomChatQuestion(null);
                            toggleDrawer('ask');
                          }}
                        >
                          <span>&#10024;</span> Ask CodeLens
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}

              {/* 5. Docked Monaco CodeViewer Drawer */}
              {activeDrawer === 'implementation' && activeImplementation && (
                <section className="walkthrough-drawer-card">
                  <div className="drawer-header">
                    <div className="drawer-title-group">
                      <span className="drawer-badge">REAL SOURCE CODE</span>
                      <span className="drawer-file-path">
                        {activeImplementation.file_path}
                      </span>
                      <span className="drawer-line-range">
                        (Lines {activeImplementation.start_line}&ndash;
                        {activeImplementation.end_line})
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setActiveDrawer('none')}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      &times; Close Viewer
                    </button>
                  </div>

                  <div className="drawer-monaco-viewport">
                    <CodeViewer
                      filePath={activeImplementation.file_path}
                      code={currentSource.code}
                      language={currentSource.language}
                      startLine={activeImplementation.start_line}
                      endLine={activeImplementation.end_line}
                      nodeName={activeImplementation.symbol}
                      nodeType="function"
                      loading={sourceLoading}
                      error={sourceError}
                    />
                  </div>
                </section>
              )}

              {/* 6. Docked Ask CodeLens AIChat Drawer */}
              {activeDrawer === 'ask' && (
                <section className="walkthrough-drawer-card">
                  <div className="drawer-header">
                    <div className="drawer-title-group">
                      <span className="drawer-badge ai-badge">ASK CODELENS</span>
                      <span>
                        {viewMode === 'experimental'
                          ? 'Q&A about hmm() Call Flow'
                          : `Q&A about ${selectedConcept?.title || 'Implementation'}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setActiveDrawer('none')}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      &times; Close Chat
                    </button>
                  </div>

                  <div className="drawer-chat-viewport">
                    <AIChat
                      repoUrl={repoUrl}
                      suggestedQuestions={
                        viewMode === 'experimental'
                          ? [
                              customChatQuestion ||
                                `Explain the core execution flow of ${repoName}.`,
                              `Where is ${activeImplementation?.symbol || 'the core entrypoint'} called in this repository?`,
                              `What are the major components in ${repoName}?`,
                            ]
                          : [
                              `How does ${selectedConcept?.title} work in ${selectedConcept?.implementation?.file_path}?`,
                              `Where is ${selectedConcept?.implementation?.symbol}() called in this repository?`,
                              `Explain the implementation trade-offs of ${selectedConcept?.title}.`,
                            ]
                      }
                    />
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
