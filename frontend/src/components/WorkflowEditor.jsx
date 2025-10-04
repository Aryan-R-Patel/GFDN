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

const palette = [
  {
    type: 'GEO_CHECK',
    label: 'Geo Check',
    config: { allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR'], action: 'FLAG' },
  },
  {
    type: 'VELOCITY_CHECK',
    label: 'Velocity Check',
    config: { maxPerWindow: 6, windowMs: 60_000, flagOnly: true },
  },
  {
    type: 'AI_ANOMALY',
    label: 'AI Anomaly',
    config: { blockThreshold: 85, flagThreshold: 60 },
  },
  {
    type: 'DECISION',
    label: 'Decision',
    config: { autoApproveBelow: 40, escalateOnFlag: true },
  },
];

const cleanWorkflow = (workflow) => {
  if (!workflow) return { nodes: [], edges: [] };
  const nodes = workflow.nodes?.map((node) => ({
    id: node.id,
    position: node.position || { x: Math.random() * 400, y: Math.random() * 200 },
    data: {
      label: node.label || node.type,
      type: node.type,
      config: node.config || {},
    },
  }));
  const edges = workflow.edges?.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  }));
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

  const onConnect = useCallback(
    (connection) => setEdges((eds) => addEdge({ ...connection, id: crypto.randomUUID() }, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);

  const handleAddNode = (paletteNode) => {
    const id = crypto.randomUUID();
    setNodes((nds) => [
      ...nds,
      {
        id,
        position: { x: 100 + Math.random() * 400, y: 50 + Math.random() * 200 },
        data: {
          label: paletteNode.label,
          type: paletteNode.type,
          config: paletteNode.config,
        },
      },
    ]);
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
