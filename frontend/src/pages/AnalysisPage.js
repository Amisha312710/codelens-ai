import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import { mockRepository, mockAnalysis } from '../data/mockData.js';
import '../styles/analysis.css';

/**
 * Analysis Page - Placeholder Shell
 * Visual Source: Stitch Design Screen 2
 */
export default function AnalysisPage() {
  return (
    <div className="app-container">
      <Navbar />

      <main className="analysis-page">
        <div className="analysis-content">
          {/* Active Repository Pill */}
          <div className="analysis-repo-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>{mockRepository.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
            <span style={{ color: '#a5b4fc' }}>{mockAnalysis.status}</span>
          </div>

          {/* Heading */}
          <h1 className="analysis-heading">Understanding your codebase</h1>
          <p className="analysis-subtext">
            CodeLens is mapping the structure and relationships inside this repository.
          </p>

          {/* Progress Bar Container */}
          <div className="analysis-progress-wrapper">
            <div className="analysis-progress-bar">
              <div 
                className="analysis-progress-fill" 
                style={{ width: `${mockAnalysis.progress}%` }} 
              />
            </div>
            <div className="analysis-progress-meta">
              <span>{mockAnalysis.currentTask}</span>
              <span>{mockAnalysis.progress}%</span>
            </div>
          </div>

          {/* Analysis Steps Checklist */}
          <div className="analysis-steps">
            {mockAnalysis.steps.map((step) => (
              <div 
                key={step.id} 
                className={`analysis-step-item ${step.status}`}
              >
                {step.status === 'completed' && <span style={{ color: 'var(--accent-green)' }}>&#10003;</span>}
                {step.status === 'active' && <span className="badge-dot" />}
                {step.status === 'pending' && <span style={{ color: 'var(--text-dim)' }}>&#9675;</span>}
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          {/* Architecture Mapping Stage Preview */}
          <div className="analysis-graph-preview">
            <div className="graph-node-sample" style={{ top: '24px', left: '50%', transform: 'translateX(-50%)' }}>
              &bull; API Router
            </div>
            <div className="graph-node-sample" style={{ top: '100px', left: '16%' }}>
              OAuth2 Auth
            </div>
            <div className="graph-node-sample highlight" style={{ top: '110px', left: '38%' }}>
              &bull; Core Services
            </div>
            <div className="graph-node-sample" style={{ top: '110px', right: '18%' }}>
              Dependency Injection
            </div>
            <div className="graph-node-sample" style={{ bottom: '40px', left: '26%' }}>
              Pydantic Models
            </div>
            <div className="graph-node-sample" style={{ bottom: '30px', right: '30%' }}>
              &bull; Database Engine
            </div>
          </div>

          {/* Navigation link to Dashboard */}
          <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
            <Link to="/dashboard" className="btn btn-primary">
              View Dashboard &rarr;
            </Link>
            <Link to="/" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
