import React, { useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

/**
 * Custom React Flow Node Component for CodeLens AI
 * Displays file, class, or function metadata aligned with the dark Stitch design.
 */
const CodeLensNode = ({ data, selected }) => {
  const isSelected = selected || data.isSelected;

  const typeConfig = {
    file: { color: '#38bdf8', label: 'FILE' },
    class: { color: '#c084fc', label: 'CLASS' },
    function: { color: '#34d399', label: 'FUNCTION' },
  }[data.type] || { color: '#818cf8', label: (data.type || 'NODE').toUpperCase() };

  return (
    <div
      className={`graph-card-node ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'relative',
        minWidth: '220px',
        maxWidth: '280px',
        padding: '10px 14px',
        cursor: 'pointer',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: typeConfig.color,
          width: 8,
          height: 8,
          border: '2px solid #0b0e15',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: typeConfig.color,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: typeConfig.color,
              display: 'inline-block',
            }}
          />
          {typeConfig.label}
        </span>
        {data.start_line && (
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-dim)',
            }}
          >
            L{data.start_line}
            {data.end_line && data.end_line !== data.start_line ? `-${data.end_line}` : ''}
          </span>
        )}
      </div>

      <div
        className="graph-node-title"
        style={{
          fontSize: '13px',
          wordBreak: 'break-word',
          color: isSelected ? '#ffffff' : 'var(--text-primary)',
        }}
      >
        {data.name}
      </div>

      <div
        className="graph-node-path"
        style={{
          fontSize: '10px',
          wordBreak: 'break-all',
          marginTop: '2px',
        }}
      >
        {data.file_path}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: typeConfig.color,
          width: 8,
          height: 8,
          border: '2px solid #0b0e15',
        }}
      />
    </div>
  );
};

const nodeTypes = {
  codeNode: CodeLensNode,
};

/**
 * Transforms raw backend graph nodes and edges into React Flow format.
 * Applies a deterministic multi-column layout (Files -> Classes -> Functions)
 * grouped by file path.
 */
function transformToReactFlow(backendNodes, backendEdges, selectedNodeId) {
  if (!backendNodes || backendNodes.length === 0) {
    return { rfNodes: [], rfEdges: [] };
  }

  const fileGroups = {};
  const fileOrder = [];

  backendNodes.forEach((node) => {
    const fp = node.file_path || 'root';
    if (!fileGroups[fp]) {
      fileGroups[fp] = { file: null, classes: [], functions: [] };
      fileOrder.push(fp);
    }
    if (node.type === 'file') {
      fileGroups[fp].file = node;
    } else if (node.type === 'class') {
      fileGroups[fp].classes.push(node);
    } else if (node.type === 'function') {
      fileGroups[fp].functions.push(node);
    }
  });

  const rfNodes = [];
  let currentY = 50;
  const FILE_X = 50;
  const CLASS_X = 360;
  const FUNC_X = 680;
  const ROW_HEIGHT = 85;

  fileOrder.forEach((fp) => {
    const group = fileGroups[fp];
    const maxItems = Math.max(1, group.classes.length, group.functions.length);
    const groupHeight = Math.max(100, maxItems * ROW_HEIGHT);

    // Place File Node
    if (group.file) {
      rfNodes.push({
        id: group.file.id,
        type: 'codeNode',
        position: { x: FILE_X, y: currentY },
        data: {
          ...group.file,
          isSelected: group.file.id === selectedNodeId,
        },
      });
    }

    // Place Class Nodes
    group.classes.forEach((clsNode, idx) => {
      rfNodes.push({
        id: clsNode.id,
        type: 'codeNode',
        position: { x: CLASS_X, y: currentY + idx * ROW_HEIGHT },
        data: {
          ...clsNode,
          isSelected: clsNode.id === selectedNodeId,
        },
      });
    });

    // Place Function Nodes
    group.functions.forEach((fnNode, idx) => {
      rfNodes.push({
        id: fnNode.id,
        type: 'codeNode',
        position: { x: FUNC_X, y: currentY + idx * ROW_HEIGHT },
        data: {
          ...fnNode,
          isSelected: fnNode.id === selectedNodeId,
        },
      });
    });

    currentY += groupHeight + 40;
  });

  // Edge styling mapping
  const edgeColorMap = {
    contains: '#64748b',
    imports: '#818cf8',
    calls: '#10b981',
  };

  const rfEdges = (backendEdges || []).map((edge) => {
    const isCalls = edge.type === 'calls';
    const isImports = edge.type === 'imports';
    const color = edgeColorMap[edge.type] || '#818cf8';

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: isCalls || isImports,
      style: {
        stroke: color,
        strokeWidth: isCalls ? 2.5 : isImports ? 2 : 1.5,
        strokeDasharray: edge.type === 'contains' ? '4 2' : undefined,
      },
      label: edge.type,
      labelStyle: {
        fill: '#94a3b8',
        fontSize: 10,
        fontFamily: 'monospace',
        fontWeight: 600,
      },
      labelBgStyle: {
        fill: '#0b0e15',
        fillOpacity: 0.92,
        stroke: '#1e293b',
        strokeWidth: 1,
      },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 4,
    };
  });

  return { rfNodes, rfEdges };
}

/**
 * ArchitectureGraph Component
 * Renders the analyzed repository architecture using React Flow.
 */
export default function ArchitectureGraph({
  nodes = [],
  edges = [],
  selectedNode = null,
  onSelectNode = () => {},
}) {
  const selectedNodeId = selectedNode?.id;

  const { rfNodes, rfEdges } = useMemo(
    () => transformToReactFlow(nodes, edges, selectedNodeId),
    [nodes, edges, selectedNodeId]
  );

  const handleNodeClick = useCallback(
    (_, node) => {
      if (onSelectNode) {
        onSelectNode(node.data);
      }
    },
    [onSelectNode]
  );

  if (!nodes || nodes.length === 0) {
    return (
      <div className="graph-canvas">
        <div className="graph-canvas-grid" />
        <div style={{ color: 'var(--text-muted)', fontSize: '13px', zIndex: 1 }}>
          No graph data available.
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background color="rgba(255, 255, 255, 0.05)" gap={24} size={1} />
        <Controls
          style={{
            backgroundColor: '#0f172a',
            borderColor: '#334155',
            fill: '#94a3b8',
          }}
        />
      </ReactFlow>
    </div>
  );
}

