import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

/**
 * Custom Node for Code Flow Steps
 */
const FlowNodeCard = ({ data, selected }) => {
  const isSelected = selected || data.isSelected;
  const isRoot = data.isRoot;

  return (
    <div
      className={`flow-node-card ${isSelected ? 'focused' : ''} ${isRoot ? 'flow-node-root' : ''}`}
      style={{
        position: 'relative',
        minWidth: '200px',
        maxWidth: '260px',
        cursor: 'pointer',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: isRoot ? '#818cf8' : '#38bdf8',
          width: 8,
          height: 8,
          border: '2px solid #0b0e15',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span
          className="flow-node-badge"
          style={{
            backgroundColor: isRoot ? 'rgba(99, 102, 241, 0.25)' : 'rgba(56, 189, 248, 0.15)',
            color: isRoot ? '#c7d2fe' : '#7dd3fc',
            border: `1px solid ${isRoot ? 'rgba(99, 102, 241, 0.4)' : 'rgba(56, 189, 248, 0.25)'}`,
          }}
        >
          {isRoot ? '★ ROOT' : 'CALL STEP'}
        </span>
        {data.start_line && (
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
            L{data.start_line}{data.end_line && data.end_line !== data.start_line ? `–${data.end_line}` : ''}
          </span>
        )}
      </div>

      <div className="flow-node-name" style={{ color: isSelected ? '#ffffff' : (isRoot ? '#e0e7ff' : 'var(--text-primary)') }}>
        {data.name}()
      </div>

      <div className="flow-node-loc" title={data.file_path}>
        {data.file_path}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: isRoot ? '#818cf8' : '#34d399',
          width: 8,
          height: 8,
          border: '2px solid #0b0e15',
        }}
      />
    </div>
  );
};

const nodeTypes = {
  flowNode: FlowNodeCard,
};

/**
 * CodeFlow Component
 * Directional call hierarchy visualizer using React Flow.
 * Displays static AST call flow derived from the repository.
 *
 * @param {object} props
 * @param {object} props.flow - Flow data { repository_url, root_function, nodes, edges }
 * @param {string} props.selectedNodeId - Currently selected node ID
 * @param {function} props.onNodeClick - Callback when node is clicked (node) => void
 */
export default function CodeFlow({ flow, selectedNodeId, onNodeClick }) {
  // Compute hierarchical layout (levels 0, 1, 2)
  const { rfNodes, rfEdges } = useMemo(() => {
    if (!flow || !flow.nodes || flow.nodes.length === 0) {
      return { rfNodes: [], rfEdges: [] };
    }

    const rawNodes = flow.nodes;
    const rawEdges = flow.edges || [];
    const rootNode = rawNodes[0];

    // Calculate level depth for each node
    const levelMap = new Map();
    levelMap.set(rootNode.id, 0);

    // BFS compute levels
    const queue = [rootNode.id];
    while (queue.length > 0) {
      const current = queue.shift();
      const currentLevel = levelMap.get(current) || 0;
      for (const edge of rawEdges) {
        if (edge.source === current && !levelMap.has(edge.target)) {
          levelMap.set(edge.target, currentLevel + 1);
          queue.push(edge.target);
        }
      }
    }

    // Group nodes by level
    const levelGroups = new Map();
    rawNodes.forEach((node) => {
      const lvl = levelMap.has(node.id) ? levelMap.get(node.id) : 1;
      if (!levelGroups.has(lvl)) {
        levelGroups.set(lvl, []);
      }
      levelGroups.get(lvl).push(node);
    });

    const X_CENTER = 360;
    const Y_START = 40;
    const Y_SPACING = 150;
    const X_SPACING = 270;

    const positionedNodes = [];
    levelGroups.forEach((groupNodes, level) => {
      const count = groupNodes.length;
      const totalWidth = (count - 1) * X_SPACING;
      const startX = X_CENTER - totalWidth / 2;

      groupNodes.forEach((node, idx) => {
        positionedNodes.push({
          id: node.id,
          type: 'flowNode',
          position: {
            x: startX + idx * X_SPACING - 110,
            y: Y_START + level * Y_SPACING,
          },
          data: {
            ...node,
            isRoot: node.id === rootNode.id,
            isSelected: node.id === selectedNodeId,
          },
        });
      });
    });

    const formattedEdges = rawEdges.map((edge, idx) => ({
      id: `flow-edge-${edge.source}-${edge.target}-${idx}`,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 14,
        height: 14,
        color: '#818cf8',
      },
      style: {
        stroke: '#6366f1',
        strokeWidth: 2,
        strokeDasharray: '4 2',
      },
      label: 'calls',
      labelStyle: {
        fill: '#a5b4fc',
        fontSize: 10,
        fontFamily: 'monospace',
      },
      labelBgStyle: {
        fill: '#0f131d',
        fillOpacity: 0.9,
      },
    }));

    return { rfNodes: positionedNodes, rfEdges: formattedEdges };
  }, [flow, selectedNodeId]);

  const handleNodeClick = useCallback(
    (_, node) => {
      if (onNodeClick && node && node.data) {
        onNodeClick(node.data);
      }
    },
    [onNodeClick]
  );

  if (!flow || !flow.nodes || flow.nodes.length === 0) {
    return (
      <div className="flow-visualizer-canvas">
        <div className="flow-empty-state">
          <div className="flow-empty-icon">&#9655;</div>
          <div className="flow-empty-title">Trace Code Flow</div>
          <div className="flow-empty-subtitle">
            Select a function to see how it connects to other parts of the code.
          </div>
        </div>
      </div>
    );
  }

  const hasNoChildCalls = flow.nodes.length === 1 && (!flow.edges || flow.edges.length === 0);

  return (
    <div className="flow-visualizer-canvas">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={1.5}
        attributionPosition="bottom-left"
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            fill: 'var(--text-primary)',
          }}
        />
      </ReactFlow>

      {hasNoChildCalls && (
        <div className="flow-no-calls-banner">
          <span style={{ color: 'var(--accent-cyan)' }}>&#9432;</span>
          <span>This function does not call any other repository functions we can trace.</span>
        </div>
      )}
    </div>
  );
}

