import React, { useState, useEffect } from 'react';

/**
 * Walkthrough Component - Visual Walkthrough v1
 * Deterministic, user-controlled interactive educational animation player.
 * Strictly supports the 5 approved visual types:
 * 1. document_to_chunks
 * 2. text_to_vector
 * 3. query_to_results
 * 4. request_flow
 * 5. data_to_prediction
 */
export default function Walkthrough({ concept }) {
  const [currentStep, setCurrentStep] = useState(1);

  // Reset step whenever selected concept changes
  useEffect(() => {
    setCurrentStep(1);
  }, [concept?.id]);

  if (!concept) {
    return (
      <div className="walkthrough-stage-empty">
        <p>Select a concept above to view its visual walkthrough.</p>
      </div>
    );
  }

  const steps = concept.steps || [];
  const totalSteps = steps.length || 4;
  const activeStepData = steps[currentStep - 1] || steps[0] || {};
  const conceptType = concept.type || 'request_flow';

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
  };

  const handleReplay = () => {
    setCurrentStep(1);
  };

  return (
    <div className="walkthrough-player-card">
      {/* Concept Header & Type Badge */}
      <div className="walkthrough-player-header">
        <div>
          <span className="walkthrough-type-badge">{conceptType.replace(/_/g, ' ')}</span>
          <h2 className="walkthrough-concept-title">{concept.title}</h2>
        </div>
        <div className="walkthrough-step-counter">
          Step <span className="step-num-highlight">{currentStep}</span> / {totalSteps}
        </div>
      </div>

      {/* Visual Animation Stage Area */}
      <div className="walkthrough-stage-viewport">
        <VisualRenderer
          type={conceptType}
          step={currentStep}
          concept={concept}
          activeStepData={activeStepData}
        />
      </div>

      {/* Stepper Controls Bar */}
      <div className="walkthrough-controls-bar">
        <div className="walkthrough-progress-dots">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`progress-dot-btn ${currentStep === idx + 1 ? 'active' : ''} ${
                idx + 1 < currentStep ? 'completed' : ''
              }`}
              onClick={() => setCurrentStep(idx + 1)}
              title={`Go to step ${idx + 1}`}
            >
              <span>{idx + 1}</span>
            </button>
          ))}
        </div>

        <div className="walkthrough-btn-group">
          <button
            type="button"
            className="btn btn-secondary walkthrough-ctrl-btn"
            onClick={handleReplay}
            title="Replay from step 1"
          >
            <span>&#8634;</span> Replay
          </button>
          <button
            type="button"
            className="btn btn-secondary walkthrough-ctrl-btn"
            onClick={handlePrev}
            disabled={currentStep === 1}
          >
            &larr; Previous
          </button>
          <button
            type="button"
            className="btn btn-primary walkthrough-ctrl-btn"
            onClick={handleNext}
            disabled={currentStep === totalSteps}
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Human-Friendly Explanation Area */}
      <div className="walkthrough-explanation-panel">
        <div className="explanation-step-tag">What is happening?</div>
        <h3 className="explanation-step-title">{getExplanationForStep().title}</h3>
        <p className="explanation-step-desc">{getExplanationForStep().desc}</p>
      </div>
    </div>
  );

  function getExplanationForStep() {
    if (conceptType === 'document_to_chunks') {
      const hasEmbedding =
        concept?.steps?.[3]?.visual?.next_stage === 'embedding' ||
        concept?.steps?.[3]?.visual?.label?.toLowerCase().includes('embedding');
      if (currentStep === 1) {
        return {
          title: 'Source Document',
          desc: 'The process starts with a larger piece of text.',
        };
      }
      if (currentStep === 2) {
        return {
          title: 'Splitting into Sections',
          desc: 'Text is divided into smaller sections.',
        };
      }
      if (currentStep === 3) {
        return {
          title: 'Separate Chunks',
          desc: 'Each smaller section can now be processed independently.',
        };
      }
      return {
        title: 'Ready for Next Stage',
        desc: hasEmbedding
          ? 'Chunks are prepared for embedding.'
          : 'Chunks are prepared for later processing.',
      };
    }
    return {
      title: activeStepData.title || `Step ${currentStep}`,
      desc: activeStepData.description,
    };
  }
}

/**
 * Renders the deterministic visual diagram for the active step and visual type.
 */
function VisualRenderer({ type, step, concept, activeStepData }) {
  switch (type) {
    case 'document_to_chunks':
      return <DocumentToChunksVisual step={step} concept={concept} />;
    case 'text_to_vector':
      return <TextToVectorVisual step={step} />;
    case 'query_to_results':
      return <QueryToResultsVisual step={step} />;
    case 'data_to_prediction':
      return <DataToPredictionVisual step={step} />;
    case 'request_flow':
    default:
      return <RequestFlowVisual step={step} concept={concept} />;
  }
}

