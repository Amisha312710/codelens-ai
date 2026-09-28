import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

/**
 * Reusable Navbar Component
 * Matches the Stitch dark premium developer-tool aesthetic.
 * Contains: CodeLens AI brand, navigation links (Overview, Ask AI, Code Flow, Walkthrough),
 * and actions (GitHub, Sign In, Get Started).
 */
export default function Navbar() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  // Single source of truth for active repository URL
  const activeRepoUrl = (
    location.state?.repoUrl ||
    new URLSearchParams(location.search).get('repo') ||
    ''
  ).trim();

  const repoState = activeRepoUrl ? { repoUrl: activeRepoUrl } : undefined;

  let displayRepoName = '';
  if (activeRepoUrl) {
    displayRepoName = activeRepoUrl
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/, '')
      .replace(/\/$/, '');
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left: Brand Logo & Repo Indicator */}
        <div className="navbar-left">
          <Link to="/" className="navbar-brand">
            <span className="navbar-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </span>
            <span className="navbar-brand-name">CodeLens <span className="navbar-brand-badge">AI</span></span>
          </Link>

          {!isLanding && displayRepoName && (
            <div className="navbar-repo-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span className="repo-name">{displayRepoName}</span>
              <span className="repo-branch">main</span>
            </div>
          )}
        </div>

        {/* Center: Main Navigation Links */}
        <div className="navbar-center">
          <div className="nav-segmented-control">
            <NavLink 
              to="/dashboard" 
              state={repoState}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Overview
            </NavLink>
            <NavLink 
              to="/ask" 
              state={repoState}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Ask AI
            </NavLink>
            <NavLink 
              to="/flow" 
              state={repoState}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Code Flow
            </NavLink>
            <NavLink 
              to="/walkthrough" 
              state={repoState}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Walkthrough
            </NavLink>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="navbar-right">
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn btn-ghost nav-action-btn"
          >
            GitHub
          </a>
          <button type="button" className="btn btn-ghost nav-action-btn">
            Sign In
          </button>
          <Link to="/" className="btn btn-primary nav-get-started-btn">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
