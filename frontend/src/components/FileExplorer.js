import React from 'react';

/**
 * FileExplorer Component
 * Repository tree navigation panel.
 * Scheduled for full interactive implementation in Milestone 3.
 */
export default function FileExplorer() {
  return (
    <aside className="dashboard-explorer">
      <div className="explorer-header">
        <span>Explorer</span>
      </div>
      <div className="explorer-tree">
        <div className="explorer-node active">
          <span>oauth2.py</span>
        </div>
      </div>
    </aside>
  );
}
