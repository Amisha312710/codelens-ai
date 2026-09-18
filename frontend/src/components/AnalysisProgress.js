import React from 'react';

/**
 * AnalysisProgress Component
 * Progress bar and step status checklist component.
 * Scheduled for full interactive implementation in Milestone 2.
 */
export default function AnalysisProgress({ progress = 0, currentTask = '', steps = [] }) {
  return (
    <div className="analysis-progress-wrapper">
      <div className="analysis-progress-bar">
        <div className="analysis-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="analysis-progress-meta">
        <span>{currentTask}</span>
        <span>{progress}%</span>
      </div>
    </div>
  );
}
