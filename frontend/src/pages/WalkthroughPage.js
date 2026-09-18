import React, { useState } from 'react';
import Navbar from '../components/Navbar.js';
import { mockWalkthroughScenes } from '../data/mockData.js';
import '../styles/walkthrough.css';

/**
 * Developer Walkthrough Page - Placeholder Shell
 * Visual Direction: Dark, Minimal, Technical, Spacious
 */
export default function WalkthroughPage() {
  const [selectedScene, setSelectedScene] = useState(mockWalkthroughScenes[0]?.id || 1);

  return (
    <div className="app-container">
      <Navbar />

      <main className="walkthrough-page">
        <div className="walkthrough-container">
          {/* Header */}
          <div className="walkthrough-header-area">
            <div className="walkthrough-title-block">
              <div className="walkthrough-badge">
                <span className="badge-dot" />
                DEVELOPER WALKTHROUGH
              </div>
              <h1 className="walkthrough-heading">Interactive Codebase Walkthrough</h1>
              <p className="walkthrough-subheading">
                Step-by-step architectural tours with grounded code highlights and diagrammatic flow progression.
              </p>
            </div>

            <button type="button" className="btn btn-primary">
              Generate Walkthrough &rarr;
            </button>
          </div>

          {/* Scene Selector Strip */}
          <section className="scene-strip-section">
            <div className="scene-strip-title">Codebase Story Scenes</div>
            <div className="scene-strip-cards">
              {mockWalkthroughScenes.map((scene) => (
                <div
                  key={scene.id}
                  className={`scene-card ${selectedScene === scene.id ? 'selected' : ''}`}
                  onClick={() => setSelectedScene(scene.id)}
                >
                  <div className="scene-num">Scene 0{scene.id}</div>
                  <div className="scene-name">{scene.name}</div>
                  <div className="scene-desc">{scene.description}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Main Stage Preview */}
          <section className="walkthrough-stage-card">
            <div className="stage-placeholder-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
            <h2 className="stage-title">Walkthrough Stage Ready</h2>
            <p className="stage-subtitle">
              Scene 0{selectedScene}: {mockWalkthroughScenes.find(s => s.id === selectedScene)?.name}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn btn-primary" style={{ fontSize: '13px' }}>
                Play Walkthrough
              </button>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '13px' }}>
                Configure Scenes
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
