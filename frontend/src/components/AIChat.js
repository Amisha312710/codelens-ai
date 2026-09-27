import React, { useState, useRef, useEffect } from 'react';
import { askRepository } from '../services/api.js';

/**
 * Deterministically parses citation strings into filePath, startLine, and endLine.
 * Expected format: <file_path>:<start_line>-<end_line> or <file_path>:<start_line>.
 * Only treats the final :number-number or :number segment as the line range.
 * Supports file paths containing slashes, dots, underscores, and hyphens.
 *
 * @param {string} citation - Raw citation string e.g. "sample/core.py:9-12"
 * @returns {{filePath: string, startLine: number, endLine: number, raw: string} | null}
 */
export function parseCitation(citation) {
  if (!citation || typeof citation !== 'string') return null;
  const trimmed = citation.trim().replace(/^[`'"]+|[`'"]+$/g, '');
  const match = trimmed.match(/^(.*):(\d+)(?:-(\d+))?$/);
  if (match) {
    const filePath = match[1].trim();
    const startLine = parseInt(match[2], 10);
    const endLine = match[3] ? parseInt(match[3], 10) : startLine;
    return { filePath, startLine, endLine, raw: trimmed };
  }
  return { filePath: trimmed, startLine: 1, endLine: 1, raw: trimmed };
}

/**
 * Renders answer text preserving paragraphs, line breaks, and inline code backticks.
 */
function renderFormattedAnswer(text) {
  if (!text) return null;
  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs.map((para, pIdx) => {
    const lines = para.split('\n');
    return (
      <p key={pIdx} className="ai-chat-paragraph">
        {lines.map((line, lIdx) => (
          <React.Fragment key={lIdx}>
            {lIdx > 0 && <br />}
            {renderInlineCode(line)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

/**
 * Splits a text line by backticks and wraps code segments into <code> elements.
 */
function renderInlineCode(line) {
  const parts = line.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return (
        <code key={idx} className="ai-chat-inline-code">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

/**
 * Formats retrieval sources into display badge text (e.g. "Semantic + Structural").
 */
function formatSources(sources) {
  if (!sources || sources.length === 0) return 'Semantic';
  return sources
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' + ');
}

/**
 * AIChat Component - Ask AI 2.0
 * Multi-turn conversational codebase Q&A with explanation modes,
 * expandable evidence used, deterministic follow-up suggestions, and New Chat reset.
 *
 * @param {object} props
 * @param {string} props.repoUrl - Currently analyzed repository URL
 * @param {function} props.onCitationClick - Callback (filePath, startLine, endLine) -> void
 * @param {string[]} [props.suggestedQuestions] - Repository-grounded prompt suggestions
 */
export default function AIChat({ repoUrl = '', onCitationClick, suggestedQuestions = [] }) {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState('beginner');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [expandedEvidence, setExpandedEvidence] = useState({});

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const toggleEvidence = (msgId) => {
    setExpandedEvidence((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleNewChat = () => {
    setMessages([]);
    setQuestion('');
    setError(null);
    setValidationError('');
  };

  const submitQuestion = async (queryText) => {
    const trimmedQ = (queryText || question).trim();
    if (!trimmedQ) {
      setValidationError('Please enter a question about this repository.');
      return;
    }
    setValidationError('');
    setError(null);
    setLoading(true);

    const userMsgId = `user-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      role: 'user',
      content: trimmedQ,
      mode: mode,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setQuestion('');

    const boundedHistory = newMessages
      .slice(0, -1)
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    try {
      const data = await askRepository(
        repoUrl,
        trimmedQ,
        5,
        mode,
        boundedHistory
      );

      const assistantMsg = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.answer,
        citations: data.citations || [],
        evidence_used: data.evidence_used || [],
        followups: data.suggested_followups || [],
        mode: data.explanation_mode || mode,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err.message || 'Unable to generate answer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    submitQuestion(question);
  };

  return (
    <div className="ai-chat-container">
      {/* Unified Header with Brand, Mode Selector, and New Chat */}
      <div className="ai-chat-header">
        <div className="ai-chat-brand">
          <span style={{ color: 'var(--accent-primary)' }}>&#10022;</span>
          <span>CODELENS AI</span>
        </div>

        {/* Primary Explanation Mode Selector */}
        <div className="ai-mode-selector" role="group" aria-label="Explanation style">
          <button
            type="button"
            className={`ai-mode-pill ${mode === 'beginner' ? 'active' : ''}`}
            onClick={() => setMode('beginner')}
            title="Everyday language with simple analogies"
          >
            Beginner
          </button>
          <button
            type="button"
            className={`ai-mode-pill ${mode === 'developer' ? 'active' : ''}`}
            onClick={() => setMode('developer')}
            title="Technical precision, data flow, and exact code semantics"
          >
            Developer
          </button>
          <button
            type="button"
            className={`ai-mode-pill ${mode === 'interview' ? 'active' : ''}`}
            onClick={() => setMode('interview')}
            title="Interview structure: problem, components, flow, and trade-offs"
          >
            Interview
          </button>
        </div>

        <button
          type="button"
          className="ai-chat-new-btn"
          onClick={handleNewChat}
          title="Start a new chat conversation"
        >
          + New Chat
        </button>
      </div>

      {/* Conversation Scroll Timeline */}
      <div className="ai-chat-content-scroll" ref={scrollRef}>
        {messages.length === 0 && !loading && (
          <div className="ai-chat-empty-state">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, maxWidth: '520px' }}>
              Ask questions about functions, classes, or architecture in this repository. Answers are strictly grounded in real source evidence.
            </span>

            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '560px', marginTop: '16px' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>
                  Suggested Questions
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="question-chip-btn"
                      onClick={() => submitQuestion(q)}
                      disabled={loading}
                    >
                      <span style={{ color: 'var(--accent-primary)', marginRight: '4px' }}>&#10022;</span>
                      <span>{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`ai-chat-msg ai-chat-msg-${msg.role}`}>
            <div className="ai-chat-msg-header">
              <span className="ai-chat-msg-role">
                {msg.role === 'user' ? 'USER' : 'AI'}
              </span>
              <span className="ai-chat-msg-mode">
                {msg.mode}
              </span>
            </div>

            <div className="ai-chat-msg-content">
              {msg.role === 'user' ? (
                <div className="ai-chat-user-text">{msg.content}</div>
              ) : (
                <div className="ai-chat-answer-body">
                  {renderFormattedAnswer(msg.content)}

                  {/* Expandable Evidence Panel */}
                  {msg.evidence_used && msg.evidence_used.length > 0 && (
                    <div className="ai-evidence-accordion">
                      <button
                        type="button"
                        className="ai-evidence-toggle"
                        onClick={() => toggleEvidence(msg.id)}
                        aria-expanded={Boolean(expandedEvidence[msg.id])}
                      >
                        <span>🔎 Evidence used ({msg.evidence_used.length})</span>
                        <span>{expandedEvidence[msg.id] ? '▴' : '▾'}</span>
                      </button>

                      {expandedEvidence[msg.id] && (
                        <div className="ai-evidence-list">
                          {msg.evidence_used.map((item, evIdx) => (
                            <button
                              key={evIdx}
                              type="button"
                              className="ai-evidence-card"
                              onClick={() => {
                                if (onCitationClick) {
                                  onCitationClick(item.file_path, item.start_line, item.end_line);
                                }
                              }}
                              title={`Jump to ${item.file_path}:${item.start_line}-${item.end_line}`}
                            >
                              <div className="ai-evidence-card-top">
                                <span className="ai-evidence-path">{item.file_path}</span>
                                <span className="ai-evidence-lines">L{item.start_line}–{item.end_line}</span>
                              </div>
                              <div className="ai-evidence-card-bottom">
                                {item.symbol_name && item.symbol_name !== item.file_path && (
                                  <span className="ai-evidence-symbol">{item.symbol_name}</span>
                                )}
                                <span className="ai-evidence-source">{formatSources(item.retrieval_sources)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sources / Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="ai-chat-citations-section">
                      <div className="ai-chat-citations-header">
                        <span className="ai-chat-citations-title">Sources</span>
                        <span className="ai-chat-citations-hint">Click source to jump &amp; highlight</span>
                      </div>
                      <div className="ai-chat-citations-list">
                        {msg.citations.map((rawCitation, index) => {
                          const parsed = parseCitation(rawCitation);
                          if (!parsed) return null;
                          return (
                            <button
                              key={index}
                              type="button"
                              className="ai-chat-citation-btn"
                              onClick={() => {
                                if (onCitationClick) {
                                  onCitationClick(parsed.filePath, parsed.startLine, parsed.endLine);
                                }
                              }}
                              title={`Jump to ${parsed.filePath} lines ${parsed.startLine}-${parsed.endLine}`}
                            >
                              <span className="citation-icon">&bull;</span>
                              <span className="citation-path">{parsed.filePath}</span>
                              <span className="citation-lines">
                                :{parsed.startLine}
                                {parsed.endLine !== parsed.startLine ? `-${parsed.endLine}` : ''}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Follow-up Suggestions */}
                  {msg.followups && msg.followups.length > 0 && (
                    <div className="ai-followups-container">
                      <span className="ai-followups-label">You might also ask:</span>
                      <div className="ai-followups-chips">
                        {msg.followups.map((suggestion, sIdx) => (
                          <button
                            key={sIdx}
                            type="button"
                            className="ai-followup-chip"
                            onClick={() => submitQuestion(suggestion)}
                            disabled={loading}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="ai-chat-loading-indicator">
            <span
              className="badge-dot"
              style={{ width: '8px', height: '8px', animation: 'pulse 1s infinite' }}
            />
            <span>Analyzing repository &amp; generating grounded answer...</span>
          </div>
        )}

        {error && !loading && (
          <div className="ai-chat-error-banner" role="alert">
            <div>{error}</div>
            <button
              type="button"
              className="ai-chat-retry-btn"
              onClick={() => {
                const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                if (lastUser) {
                  submitQuestion(lastUser.content);
                }
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <form className="ai-chat-form" onSubmit={handleSubmit}>
        <div className="ai-chat-input-row">
          <input
            id="ai-chat-question-input"
            type="text"
            className="ai-chat-input"
            placeholder="Ask codebase question... e.g. Why do we need the token?"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (validationError) setValidationError('');
            }}
            disabled={loading}
            aria-label="Ask a question about this repository"
          />
          <button
            type="submit"
            className="ai-chat-submit-btn"
            disabled={loading || !question.trim()}
            aria-label="Submit question"
          >
            {loading ? (
              <span
                className="badge-dot"
                style={{ width: '8px', height: '8px', animation: 'pulse 1s infinite' }}
              />
            ) : (
              <span>Ask &rarr;</span>
            )}
          </button>
        </div>
        {validationError && (
          <div className="ai-chat-validation-error" role="alert">
            {validationError}
          </div>
        )}
      </form>
    </div>
  );
}
