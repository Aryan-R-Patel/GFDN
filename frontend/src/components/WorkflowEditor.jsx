import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import useGfdnStore from "../store/useGfdnStore.js";

/**
 * Aesthetic goals
 * - Calmer colors, consistent spacing, and soft elevation
 * - Card-like nodes with clear labels & subtle badges
 * - Smoother edges, better minimap contrast, tasteful background
 * - Cohesive layout with balanced side panels
 */

// ------- Palette (unchanged data; UI polish below) -------
const palette = [
  {
    type: "GEO_CHECK",
    label: "Geo Check",
    config: {
      allowedCountries: ["US", "CA", "GB", "DE", "FR"],
      action: "FLAG",
    },
    reactType: "default",
  },
  {
    type: "VELOCITY_CHECK",
    label: "Velocity Check",
    config: { maxPerWindow: 6, windowMs: 60_000, flagOnly: true },
    reactType: "default",
  },
  {
    type: "ANOMALY_CHECK",
    label: "Anomaly Check",
    config: { blockThreshold: 85, flagThreshold: 60 },
    reactType: "default",
  },
];

const getReactNodeType = workflowType => {
  if (workflowType === "INPUT") return "input";
  if (workflowType === "DECISION") return "output";
  return "default";
};

const INPUT_NODE_ID = "system-input";
const DECISION_NODE_ID = "system-decision";

// ------- Node UI -------
const tone = {
  base: {
    bg: "#0b1020",
    card: "#11172b",
    border: "#1f2a44",
    text: "#dbe7ff",
    subtext: "#8fa3c8",
    accent: "#6ea8fe",
    accentSoft: "#6ea8fe22",
    success: "#66d19e",
    warning: "#ffd166",
  },
  byType: {
    INPUT: { chip: "#3ddbf0", glow: "#3ddbf044" },
    DECISION: { chip: "#66d19e", glow: "#66d19e44" },
    GEO_CHECK: { chip: "#a78bfa", glow: "#a78bfa33" },
    VELOCITY_CHECK: { chip: "#f59e0b", glow: "#f59e0b33" },
    ANOMALY_CHECK: { chip: "#ef4444", glow: "#ef444433" },
    default: { chip: "#6ea8fe", glow: "#6ea8fe33" },
  },
};

function badgeColor(type) {
  return tone.byType[type]?.chip ?? tone.byType.default.chip;
}

function nodeShadow(type) {
  const glow = tone.byType[type]?.glow ?? tone.byType.default.glow;
  return `0 6px 18px -6px ${glow}`;
}

function CardNode({ data, selected }) {
  const primaryColor = badgeColor(data?.type);
  const borderColor = selected
    ? tone.base.accent
    : primaryColor ?? tone.base.accent;
  return (
    <div
      style={{
        background: tone.base.card,
        color: tone.base.text,
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        minWidth: 180,
        boxShadow: selected
          ? `0 0 0 3px ${tone.base.accentSoft}, ${nodeShadow(data?.type)}`
          : `0 0 0 3px ${primaryColor}22, ${nodeShadow(data?.type)}`,
      }}
      className="rf-node-card"
    >
      {data?.type !== "INPUT" && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: tone.base.border,
            width: 8,
            height: 8,
            borderRadius: 2,
          }}
        />
      )}
      <div
        style={{
          padding: "10px 12px 8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 2,
            background: badgeColor(data?.type),
            boxShadow: `0 0 0 6px ${
              tone.byType[data?.type]?.glow ?? tone.byType.default.glow
            }`,
          }}
        />
        <strong style={{ fontSize: 13, letterSpacing: 0.2 }}>
          {data?.label}
        </strong>
      </div>
      <div
        style={{
          padding: "0 12px 12px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: 0.9,
          fontSize: 11,
          color: tone.base.subtext,
        }}
      >
        <span
          style={{
            background: badgeColor(data?.type) + "22",
            color: badgeColor(data?.type),
            border: `1px solid ${badgeColor(data?.type)}44`,
            padding: "2px 6px",
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          {data?.type}
        </span>
        <span>config {data?.config ? "• editable" : ""}</span>
      </div>
      {data?.type !== "DECISION" && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: tone.base.border,
            width: 8,
            height: 8,
            borderRadius: 2,
          }}
        />
      )}
    </div>
  );
}

// ------- System node factories -------
const createInputNode = () => ({
  id: INPUT_NODE_ID,
  type: "card",
  position: { x: 50, y: 180 },
  data: {
    label: "Input",
    type: "INPUT",
    config: { validateTransaction: true, logEntry: true },
  },
});

const createDecisionNode = () => ({
  id: DECISION_NODE_ID,
  type: "card",
  position: { x: 800, y: 180 },
  data: {
    label: "Decision",
    type: "DECISION",
    config: { autoApproveBelow: 40, escalateOnFlag: true },
  },
});