/**
 * Visual Type 1: document_to_chunks (Refined)
 * Shows a single document visually dividing into distinct smaller chunk cards.
 * Distinguishes between actual repository facts and illustrative visualization.
 */
function DocumentToChunksVisual({ step, concept }) {
  const hasEmbedding =
    concept?.steps?.[3]?.visual?.next_stage === 'embedding' ||
    concept?.steps?.[3]?.visual?.label?.toLowerCase().includes('embedding');

  const nextStageLabel = hasEmbedding
    ? 'Ready for embedding'
    : 'Ready for the next processing stage';

  return (
    <div className={`chunking-visual-canvas stage-step-${step}`}>
      {/* Illustrative Notice & State Caption */}
      <div className="chunking-caption-row">
        <span className="illustrative-tag">Illustrative Visualization</span>
        <span className="step-phase-text">
          {step === 1 && 'Single continuous document containing multiple text sections'}
          {step === 2 && 'Dividing document along natural boundaries into smaller sections'}
          {step === 3 && 'Document separated into 3 independent, discrete chunk cards'}
          {step === 4 && `Chunks prepared and ${nextStageLabel.toLowerCase()}`}
        </span>
      </div>

      {/* Main Chunking Flow Canvas */}
      <div className="chunking-animation-stage">
        {/* Document Shell - In Step 1 & 2 it's one contiguous document sheet; in Step 3 & 4 it expands into 3 cards */}
        <div className={`doc-transform-wrapper step-mode-${step}`}>
          {/* Header of the document (visible in steps 1 & 2) */}
          <div className="doc-main-header">
            <div className="doc-title-left">
              <span className="doc-sheet-icon">&#128196;</span>
              <span className="doc-sheet-title">
                {step < 3 ? 'Project Documentation (Full Document)' : 'Document Chunks'}
              </span>
            </div>
            <div className="doc-status-pill">
              {step === 1 && 'Single Piece of Text'}
              {step === 2 && 'Splitting in Progress...'}
              {step >= 3 && '3 Independent Chunks'}
            </div>
          </div>

          {/* The 3 Text Blocks / Sections */}
          <div className="doc-blocks-layout">
            {/* Block 1 */}
            <div className={`doc-chunk-card chunk-card-1 ${step >= 3 ? 'detached' : ''}`}>
              <div className="chunk-card-top">
                <span className="chunk-id-badge">
                  {step < 3 ? 'Section 1' : 'Chunk 1'}
                </span>
                {step === 4 && <span className="ready-indicator">✓ Ready</span>}
              </div>
              <div className="chunk-card-text">
                <p>
                  &ldquo;Project documentation and architectural overview establishing module scopes and execution entry points across the codebase.&rdquo;
                </p>
              </div>
              <div className="chunk-card-footer">
                <span className="footer-dot">&bull;</span>
                <span>{step < 3 ? 'Paragraph 1' : 'Discrete Chunk 1'}</span>
              </div>
            </div>

            {/* Split Boundary Indicator 1 (Animates in at Step 2) */}
            <div className={`split-cut-indicator ${step >= 2 && step < 3 ? 'active' : ''}`}>
              <div className="split-cut-line" />
              <div className="split-cut-badge">
                <span className="scissors-glyph">&#9986;</span>
                <span>Split Boundary</span>
              </div>
              <div className="split-cut-line" />
            </div>

            {/* Block 2 */}
            <div className={`doc-chunk-card chunk-card-2 ${step >= 3 ? 'detached' : ''}`}>
              <div className="chunk-card-top">
                <span className="chunk-id-badge">
                  {step < 3 ? 'Section 2' : 'Chunk 2'}
                </span>
                {step === 4 && <span className="ready-indicator">✓ Ready</span>}
              </div>
              <div className="chunk-card-text">
                <p>
                  &ldquo;Core domain routines, data validation pipelines, and business algorithms handling parameter transformations and internal state.&rdquo;
                </p>
              </div>
              <div className="chunk-card-footer">
                <span className="footer-dot">&bull;</span>
                <span>{step < 3 ? 'Paragraph 2' : 'Discrete Chunk 2'}</span>
              </div>
            </div>

            {/* Split Boundary Indicator 2 (Animates in at Step 2) */}
            <div className={`split-cut-indicator ${step >= 2 && step < 3 ? 'active' : ''}`}>
              <div className="split-cut-line" />
              <div className="split-cut-badge">
                <span className="scissors-glyph">&#9986;</span>
                <span>Split Boundary</span>
              </div>
              <div className="split-cut-line" />
            </div>

            {/* Block 3 */}
            <div className={`doc-chunk-card chunk-card-3 ${step >= 3 ? 'detached' : ''}`}>
              <div className="chunk-card-top">
                <span className="chunk-id-badge">
                  {step < 3 ? 'Section 3' : 'Chunk 3'}
                </span>
                {step === 4 && <span className="ready-indicator">✓ Ready</span>}
              </div>
              <div className="chunk-card-text">
                <p>
                  &ldquo;Helper subroutines, utility functions, and serialization logic constructing formatted response objects for external callers.&rdquo;
                </p>
              </div>
              <div className="chunk-card-footer">
                <span className="footer-dot">&bull;</span>
                <span>{step < 3 ? 'Paragraph 3' : 'Discrete Chunk 3'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4 Downstream Stage Banner */}
        {step === 4 && (
          <div className="chunking-downstream-stage">
            <div className="downstream-flow-arrow">&darr;</div>
            <div className="downstream-card-box">
              <div className="downstream-tag-row">
                <span className="downstream-badge">DOWNSTREAM PIPELINE</span>
              </div>
              <div className="downstream-target-title">{nextStageLabel}</div>
              <div className="downstream-subtext">
                {hasEmbedding
                  ? 'Each smaller section is prepared for vector embedding.'
                  : 'Each smaller section is prepared for later processing.'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Visual Type 2: text_to_vector
 * Text -> Embedding Model -> Vector representation
 */
function TextToVectorVisual({ step }) {
  return (
    <div className="visual-stage-container">
      {/* 1. Input Text Tokens */}
      <div className={`visual-node-box ${step >= 1 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#128203;</span>
          <span>Input Text</span>
        </div>
        <div className="visual-token-list">
          <span className="code-token">&quot;def&quot;</span>
          <span className="code-token">&quot;authenticate&quot;</span>
          <span className="code-token">&quot;(user)&quot;</span>
        </div>
        <div className="visual-node-sub">Normalized Token Stream</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 2 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 2 ? 'Encode' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 2. Embedding Model */}
      <div className={`visual-node-box transform-box ${step >= 2 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#9883;</span>
          <span>Embedding Model</span>
        </div>
        <div className="neural-layer-diagram">
          <div className="neural-nodes-row">
            <span className="neural-node" />
            <span className="neural-node" />
            <span className="neural-node" />
          </div>
          <div className="neural-links">&#8645; Attention Layers &#8645;</div>
          <div className="neural-nodes-row">
            <span className="neural-node" />
            <span className="neural-node" />
            <span className="neural-node" />
          </div>
        </div>
        <div className="visual-node-sub">Dense Context Projection</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 3 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 3 ? 'Vector' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 3. Vector Representation */}
      <div className={`visual-node-box output-box ${step >= 3 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#128392;</span>
          <span>Vector Embedding</span>
        </div>
        <div className="vector-display-box">
          <div className="vector-bracket">[</div>
          <div className="vector-values">
            <span>+0.042,</span>
            <span>-0.198,</span>
            <span>+0.812,</span>
            <span>-0.055,</span>
            <span>+0.421,</span>
            <span>...</span>
          </div>
          <div className="vector-bracket">]</div>
        </div>
        <div className="visual-node-sub">
          {step >= 4 ? '✓ Positioned in semantic space' : '768-dim float coordinates'}
        </div>
      </div>
    </div>
  );
}

/**
 * Visual Type 3: query_to_results
 * User Question -> Search -> Relevant Results
 */
function QueryToResultsVisual({ step }) {
  return (
    <div className="visual-stage-container">
      {/* 1. User Question */}
      <div className={`visual-node-box ${step >= 1 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#128172;</span>
          <span>User Question</span>
        </div>
        <div className="query-bubble">
          &ldquo;How does authentication work?&rdquo;
        </div>
        <div className="visual-node-sub">Natural Language Query</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 2 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 2 ? 'Search' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 2. Similarity Search Engine */}
      <div className={`visual-node-box transform-box ${step >= 2 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#128269;</span>
          <span>Search Index</span>
        </div>
        <div className="search-metric-group">
          <div className="search-metric-row">
            <span>Cosine Dot Product:</span>
            <span style={{ color: '#86efac' }}>0.942</span>
          </div>
          <div className="search-metric-row">
            <span>Indexed Candidates:</span>
            <span>34 chunks</span>
          </div>
        </div>
        <div className="visual-node-sub">Ranking Source Passages</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 3 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 3 ? 'Ranked' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 3. Relevant Results */}
      <div className={`visual-node-box output-box ${step >= 3 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#10003;</span>
          <span>Relevant Results</span>
        </div>
        <div className="results-list-cards">
          <div className={`result-hit-card ${step >= 3 ? 'show' : ''}`}>
            <span className="result-hit-name">sample/core.py</span>
            <span className="result-score-badge">98.4% Match</span>
          </div>
          <div className={`result-hit-card ${step >= 3 ? 'show' : ''}`}>
            <span className="result-hit-name">sample/helpers.py</span>
            <span className="result-score-badge">89.1% Match</span>
          </div>
        </div>
        <div className="visual-node-sub">
          {step >= 4 ? '✓ Exact line citations verified' : 'Top matching source snippets'}
        </div>
      </div>
    </div>
  );
}

/**
 * Visual Type 4: request_flow
 * Request -> API -> Service -> Response
 */
function RequestFlowVisual({ step, concept }) {
  const symbol = concept?.implementation?.symbol || 'main';

  return (
    <div className="visual-stage-container">
      {/* 1. Inbound Request */}
      <div className={`visual-node-box ${step >= 1 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#128229;</span>
          <span>Incoming Call</span>
        </div>
        <div className="request-packet">
          <div className="packet-header">CALLER INVOCATION</div>
          <div className="packet-body">Target: {symbol}()</div>
        </div>
        <div className="visual-node-sub">HTTP Client / CLI Runner</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 2 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 2 ? 'Dispatch' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 2. API / Entry Point */}
      <div className={`visual-node-box transform-box ${step >= 2 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#128187;</span>
          <span>Entry Handler</span>
        </div>
        <div className="api-route-block">
          <span className="route-tag">ENTRY</span>
          <span className="route-name">{symbol}()</span>
        </div>
        <div className="visual-node-sub">Parameter Validation &amp; Scope</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 3 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 3 ? 'Execute' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 3. Core Service / Helpers */}
      <div className={`visual-node-box transform-box ${step >= 3 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#9881;</span>
          <span>Service &amp; Helpers</span>
        </div>
        <div className="service-subroutine-list">
          <div className="subroutine-pill">Domain Execution</div>
          <div className="subroutine-pill">Subroutines &amp; Helpers</div>
        </div>
        <div className="visual-node-sub">Core Algorithm &amp; Computation</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 4 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 4 ? 'Return' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 4. Response Output */}
      <div className={`visual-node-box output-box ${step >= 4 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#128228;</span>
          <span>Response</span>
        </div>
        <div className="response-output-box">
          <span className="response-status">200 OK</span>
          <span className="response-data">Result Data Dispatched</span>
        </div>
        <div className="visual-node-sub">Completed Execution</div>
      </div>
    </div>
  );
}

/**
 * Visual Type 5: data_to_prediction
 * Data -> Preprocessing -> Model -> Prediction
 */
function DataToPredictionVisual({ step }) {
  return (
    <div className="visual-stage-container">
      {/* 1. Raw Data */}
      <div className={`visual-node-box ${step >= 1 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#128202;</span>
          <span>Raw Input Data</span>
        </div>
        <div className="raw-data-table">
          <div className="data-row"><span>Feature X1:</span> 12.8</div>
          <div className="data-row"><span>Feature X2:</span> 0.94</div>
          <div className="data-row"><span>Feature X3:</span> 41.2</div>
        </div>
        <div className="visual-node-sub">Input Feature Vector</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 2 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 2 ? 'Scale' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 2. Preprocessing */}
      <div className={`visual-node-box transform-box ${step >= 2 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#9881;</span>
          <span>Preprocessing</span>
        </div>
        <div className="preprocess-metrics">
          <div>Normalization: StandardScalar</div>
          <div>Tensor formatting: Float32</div>
        </div>
        <div className="visual-node-sub">Tensor Transformation</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 3 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 3 ? 'Infer' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 3. Trained Model */}
      <div className={`visual-node-box transform-box ${step >= 3 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#9883;</span>
          <span>Model Inference</span>
        </div>
        <div className="model-forward-pass">
          <div className="forward-indicator">Forward Pass Computing...</div>
        </div>
        <div className="visual-node-sub">Forward Weights Activation</div>
      </div>

      {/* Flow arrow */}
      <div className={`visual-flow-arrow ${step >= 4 ? 'active pulse' : ''}`}>
        <span className="arrow-label">{step >= 4 ? 'Predict' : '→'}</span>
        <span className="arrow-symbol">&rarr;</span>
      </div>

      {/* 4. Prediction */}
      <div className={`visual-node-box output-box ${step >= 4 ? 'active' : 'dimmed'}`}>
        <div className="visual-node-header">
          <span className="visual-node-icon">&#127919;</span>
          <span>Prediction</span>
        </div>
        <div className="prediction-badge-box">
          <span className="prediction-label">Target Class A</span>
          <span className="prediction-prob">Confidence: 97.4%</span>
        </div>
        <div className="visual-node-sub">Output Confidence</div>
      </div>
    </div>
  );
}
