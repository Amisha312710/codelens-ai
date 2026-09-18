import React from 'react';

/**
 * CodeViewer Component
 * Syntax-highlighted docked source code display.
 * Scheduled for full interactive implementation in Milestone 3.
 */
export default function CodeViewer({ filePath = '', code = '' }) {
  return (
    <div className="dashboard-source-dock">
      <div className="source-header">
        <span>{filePath || 'Source Preview'}</span>
      </div>
      <pre className="source-code">
        <code>{code || '// Code preview'}</code>
      </pre>
    </div>
  );
}