// Ensure INPUT and DECISION nodes are always present and connected
const ensureSystemNodes = (nodes, edges) => {
  let workingNodes = [...nodes];
  let workingEdges = [...edges];

  // Filter out any existing INPUT/DECISION nodes
  workingNodes = workingNodes.filter(
    node => node.data?.type !== "INPUT" && node.data?.type !== "DECISION"
  );

  // Filter out any system edges
  workingEdges = workingEdges.filter(
    edge => edge.source !== INPUT_NODE_ID && edge.target !== DECISION_NODE_ID
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
  const firstMiddleNode = workingNodes.find(
    node => !workingEdges.some(edge => edge.target === node.id)
  );

  // Find last node (no outgoing edges to middle nodes)
  const lastMiddleNode = workingNodes.find(
    node => !workingEdges.some(edge => edge.source === node.id)
  );

  // Create system edges
  const systemEdges = [];
  if (firstMiddleNode) {
    systemEdges.push({
      id: "system-input-edge",
      source: INPUT_NODE_ID,
      target: firstMiddleNode.id,
      deletable: false,
      selectable: false,
    });
  }
  if (lastMiddleNode) {
    systemEdges.push({
      id: "system-decision-edge",
      source: lastMiddleNode.id,
      target: DECISION_NODE_ID,
      deletable: false,
      selectable: false,
    });
  }

  const allNodes = [inputNode, ...workingNodes, decisionNode];
  const allEdges = [...systemEdges, ...workingEdges];

  return { nodes: allNodes, edges: allEdges };
};

const cleanWorkflow = workflow => {
  if (!workflow) {
    return ensureSystemNodes([], []);
  }

  let nodes =
    workflow.nodes?.map(node => ({
      id: node.id,
      type: "card",
      position: node.position || {
        x: Math.random() * 400,
        y: Math.random() * 200,
      },
      data: {
        label: node.label || node.type,
        type: node.type,
        config: node.config || {},
      },
    })) ?? [];
  let edges =
    workflow.edges?.map(edge => ({
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
    name: baseWorkflow?.name ?? "Fraud Workflow",
    version: baseWorkflow?.version ?? 1,
    nodes: nodes.map(node => ({
      id: node.id,
      label: node.data.label,
      type: node.data.type,
      config: node.data.config,
      position: node.position,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
  };
}

export default function WorkflowEditor({ workflow }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => cleanWorkflow(workflow),
    [workflow]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const saveWorkflow = useGfdnStore(state => state.saveWorkflow);
  const isSaving = useGfdnStore(state => state.isSavingWorkflow);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Restrict each node to one input and one output
  const connectNodes = useCallback(
    connection => {
      setEdges(eds => {
        const filtered = eds.filter(
          edge =>
            edge.source !== connection.source &&
            edge.target !== connection.target
        );
        return addEdge({ ...connection, id: crypto.randomUUID() }, filtered);
      });
    },
    [setEdges]
  );

  const onConnect = useCallback(
    connection => connectNodes(connection),
    [connectNodes]
  );

  const onNodeClick = useCallback((_, node) => {
    // Don't allow selecting system nodes
    if (node.data?.type === "INPUT" || node.data?.type === "DECISION") {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
    }
  }, []);

  const handleAddNode = paletteNode => {
    const id = crypto.randomUUID();
    const newNode = {
      id,
      type: "card",
      position: { x: 300 + Math.random() * 300, y: 150 + Math.random() * 100 },
      data: {
        label: paletteNode.label,
        type: paletteNode.type,
        config: JSON.parse(JSON.stringify(paletteNode.config ?? {})),
      },
    };

    // Get middle nodes only (excluding INPUT and DECISION)
    const middleNodes = nodes.filter(
      node => node.data?.type !== "INPUT" && node.data?.type !== "DECISION"
    );

    // Insert new node and re-wrap with system nodes
    const updatedMiddleNodes = [...middleNodes, newNode];
    const middleEdges = edges.filter(
      edge => edge.source !== INPUT_NODE_ID && edge.target !== DECISION_NODE_ID
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

  const handleConfigChange = event => {
    if (!selectedNode) return;
    try {
      const parsed = JSON.parse(event.target.value || "{}");
      setNodes(nds =>
        nds.map(node =>
          node.id === selectedNode.id
            ? {
                ...node,
                data: { ...node.data, config: parsed },
              }
            : node
        )
      );
    } catch (_) {
      // ignore parse errors during typing
    }
  };

  const handleSave = async () => {
    try {
      const payload = toWorkflowFormat(nodes, edges, workflow);
      await saveWorkflow(payload);
    } catch (error) {
      alert("Failed to save workflow. See console for details.");
    }
  };

  // ------- Unified styling for the page -------
  // const containerStyle = {
  //   display: 'grid',
  //   gridTemplateRows: 'auto 1fr',
  //   gap: 12,
  //   minHeight: '100vh',
  //   width: '100%',
  //   maxWidth: '100%',
  //   minWidth: 0,
  //   boxSizing: 'border-box',
  //   background: `linear-gradient(180deg, ${tone.base.bg}, #0a0f1c)`,
  //   padding: 12,
  // };

  const containerStyle = {
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: 12,
    minHeight: "100vh",
    padding: 12,
    boxSizing: "border-box",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "240px minmax(0,1fr) 320px", // left / center / right
    gap: 12,
    minHeight: "60vh",
  };

  const panelStyle = {
    background: tone.base.card,
    border: `1px solid ${tone.base.border}`,
    borderRadius: 14,
    color: tone.base.text,
    padding: 12,
    boxShadow: "0 8px 24px -12px rgba(0,0,0,.35)",
  };

  const canvasPanelStyle = {
    ...panelStyle,
    padding: 0,
    overflow: "hidden",
    minWidth: 0,
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: tone.base.card,
    border: `1px solid ${tone.base.border}`,
    borderRadius: 14,
    padding: "10px 12px",
    color: tone.base.text,
    boxShadow: "0 8px 24px -12px rgba(0,0,0,.35)",
  };

  // const gridStyle = {
  //   display: 'grid',
  //   gridTemplateColumns: '240px 1fr 320px',
  //   gap: 12,
  //   minHeight: '60vh',
  // };

  const button = {
    base: {
      background: tone.base.accent,
      color: "#081022",
      border: "none",
      padding: "8px 12px",
      borderRadius: 10,
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: "0 6px 18px -8px rgba(110,168,254,.7)",
    },
    ghost: {
      background: "transparent",
      color: tone.base.text,
      border: `1px solid ${tone.base.border}`,
      padding: "6px 10px",
      borderRadius: 10,
      cursor: "pointer",
    },
  };

  const nodeTypes = useMemo(() => ({ card: CardNode }), []);

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={{ margin: 0, fontWeight: 800 }}>Workflow Builder</h3>
          <p style={{ margin: 0, color: tone.base.subtext, fontSize: 12 }}>
            Drag nodes, connect logic, and push live updates instantly.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={{
            ...button.base,
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? "Saving…" : "Save Workflow"}
        </button>
      </div>

      <div style={gridStyle}>
        {/* Palette */}
        <aside style={panelStyle}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <strong>Nodes</strong>
            <span style={{ color: tone.base.subtext, fontSize: 12 }}>
              Click to add
            </span>
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "12px 0 0 0",
              display: "grid",
              gap: 8,
            }}
          >
            {palette.map(item => (
              <li key={item.type}>
                <button
                  type="button"
                  onClick={() => handleAddNode(item)}
                  style={{
                    ...button.ghost,
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: badgeColor(item.type),
                    }}
                  />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Canvas */}
        {/* // canvas panel */}
        <div style={canvasPanelStyle}>
          <div style={{ width: "100%", height: "100%" }}>
            <ReactFlow
              style={{ width: "100%", height: "100%" }} // ensure it fills the panel
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={{
                type: "smoothstep",
                animated: false,
                style: {
                  stroke: tone.base.accent,
                  strokeWidth: 2.4,
                  opacity: 0.85,
                  filter: "drop-shadow(0 0 4px rgba(110, 168, 254, 0.45))",
                },
              }}
              connectionLineStyle={{
                stroke: tone.base.accent,
                strokeWidth: 2.4,
                opacity: 0.9,
              }}
            >
              <Background
                gap={20}
                size={1}
                color={tone.base.border}
                variant="dots"
              />
              <MiniMap
                pannable
                zoomable
                nodeStrokeColor={n => badgeColor(n.data?.type)}
                nodeColor={() => tone.base.card}
                nodeBorderRadius={8}
              />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
        </div>

        {/* Config */}
        <aside style={panelStyle}>
          <strong>Config</strong>
          {selectedNode ? (
            <div style={{ marginTop: 8 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <h4 style={{ margin: "4px 0" }}>{selectedNode.data.label}</h4>
                <span
                  style={{
                    background: badgeColor(selectedNode.data.type) + "22",
                    color: badgeColor(selectedNode.data.type),
                    border: `1px solid ${badgeColor(selectedNode.data.type)}44`,
                    padding: "2px 6px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {selectedNode.data.type}
                </span>
              </div>
              <small style={{ color: tone.base.subtext }}>
                Node type: {selectedNode.data.type}
              </small>
              <textarea
                defaultValue={JSON.stringify(
                  selectedNode.data.config ?? {},
                  null,
                  2
                )}
                onChange={handleConfigChange}
                rows={16}
                style={{
                  width: "100%",
                  marginTop: 8,
                  background: "#0b1224",
                  color: tone.base.text,
                  border: `1px solid ${tone.base.border}`,
                  borderRadius: 10,
                  padding: 10,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 12,
                  lineHeight: 1.45,
                  resize: "vertical",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.02)",
                }}
              />
            </div>
          ) : (
            <p style={{ color: tone.base.subtext, marginTop: 8 }}>
              Select a node to edit configuration.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
