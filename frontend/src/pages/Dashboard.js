import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import ArchitectureGraph from '../components/ArchitectureGraph.js';
import { getArchitectureGraph } from '../services/api.js';
import '../styles/dashboard.css';

/**
 * Developer Dashboard
 * Connects real backend repository graph analysis to React Flow visualization,
 * dynamic explorer tree, node inspector, and source preview.
 */
export default function Dashboard() {
  const location = useLocation();

  const [graphData, setGraphData] = useState(location.state?.graphData || null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [loading, setLoading] = useState(!location.state?.graphData);
  const [error, setError] = useState(null);
  const [fileSearch, setFileSearch] = useState('');

  const repoUrl =
    location.state?.repoUrl ||
    location.state?.graphData?.repository_url ||
    'https://github.com/kennethreitz/samplemod';

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getArchitectureGraph(repoUrl);
      setGraphData(data);
      if (data.nodes && data.nodes.length > 0) {
        setSelectedNode(data.nodes[0]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch architecture graph.');
    } finally {
      setLoading(false);
    }
  }, [repoUrl]);

  useEffect(() => {
    if (!graphData) {
      loadGraph();
    } else if (!selectedNode && graphData.nodes && graphData.nodes.length > 0) {
      setSelectedNode(graphData.nodes[0]);
    }
  }, [graphData, selectedNode, loadGraph]);

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

  return (
    <div className="dashboard-page">
      <Navbar />

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
              {graphData?.repository_name || 'samplemod'}
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
          <div className="dashboard-source-dock">
            <div className="source-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    fontSize: '10px',
                  }}
                >
                  SOURCE
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {selectedNode?.file_path || 'No node selected'}
                </span>
              </div>
              {selectedNode?.start_line && (
                <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                  Line {selectedNode.start_line}
                  {selectedNode.end_line && selectedNode.end_line !== selectedNode.start_line
                    ? ` - ${selectedNode.end_line}`
                    : ''}
                </span>
              )}
            </div>

            <div className="source-code">
              {selectedNode ? (
                <>
                  <div>
                    <span className="code-line-num">1</span>
                    <span className="code-comment">
                      # Node: {selectedNode.name} ({selectedNode.type})
                    </span>
                  </div>
                  <div>
                    <span className="code-line-num">2</span>
                    <span className="code-comment">
                      # File: {selectedNode.file_path}
                    </span>
                  </div>
                  {selectedNode.start_line && (
                    <div>
                      <span className="code-line-num">3</span>
                      <span className="code-comment">
                        # Location: Lines {selectedNode.start_line} to {selectedNode.end_line}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="code-line-num">4</span>
                  </div>
                  {selectedNode.type === 'function' && (
                    <div>
                      <span className="code-line-num">{selectedNode.start_line || 5}</span>
                      <span className="code-keyword">def</span>{' '}
                      <span className="code-fn">{selectedNode.name}</span>(...):
                    </div>
                  )}
                  {selectedNode.type === 'class' && (
                    <div>
                      <span className="code-line-num">{selectedNode.start_line || 5}</span>
                      <span className="code-keyword">class</span>{' '}
                      <span className="code-fn">{selectedNode.name}</span>:
                    </div>
                  )}
                  {selectedNode.type === 'file' && (
                    <div>
                      <span className="code-line-num">5</span>
                      <span className="code-comment">
                        # Top-level module: {selectedNode.file_path}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: 'var(--text-dim)' }}>
                  Select a node from the architecture graph to view source details.
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right Column: Inspector */}
        <aside className="dashboard-inspector">
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
            <Link
              to="/ask"
              className="btn btn-secondary"
              style={{ width: '100%', textDecoration: 'none', textAlign: 'center' }}
            >
              &#10024; Explain with AI
            </Link>
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
        </aside>
      </div>
    </div>
  );
}

