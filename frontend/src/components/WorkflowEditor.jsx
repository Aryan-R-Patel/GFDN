import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import useGfdnStore from '../store/useGfdnStore.js';

// Only middle nodes that can be added (INPUT and DECISION are system nodes)
const palette = [
  {
    type: 'GEO_CHECK',
    label: 'Geo Check',
    config: { allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR'], action: 'FLAG' },
    reactType: 'default',
  },
  {
    type: 'VELOCITY_CHECK',
    label: 'Velocity Check',
    config: { maxPerWindow: 6, windowMs: 60_000, flagOnly: true },
    reactType: 'default',
  },
  {
    type: 'AI_ANOMALY',
    label: 'AI Anomaly',
    config: { blockThreshold: 85, flagThreshold: 60 },
    reactType: 'default',
  },
];

const getReactNodeType = (workflowType) => {
  if (workflowType === 'INPUT') return 'input';
  if (workflowType === 'DECISION') return 'output';
  return 'default';
};

const INPUT_NODE_ID = 'system-input';
const DECISION_NODE_ID = 'system-decision';

const createInputNode = () => ({
  id: INPUT_NODE_ID,
  type: 'input',
  position: { x: 50, y: 180 },
  data: {
    label: 'Input',
    type: 'INPUT',
    config: { validateTransaction: true, logEntry: true },
  },
});

const createDecisionNode = () => ({
  id: DECISION_NODE_ID,
  type: 'output',
  position: { x: 800, y: 180 },
  data: {
    label: 'Decision',
    type: 'DECISION',
    config: { autoApproveBelow: 40, escalateOnFlag: true },
  },
});

// Ensure INPUT and DECISION nodes are always present and connected
const ensureSystemNodes = (nodes, edges) => {
  let workingNodes = [...nodes];
  let workingEdges = [...edges];

  // Filter out any existing INPUT/DECISION nodes
  workingNodes = workingNodes.filter(
    (node) => node.data?.type !== 'INPUT' && node.data?.type !== 'DECISION'
  );

  // Filter out any system edges
  workingEdges = workingEdges.filter(
    (edge) => edge.source !== INPUT_NODE_ID && edge.target !== DECISION_NODE_ID
  );

  const inputNode = {
    ...createInputNode(),
    draggable: true,
    deletable: false,
    selectable: false,
  };

  const decisionNode = {
    ...createDecisionNode(),
    draggable: true,
    deletable: false,
    selectable: false,
  };

  // Find first node (no incoming edges from middle nodes)
  const firstMiddleNode = workingNodes.find((node) =>
    !workingEdges.some((edge) => edge.target === node.id)
  );

  // Find last node (no outgoing edges to middle nodes)
  const lastMiddleNode = workingNodes.find((node) =>
    !workingEdges.some((edge) => edge.source === node.id)
  );

  // Create system edges
  const systemEdges = [];
  if (firstMiddleNode) {
    systemEdges.push({
      id: 'system-input-edge',
      source: INPUT_NODE_ID,
      target: firstMiddleNode.id,
      deletable: false,
      selectable: false,
    });
  }
  if (lastMiddleNode) {
    systemEdges.push({
      id: 'system-decision-edge',
      source: lastMiddleNode.id,
      target: DECISION_NODE_ID,
      deletable: false,
      selectable: false,
    });
  }

  // Add system nodes at start and end
  const allNodes = [inputNode, ...workingNodes, decisionNode];
  const allEdges = [...systemEdges, ...workingEdges];

  return { nodes: allNodes, edges: allEdges };
};

const cleanWorkflow = (workflow) => {
  if (!workflow) {
    return ensureSystemNodes([], []);
  }

  let nodes =
    workflow.nodes?.map((node) => ({
      id: node.id,
      type: getReactNodeType(node.type),
      position: node.position || { x: Math.random() * 400, y: Math.random() * 200 },
      data: {
        label: node.label || node.type,
        type: node.type,
        config: node.config || {},
      },
    })) ?? [];
  let edges =
    workflow.edges?.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })) ?? [];

  ({ nodes, edges } = ensureSystemNodes(nodes, edges));

  return { nodes, edges };
};

