import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import CodeViewer from '../components/CodeViewer.js';
import { exploreCodebase, getSourceCode, resolveRepoUrl } from '../services/api.js';
import '../styles/explore.css';

/**
 * ExplorePage Component
 * Primary repository feature for finding where functionality is implemented
 * and understanding verifiable AST change impact.
 */
export default function ExplorePage() {
  const location = useLocation();
  const navigate = useNavigate();

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

  // Search state
  const [query, setQuery] = useState(location.state?.initialQuery || '');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Explore response data
  const [exploreData, setExploreData] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Monaco source viewer drawer state
  const [activeSourceModal, setActiveSourceModal] = useState(null);
  const [sourceData, setSourceData] = useState({ code: '', language: 'python' });
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);
  const sourceCacheRef = useRef(new Map());

  // Wipe repository-specific state when switching repositories
  useEffect(() => {
    if (lastRepoRef.current && lastRepoRef.current !== repoUrl) {
      setExploreData(null);
      setSelectedNodeId(null);
      setHasSearched(false);
      setQuery('');
      sourceCacheRef.current.clear();
      setActiveSourceModal(null);
      setSourceData({ code: '', language: 'python' });
      setError(null);
    }
    lastRepoRef.current = repoUrl;
  }, [repoUrl]);

  // Execute exploration query
  const handleSearch = useCallback(
    async (searchQuery, targetNodeId = null) => {
      const q = (searchQuery !== undefined ? searchQuery : query).trim();
      if (!repoUrl) {
        setError('Please select and analyze a repository first.');
        return;
      }
      if (!q) {
        setError('Please enter a feature, file, or symbol to explore.');
        return;
      }

      setLoading(true);
      setError(null);
      setHasSearched(true);

      try {
        const data = await exploreCodebase(repoUrl, q, targetNodeId);
        if (lastRepoRef.current === repoUrl) {
          setExploreData(data);
          if (data.selected_impact?.selected_id) {
            setSelectedNodeId(data.selected_impact.selected_id);
          } else {
            setSelectedNodeId(null);
          }
        }
      } catch (err) {
        if (lastRepoRef.current === repoUrl) {
          setError(err.message || 'Failed to explore repository.');
          setExploreData(null);
          setSelectedNodeId(null);
        }
      } finally {
        if (lastRepoRef.current === repoUrl) {
          setLoading(false);
        }
      }
    },
    [repoUrl, query]
  );

  // Handle selecting an item from the "Found in" panel
  const handleSelectItem = useCallback(
    (item) => {
      if (!item?.id) return;
      setSelectedNodeId(item.id);
      // Re-query with specific selectedNodeId to re-derive impact and compact subgraph
      if (exploreData?.query) {
        handleSearch(exploreData.query, item.id);
      }
    },
    [exploreData?.query, handleSearch]
  );

  // Handle opening Monaco source viewer for a given item
  const handleOpenSource = useCallback((item) => {
    if (!item?.file_path) return;
    setActiveSourceModal({
      filePath: item.file_path,
      symbolName: item.symbol_name,
      startLine: item.start_line || 1,
      endLine: item.end_line || item.start_line || 1,
    });
  }, []);

  // Fetch source code when source drawer opens
  useEffect(() => {
    if (!activeSourceModal?.filePath || !repoUrl) {
      setSourceData({ code: '', language: 'python' });
      setSourceError(null);
      setSourceLoading(false);
      return;
    }

    const { filePath, startLine, endLine } = activeSourceModal;

    if (sourceCacheRef.current.has(filePath)) {
      setSourceData(sourceCacheRef.current.get(filePath));
      setSourceLoading(false);
      setSourceError(null);
      return;
    }

    let isMounted = true;
    setSourceLoading(true);
    setSourceError(null);

    getSourceCode(repoUrl, filePath, startLine, endLine)
      .then((res) => {
        if (isMounted) {
          const loaded = {
            code: res.source_code || '',
            language: res.language || 'python',
          };
          sourceCacheRef.current.set(filePath, loaded);
          setSourceData(loaded);
          setSourceLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setSourceError(err.message || 'Failed to load file source.');
          setSourceLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeSourceModal, repoUrl]);

  // Dismiss drawer on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeSourceModal) {
        setActiveSourceModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSourceModal]);

  // Initial search if passed via route state
  useEffect(() => {
    if (location.state?.initialQuery && !hasSearched) {
      handleSearch(location.state.initialQuery);
    }
  }, [location.state?.initialQuery, hasSearched, handleSearch]);

  const sampleChips = [
    'Where is authentication implemented?',
    'Payment processing',
    'Document ingestion',
    'Request routing',
  ];

  // Derived properties from exploreData
  const foundCategories = exploreData?.found_in || {};
  const categoryKeys = Object.keys(foundCategories).filter(
    (cat) => foundCategories[cat] && foundCategories[cat].length > 0
  );
  const totalFoundCount = categoryKeys.reduce(
    (acc, cat) => acc + foundCategories[cat].length,
    0
  );
  const selectedImpact = exploreData?.selected_impact;
  const compactSubgraph = exploreData?.compact_subgraph;

  return (
    <div className="explore-page">
      <Navbar />

      <main className="explore-container">
        {/* Active Repository Bar */}
        {displayRepoName && (
          <div className="explore-repo-bar">
            <div className="explore-repo-info">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>{displayRepoName}</span>
              <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
              <span style={{ color: 'var(--accent-cyan)' }}>main</span>
            </div>
            <Link
              to="/dashboard"
              state={{ repoUrl }}
              className="btn btn-ghost"
              style={{ fontSize: '11.5px', padding: '3px 8px', textDecoration: 'none' }}
            >
              &larr; Overview
            </Link>
          </div>
        )}

        {/* No Repository Fallback Card */}
        {!repoUrl ? (
          <div className="explore-empty-state">
            <div className="explore-empty-icon">&#128269;</div>
            <h2 className="explore-empty-title">Analyze a Repository First</h2>
            <p className="explore-empty-desc">
              Please analyze a GitHub repository first to explore where features are implemented and understand connected components.
            </p>
            <Link
              to="/"
              className="btn btn-primary"
              style={{ textDecoration: 'none', padding: '9px 18px', fontSize: '13px' }}
            >
              Go to Repository Analyzer &rarr;
            </Link>
          </div>
        ) : (
          <>
            {/* Search Hero */}
            <section className={`explore-hero ${hasSearched ? 'compact' : ''}`}>
              <h1 className="explore-title">Explore Codebase</h1>
              <p className="explore-subtitle">
                Find where something is implemented and understand what is connected to it.
              </p>

              <form
                className="explore-search-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearch();
                }}
              >
                <div className="explore-search-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="explore-search-input"
                  placeholder="Where is authentication implemented? or auth.py, authenticate_user..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="submit"
                  className="btn btn-primary explore-search-btn"
                  disabled={loading || !query.trim()}
                >
                  {loading ? 'Searching...' : 'Explore'}
                </button>
              </form>

              {/* Example Chips */}
              <div className="explore-chips-row">
                <span className="explore-chip-label">Try:</span>
                {sampleChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="explore-chip-btn"
                    onClick={() => {
                      setQuery(chip);
                      handleSearch(chip);
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </section>

            {/* Error Message */}
            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '13px',
                  marginBottom: '20px',
                }}
              >
                {error}
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <span className="badge-dot" style={{ animation: 'pulse 1.2s infinite', marginRight: '8px' }} />
                <span>Searching repository AST and dependencies...</span>
              </div>
            )}

            {/* Results Section */}
            {!loading && hasSearched && exploreData && (
              <>
                {totalFoundCount === 0 ? (
                  /* No Results / Unsupported State */
                  <div className="explore-empty-state">
                    <div className="explore-empty-icon">&#9888;</div>
                    <h3 className="explore-empty-title">Couldn&apos;t find a clear implementation for that.</h3>
                    <p className="explore-empty-desc">
                      Try a file name, function name, or describe the feature differently.
                    </p>
                  </div>
                ) : (
                  /* 2-Column Results Layout */
                  <div className="explore-results-layout">
                    {/* SECTION 1: FOUND IN */}
                    <div className="explore-found-panel">
                      <div className="explore-section-title">
                        <span>Found in</span>
                        <span>{totalFoundCount} results</span>
                      </div>

                      {categoryKeys.map((cat) => (
                        <div key={cat} className="explore-category-group">
                          <div className="explore-category-header">
                            <span>&bull;</span>
                            <span>{cat}</span>
                          </div>

                          {foundCategories[cat].map((item) => {
                            const isSelected = item.id === selectedNodeId;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`explore-item-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelectItem(item)}
                              >
                                <div className="explore-item-header">
                                  <span className="explore-item-symbol">
                                    {item.symbol_name || item.file_path.split('/').pop()}
                                  </span>
                                  <span className="explore-item-type-badge">
                                    {item.symbol_type}
                                  </span>
                                </div>

                                <div className="explore-item-file">
                                  {item.file_path}
                                  {item.start_line ? ` : L${item.start_line}` : ''}
                                  {item.end_line && item.end_line !== item.start_line
                                    ? `–${item.end_line}`
                                    : ''}
                                </div>

                                {item.evidence_reason && (
                                  <div className="explore-item-reason">
                                    {item.evidence_reason}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    {/* SECTION 2: CHANGE IMPACT */}
                    <div className="explore-impact-panel">
                      {selectedImpact ? (
                        <>
                          <div className="explore-impact-header">
                            <div className="explore-impact-badge-row">
                              <span className="badge badge-accent">Change Impact</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Verified AST &amp; Dependency Graph
                              </span>
                            </div>

                            <h2 className="explore-selected-title">
                              <span>Selected:</span>
                              <span style={{ color: 'var(--accent-primary)' }}>
                                {selectedImpact.selected_name}
                              </span>
                            </h2>

                            <div className="explore-selected-file-line">
                              {selectedImpact.selected_file} &bull; {selectedImpact.selected_type}
                            </div>

                            {/* Actions Bar */}
                            <div className="explore-actions-bar">
                              {/* 1. View Source */}
                              <button
                                type="button"
                                className="btn btn-secondary explore-action-btn"
                                onClick={() =>
                                  handleOpenSource({
                                    file_path: selectedImpact.selected_file,
                                    symbol_name: selectedImpact.selected_name,
                                  })
                                }
                                title="Inspect source in Monaco editor"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="16 18 22 12 16 6" />
                                  <polyline points="8 6 2 12 8 18" />
                                </svg>
                                <span>View Source</span>
                              </button>

                              {/* 2. Explain with AI */}
                              <button
                                type="button"
                                className="btn btn-secondary explore-action-btn"
                                onClick={() =>
                                  navigate('/ask', {
                                    state: {
                                      repoUrl,
                                      initialQuestion: `Where and how is ${selectedImpact.selected_name} in ${selectedImpact.selected_file} implemented, and what is its role?`,
                                    },
                                  })
                                }
                                title="Ask CodeLens AI about this implementation"
                              >
                                <span style={{ color: 'var(--accent-primary)' }}>&#10022;</span>
                                <span>Explain with AI</span>
                              </button>

                              {/* 3. Trace Implementation */}
                              <button
                                type="button"
                                className="btn btn-primary explore-action-btn"
                                onClick={() =>
                                  navigate('/flow', {
                                    state: {
                                      repoUrl,
                                      rootFunction: selectedImpact.selected_name.split('.').pop(),
                                    },
                                  })
                                }
                                title="Trace static call flow in Code Flow"
                              >
                                <span>&#9655;</span>
                                <span>Trace Implementation</span>
                              </button>

                              {/* 4. View Full Architecture */}
                              <button
                                type="button"
                                className="btn btn-ghost explore-action-btn"
                                onClick={() =>
                                  navigate('/dashboard', {
                                    state: {
                                      repoUrl,
                                      viewMode: 'architecture',
                                    },
                                  })
                                }
                                title="Open full interactive Architecture Graph"
                              >
                                <span>View Full Architecture &rarr;</span>
                              </button>
                            </div>
                          </div>

                          {/* Relationship Groups */}
                          <div className="explore-impact-groups">
                            {/* Used by */}
                            {selectedImpact.used_by?.length > 0 && (
                              <div className="explore-impact-group">
                                <div className="explore-group-title">
                                  <span style={{ color: 'var(--accent-cyan)' }}>&darr;</span>
                                  <span>Used by / Referenced by ({selectedImpact.used_by.length})</span>
                                </div>
                                <ul className="explore-group-items">
                                  {selectedImpact.used_by.map((item, idx) => (
                                    <li key={idx} className="explore-group-item">
                                      <span>{item.name}</span>
                                      <span className="explore-item-relation-tag">{item.relation}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Calls */}
                            {selectedImpact.calls?.length > 0 && (
                              <div className="explore-impact-group">
                                <div className="explore-group-title">
                                  <span style={{ color: 'var(--accent-primary)' }}>&rarr;</span>
                                  <span>Calls ({selectedImpact.calls.length})</span>
                                </div>
                                <ul className="explore-group-items">
                                  {selectedImpact.calls.map((item, idx) => (
                                    <li key={idx} className="explore-group-item">
                                      <span>{item.name}</span>
                                      <span className="explore-item-relation-tag">{item.relation}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Imports */}
                            {selectedImpact.imports?.length > 0 && (
                              <div className="explore-impact-group">
                                <div className="explore-group-title">
                                  <span style={{ color: 'var(--accent-purple)' }}>&bull;</span>
                                  <span>Imports ({selectedImpact.imports.length})</span>
                                </div>
                                <ul className="explore-group-items">
                                  {selectedImpact.imports.map((item, idx) => (
                                    <li key={idx} className="explore-group-item">
                                      <span>{item.name}</span>
                                      <span className="explore-item-relation-tag">{item.relation}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Related Tests */}
                            {selectedImpact.related_tests?.length > 0 && (
                              <div className="explore-impact-group">
                                <div className="explore-group-title">
                                  <span style={{ color: '#10b981' }}>&#10003;</span>
                                  <span>Related tests ({selectedImpact.related_tests.length})</span>
                                </div>
                                <ul className="explore-group-items">
                                  {selectedImpact.related_tests.map((item, idx) => (
                                    <li key={idx} className="explore-group-item">
                                      <span>{item.name}</span>
                                      <span className="explore-item-relation-tag">{item.relation}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Directly Connected */}
                            {selectedImpact.directly_connected?.length > 0 && (
                              <div className="explore-impact-group">
                                <div className="explore-group-title">
                                  <span>&#8644;</span>
                                  <span>Directly connected ({selectedImpact.directly_connected.length})</span>
                                </div>
                                <ul className="explore-group-items">
                                  {selectedImpact.directly_connected.map((item, idx) => (
                                    <li key={idx} className="explore-group-item">
                                      <span>{item.name}</span>
                                      <span className="explore-item-relation-tag">{item.relation}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>

                          {/* Compact Relationship Visualization */}
                          <div className="explore-visual-container">
                            <div className="explore-visual-header">
                              <span>Compact Relationship Diagram</span>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ fontSize: '11px', padding: '2px 8px' }}
                                onClick={() =>
                                  navigate('/dashboard', {
                                    state: { repoUrl, viewMode: 'architecture' },
                                  })
                                }
                              >
                                View Full Architecture &rarr;
                              </button>
                            </div>

                            <div className="explore-visual-diagram">
                              {/* Incoming Column */}
                              <div className="explore-diagram-column">
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                  Used By / Incoming
                                </div>
                                {selectedImpact.used_by?.slice(0, 3).map((item, idx) => (
                                  <div key={idx} className="explore-diagram-node incoming" title={item.name}>
                                    {item.name}
                                  </div>
                                ))}
                                {(!selectedImpact.used_by || selectedImpact.used_by.length === 0) && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                    None discovered
                                  </div>
                                )}
                              </div>

                              {/* Arrow In */}
                              <div className="explore-diagram-arrow">&rarr;</div>

                              {/* Target Column */}
                              <div className="explore-diagram-column">
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                  Selected
                                </div>
                                <div className="explore-diagram-node target" title={selectedImpact.selected_name}>
                                  {selectedImpact.selected_name}
                                </div>
                              </div>

                              {/* Arrow Out */}
                              <div className="explore-diagram-arrow">&rarr;</div>

                              {/* Outgoing Column */}
                              <div className="explore-diagram-column">
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                                  Calls / Dependencies
                                </div>
                                {selectedImpact.calls?.slice(0, 2).map((item, idx) => (
                                  <div key={idx} className="explore-diagram-node outgoing" title={item.name}>
                                    {item.name}
                                  </div>
                                ))}
                                {selectedImpact.imports?.slice(0, 2).map((item, idx) => (
                                  <div key={`imp-${idx}`} className="explore-diagram-node outgoing" title={item.name}>
                                    {item.name}
                                  </div>
                                ))}
                                {(!selectedImpact.calls || selectedImpact.calls.length === 0) &&
                                  (!selectedImpact.imports || selectedImpact.imports.length === 0) && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                      Leaf component
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                          Select an item from the left to view its connected dependencies and change impact.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Slide-out Monaco Code Viewer Drawer */}
      {activeSourceModal && (
        <div
          className="explore-source-drawer-overlay"
          onClick={() => setActiveSourceModal(null)}
        >
          <div
            className="explore-source-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="explore-drawer-header">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {activeSourceModal.filePath}
                </span>
                {activeSourceModal.startLine && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-primary)' }}>
                    Lines {activeSourceModal.startLine}
                    {activeSourceModal.endLine && activeSourceModal.endLine !== activeSourceModal.startLine
                      ? `–${activeSourceModal.endLine}`
                      : ''}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setActiveSourceModal(null)}
                style={{ padding: '4px 8px', fontSize: '16px' }}
                title="Close (Esc)"
              >
                &times;
              </button>
            </div>
            <div className="explore-drawer-body">
              <CodeViewer
                filePath={activeSourceModal.filePath}
                code={sourceData.code}
                language={sourceData.language}
                startLine={activeSourceModal.startLine}
                endLine={activeSourceModal.endLine}
                loading={sourceLoading}
                error={sourceError}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
