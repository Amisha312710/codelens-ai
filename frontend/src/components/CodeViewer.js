import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';

/**
 * Maps extension / detected language to Monaco editor language identifier
 */
function getMonacoLanguage(filePath = '', detectedLang = '') {
  if (detectedLang) {
    const l = detectedLang.toLowerCase();
    if (l.includes('python')) return 'python';
    if (l.includes('javascript')) return 'javascript';
    if (l.includes('typescript')) return 'typescript';
    if (l.includes('html')) return 'html';
    if (l.includes('css')) return 'css';
    if (l.includes('json')) return 'json';
    if (l.includes('yaml')) return 'yaml';
    if (l.includes('markdown')) return 'markdown';
    if (l.includes('shell')) return 'shell';
    if (l.includes('sql')) return 'sql';
  }
  if (filePath.endsWith('.py')) return 'python';
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return 'javascript';
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return 'typescript';
  if (filePath.endsWith('.json')) return 'json';
  if (filePath.endsWith('.md')) return 'markdown';
  if (filePath.endsWith('.yml') || filePath.endsWith('.yaml')) return 'yaml';
  return 'python';
}

/**
 * CodeViewer Component
 * Syntax-highlighted docked source code display using Monaco Editor.
 * Displays repository file source and highlights selected class/function line ranges.
 */
export default function CodeViewer({
  filePath = '',
  code = '',
  language = 'python',
  startLine = null,
  endLine = null,
  nodeType = 'file',
  nodeName = '',
  loading = false,
  error = null,
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);

  const monacoLang = getMonacoLanguage(filePath, language);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // For FILE node: clear decorations and reveal top of file
    if (nodeType === 'file' || !startLine) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      editor.revealLine(1);
      return;
    }

    // For CLASS / FUNCTION node: reveal line and apply decoration highlight
    const start = Math.max(1, startLine);
    const end = Math.max(start, endLine || start);

    editor.revealLineInCenter(start);

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(start, 1, end, 1),
        options: {
          isWholeLine: true,
          className: 'monaco-line-highlight',
          linesDecorationsClassName: 'monaco-line-gutter-marker',
        },
      },
    ]);
  }, [code, startLine, endLine, nodeType, filePath]);

  return (
    <div className="dashboard-source-dock">
      <div className="source-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="badge"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              fontSize: '10px',
            }}
          >
            SOURCE
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {filePath || 'No file selected'}
          </span>
          {nodeName && nodeType !== 'file' && (
            <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
              &bull; <span style={{ color: '#a5b4fc' }}>{nodeName}</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {startLine && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--accent-primary)',
                background: 'rgba(99, 102, 241, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: '1px solid rgba(99, 102, 241, 0.25)',
              }}
            >
              Lines {startLine}
              {endLine && endLine !== startLine ? `-${endLine}` : ''}
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#07090e',
        }}
      >
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: 'rgba(7, 9, 14, 0.85)',
              zIndex: 5,
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <span
              className="badge-dot"
              style={{ animation: 'pulse 1.2s infinite' }}
            />
            <span>Loading source from repository...</span>
          </div>
        )}

        {error && !loading && (
          <div
            style={{
              padding: '16px',
              color: 'var(--accent-red)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>&bull;</span>
            <span>{error}</span>
          </div>
        )}

        {!error && (
          <Editor
            height="100%"
            language={monacoLang}
            theme="vs-dark"
            value={code || '// Select a node in the architecture graph to view source code.'}
            onMount={handleEditorDidMount}
            options={{
              readOnly: true,
              domReadOnly: true,
              lineNumbers: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 12,
              fontFamily: 'var(--font-mono), Consolas, "Courier New", monospace',
              automaticLayout: true,
              renderLineHighlight: 'none',
              contextmenu: false,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        )}
      </div>
    </div>
  );
}

