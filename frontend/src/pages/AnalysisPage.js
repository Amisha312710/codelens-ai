import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.js';
import { getArchitectureGraph } from '../services/api.js';
import '../styles/analysis.css';

/**
 * Analysis Page
 * Displays progress transition while backend analyzes repository and builds architecture graph.
 */
export default function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const repoUrl =
    location.state?.repoUrl || 'https://github.com/kennethreitz/samplemod';
  const repoName = repoUrl
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/$/, '');

  const [progress, setProgress] = useState(15);
  const [currentTask, setCurrentTask] = useState('Acquiring repository...');
  const [error, setError] = useState(null);
  const [steps, setSteps] = useState([
    { id: 1, label: 'Clone repository securely', status: 'active' },
    { id: 2, label: 'Analyze Python AST & symbols', status: 'pending' },
    { id: 3, label: 'Resolve internal module dependencies', status: 'pending' },
    { id: 4, label: 'Construct architecture graph', status: 'pending' },
  ]);

  const hasTriggered = useRef(false);

  const startAnalysis = async () => {
    setError(null);
    setProgress(15);
    setCurrentTask('Acquiring repository...');
    setSteps([
      { id: 1, label: 'Clone repository securely', status: 'active' },
      { id: 2, label: 'Analyze Python AST & symbols', status: 'pending' },
      { id: 3, label: 'Resolve internal module dependencies', status: 'pending' },
      { id: 4, label: 'Construct architecture graph', status: 'pending' },
    ]);

    const timer1 = setTimeout(() => {
      setProgress(40);
      setCurrentTask('Parsing Python AST and syntactic calls...');
      setSteps((prev) => [
        { ...prev[0], status: 'completed' },
        { ...prev[1], status: 'active' },
        prev[2],
        prev[3],
      ]);
    }, 800);

    const timer2 = setTimeout(() => {
      setProgress(75);
      setCurrentTask('Resolving cross-file imports and containment...');
      setSteps((prev) => [
        { ...prev[0], status: 'completed' },
        { ...prev[1], status: 'completed' },
        { ...prev[2], status: 'active' },
        prev[3],
      ]);
    }, 1800);

    try {
      const data = await getArchitectureGraph(repoUrl);
      clearTimeout(timer1);
      clearTimeout(timer2);

      setProgress(100);
      setCurrentTask('Architecture graph ready!');
      setSteps([
        { id: 1, label: 'Clone repository securely', status: 'completed' },
        { id: 2, label: 'Analyze Python AST & symbols', status: 'completed' },
        { id: 3, label: 'Resolve internal module dependencies', status: 'completed' },
        { id: 4, label: 'Construct architecture graph', status: 'completed' },
      ]);

      // Brief transition pause so user perceives completion
      setTimeout(() => {
        navigate('/dashboard', { state: { graphData: data, repoUrl } });
      }, 400);
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setError(err.message || 'Analysis failed. Please check repository URL.');
      setCurrentTask('Analysis encountered an error');
    }
  };

  useEffect(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true;
      startAnalysis();
    }
  }, [repoUrl]);

  return (
    <div className="app-container">
      <Navbar />

      <main className="analysis-page">
        <div className="analysis-content">
          {/* Active Repository Pill */}
          <div className="analysis-repo-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>{repoName}</span>
            <span style={{ color: 'var(--text-muted)' }}>&bull;</span>
            <span style={{ color: error ? 'var(--accent-red)' : '#a5b4fc' }}>
              {error ? 'failed' : 'analyzing'}
            </span>
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
                style={{
                  width: `${progress}%`,
                  backgroundColor: error ? 'var(--accent-red)' : 'var(--accent-primary)',
                }}
              />
            </div>
            <div className="analysis-progress-meta">
              <span>{currentTask}</span>
              <span>{progress}%</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#fca5a5',
                fontSize: '13px',
              }}
            >
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Analysis Steps Checklist */}
          <div className="analysis-steps">
            {steps.map((step) => (
              <div key={step.id} className={`analysis-step-item ${step.status}`}>
                {step.status === 'completed' && (
                  <span style={{ color: 'var(--accent-green)' }}>&#10003;</span>
                )}
                {step.status === 'active' && <span className="badge-dot" />}
                {step.status === 'pending' && (
                  <span style={{ color: 'var(--text-dim)' }}>&#9675;</span>
                )}
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          {/* Stage Preview */}
          <div className="analysis-graph-preview">
            <div
              className="graph-node-sample"
              style={{ top: '24px', left: '50%', transform: 'translateX(-50%)' }}
            >
              &bull; File Nodes
            </div>
            <div className="graph-node-sample" style={{ top: '100px', left: '16%' }}>
              Class Definitions
            </div>
            <div
              className="graph-node-sample highlight"
              style={{ top: '110px', left: '38%' }}
            >
              &bull; Functions &amp; Methods
            </div>
            <div className="graph-node-sample" style={{ top: '110px', right: '18%' }}>
              Internal Imports
            </div>
            <div className="graph-node-sample" style={{ bottom: '40px', left: '26%' }}>
              Containment Hierarchy
            </div>
            <div className="graph-node-sample" style={{ bottom: '30px', right: '30%' }}>
              &bull; Function Invocations
            </div>
          </div>

          {/* Navigation action buttons */}
          <div style={{ marginTop: '32px', display: 'flex', gap: '12px' }}>
            {error ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={startAnalysis}
              >
                Retry Analysis
              </button>
            ) : (
              <Link to="/dashboard" className="btn btn-primary">
                View Dashboard &rarr;
              </Link>
            )}
            <Link to="/" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

