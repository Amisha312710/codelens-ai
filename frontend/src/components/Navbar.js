import React, { useState, useEffect } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';

/**
 * Reusable Navbar Component
 * Matches the Stitch dark premium developer-tool aesthetic.
 * Contains: CodeLens AI brand, navigation links (Overview, Ask AI, Code Flow, Walkthrough),
 * theme toggle (Light / Dark mode), and actions (GitHub, Sign In, Get Started).
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

  // Theme state synced with document.documentElement.dataset.theme
  const [theme, setTheme] = useState(() => {
    if (typeof document !== 'undefined' && document.documentElement.dataset.theme) {
      return document.documentElement.dataset.theme;
    }
    return 'dark';
  });

  useEffect(() => {
    const syncTheme = () => {
      const active = document.documentElement.dataset.theme || 'dark';
      setTheme(active);
    };

    syncTheme();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'data-theme') {
          syncTheme();
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    try {
      localStorage.setItem('codelens_theme', nextTheme);
    } catch (e) {
      // Ignore storage errors
    }
    setTheme(nextTheme);
    window.dispatchEvent(new CustomEvent('codelens-theme-toggle', { detail: { theme: nextTheme } }));
  };

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
              to="/explore" 
              state={repoState}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Explore
            </NavLink>
            <NavLink 
              to="/ask" 
              state={repoState}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              Ask AI
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
          {/* Theme Toggle Button */}
          <button
            type="button"
            className="theme-toggle-btn"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="Toggle light and dark mode"
            title={theme === 'dark' ? "Switch to light mode" : "Switch to dark mode"}
            onClick={handleToggleTheme}
          >
            <span className={`theme-toggle-icon theme-toggle-sun ${theme === 'light' ? 'active' : ''}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            </span>
            <span className={`theme-toggle-icon theme-toggle-moon ${theme === 'dark' ? 'active' : ''}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </span>
            <span className={`theme-toggle-thumb ${theme === 'dark' ? 'dark' : 'light'}`} />
          </button>

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

