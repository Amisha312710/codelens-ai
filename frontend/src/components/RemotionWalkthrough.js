import React, { useRef, useState, useMemo } from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Player } from '@remotion/player';

/**
 * Monotonically safe interpolation helper.
 * Prevents Remotion runtime error: "inputRange must be strictly monotonically increasing".
 */
function safeInterpolate(frame, inputRange, outputRange, options = {}) {
  const [a, b] = inputRange;
  const safeB = Math.max(a + 1, b);
  return interpolate(frame, [a, safeB], outputRange, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    ...options,
  });
}

function truncateMiddle(text, maxLength = 36) {
  if (!text || text.length <= maxLength) return text || '';
  const half = Math.floor((maxLength - 3) / 2);
  return `${text.slice(0, half)}...${text.slice(-half)}`;
}

// ---------------------------------------------------------------------------
// 1. Single-Flow Node Primitive (Standard Default Primitive)
// ---------------------------------------------------------------------------
function SingleNodePrimitive({ stage, localFrame, fps }) {
  const inSpring = spring({ frame: Math.max(0, localFrame - 4), fps, config: { damping: 14 } });
  const nodeSpring = spring({ frame: Math.max(0, localFrame - 16), fps, config: { damping: 14 } });
  const outSpring = spring({ frame: Math.max(0, localFrame - 30), fps, config: { damping: 14 } });
  const pulse = Math.sin(localFrame / 6) * 0.15 + 0.85;

  const ev = stage.evidence || {};
  const hasDataIn = Boolean(stage.data_in && (stage.data_in.type || stage.data_in.label));
  const hasDataOut = Boolean(stage.data_out && (stage.data_out.type || stage.data_out.label));

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', width: '100%', height: '100%' }}>
      {/* Inbound Data Card */}
      {hasDataIn && (
        <div
          style={{
            transform: `scale(${inSpring})`,
            opacity: safeInterpolate(localFrame, [0, 15], [0, 1]),
            width: '260px',
            backgroundColor: '#111827',
            border: '1.5px solid #38bdf8',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 4px 16px rgba(56, 189, 248, 0.15)',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
            &#9654; Input Payload
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
            {stage.data_in.type || 'Data Input'}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {stage.data_in.label || 'Input parameters'}
          </div>
        </div>
      )}

      {/* Inbound Arrow */}
      {hasDataIn && (
        <div style={{ color: '#38bdf8', fontSize: '24px', opacity: pulse }}>&rarr;</div>
      )}

      {/* Main Execution / Processing Node */}
      <div
        style={{
          transform: `scale(${nodeSpring})`,
          opacity: safeInterpolate(localFrame, [10, 25], [0, 1]),
          width: '360px',
          backgroundColor: '#0f172a',
          border: '2px solid #6366f1',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 0 28px rgba(99, 102, 241, 0.25)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', marginBottom: '6px' }}>
          &#9881; {stage.role_badge || 'STAGE EXECUTION'}
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace', marginBottom: '6px', wordBreak: 'break-word' }}>
          {ev.symbol ? `${ev.symbol}()` : stage.title}
        </div>
        <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace', marginBottom: '10px' }}>
          {truncateMiddle(ev.file_path, 40)}{ev.start_line ? `: L${ev.start_line}–${ev.end_line}` : ''}
        </div>
        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
          {stage.explanation}
        </div>
      </div>

      {/* Outbound Arrow */}
      {hasDataOut && (
        <div style={{ color: '#34d399', fontSize: '24px', opacity: pulse }}>&rarr;</div>
      )}

      {/* Outbound Data Card */}
      {hasDataOut && (
        <div
          style={{
            transform: `scale(${outSpring})`,
            opacity: safeInterpolate(localFrame, [20, 36], [0, 1]),
            width: '260px',
            backgroundColor: '#111827',
            border: '1.5px solid #34d399',
            borderRadius: '10px',
            padding: '16px',
            boxShadow: '0 4px 16px rgba(52, 211, 153, 0.15)',
          }}
        >
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '6px' }}>
            &#10003; Output Result
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
            {stage.data_out.type || 'Processed Result'}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {stage.data_out.label || 'Output state'}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Request-Response Primitive (Ingress & Egress)
// ---------------------------------------------------------------------------
function RequestResponsePrimitive({ stage, localFrame, fps }) {
  const reqSpring = spring({ frame: Math.max(0, localFrame - 4), fps, config: { damping: 14 } });
  const routerSpring = spring({ frame: Math.max(0, localFrame - 16), fps, config: { damping: 14 } });
  const resSpring = spring({ frame: Math.max(0, localFrame - 30), fps, config: { damping: 14 } });
  const pulse = Math.sin(localFrame / 6) * 0.15 + 0.85;

  const ev = stage.evidence || {};

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', width: '100%', height: '100%' }}>
      {/* Inbound Request Card */}
      <div
        style={{
          transform: `scale(${reqSpring})`,
          opacity: safeInterpolate(localFrame, [0, 15], [0, 1]),
          width: '260px',
          backgroundColor: '#111827',
          border: '1.5px solid #38bdf8',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 4px 16px rgba(56, 189, 248, 0.15)',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
          &#9654; Inbound Payload
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
          {stage.data_in?.type || 'Inbound Request'}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {stage.data_in?.label || 'Client request packet / invocation'}
        </div>
      </div>

      <div style={{ color: '#38bdf8', fontSize: '22px', opacity: pulse }}>&rarr;</div>

      {/* Core Handler / Router Card */}
      <div
        style={{
          transform: `scale(${routerSpring})`,
          opacity: safeInterpolate(localFrame, [12, 26], [0, 1]),
          width: '350px',
          backgroundColor: '#0f172a',
          border: '2px solid #60a5fa',
          borderRadius: '12px',
          padding: '18px',
          boxShadow: '0 0 24px rgba(96, 165, 250, 0.25)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', marginBottom: '6px' }}>
          &#9881; {stage.role_badge || 'ROUTER DISPATCH'}
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace', marginBottom: '6px' }}>
          {ev.symbol ? `${ev.symbol}()` : 'handle_request()'}
        </div>
        <div style={{ fontSize: '11px', color: '#38bdf8', fontFamily: 'monospace', marginBottom: '8px' }}>
          {truncateMiddle(ev.file_path, 38)}{ev.start_line ? `: L${ev.start_line}` : ''}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {stage.explanation}
        </div>
      </div>

      <div style={{ color: '#34d399', fontSize: '22px', opacity: pulse }}>&rarr;</div>

      {/* Outbound Response Card */}
      <div
        style={{
          transform: `scale(${resSpring})`,
          opacity: safeInterpolate(localFrame, [24, 38], [0, 1]),
          width: '260px',
          backgroundColor: '#111827',
          border: '1.5px solid #34d399',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 4px 16px rgba(52, 211, 153, 0.15)',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '6px' }}>
          &#10003; Outbound Response
        </div>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
          {stage.data_out?.type || 'Dispatched Result'}
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {stage.data_out?.label || 'Serialized response payload'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. External Effect Primitive (LLM / Database / External Services)
// ---------------------------------------------------------------------------
function ExternalEffectPrimitive({ stage, localFrame, fps }) {
  const leftSpring = spring({ frame: Math.max(0, localFrame - 4), fps, config: { damping: 14 } });
  const centerSpring = spring({ frame: Math.max(0, localFrame - 16), fps, config: { damping: 14 } });
  const extSpring = spring({ frame: Math.max(0, localFrame - 28), fps, config: { damping: 14 } });
  const pulse = Math.sin(localFrame / 6) * 0.15 + 0.85;

  const ev = stage.evidence || {};

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', width: '100%', height: '100%' }}>
      {/* Caller Logic */}
      <div
        style={{
          transform: `scale(${leftSpring})`,
          opacity: safeInterpolate(localFrame, [0, 15], [0, 1]),
          width: '270px',
          backgroundColor: '#0f172a',
          border: '1.5px solid #818cf8',
          borderRadius: '10px',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', marginBottom: '6px' }}>
          &#9881; Invoking Function
        </div>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace', marginBottom: '4px' }}>
          {ev.symbol ? `${ev.symbol}()` : 'service_call()'}
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}>
          {truncateMiddle(ev.file_path, 32)}
        </div>
      </div>

      <div style={{ color: '#818cf8', fontSize: '22px', opacity: pulse }}>&rarr;</div>

      {/* External Service Dispatcher */}
      <div
        style={{
          transform: `scale(${centerSpring})`,
          opacity: safeInterpolate(localFrame, [12, 26], [0, 1]),
          width: '320px',
          backgroundColor: '#111827',
          border: '2px solid #ec4899',
          borderRadius: '12px',
          padding: '18px',
          boxShadow: '0 0 24px rgba(236, 72, 153, 0.25)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#ec4899', textTransform: 'uppercase', marginBottom: '6px' }}>
          &#9889; {stage.role_badge || 'EXTERNAL EFFECT'}
        </div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginBottom: '6px' }}>
          {stage.title}
        </div>
        <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: '1.4' }}>
          {stage.explanation}
        </div>
      </div>

      <div style={{ color: '#34d399', fontSize: '22px', opacity: pulse }}>&rarr;</div>

      {/* External Return */}
      <div
        style={{
          transform: `scale(${extSpring})`,
          opacity: safeInterpolate(localFrame, [24, 38], [0, 1]),
          width: '270px',
          backgroundColor: '#0f172a',
          border: '1.5px solid #34d399',
          borderRadius: '10px',
          padding: '16px',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '6px' }}>
          &#10003; Result Received
        </div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
          {stage.data_out?.type || 'External Result'}
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
          {stage.data_out?.label || 'Returned computation data'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. Proven Fan-Out / Fan-In Primitive
// Only displayed when code proves two distinct parallel branches!
// ---------------------------------------------------------------------------
function FanOutFanInPrimitive({ stage, localFrame, fps }) {
  const topSpring = spring({ frame: Math.max(0, localFrame - 4), fps, config: { damping: 14 } });
  const b1Spring = spring({ frame: Math.max(0, localFrame - 15), fps, config: { damping: 14 } });
  const b2Spring = spring({ frame: Math.max(0, localFrame - 20), fps, config: { damping: 14 } });
  const convergeSpring = spring({ frame: Math.max(0, localFrame - 32), fps, config: { damping: 14 } });
  const pulse = Math.sin(localFrame / 5) * 0.2 + 0.8;

  const branches = stage.visual_data?.branches || ['Branch A', 'Branch B'];
  const ev = stage.evidence || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', width: '100%', height: '100%' }}>
      {/* Root Node */}
      <div
        style={{
          transform: `scale(${topSpring})`,
          opacity: safeInterpolate(localFrame, [0, 12], [0, 1]),
          width: '420px',
          backgroundColor: '#1e293b',
          border: '1.5px solid #38bdf8',
          borderRadius: '8px',
          padding: '10px 16px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
          DISPATCH ROOT &bull; {ev.symbol || 'dispatch'}()
        </div>
        <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600 }}>
          {stage.title}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-around', width: '640px', color: '#818cf8', fontSize: '14px', fontWeight: 600, opacity: pulse }}>
        <div>&swarr; {branches[0]}</div>
        <div>{branches[1]} &searr;</div>
      </div>

      {/* Parallel Branches */}
      <div style={{ display: 'flex', gap: '20px', width: '640px', justifyContent: 'center' }}>
        <div
          style={{
            transform: `scale(${b1Spring})`,
            opacity: safeInterpolate(localFrame, [12, 24], [0, 1]),
            flex: 1,
            backgroundColor: '#0f172a',
            border: '1.5px solid #818cf8',
            borderRadius: '10px',
            padding: '12px 14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#818cf8' }}>{branches[0]}</div>
          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>Parallel branch execution</div>
        </div>

        <div
          style={{
            transform: `scale(${b2Spring})`,
            opacity: safeInterpolate(localFrame, [18, 30], [0, 1]),
            flex: 1,
            backgroundColor: '#0f172a',
            border: '1.5px solid #a855f7',
            borderRadius: '10px',
            padding: '12px 14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#a855f7' }}>{branches[1]}</div>
          <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>Parallel branch execution</div>
        </div>
      </div>

      <div style={{ color: '#ec4899', fontSize: '14px', fontWeight: 600, opacity: pulse }}>
        &darr; Merge & Converge
      </div>

      {/* Converged Output */}
      <div
        style={{
          transform: `scale(${convergeSpring})`,
          opacity: safeInterpolate(localFrame, [30, 42], [0, 1]),
          width: '500px',
          backgroundColor: '#111827',
          border: '2px solid #ec4899',
          borderRadius: '10px',
          padding: '10px 18px',
          textAlign: 'center',
          boxShadow: '0 0 20px rgba(236, 72, 153, 0.25)',
        }}
      >
        <div style={{ fontSize: '10px', fontWeight: 700, color: '#ec4899' }}>CONVERGED STATE</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
          {stage.data_out?.label || 'Combined Branch Results'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene 1: Project Introduction
// ---------------------------------------------------------------------------
function SceneIntro({ story, repoName, localFrame, fps, durationFrames }) {
  const titleSpring = spring({ frame: localFrame, fps, config: { damping: 14 } });
  const cardSpring = spring({ frame: Math.max(0, localFrame - 15), fps, config: { damping: 14 } });
  const pulse = Math.sin(localFrame / 6) * 0.15 + 0.85;

  const stages = story.stages || [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '40px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at top, #1e1b4b 0%, #090d16 70%)',
      }}
    >
      <div
        style={{
          transform: `scale(${titleSpring})`,
          opacity: safeInterpolate(localFrame, [0, 20], [0, 1]),
          marginBottom: '20px',
        }}
      >
        <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(56, 189, 248, 0.12)', border: '1px solid #38bdf8', borderRadius: '20px', fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          {story.archetype?.replace(/_/g, ' ') || 'SYSTEM EXPLAINER'} &bull; HOW THIS PROJECT WORKS
        </div>
        <h1 style={{ fontSize: '42px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', margin: 0 }}>
          {story.project_title || repoName}
        </h1>
        <p style={{ fontSize: '16px', color: '#cbd5e1', maxWidth: '780px', margin: '10px auto 0', lineHeight: '1.5' }}>
          {story.project_summary}
        </p>
      </div>

      {/* System Boundary: What Enters -> Core System -> What Comes Out */}
      <div
        style={{
          transform: `scale(${cardSpring})`,
          opacity: safeInterpolate(localFrame, [12, 30], [0, 1]),
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          marginTop: '16px',
        }}
      >
        {/* Ingress Preview */}
        <div style={{ width: '240px', padding: '14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #38bdf8', borderRadius: '10px', textAlign: 'left' }}>
          <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>WHAT ENTERS</div>
          <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600, marginTop: '4px' }}>
            {story.input_description}
          </div>
        </div>

        <div style={{ color: '#38bdf8', fontSize: '20px', opacity: pulse }}>&rarr;</div>

        {/* Core System */}
        <div style={{ width: '280px', padding: '16px', background: 'rgba(30, 27, 75, 0.9)', border: '2px solid #818cf8', borderRadius: '12px', textAlign: 'center', boxShadow: '0 0 20px rgba(129, 140, 248, 0.25)' }}>
          <div style={{ fontSize: '10px', color: '#a5b4fc', fontWeight: 700, textTransform: 'uppercase' }}>CORE ENGINE</div>
          <div style={{ fontSize: '15px', color: '#ffffff', fontWeight: 700, marginTop: '4px' }}>
            {stages.length} Proven Logical Stages
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Fully traceable to repository AST
          </div>
        </div>

        <div style={{ color: '#34d399', fontSize: '20px', opacity: pulse }}>&rarr;</div>

        {/* Egress Preview */}
        <div style={{ width: '240px', padding: '14px', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid #34d399', borderRadius: '10px', textAlign: 'left' }}>
          <div style={{ fontSize: '10px', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>WHAT COMES OUT</div>
          <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600, marginTop: '4px' }}>
            {story.output_description}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene 2: Ingress / Input
// ---------------------------------------------------------------------------
function SceneInputIngress({ story, localFrame, fps, durationFrames }) {
  const enterSpring = spring({ frame: localFrame, fps, config: { damping: 14 } });
  const pulse = Math.sin(localFrame / 6) * 0.15 + 0.85;

  const firstStage = story.stages?.[0] || {};
  const ev = firstStage.evidence || {};

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '40px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at center, #0f172a 0%, #020617 80%)',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        STAGE 1 &bull; SYSTEM INGRESS
      </div>
      <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', margin: '0 0 10px' }}>
        What Enters The System
      </h2>
      <p style={{ fontSize: '15px', color: '#94a3b8', maxWidth: '640px', margin: '0 auto 28px' }}>
        {story.input_description}
      </p>

      <div
        style={{
          transform: `scale(${enterSpring})`,
          opacity: safeInterpolate(localFrame, [0, 18], [0, 1]),
          width: '560px',
          backgroundColor: '#111827',
          border: '2px solid #38bdf8',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 8px 30px rgba(56, 189, 248, 0.2)',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
            INBOUND ENTRYPOINT
          </span>
          <span style={{ fontSize: '11px', color: '#7ee787', fontFamily: 'monospace' }}>
            {ev.file_path ? `${ev.file_path}:L${ev.start_line}` : 'entrypoint'}
          </span>
        </div>
        <div style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', fontFamily: 'monospace', marginBottom: '8px' }}>
          {ev.symbol ? `${ev.symbol}()` : firstStage.title}
        </div>
        <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
          {firstStage.explanation || 'Entry boundary receiving user questions or client API requests.'}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene 3..N: Stage Execution Scenes
// ---------------------------------------------------------------------------
function SceneStage({ stage, localFrame, fps, durationFrames, totalStages }) {
  const ev = stage.evidence || {};

  // Choose visual primitive strictly based on proven stage_type and visual_data
  let Primitive = SingleNodePrimitive;
  if (stage.visual_data?.fan_out_fan_in) {
    Primitive = FanOutFanInPrimitive;
  } else if (stage.stage_type === 'external_call') {
    Primitive = ExternalEffectPrimitive;
  } else if (stage.stage_type === 'request' || stage.stage_type === 'ingress' || stage.stage_type === 'response' || stage.stage_type === 'output') {
    Primitive = RequestResponsePrimitive;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: '#090d16',
        padding: '30px 48px',
        boxSizing: 'border-box',
      }}
    >
      {/* Stage Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ background: '#38bdf8', color: '#090d16', fontWeight: 800, fontSize: '12px', padding: '3px 9px', borderRadius: '4px' }}>
            {stage.stage_index} / {totalStages}
          </span>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
              {stage.concept_title || stage.title}
            </h2>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
              {stage.concept_explanation || stage.subtitle}
            </div>
          </div>
        </div>

        {/* Provenance Evidence Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#a5b4fc', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '4px', padding: '3px 8px', fontFamily: 'monospace' }}>
            {stage.provenance_chip || (ev.symbol ? `${ev.symbol}()` : 'proven')}
          </span>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
            {truncateMiddle(ev.file_path, 30)}{ev.start_line ? `:L${ev.start_line}–${ev.end_line}` : ''}
          </span>
        </div>
      </div>

      {/* Visual Animation Area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Primitive stage={stage} localFrame={localFrame} fps={fps} />
      </div>

      {/* Bottom Narration Explanation Bar */}
      <div
        style={{
          marginTop: '12px',
          padding: '12px 20px',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4', flex: 1 }}>
          <strong style={{ color: '#38bdf8' }}>Narration:</strong> {stage.narration || stage.explanation}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scene Final: Output & End-to-End Recap
// ---------------------------------------------------------------------------
function SceneSummary({ story, localFrame, fps, durationFrames }) {
  const pulse = Math.sin(localFrame / 6) * 0.15 + 0.85;
  const stages = story.stages || [];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '36px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at bottom, #1e1b4b 0%, #090d16 70%)',
      }}
    >
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
        RECAP &bull; END-TO-END PIPELINE
      </div>
      <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', margin: '0 0 10px' }}>
        How {story.project_title} Completes The Loop
      </h2>
      <p style={{ fontSize: '15px', color: '#94a3b8', maxWidth: '680px', margin: '0 auto 24px' }}>
        {story.closing_recap || `From ${story.input_description} to ${story.output_description}.`}
      </p>

      {/* Interconnected Pipeline Recap Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          maxWidth: '1100px',
        }}
      >
        {stages.map((st, i) => {
          const stepAppearFrame = i * 6;
          const isLit = localFrame >= stepAppearFrame;
          return (
            <React.Fragment key={st.id || i}>
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: isLit ? 'rgba(30, 41, 59, 0.9)' : 'rgba(15, 23, 42, 0.5)',
                  border: `1.5px solid ${isLit ? '#38bdf8' : '#334155'}`,
                  borderRadius: '8px',
                  minWidth: '140px',
                  maxWidth: '180px',
                  textAlign: 'center',
                  boxShadow: isLit ? '0 0 16px rgba(56, 189, 248, 0.2)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ fontSize: '9px', fontWeight: 700, color: '#38bdf8' }}>
                  STAGE {i + 1}
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: isLit ? '#ffffff' : '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {st.concept_title || st.title}
                </div>
                <div style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace', marginTop: '2px' }}>
                  {st.evidence?.symbol ? `${st.evidence.symbol}()` : ''}
                </div>
              </div>

              {i < stages.length - 1 && (
                <div style={{ color: isLit ? '#38bdf8' : '#334155', fontSize: '16px', opacity: isLit ? pulse : 0.3 }}>
                  &rarr;
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root Composition Orchestrator
// ---------------------------------------------------------------------------
export function ProjectStoryComposition({ story, repoName = 'Repository' }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!story || !story.stages || story.stages.length === 0) {
    return (
      <div style={{ width: '100%', height: '100%', background: '#090d16', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        No project story available.
      </div>
    );
  }

  const introSec = 7;
  const introFrames = introSec * fps;
  const ingressSec = 6;
  const ingressFrames = ingressSec * fps;
  const recapSec = 7;
  const recapFrames = recapSec * fps;

  let cumFrames = introFrames + ingressFrames;
  const scenes = [];

  // Scene 1: Intro
  scenes.push({
    id: 'intro',
    start: 0,
    duration: introFrames,
    render: (localF) => <SceneIntro story={story} repoName={repoName} localFrame={localF} fps={fps} durationFrames={introFrames} />,
  });

  // Scene 2: Ingress
  scenes.push({
    id: 'ingress',
    start: introFrames,
    duration: ingressFrames,
    render: (localF) => <SceneInputIngress story={story} localFrame={localF} fps={fps} durationFrames={ingressFrames} />,
  });

  // Scenes 3..N: Stages
  story.stages.forEach((st, idx) => {
    const durSec = st.duration_seconds || 9;
    const durFrames = durSec * fps;
    const startF = cumFrames;
    cumFrames += durFrames;
    scenes.push({
      id: st.id || `stage_${idx}`,
      start: startF,
      duration: durFrames,
      render: (localF) => (
        <SceneStage
          stage={st}
          localFrame={localF}
          fps={fps}
          durationFrames={durFrames}
          totalStages={story.stages.length}
        />
      ),
    });
  });

  // Scene Final: Recap
  scenes.push({
    id: 'recap',
    start: cumFrames,
    duration: recapFrames,
    render: (localF) => <SceneSummary story={story} localFrame={localF} fps={fps} durationFrames={recapFrames} />,
  });

  // Determine active scene
  const activeScene = scenes.find((s) => frame >= s.start && frame < s.start + s.duration) || scenes[scenes.length - 1];
  const localFrame = frame - activeScene.start;

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#090d16', position: 'relative', overflow: 'hidden' }}>
      {activeScene.render(localFrame)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default Export Component (In-App Player + Controls)
// ---------------------------------------------------------------------------
export default function RemotionWalkthrough({
  story,
  repoName = 'Repository',
  onViewImplementation,
  onAskCodeLens,
}) {
  const playerRef = useRef(null);

  if (!story || !story.stages || story.stages.length === 0) {
    return null;
  }

  const fps = 30;
  const introSec = 7;
  const introFrames = introSec * fps;
  const ingressSec = 6;
  const ingressFrames = ingressSec * fps;
  const recapSec = 7;
  const recapFrames = recapSec * fps;

  let cumFrames = introFrames + ingressFrames;
  const stageFramesMap = story.stages.map((st) => {
    const durSec = st.duration_seconds || 9;
    const start = cumFrames;
    cumFrames += durSec * fps;
    return { ...st, startFrame: start };
  });

  const totalFrames = cumFrames + recapFrames;

  const [selectedStageIdx, setSelectedStageIdx] = useState(0);
  const activeStage = story.stages[selectedStageIdx] || story.stages[0];
  const activeEvidence = activeStage?.evidence || { file_path: '', symbol: '', start_line: 1, end_line: 20 };

  const handleSeekToStage = (idx) => {
    setSelectedStageIdx(idx);
    const target = stageFramesMap[idx];
    if (target && playerRef.current) {
      playerRef.current.seekTo(target.startFrame);
    }
  };

  const handleSeekToIntro = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(0);
    }
  };

  const handleSeekToIngress = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(introFrames);
    }
  };

  const handleSeekToRecap = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(totalFrames - recapFrames);
    }
  };

  return (
    <div className="remotion-walkthrough-wrapper">
      <div className="remotion-player-container">
        <Player
          ref={playerRef}
          component={ProjectStoryComposition}
          inputProps={{ story, repoName }}
          durationInFrames={totalFrames}
          compositionWidth={1280}
          compositionHeight={720}
          fps={fps}
          controls
          autoPlay
          loop
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: '16 / 9',
            borderRadius: '10px',
            border: '1px solid var(--border-color, #30363d)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          }}
        />
      </div>

      {/* Interactive Timeline Scrubber Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          padding: '8px 12px',
          background: 'rgba(17, 24, 39, 0.75)',
          border: '1px solid var(--border-subtle, #1e293b)',
          borderRadius: '8px',
        }}
      >
        <button
          type="button"
          onClick={handleSeekToIntro}
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            color: '#94a3b8',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          &#9654; Intro
        </button>

        <button
          type="button"
          onClick={handleSeekToIngress}
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            color: '#94a3b8',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          &#9654; Ingress
        </button>

        {story.stages.map((st, i) => (
          <button
            key={st.id || i}
            type="button"
            onClick={() => handleSeekToStage(i)}
            style={{
              background: selectedStageIdx === i ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              border: `1px solid ${selectedStageIdx === i ? '#38bdf8' : '#334155'}`,
              color: selectedStageIdx === i ? '#ffffff' : '#cbd5e1',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '11px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '9px', color: '#38bdf8', fontWeight: 700 }}>{i + 1}</span>
            <span>{st.title}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={handleSeekToRecap}
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            color: '#94a3b8',
            borderRadius: '4px',
            padding: '4px 10px',
            fontSize: '11px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Recap &#9632;
        </button>
      </div>

      {/* Grounded Source Code Action Bar */}
      <div className="remotion-actions-bar">
        <div className="remotion-actions-meta">
          <span className="implementation-label">Selected Stage Provenance:</span>
          <span className="implementation-symbol-tag">
            {activeEvidence.symbol ? `${activeEvidence.symbol}()` : activeStage.title}
          </span>
          <span className="implementation-file-tag">
            {truncateMiddle(activeEvidence.file_path, 34)}{activeEvidence.start_line ? `: L${activeEvidence.start_line}–${activeEvidence.end_line}` : ''}
          </span>
        </div>

        <div className="remotion-actions-buttons">
          <button
            type="button"
            className="btn btn-secondary action-cta-btn"
            onClick={() =>
              onViewImplementation &&
              onViewImplementation({
                file_path: activeEvidence.file_path,
                symbol: activeEvidence.symbol,
                start_line: activeEvidence.start_line,
                end_line: activeEvidence.end_line,
              })
            }
          >
            <span>&#128187;</span> View Implementation
          </button>

          <button
            type="button"
            className="btn btn-secondary action-cta-btn"
            onClick={() =>
              onAskCodeLens &&
              onAskCodeLens(
                `Explain how ${activeStage.title} (${activeEvidence.symbol || 'logic'} in ${activeEvidence.file_path}) works in this repository.`
              )
            }
          >
            <span>&#10024;</span> Ask CodeLens
          </button>
        </div>
      </div>
    </div>
  );
}
