import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import { mockFlow } from '../data/mockData.js';
import '../styles/flow.css';

/**
 * Code Flow Page - Placeholder Shell
 * Visual Source: Stitch Design Screen 5
 */
export default function CodeFlowPage() {
  return (
    <div className="flow-page">
      <Navbar />

      {/* Header bar */}
      <div className="flow-header-bar">
        <div className="flow-title-wrap">
          <div className="flow-tag-row">
            <span className="badge-ai" style={{ padding: '2px 8px', fontSize: '10px' }}>&bull; CODE FLOW</span>
            <span className="badge" style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>Source-derived flow</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Why this path?</span>
          </div>
          <h1 className="flow-main-heading">Trace how the code works.</h1>
          <div className="flow-subheading">Select an endpoint or function to visualize its execution and dependency path through the codebase.</div>
        </div>

        <Link to="/ask" className="btn btn-secondary" style={{ fontSize: '12px', gap: '6px' }}>
          <span>&#10022;</span> Explain this flow with AI &rarr;
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flow-toolbar">
        <div className="flow-controls-left">
          <div className="flow-endpoint-badge">
            <span className="http-method">POST</span>
            <span>/login</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>&#9662;</span>
          </div>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '11px' }}>
            &#9655; Trace Flow
          </button>
          <button type="button" className="btn btn-primary" style={{ fontSize: '11px', padding: '4px 10px' }}>
            Request Flow
          </button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '11px' }}>
            &sum; Function Calls
          </button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: '11px' }}>
            Dependencies
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          <span>+</span>
          <span>&minus;</span>
          <span>[ ]</span>
          <span>100%</span>
        </div>
      </div>

      {/* Main Flow Stage and Sidebar */}
      <div className="flow-main-area">
        <div className="flow-visualizer-canvas">
          <div className="flow-diagram-stage">
            {mockFlow.steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className={`flow-node-card ${step.selected ? 'focused' : ''}`}>
                  <span className="flow-node-badge">{step.badge}</span>
                  <div className="flow-node-name">{step.name}</div>
                  <div className="flow-node-loc">{step.loc}</div>
                </div>
                {index < mockFlow.steps.length - 1 && (
                  <span className="flow-arrow">&rarr;</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Bottom Docked Source */}
          <div className="flow-bottom-dock">
            <div className="source-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-dim)' }}>&lt;&gt;</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>SOURCE PREVIEW</span>
                <span style={{ color: 'var(--text-muted)' }}>auth/service.py &bull; {mockFlow.lineRange}</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '11px' }}>Copy Snippet</button>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '11px' }}>Open in Editor &nearr;</button>
              </div>
            </div>

            <div className="source-code">
              <div><span className="code-line-num">61</span><span className="code-keyword">def</span> <span className="code-fn">authenticate_user</span>(fake_db, username: <span className="code-keyword">str</span>, password: <span className="code-keyword">str</span>):</div>
              <div><span className="code-line-num">62</span>&nbsp;&nbsp;user = get_user(fake_db, username)</div>
              <div><span className="code-line-num">63</span>&nbsp;&nbsp;<span className="code-keyword">if not</span> user:</div>
              <div><span className="code-line-num">64</span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="code-keyword">return False</span></div>
              <div><span className="code-line-num">65</span>&nbsp;&nbsp;<span className="code-keyword">if not</span> verify_password(password, user.hashed_password):</div>
              <div><span className="code-line-num">66</span>&nbsp;&nbsp;&nbsp;&nbsp;<span className="code-keyword">return False</span></div>
              <div><span className="code-line-num">67</span>&nbsp;&nbsp;<span className="code-keyword">return</span> user</div>
            </div>
          </div>
        </div>

        {/* Right Inspector */}
        <aside className="flow-sidebar-inspector">
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Function
          </div>
          <h3 style={{ fontSize: '15px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', marginBottom: '4px' }}>
            authenticate_user()
          </h3>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            auth/service.py Lines 42-58
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Calls</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>&rsaquo; get_user()</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>&rsaquo; verify_password()</div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginBottom: '24px' }}>
            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Called by</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>&rsaquo; login()</div>
          </div>

          <button type="button" className="btn btn-primary" style={{ width: '100%', marginBottom: '8px' }}>
            View Source in Context &rarr;
          </button>
          <Link to="/ask" className="btn btn-secondary" style={{ width: '100%', textDecoration: 'none' }}>
            &#10024; Explain with AI
          </Link>
        </aside>
      </div>
    </div>
  );
}
