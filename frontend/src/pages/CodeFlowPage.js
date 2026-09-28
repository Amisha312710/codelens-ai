import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import CodeFlow from '../components/CodeFlow.js';
import CodeViewer from '../components/CodeViewer.js';
import { traceFlow, getFlowFunctions, getSourceCode } from '../services/api.js';
import '../styles/flow.css';

/**
 * Code Flow Page - Code Flow v1
 * Static AST-derived function call flow visualizer.
 * Connects function selection to React Flow and real docked Monaco source code.
 */
export default function CodeFlowPage() {
  const location = useLocation();

  const repoUrl = (
    location.state?.repoUrl ||
    new URLSearchParams(location.search).get('repo') ||
    ''
  ).trim();

  const [functionQuery, setFunctionQuery] = useState(
    location.state?.rootFunction || ''
  );
  const [maxDepth, setMaxDepth] = useState(3);
  const [flowData, setFlowData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [availableFunctions, setAvailableFunctions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiNotice, setAiNotice] = useState(false);

  // Monaco source code state and cache
  const sourceCacheRef = useRef(new Map());
  const [currentSource, setCurrentSource] = useState({ code: '', language: 'python' });
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState(null);

  // Load available functions for the compact search control
  useEffect(() => {
    let isMounted = true;
    getFlowFunctions(repoUrl)
      .then((data) => {
        if (isMounted && data.functions) {
          setAvailableFunctions(data.functions);
          // If no initial query, default to first non-test function
          if (!functionQuery && data.functions.length > 0) {
            const first =
              data.functions.find((f) => !f.file_path.includes('test')) ||
              data.functions[0];
            setFunctionQuery(first.name);
          }
        }
      })
      .catch(() => {
        // Fallback: non-blocking if listing fails
      });
    return () => {
      isMounted = false;
    };
  }, [repoUrl]);

  // Execute flow trace
  const handleTrace = useCallback(
    async (fnName, depthVal) => {
      const targetFunc = (fnName !== undefined ? fnName : functionQuery).trim();
      const targetDepth = depthVal !== undefined ? depthVal : maxDepth;

      if (!targetFunc) {
        setError('Please select or enter a function to trace.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await traceFlow(repoUrl, targetFunc, targetDepth);
        setFlowData(data);
        if (data.nodes && data.nodes.length > 0) {
          setSelectedNode(data.nodes[0]);
        } else {
          setSelectedNode(null);
        }
      } catch (err) {
        setError(err.message || "We couldn't trace this function's flow.");
        setFlowData(null);
        setSelectedNode(null);
      } finally {
        setLoading(false);
      }
    },
    [repoUrl, functionQuery, maxDepth]
  );

  // Automatically trace if navigated with a root function from Dashboard
  useEffect(() => {
    if (location.state?.rootFunction) {
      handleTrace(location.state.rootFunction, 3);
    }
  }, [location.state?.rootFunction, handleTrace]);

  // Fetch source code when selectedNode changes
  useEffect(() => {
    if (!selectedNode || !selectedNode.file_path) {
      setCurrentSource({ code: '', language: 'python' });
      setSourceError(null);
      setSourceLoading(false);
      return;
    }

    const filePath = selectedNode.file_path;

    if (sourceCacheRef.current.has(filePath)) {
      setCurrentSource(sourceCacheRef.current.get(filePath));
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
          const sData = {
            code: res.source_code,
            language: res.language || 'python',
          };
          sourceCacheRef.current.set(filePath, sData);
          setCurrentSource(sData);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setSourceError(err.message || 'Failed to load source code.');
        }
      })
      .finally(() => {
        if (isMounted) setSourceLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNode, repoUrl]);

  return (
    <div className="flow-page">
      <Navbar />

      {/* Header bar */}
      <div className="flow-header-bar">
        <div className="flow-title-wrap">
          <div className="flow-tag-row">
            <span className="badge-ai" style={{ padding: '2px 8px', fontSize: '10px' }}>&bull; CODE FLOW</span>
            <span className="badge" style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>Static AST Call Flow</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Depth: 1–3</span>
          </div>
          <h1 className="flow-main-heading">See how this part of the code works.</h1>
          <div className="flow-subheading">
            Trace a function through internal call relationships to understand its key steps and inspect real source code.
          </div>
        </div>

        <Link to="/dashboard" className="btn btn-secondary" style={{ fontSize: '12px' }}>
          &larr; Back to Overview
        </Link>
      </div>

      {/* Control Toolbar */}
      <div className="flow-toolbar">
        <div className="flow-controls-left">
          {/* Compact Function Search Selector */}
          <div className="flow-search-control">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Function:</span>
            <input
              type="text"
              list="flow-available-functions"
              className="flow-func-input"
              placeholder="Search or enter function... e.g. hmm"
              value={functionQuery}
              onChange={(e) => {
                setFunctionQuery(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTrace(functionQuery, maxDepth);
                }
              }}
            />
            <datalist id="flow-available-functions">
              {availableFunctions.map((fn) => (
                <option key={fn.id} value={fn.name}>
                  {fn.file_path}:{fn.start_line}
                </option>
              ))}
            </datalist>
          </div>

          {/* Depth Selector (Strictly 1–3) */}
          <div className="flow-depth-control">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Depth:</span>
            <div className="flow-depth-pills">
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`flow-depth-pill ${maxDepth === d ? 'active' : ''}`}
                  onClick={() => {
                    setMaxDepth(d);
                    if (flowData) {
                      handleTrace(functionQuery, d);
                    }
                  }}
                  title={`Trace up to ${d} call level${d > 1 ? 's' : ''}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ fontSize: '12px', padding: '6px 14px' }}
            onClick={() => handleTrace(functionQuery, maxDepth)}
            disabled={loading || !functionQuery.trim()}
          >
            {loading ? 'Tracing...' : '▷ Trace Flow'}
          </button>
        </div>

        {error && (
          <div className="flow-error-badge" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Main Flow Stage and Sidebar */}
      <div className="flow-main-area">
        {/* Left/Center Visual Canvas & Docked Source */}
        <div className="flow-canvas-wrapper">
          <CodeFlow
            flow={flowData}
            selectedNodeId={selectedNode?.id}
            onNodeClick={(node) => setSelectedNode(node)}
          />

          {/* Bottom Docked Source Code Preview */}
          <div className="flow-bottom-dock">
            <div className="source-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--accent-primary)', fontSize: '12px' }}>&lt;&gt;</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '12px' }}>
                  SOURCE VIEWER
                </span>
                {selectedNode && (
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    {selectedNode.file_path} &bull; Lines {selectedNode.start_line}–{selectedNode.end_line}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                Monaco Editor &bull; Exact Line Highlighting
              </span>
            </div>

            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <CodeViewer
                filePath={selectedNode?.file_path || ''}
                code={currentSource.code}
                language={currentSource.language}
                startLine={selectedNode?.start_line}
                endLine={selectedNode?.end_line}
                nodeType={selectedNode?.type || 'function'}
                nodeName={selectedNode?.name || ''}
                loading={sourceLoading}
                error={sourceError}
              />
            </div>
          </div>
        </div>

        {/* Right Human-First Inspector */}
        <aside className="flow-sidebar-inspector">
          <div className="flow-inspector-header">
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600 }}>
              Function Inspector
            </span>
            {selectedNode && (
              <span className="badge" style={{ fontSize: '10px' }}>
                {selectedNode.id === flowData?.nodes[0]?.id ? 'Root Function' : 'Called Step'}
              </span>
            )}
          </div>

          {selectedNode ? (
            <>
              <h3 className="flow-inspector-name">
                {selectedNode.name}()
              </h3>
              <div className="flow-inspector-loc">
                {selectedNode.file_path} &bull; lines {selectedNode.start_line}–{selectedNode.end_line}
              </div>

              <div className="flow-inspector-card">
                <div className="flow-inspector-card-title">Context</div>
                <p className="flow-inspector-card-desc">
                  {selectedNode.id === flowData?.nodes[0]?.id
                    ? 'This is the root entry point of this traced call flow.'
                    : `Discovered in static call path from ${flowData?.root_function}().`}
                </p>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => {
                    // Re-trigger source highlighting / focus
                    setSelectedNode({ ...selectedNode });
                  }}
                >
                  View Source in Editor &darr;
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '11px' }}
                  onClick={() => setAiNotice(true)}
                  title="Explain this function with Ask AI"
                >
                  &#10024; Explain with AI
                </button>

                {aiNotice && (
                  <div className="flow-ai-notice" role="status">
                    <span>Ask AI integration handoff will be connected in the next milestone.</span>
                    <button
                      type="button"
                      className="flow-ai-notice-close"
                      onClick={() => setAiNotice(false)}
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flow-inspector-empty">
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center' }}>
                Click any step in the flow diagram to inspect its source code and location.
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

