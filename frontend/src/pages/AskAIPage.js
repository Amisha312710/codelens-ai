import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import { mockAISuggestions, mockRepository } from '../data/mockData.js';
import '../styles/ai.css';

/**
 * Ask AI Page - Placeholder Shell
 * Visual Source: Stitch Design Screen 4
 */
export default function AskAIPage() {
  return (
    <div className="app-container">
      <Navbar />

      <main className="ai-page">
        <div className="ai-container">
          {/* Header */}
          <div className="ai-header-group">
            <div className="ai-tagline-row">
              <span className="badge badge-ai">&bull; Codebase Q&amp;A</span>
              <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
              <span style={{ color: 'var(--accent-cyan)' }}>FastAPI Engine</span>
            </div>

            <h1 className="ai-title">What do you want to understand?</h1>
            <p className="ai-description">
              Ask architectural questions across this repository. CodeLens analyzes AST definitions, control flow graph paths, and static source references to generate verifiable proofs.
            </p>
          </div>

          {/* Suggested Prompts */}
          <div className="ai-suggestions-grid">
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>
              Suggested:
            </span>
            {mockAISuggestions.map((prompt, index) => (
              <button key={index} type="button" className="ai-suggestion-chip">
                <span style={{ color: 'var(--accent-primary)', marginRight: '4px' }}>#</span>
                {prompt}
              </button>
            ))}
          </div>

          {/* Investigated Query Card */}
          <div className="ai-query-card">
            <div className="ai-query-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--accent-primary)' }}>&bull;</span>
                <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Investigated Query</span>
              </div>
              <div>Analyzed {mockRepository.name} (main)</div>
            </div>
            <div className="ai-query-text">
              &ldquo;How does authentication work when a user logs in?&rdquo;
            </div>
          </div>

          {/* AI Response Card */}
          <div className="ai-response-card">
            <div className="ai-response-header">
              <div className="ai-brand-badge">
                <span style={{ color: 'var(--accent-primary)' }}>&#10022;</span>
                <span>CODELENS</span>
              </div>
              <div className="ai-grounded-badge">
                <span>&#10003;</span>
                <span>Grounded in repository source</span>
              </div>
            </div>

            <h2 className="ai-section-title">Authentication Flow</h2>
            <p className="ai-section-text">
              The login request enters through the authentication route, where submitted credentials are validated against the stored password hash before an asymmetric JWT access token is generated. Execution leverages FastAPI&apos;s dependency injection to parse headers prior to user identity serialization.
            </p>

            {/* Sequence Map */}
            <div className="ai-sequence-container">
              <div className="ai-sequence-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>&#8644;</span>
                  <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Execution Sequence Map</span>
                </div>
                <div>5 sequential steps identified</div>
              </div>

              <div className="ai-sequence-steps">
                <div className="sequence-step-box">
                  <div className="sequence-step-num">01</div>
                  <div className="sequence-step-title">Login Route</div>
                </div>
                <span style={{ color: 'var(--accent-cyan)' }}>&rarr;</span>

                <div className="sequence-step-box">
                  <div className="sequence-step-num">02</div>
                  <div className="sequence-step-title">Authenticate User</div>
                </div>
                <span style={{ color: 'var(--accent-cyan)' }}>&rarr;</span>

                <div className="sequence-step-box highlight">
                  <div className="sequence-step-num">03 &bull; AUDIT</div>
                  <div className="sequence-step-title">Verify Password</div>
                </div>
                <span style={{ color: 'var(--accent-cyan)' }}>&rarr;</span>

                <div className="sequence-step-box">
                  <div className="sequence-step-num">04</div>
                  <div className="sequence-step-title">Create Access Token</div>
                </div>
                <span style={{ color: 'var(--accent-cyan)' }}>&rarr;</span>

                <div className="sequence-step-box">
                  <div className="sequence-step-num">05</div>
                  <div className="sequence-step-title">Return Token</div>
                </div>
              </div>
            </div>

            {/* Citations / Proofs */}
            <div style={{ marginBottom: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              SOURCE GROUNDING PROOFS &bull; Click citation to inspect source
            </div>
            <div className="ai-proofs-row">
              <div className="proof-badge" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', borderColor: 'var(--accent-primary)' }}>
                <span>&bull; oauth2.py &bull; L42&ndash;67</span>
                <span>&rarr;</span>
              </div>
              <div className="proof-badge">
                <span>&bull; routing.py &bull; L104&ndash;120</span>
              </div>
              <div className="proof-badge">
                <span>&bull; dependencies.py &bull; L18&ndash;31</span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ fontSize: '12px' }}>
                  Show evidence
                </button>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '12px' }}>
                  Copy summary
                </button>
              </div>
              <Link to="/flow" className="btn btn-primary" style={{ fontSize: '12px' }}>
                View this flow in Architecture &rarr;
              </Link>
            </div>
          </div>
        </div>

        {/* Follow-up Question Dock */}
        <div className="ai-dock-wrapper">
          <div className="ai-dock-input-bar">
            <input 
              type="text" 
              className="ai-dock-field" 
              placeholder="Ask a follow-up... e.g. Where is the password actually verified?" 
              readOnly 
            />
            <button type="button" className="btn btn-primary" style={{ fontSize: '12px', padding: '6px 14px' }}>
              Ask &rarr;
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
