import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import { mockRepository, mockArchitectureNodes } from '../data/mockData.js';
import '../styles/dashboard.css';

/**
 * Developer Dashboard - Placeholder Shell
 * Visual Source: Stitch Design Screen 3
 */
export default function Dashboard() {
  return (
    <div className="dashboard-page">
      <Navbar />

      <div className="dashboard-layout">
        {/* Left Column: Explorer */}
        <aside className="dashboard-explorer">
          <div className="explorer-header">
            <span>Explorer</span>
            <span style={{ color: 'var(--text-dim)', fontSize: '10px' }}>&harr;</span>
          </div>

          <div className="explorer-search">
            <input 
              type="text" 
              className="explorer-search-input" 
              placeholder="Search files... ⌘P" 
              readOnly 
            />
          </div>

          <div className="explorer-tree">
            <div className="explorer-node">
              <span>&#9662;</span> <span>fastapi</span>
            </div>
            <div className="explorer-node" style={{ paddingLeft: '20px' }}>
              <span>&#9662;</span> <span>security</span>
            </div>
            <div className="explorer-node active" style={{ paddingLeft: '32px' }}>
              <span style={{ color: 'var(--accent-primary)' }}>&bull;</span>
              <span>oauth2.py</span>
            </div>
            <div className="explorer-node" style={{ paddingLeft: '32px' }}>
              <span>http.py</span>
            </div>
            <div className="explorer-node" style={{ paddingLeft: '20px' }}>
              <span>&#9656;</span> <span>applications.py</span>
            </div>
            <div className="explorer-node" style={{ paddingLeft: '20px' }}>
              <span>&#9656;</span> <span>routing.py</span>
            </div>
            <div className="explorer-node" style={{ paddingLeft: '20px' }}>
              <span>&#9656;</span> <span>dependencies</span>
            </div>
            <div className="explorer-node" style={{ paddingLeft: '20px' }}>
              <span>&#9656;</span> <span>middleware</span>
            </div>
          </div>

          <div className="explorer-footer">
            <span><span className="badge-dot-green" style={{ display: 'inline-block', marginRight: '4px' }} /> Indexed</span>
            <span>{mockRepository.version}</span>
          </div>
        </aside>

        {/* Center Column: Architecture Graph & Docked Source */}
        <main className="dashboard-center">
          <div className="graph-header">
            <div className="graph-title-group">
              <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Architecture Graph
              </span>
              <span className="graph-badge">
                {mockArchitectureNodes.length} nodes &bull; 8 connections
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link to="/flow" className="btn btn-primary" style={{ fontSize: '11px', padding: '5px 12px' }}>
                Trace Flow &rarr;
              </Link>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>&minus;</span>
                <span>+</span>
                <span>Fit</span>
              </div>
            </div>
          </div>

          {/* Graph Interactive Canvas Placeholder */}
          <div className="graph-canvas">
            <div className="graph-canvas-grid" />
            <div className="graph-nodes-container">
              {/* API Node */}
              <div className="graph-card-node" style={{ top: '30px', left: '42%' }}>
                <div className="graph-node-title">API</div>
                <div className="graph-node-path">fastapi/applications</div>
              </div>

              {/* Routing Node */}
              <div className="graph-card-node" style={{ top: '130px', left: '26%' }}>
                <div className="graph-node-title">Routing</div>
                <div className="graph-node-path">fastapi/routing</div>
              </div>

              {/* Security & Auth Node (Selected) */}
              <div className="graph-card-node selected" style={{ top: '120px', left: '56%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span className="badge-dot" />
                  <span style={{ fontSize: '9px', fontWeight: 600, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected Focus</span>
                </div>
                <div className="graph-node-title">Security &amp; Auth</div>
                <div className="graph-node-path">fastapi/security</div>
              </div>

              {/* Dependencies Node */}
              <div className="graph-card-node" style={{ top: '240px', left: '22%' }}>
                <div className="graph-node-title">Dependencies</div>
                <div className="graph-node-path">fastapi/dependencies</div>
              </div>

              {/* Services Node */}
              <div className="graph-card-node" style={{ top: '240px', left: '54%' }}>
                <div className="graph-node-title">Services</div>
                <div className="graph-node-path">fastapi/services</div>
              </div>

              {/* Models & Database */}
              <div className="graph-card-node" style={{ bottom: '40px', left: '34%' }}>
                <div className="graph-node-title">Models</div>
                <div className="graph-node-path">fastapi/models</div>
              </div>

              <div className="graph-card-node" style={{ bottom: '20px', left: '48%' }}>
                <div className="graph-node-title">Database</div>
                <div className="graph-node-path">fastapi/database</div>
              </div>
            </div>
          </div>

          {/* Bottom Source Dock */}
          <div className="dashboard-source-dock">
            <div className="source-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge" style={{ backgroundColor: 'var(--accent-primary)', color: '#ffffff', fontSize: '10px' }}>SOURCE</span>
                <span style={{ color: 'var(--text-secondary)' }}>fastapi / security / oauth2.py</span>
              </div>
              <button type="button" className="btn btn-ghost" style={{ fontSize: '11px', padding: '2px 8px' }}>
                Open in Editor &nearr;
              </button>
            </div>
            <div className="source-code">
              <div><span className="code-line-num">1</span></div>
              <div><span className="code-line-num">2</span><span className="code-keyword">class</span> <span className="code-fn">OAuth2</span>:</div>
              <div><span className="code-line-num">3</span></div>
              <div><span className="code-line-num">4</span>&nbsp;&nbsp;<span className="code-keyword">def</span> <span className="code-fn">__init__</span>(self):</div>
              <div><span className="code-line-num">5</span>&nbsp;&nbsp;&nbsp;&nbsp;self.scheme_name = None</div>
              <div><span className="code-line-num">6</span></div>
              <div><span className="code-line-num">7</span>&nbsp;&nbsp;&nbsp;&nbsp;tokenUrl: str</div>
            </div>
          </div>
        </main>

        {/* Right Column: Inspector */}
        <aside className="dashboard-inspector">
          <div className="inspector-header">
            <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Inspector
            </span>
            <span className="badge" style={{ fontSize: '10px' }}>Focused</span>
          </div>

          <h3 className="inspector-title">Security &amp; Auth</h3>
          <div className="inspector-subtitle">fastapi/security/</div>

          <div className="inspector-stats-row">
            <div className="stat-box">
              <div className="stat-label">Files</div>
              <div className="stat-value">{mockRepository.filesCount}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Functions</div>
              <div className="stat-value">{mockRepository.functionsCount}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Deps</div>
              <div className="stat-value">{mockRepository.dependenciesCount}</div>
            </div>
          </div>

          <div className="inspector-actions">
            <button type="button" className="btn btn-primary" style={{ width: '100%' }}>
              &lt;&gt; View Source
            </button>
            <Link to="/ask" className="btn btn-secondary" style={{ width: '100%', textDecoration: 'none' }}>
              &#10024; Explain with AI
            </Link>
          </div>

          <div className="inspector-connections-section">
            <div className="section-label">Connected To</div>
            <div className="connection-item">
              <span>&bull; Routing</span>
              <span>&rarr;</span>
            </div>
            <div className="connection-item">
              <span>&bull; Dependencies</span>
              <span>&rarr;</span>
            </div>
            <div className="connection-item">
              <span>&bull; Applications</span>
              <span>&rarr;</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