function toWorkflowFormat(nodes, edges, baseWorkflow) {
  return {
    id: baseWorkflow?.id ?? crypto.randomUUID(),
    name: baseWorkflow?.name ?? 'Fraud Workflow',
    version: baseWorkflow?.version ?? 1,
    nodes: nodes.map((node) => ({
      id: node.id,
      label: node.data.label,
      type: node.data.type,
      config: node.data.config,
      position: node.position,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

export default function WorkflowEditor({ workflow }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => cleanWorkflow(workflow), [workflow]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const saveWorkflow = useGfdnStore((state) => state.saveWorkflow);
  const isSaving = useGfdnStore((state) => state.isSavingWorkflow);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Restrict each node to one input and one output
  const connectNodes = useCallback(
    (connection) => {
      setEdges((eds) => {
        const filtered = eds.filter(
          (edge) => edge.source !== connection.source && edge.target !== connection.target,
        );
        return addEdge({ ...connection, id: crypto.randomUUID() }, filtered);
      });
    },
    [setEdges],
  );

  const onConnect = useCallback((connection) => connectNodes(connection), [connectNodes]);

  const onNodeClick = useCallback((_, node) => {
    // Don't allow selecting system nodes
    if (node.data?.type === 'INPUT' || node.data?.type === 'DECISION') {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  }, []);

  const handleAddNode = (paletteNode) => {
    const id = crypto.randomUUID();
    const newNode = {
      id,
      type: paletteNode.reactType ?? getReactNodeType(paletteNode.type),
      position: { x: 300 + Math.random() * 300, y: 150 + Math.random() * 100 },
      data: {
        label: paletteNode.label,
        type: paletteNode.type,
        config: JSON.parse(JSON.stringify(paletteNode.config ?? {})),
      },
    };

    // Get middle nodes only (excluding INPUT and DECISION)
    const middleNodes = nodes.filter(
      (node) => node.data?.type !== 'INPUT' && node.data?.type !== 'DECISION'
    );

    // Insert new node and re-wrap with system nodes
    const updatedMiddleNodes = [...middleNodes, newNode];
    const middleEdges = edges.filter(
      (edge) => edge.source !== INPUT_NODE_ID && edge.target !== DECISION_NODE_ID
    );

    // Auto-connect: if there are other middle nodes, connect from the last one
    let updatedEdges = [...middleEdges];
    if (middleNodes.length > 0) {
      const lastMiddleNode = middleNodes[middleNodes.length - 1];
      updatedEdges.push({
        id: crypto.randomUUID(),
        source: lastMiddleNode.id,
        target: id,
      });
    }

    const { nodes: wrappedNodes, edges: wrappedEdges } = ensureSystemNodes(
      updatedMiddleNodes,
      updatedEdges
    );

    setNodes(wrappedNodes);
    setEdges(wrappedEdges);
  };

  const handleConfigChange = (event) => {
    if (!selectedNode) return;
    try {
      const parsed = JSON.parse(event.target.value || '{}');
      setNodes((nds) =>
        nds.map((node) =>
          node.id === selectedNode.id
            ? {
                ...node,
                data: { ...node.data, config: parsed },
              }
            : node,
        ),
      );
    } catch (error) {
      // ignore parse errors during typing
    }
  };

  const handleSave = async () => {
    try {
      const payload = toWorkflowFormat(nodes, edges, workflow);
      await saveWorkflow(payload);
    } catch (error) {
      alert('Failed to save workflow. See console for details.');
    }
  };

  return (
    <div className="panel panel--workflow">
      <div className="panel__header">
        <div>
          <h2>Workflow Builder</h2>
          <p className="muted">Drag nodes, connect logic, and push live updates instantly.</p>
        </div>
        <button className="button" type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save Workflow'}
        </button>
      </div>
      <div className="workflow">
        <aside className="workflow__palette">
          <h3>Nodes</h3>
          <ul>
            {palette.map((item) => (
              <li key={item.type}>
                <button type="button" onClick={() => handleAddNode(item)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <div className="workflow__canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            onNodeClick={onNodeClick}
          >
            <Background gap={16} size={1} color="#cbd5f5" variant="cross" />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
        <aside className="workflow__config">
          <h3>Config</h3>
          {selectedNode ? (
            <div>
              <h4>{selectedNode.data.label}</h4>
              <small className="muted">Node type: {selectedNode.data.type}</small>
              <textarea
                defaultValue={JSON.stringify(selectedNode.data.config ?? {}, null, 2)}
                onChange={handleConfigChange}
                rows={14}
              />
            </div>
          ) : (
            <p className="muted">Select a node to edit configuration.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
