import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import ArchitectureGraph from '../components/ArchitectureGraph.js';
import CodeViewer from '../components/CodeViewer.js';
import AIChat from '../components/AIChat.js';
import { getArchitectureGraph, getSourceCode, getProjectOverview } from '../services/api.js';
import '../styles/dashboard.css';
import '../styles/ai.css';

/**
 * Developer Dashboard
 * Connects real backend repository graph analysis to React Flow visualization,
 * dynamic explorer tree, node inspector, and source preview.
 */
export default function Dashboard() {
  const location = useLocation();

  const [graphData, setGraphData] = useState(location.state?.graphData || null);
  const [overviewData, setOverviewData] = useState(
    location.state?.graphData?.project_overview || null
  );
  const [viewMode, setViewMode] = useState('overview'); // 'overview' | 'architecture'
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(!location.state?.graphData);
  const [error, setError] = useState(null);
  const [fileSearch, setFileSearch] = useState('');
  const [activeTab, setActiveTab] = useState('inspector');

  // Source code state and in-memory cache to prevent redundant fetches
  const sourceCacheRef = useRef(new Map());
  const [currentSource, setCurrentSource] = useState({ code: '', language: 'python' });
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);

  const repoUrl = (
    location.state?.repoUrl ||
    location.state?.graphData?.repository_url ||
    new URLSearchParams(location.search).get('repo') ||
    ''
  ).trim();

  const repoName =
    overviewData?.repository_name ||
    graphData?.repository_name ||
    repoUrl.replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/, '');

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getArchitectureGraph(repoUrl);
      setGraphData(data);
      if (data.project_overview) {
        setOverviewData(data.project_overview);
      } else {
        try {
          const ov = await getProjectOverview(repoUrl);
          setOverviewData(ov);
        } catch (_) {
          // Graceful fallback
        }
      }
      if (data.nodes && data.nodes.length > 0) {
        setSelectedNode(data.nodes[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch architecture graph.');
    } finally {
      setLoading(false);
    }
  }, [repoUrl]);

  const handleCitationClick = useCallback(
    (filePath, startLine, endLine) => {
      // Switch view mode to architecture to reveal graph and Monaco code viewer
      setViewMode('architecture');

      const existingNode =
        graphData?.nodes?.find(
          (n) => n.file_path === filePath && n.start_line === startLine
        ) || graphData?.nodes?.find((n) => n.file_path === filePath);

      setSelectedNode({
        id: `citation:${filePath}:${startLine}-${endLine}`,
        name: existingNode?.name || filePath.split('/').pop() || filePath,
        file_path: filePath,
        start_line: Number(startLine),
        end_line: Number(endLine),
        type: 'citation',
      });
    },
    [graphData]
  );

  useEffect(() => {
    if (!graphData) {
      loadGraph();
    } else {
      if (!overviewData && graphData.project_overview) {
        setOverviewData(graphData.project_overview);
      }
      if (!selectedNode && graphData.nodes && graphData.nodes.length > 0) {
        setSelectedNode(graphData.nodes[0]);
      }
    }
  }, [graphData, selectedNode, overviewData, loadGraph]);

  // Retrieve source code whenever selectedNode changes
  useEffect(() => {
    if (!selectedNode || !selectedNode.file_path) {
      setCurrentSource({ code: '', language: 'python' });
      setSourceError(null);
      setSourceLoading(false);
      return;
    }

    const filePath = selectedNode.file_path;

    // Use cached source code if already fetched
    if (sourceCacheRef.current.has(filePath)) {
      const cached = sourceCacheRef.current.get(filePath);
      setCurrentSource(cached);
      setSourceLoading(false);
      setSourceError(null);
      return;
    }

    let isMounted = true;
    setSourceLoading(true);
    setSourceError(null);

    getSourceCode(repoUrl, filePath, selectedNode.start_line, selectedNode.end_line)
      .then((res) => {
        if (isMounted) {
          const sourceData = {
            code: res.source_code,
            language: res.language || 'python',
          };
          sourceCacheRef.current.set(filePath, sourceData);
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
  }, [selectedNode, repoUrl]);

  // Lookup map for fast node retrieval by id
  const nodeMap = useMemo(() => {
    const map = new Map();
    if (graphData?.nodes) {
      graphData.nodes.forEach((n) => map.set(n.id, n));
    }
    return map;
  }, [graphData]);

  // Filtered files for left explorer
  const fileNodes = useMemo(() => {
    if (!graphData?.nodes) return [];
    const files = graphData.nodes.filter((n) => n.type === 'file');
    if (!fileSearch.trim()) return files;
    const q = fileSearch.toLowerCase();
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.file_path && f.file_path.toLowerCase().includes(q))
    );
  }, [graphData, fileSearch]);

  // Compute connections (both outgoing and incoming) for the selected node
  const connections = useMemo(() => {
    if (!selectedNode || !graphData?.edges) return [];

    const result = [];
    graphData.edges.forEach((edge) => {
      if (edge.source === selectedNode.id) {
        const target = nodeMap.get(edge.target);
        result.push({
          id: edge.id,
          type: edge.type,
          direction: 'outgoing',
          label: `${edge.type} → ${target?.name || edge.target}`,
          targetNode: target,
        });
      } else if (edge.target === selectedNode.id) {
        const source = nodeMap.get(edge.source);
        result.push({
          id: edge.id,
          type: edge.type,
          direction: 'incoming',
          label: `${source?.name || edge.source} → ${edge.type}`,
          targetNode: source,
        });
      }
    });

    return result;
  }, [selectedNode, graphData, nodeMap]);

  // Group tech stack items by category
  const techByCategory = useMemo(() => {
    if (!overviewData?.tech_stack) return {};
    const groups = {};
    overviewData.tech_stack.forEach((item) => {
      const cat = item.category || 'Other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [overviewData]);

  return (
    <div className="dashboard-page">
      <Navbar />

      {/* Top Header & Navigation Action */}
      <div className="dashboard-top-nav-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

        <div>
          {viewMode === 'overview' ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setViewMode('architecture')}
              style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Explore Architecture Graph &rarr;
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setViewMode('overview')}
              style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              &larr; Back to Project Overview
            </button>
          )}
        </div>
      </div>

      {/* View Mode 1: Human-First Project Understanding Dashboard */}
      {viewMode === 'overview' && (
        <main className="dashboard-overview-page">
          <div className="dashboard-overview-container">
            {/* Loading state */}
            {loading && !overviewData && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                <div className="badge-dot" style={{ width: '14px', height: '14px', margin: '0 auto 12px', animation: 'pulse 1.5s infinite' }} />
                <h3>Analyzing repository &amp; synthesizing understanding...</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Extracting README, manifests, AST relationships, and architecture flow.</p>
              </div>
            )}

            {/* Error state */}
            {error && !loading && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', padding: '16px 20px', color: '#fca5a5' }}>
                <strong>Analysis Error:</strong> {error}
                <div style={{ marginTop: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={loadGraph} style={{ fontSize: '12px' }}>
                    Retry Analysis
                  </button>
                </div>
              </div>
            )}

            {(!loading || overviewData) && (
              <>
                {/* 1. Project Header & Snapshot */}
                <header className="overview-hero">
                  <div>
                    <h1 className="overview-title">
                      {overviewData?.repository_name?.split('/')?.pop() || repoName.split('/').pop() || 'Project Overview'}
                    </h1>
                  </div>

                  <p className="overview-description">
                    {overviewData?.description ||
                      'A modular codebase analyzed and indexed by CodeLens AI. Explore its core purpose, detected tech stack, and execution flows below.'}
                  </p>

                  {/* Snapshot Metric Cards */}
                  <div className="snapshot-grid">
                    <div className="snapshot-card">
                      <div className="snapshot-label">Primary Language</div>
                      <div className="snapshot-val">
                        {overviewData?.snapshot?.primary_language || 'Python'}
                      </div>
                      <div className="snapshot-sub">
                        {overviewData?.snapshot?.languages?.[0] || '100% of codebase'}
                      </div>
                    </div>

                    <div className="snapshot-card">
                      <div className="snapshot-label">Total Files</div>
                      <div className="snapshot-val">
                        {overviewData?.snapshot?.total_files ?? graphData?.total_nodes ?? 0}
                      </div>
                      <div className="snapshot-sub">Source &amp; configuration files</div>
                    </div>

                    <div className="snapshot-card">
                      <div className="snapshot-label">Major Modules</div>
                      <div className="snapshot-val">
                        {overviewData?.snapshot?.major_modules_count ?? 1}
                      </div>
                      <div className="snapshot-sub">
                        {overviewData?.snapshot?.major_modules?.length > 0
                          ? overviewData.snapshot.major_modules.join(', ')
                          : 'Root package'}
                      </div>
                    </div>

                    <div className="snapshot-card">
                      <div className="snapshot-label">Dependencies</div>
                      <div className="snapshot-val">
                        {overviewData?.snapshot?.dependencies_count ?? graphData?.total_edges ?? 0}
                      </div>
                      <div className="snapshot-sub">
                        {overviewData?.snapshot?.internal_dependencies_count ?? 0} internal module links
                      </div>
                    </div>
                  </div>
                </header>

                {/* 2. What This Project Does */}
                <section className="overview-section">
                  <div className="section-header-group">
                    <div>
                      <h2 className="section-title">What This Project Does</h2>
                      <div className="section-subtitle">
                        High-level purpose and key capabilities grounded in repository documentation
                      </div>
                    </div>
                  </div>

                  <div className="purpose-cards-grid">
                    {/* Core Purpose & Problem Solved */}
                    <div className="purpose-card">
                      <div className="purpose-card-title">Core Purpose &amp; Problem Solved</div>
                      <div className="purpose-body-text">
                        {overviewData?.core_purpose || 'Provides modular software architecture for developer tooling.'}
                      </div>
                      <div className="purpose-highlight-box">
                        <strong>Problem Solved: </strong>
                        {overviewData?.problem_solved ||
                          'Solves architectural organization and testing challenges by establishing clean module separation.'}
                      </div>

                      {overviewData?.use_cases?.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>
                            Likely Use Cases
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {overviewData.use_cases.map((uc, idx) => (
                              <li key={idx}>{uc}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Key Features */}
                    <div className="purpose-card">
                      <div className="purpose-card-title">Key Features &amp; Capabilities</div>
                      <div className="features-list">
                        {(overviewData?.key_features || [
                          'Modular architecture with clean package boundaries.',
                          'Automated test suite integration.',
                          'Standardized distribution and packaging.',
                        ]).map((feature, idx) => (
                          <div key={idx} className="feature-item">
                            <span className="feature-icon">&#10003;</span>
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* 3. Technology Stack */}
                <section className="overview-section">
                  <div className="section-header-group">
                    <div>
                      <h2 className="section-title">Technology Stack</h2>
                      <div className="section-subtitle">
                        Categorized technologies verified directly from manifests and source files
                      </div>
                    </div>
                  </div>

                  <div className="tech-stack-cards-grid">
                    {Object.keys(techByCategory).length > 0 ? (
                      Object.entries(techByCategory).map(([category, items]) => (
                        <div key={category} className="tech-category-card">
                          <div className="tech-category-header">
                            <span>{category}</span>
                            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                              {items.length} {items.length === 1 ? 'item' : 'items'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {items.map((tech, idx) => (
                              <div key={idx} className="tech-item-row">
                                <div className="tech-item-header">
                                  <span>{tech.name}</span>
                                </div>
                                <div className="tech-item-source">{tech.source}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '20px', color: 'var(--text-dim)', fontSize: '13px' }}>
                        No external frameworks detected (pure Python standard library package).
                      </div>
                    )}
                  </div>
                </section>

                {/* 4. How It Is Built (Conceptual Architecture) */}
                <section className="overview-section">
                  <div className="section-header-group">
                    <div>
                      <h2 className="section-title">How It Is Built (Conceptual Architecture)</h2>
                      <div className="section-subtitle">
                        A simplified 3-tier view of how the system is structured into functional layers
                      </div>
                    </div>
                  </div>

                  <div className="conceptual-architecture-flow">
                    {(overviewData?.conceptual_architecture || []).map((layer, idx) => (
                      <React.Fragment key={layer.id || idx}>
                        <div className="layer-card">
                          <div className="layer-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span className="layer-badge">Tier {idx + 1}</span>
                              <span className="layer-title">{layer.name}</span>
                            </div>
                            <span className="layer-role">{layer.role}</span>
                          </div>

                          <div className="layer-description">{layer.description}</div>

                          <div className="layer-meta-row">
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '4px', alignSelf: 'center' }}>
                              Files:
                            </span>
                            {(layer.files || []).map((fp, fIdx) => (
                              <span key={fIdx} className="layer-file-pill">
                                {fp}
                              </span>
                            ))}

                            {layer.key_symbols?.length > 0 && (
                              <>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px', marginRight: '4px', alignSelf: 'center' }}>
                                  Key symbols:
                                </span>
                                {layer.key_symbols.map((sym, sIdx) => (
                                  <span key={sIdx} className="layer-symbol-pill">
                                    {sym}()
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>

                        {idx < (overviewData?.conceptual_architecture?.length || 0) - 1 && (
                          <div className="layer-connector">
                            <span>&darr;</span>
                            <span>{idx === 0 ? 'initializes & delegates to domain logic' : 'calls helper subroutines & verified by tests'}</span>
                            <span>&darr;</span>
                          </div>
                        )}
                      </React.Fragment>
                    ))}

                    <div className="explore-graph-cta-card">
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#c7d2fe' }}>
                          Ready for a deep dive into every class and function connection?
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Explore all {graphData?.total_nodes || 15} nodes and {graphData?.total_edges || 14} dependencies with the interactive React Flow visualizer and Monaco source inspector.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setViewMode('architecture')}
                        style={{ flexShrink: 0, padding: '8px 16px', fontSize: '12px' }}
                      >
                        Explore Architecture Graph &rarr;
                      </button>
                    </div>
                  </div>
                </section>

                {/* 5. Understand How It Works (Key Workflows) */}
                <section className="overview-section">
                  <div className="section-header-group">
                    <div>
                      <h2 className="section-title">Understand How It Works (Key Workflows)</h2>
                      <div className="section-subtitle">
                        Important execution flows traced directly from static AST calls &mdash; click Trace Flow to visualize each step
                      </div>
                    </div>

                    <Link
                      to="/walkthrough"
                      state={{ repoUrl }}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      Visual Walkthrough &rarr;
                    </Link>
                  </div>

                  <div className="workflows-container">
                    {(overviewData?.workflows || []).map((wf) => (
                      <div key={wf.id} className="workflow-card">
                        <div className="workflow-header">
                          <h3 className="workflow-title">{wf.title}</h3>
                          <div className="workflow-desc">{wf.description}</div>
                        </div>

                        <div className="workflow-steps-list">
                          {wf.steps?.map((step, sIdx) => (
                            <div key={sIdx} className="workflow-step-item">
                              <span className="workflow-step-num">{sIdx + 1}</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                          <Link
                            to="/flow"
                            state={{ repoUrl, rootFunction: wf.root_function }}
                            className="btn btn-primary"
                            style={{ flex: 1, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px' }}
                          >
                            <span>&#9655;</span> Trace Code Flow
                          </Link>
                          <Link
                            to="/walkthrough"
                            state={{ repoUrl }}
                            className="btn btn-secondary"
                            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px 12px' }}
                            title="Interactive visual walkthrough"
                          >
                            Walkthrough &rarr;
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 6. Ask CodeLens (Integrated Assistant) */}
                <section className="overview-section">
                  <div className="section-header-group">
                    <div>
                      <h2 className="section-title">Ask CodeLens</h2>
                      <div className="section-subtitle">
                        Ask architectural questions grounded strictly in this repository's real source code
                      </div>
                    </div>

                    <Link
                      to="/ask"
                      state={{ repoUrl, suggestedQuestions: overviewData?.suggested_questions }}
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      title="Open full-page AI conversation workspace"
                    >
                      Open Dedicated Page &rarr;
                    </Link>
                  </div>

                  <div className="ask-codelens-wrapper">
                    {/* Embedded Ask AI 2.0 Assistant */}
                    <div className="ask-embedded-chat-dock">
                      <AIChat
                        repoUrl={repoUrl}
                        onCitationClick={handleCitationClick}
                        suggestedQuestions={overviewData?.suggested_questions}
                      />
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      )}

      {/* View Mode 2: Detailed 3-Column Architecture Explorer, Graph & Source Viewer */}
      {viewMode === 'architecture' && (
        <div className="dashboard-layout">
        {/* Left Column: Explorer */}
        <aside className="dashboard-explorer">
          <div className="explorer-header">
            <span>Explorer</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>
              {fileNodes.length} Files
            </span>
          </div>

          <div className="explorer-search">
            <input
              type="text"
              className="explorer-search-input"
              placeholder="Search files... ⌘P"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
            />
          </div>

          <div className="explorer-tree">
            {fileNodes.map((file) => {
              const isSelectedFile =
                selectedNode &&
                (selectedNode.id === file.id || selectedNode.file_path === file.file_path);

              return (
                <div
                  key={file.id}
                  className={`explorer-node ${isSelectedFile ? 'active' : ''}`}
                  onClick={() => setSelectedNode(file)}
                  style={{ cursor: 'pointer' }}
                >
                  <span style={{ color: 'var(--accent-primary)', fontSize: '11px' }}>
                    &bull;
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                </div>
              );
            })}
            {fileNodes.length === 0 && (
              <div style={{ padding: '12px 8px', color: 'var(--text-dim)', fontSize: '11px' }}>
                No files match filter.
              </div>
            )}
          </div>

          <div className="explorer-footer">
            <span>
              <span
                className="badge-dot-green"
                style={{ display: 'inline-block', marginRight: '4px' }}
              />
              Indexed
            </span>
            <span
              style={{
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={graphData?.repository_name || repoUrl}
            >
              {graphData?.repository_name || repoName || 'Repository'}
            </span>
          </div>
        </aside>

        {/* Center Column: Architecture Graph & Docked Source */}
        <main className="dashboard-center">
          <div className="graph-header">
            <div className="graph-title-group">
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Architecture Graph
              </span>
              <span className="graph-badge">
                {graphData?.total_nodes ?? 0} nodes &bull; {graphData?.total_edges ?? 0} connections
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                to="/flow"
                className="btn btn-primary"
                style={{ fontSize: '11px', padding: '5px 12px' }}
              >
                Trace Flow &rarr;
              </Link>
            </div>
          </div>

          {/* Graph Interactive Canvas */}
          <div className="graph-canvas">
            <div className="graph-canvas-grid" />
            {loading && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  zIndex: 2,
                }}
              >
                <div
                  className="badge-dot"
                  style={{ width: '12px', height: '12px', animation: 'pulse 1.5s infinite' }}
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Loading repository architecture graph...
                </span>
              </div>
            )}

            {error && !loading && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  zIndex: 2,
                  padding: '20px',
                  textAlign: 'center',
                }}
              >
                <span style={{ color: 'var(--accent-red)', fontSize: '13px', fontWeight: 600 }}>
                  {error}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={loadGraph}
                  style={{ fontSize: '12px' }}
                >
                  Retry Analysis
                </button>
              </div>
            )}

            {!loading && !error && graphData && (
              <ArchitectureGraph
                nodes={graphData.nodes || []}
                edges={graphData.edges || []}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
              />
            )}
          </div>

          {/* Bottom Source Dock */}
          <CodeViewer
            filePath={selectedNode?.file_path || ''}
            code={currentSource.code}
            language={currentSource.language}
            startLine={selectedNode?.start_line}
            endLine={selectedNode?.end_line}
            nodeType={selectedNode?.type || 'file'}
            nodeName={selectedNode?.name || ''}
            loading={sourceLoading}
            error={sourceError}
          />
        </main>

        {/* Right Column: Inspector & AI Chat */}
        <aside className="dashboard-inspector">
          <div className="inspector-tab-group">
            <button
              type="button"
              className={`inspector-tab-btn ${activeTab === 'inspector' ? 'active' : ''}`}
              onClick={() => setActiveTab('inspector')}
            >
              Inspector
            </button>
            <button
              type="button"
              className={`inspector-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              &#10024; AI Chat
            </button>
          </div>

          {activeTab === 'chat' ? (
            <AIChat
              repoUrl={repoUrl}
              onCitationClick={handleCitationClick}
            />
          ) : (
            <>
              <div className="inspector-header">
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                  }}
                >
                  Inspector
                </span>
                <span className="badge" style={{ fontSize: '10px' }}>
                  {selectedNode ? 'Focused' : 'Idle'}
                </span>
              </div>

              <h3 className="inspector-title">
                {selectedNode?.name || 'No Selection'}
              </h3>
              <div className="inspector-subtitle">
                {selectedNode?.file_path || 'Click any graph node to inspect'}
              </div>

              <div className="inspector-stats-row">
                <div className="stat-box">
                  <div className="stat-label">Type</div>
                  <div className="stat-value" style={{ fontSize: '14px', textTransform: 'uppercase' }}>
                    {selectedNode?.type || '-'}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Lines</div>
                  <div className="stat-value" style={{ fontSize: '14px' }}>
                    {selectedNode?.start_line
                      ? `${selectedNode.start_line}${selectedNode.end_line && selectedNode.end_line !== selectedNode.start_line ? `-${selectedNode.end_line}` : ''}`
                      : '-'}
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">Edges</div>
                  <div className="stat-value">{connections.length}</div>
                </div>
              </div>

              <div className="inspector-actions">
                {selectedNode?.type === 'function' && (
                  <Link
                    to="/flow"
                    state={{ repoUrl, rootFunction: selectedNode.name }}
                    className="btn btn-primary"
                    style={{ width: '100%', textAlign: 'center', marginBottom: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>&#9655;</span> Trace Code Flow
                  </Link>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', textAlign: 'center' }}
                  onClick={() => setActiveTab('chat')}
                >
                  &#10024; Explain with AI
                </button>
              </div>

              <div className="inspector-connections-section">
                <div className="section-label">
                  Connected Relationships ({connections.length})
                </div>
                {connections.length > 0 ? (
                  connections.map((conn) => (
                    <div
                      key={conn.id}
                      className="connection-item"
                      style={{ cursor: conn.targetNode ? 'pointer' : 'default' }}
                      onClick={() => {
                        if (conn.targetNode) {
                          setSelectedNode(conn.targetNode);
                        }
                      }}
                      title={conn.targetNode ? `Jump to ${conn.targetNode.name}` : ''}
                    >
                      <span style={{ fontSize: '11px' }}>&bull; {conn.label}</span>
                      <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>&rarr;</span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-dim)', fontSize: '11px', padding: '6px 0' }}>
                    No direct connections recorded.
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}

