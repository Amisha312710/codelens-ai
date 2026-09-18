import React from 'react';

/**
 * EvidencePanel Component
 * Slide-over evidence viewer verifying citations with AST references.
 * Scheduled for full interactive implementation in Milestone 4.
 */
export default function EvidencePanel({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="placeholder-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Evidence Panel</h3>
        <button type="button" onClick={onClose} className="btn btn-ghost">&times;</button>
      </div>
      <p>Source grounding evidence details.</p>
    </div>
  );
}
