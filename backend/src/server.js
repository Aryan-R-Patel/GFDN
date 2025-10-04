import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';

import { TransactionGenerator } from './data/transactionGenerator.js';
import { executeWorkflow } from './workflow/executor.js';
import { nodeRegistry } from './workflow/nodes/index.js';
import { MetricsManager } from './metrics.js';
import { generateSuggestions } from './suggestions/engine.js';
import { fetchAll, writeData } from '../firebase.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

const metrics = new MetricsManager();
const velocityCache = new Map();
const recentTransactions = [];
const suggestionsCache = [];

const workflowNodeSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  type: z.enum(Object.keys(nodeRegistry)),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  config: z.record(z.any()).optional(),
});

const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().default(1),
  nodes: z.array(workflowNodeSchema),
  edges: z
    .array(
      z.object({
        id: z.string(),
        source: z.string(),
        target: z.string(),
      }),
    )
    .default([]),
});

// Hardcoded INPUT and DECISION nodes (never stored in Firebase)
const INPUT_NODE_ID = 'system-input';
const DECISION_NODE_ID = 'system-decision';

const createInputNode = () => ({
  id: INPUT_NODE_ID,
  label: 'Input',
  type: 'INPUT',
  config: {
    validateTransaction: true,
    logEntry: true,
  },
  position: { x: 0, y: 0 },
});

const createDecisionNode = () => ({
  id: DECISION_NODE_ID,
  label: 'Decision',
  type: 'DECISION',
  config: {
    autoApproveBelow: 40,
    escalateOnFlag: true,
  },
  position: { x: 1000, y: 0 },
});

// Default middle nodes if Firebase doesn't have any
const getDefaultMiddleNodes = () => [
  {
    id: 'geo-check',
    label: 'Geo Check',
    type: 'GEO_CHECK',
    config: {
      allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR'],
      action: 'FLAG',
    },
    position: { x: 250, y: 0 },
  },
  {
    id: 'velocity-check',
    label: 'Velocity Guard',
    type: 'VELOCITY_CHECK',
    config: {
      maxPerWindow: 6,
      flagOnly: true,
    },
    position: { x: 500, y: 0 },
  },
  {
    id: 'anomaly',
    label: 'AI Anomaly',
    type: 'AI_ANOMALY',
    config: {
      blockThreshold: 85,
      flagThreshold: 60,
    },
    position: { x: 750, y: 0 },
  },
];

// Wrap middle nodes with INPUT and DECISION nodes
function wrapWorkflowWithSystemNodes(middleNodesData) {
  const middleNodes = middleNodesData.nodes || [];
  const middleEdges = middleNodesData.edges || [];

  const inputNode = createInputNode();
  const decisionNode = createDecisionNode();

  const allNodes = [inputNode, ...middleNodes, decisionNode];

  // Find first and last middle node
  const firstMiddleNode = middleNodes[0];
  const lastMiddleNode = middleNodes[middleNodes.length - 1];

  const systemEdges = [];

  // Connect INPUT to first middle node
  if (firstMiddleNode) {
    systemEdges.push({
      id: 'system-input-edge',
      source: INPUT_NODE_ID,
      target: firstMiddleNode.id,
    });
  }

  // Connect last middle node to DECISION
  if (lastMiddleNode) {
    systemEdges.push({
      id: 'system-decision-edge',
      source: lastMiddleNode.id,
      target: DECISION_NODE_ID,
    });
  }

  const allEdges = [...systemEdges, ...middleEdges];

  return {
    id: middleNodesData.id || uuid(),
    name: middleNodesData.name || 'Fraud Workflow',
    version: middleNodesData.version || 1,
    nodes: allNodes,
    edges: allEdges,
  };
}

let activeWorkflow = wrapWorkflowWithSystemNodes({
  id: uuid(),
  name: 'Default Risk Flow',
  version: 1,
  nodes: getDefaultMiddleNodes(),
  edges: [
    { id: 'e1', source: 'geo-check', target: 'velocity-check' },
    { id: 'e2', source: 'velocity-check', target: 'anomaly' },
  ],
});

// Load workflow from Firebase on startup
async function loadWorkflowFromFirebase() {
  try {
    const middleNodesData = await fetchAll('/workflow');
    if (middleNodesData) {
      console.log('Loaded workflow from Firebase:', middleNodesData.name || 'Unnamed');
      activeWorkflow = wrapWorkflowWithSystemNodes(middleNodesData);
    } else {
      console.log('No workflow found in Firebase, using default and saving it');
      const defaultMiddleNodes = {
        id: uuid(),
        name: 'Default Risk Flow',
        version: 1,
        nodes: getDefaultMiddleNodes(),
        edges: [
          { id: 'e1', source: 'geo-check', target: 'velocity-check' },
          { id: 'e2', source: 'velocity-check', target: 'anomaly' },
        ],
      };
      await writeData('/workflow', defaultMiddleNodes);
      activeWorkflow = wrapWorkflowWithSystemNodes(defaultMiddleNodes);
    }
  } catch (error) {
    console.error('Failed to load workflow from Firebase:', error);
    console.log('Using default workflow');
    const defaultMiddleNodes = {
      id: uuid(),
      name: 'Default Risk Flow',
      version: 1,
      nodes: getDefaultMiddleNodes(),
      edges: [
        { id: 'e1', source: 'geo-check', target: 'velocity-check' },
        { id: 'e2', source: 'velocity-check', target: 'anomaly' },
      ],
    };
    activeWorkflow = wrapWorkflowWithSystemNodes(defaultMiddleNodes);
  }
}

const generator = new TransactionGenerator(1200);

function emitState() {
  const snapshot = metrics.snapshot();
  io.emit('metrics:update', snapshot);
  io.emit('suggestions:update', suggestionsCache);
}

function addRecentTransaction(record) {
  recentTransactions.push(record);
  if (recentTransactions.length > 100) {
    recentTransactions.shift();
  }
}

function processTransaction(transaction) {
  const start = Date.now();
  const services = {
    metrics,
    velocityCache,
  };
  const result = executeWorkflow(activeWorkflow, transaction, services);
  const latency = Date.now() - start;

  metrics.incrementCounter(result.decision.status, transaction.amount);
  metrics.recordLatency(latency);

  const enriched = {
    id: transaction.id,
    transaction,
    decision: result.decision,
    history: result.history,
    processedAt: new Date().toISOString(),
    latency,
  };

  addRecentTransaction(enriched);
  io.emit('transaction:new', enriched);
  emitState();
}

generator.on('transaction', processTransaction);
generator.start();

setInterval(() => {
  suggestionsCache.splice(0, suggestionsCache.length, ...generateSuggestions({
    metrics,
    recentTransactions,
    workflow: activeWorkflow,
  }));
  emitState();
}, 10_000);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', workflowId: activeWorkflow.id, uptime: process.uptime() });
});

app.get('/api/workflows/active', (req, res) => {
  res.json(activeWorkflow);
});

app.post('/api/workflows/active', async (req, res) => {
  const parseResult = workflowSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: 'Invalid workflow schema', details: parseResult.error.flatten() });
  }

  // Extract middle nodes (filter out INPUT and DECISION)
  const middleNodes = parseResult.data.nodes.filter(
    (node) => node.type !== 'INPUT' && node.type !== 'DECISION'
  );

  // Extract middle edges (filter out system edges)
  const middleEdges = parseResult.data.edges.filter(
    (edge) => edge.source !== INPUT_NODE_ID && edge.target !== DECISION_NODE_ID
  );

  const middleNodesData = {
    id: parseResult.data.id,
    name: parseResult.data.name,
    version: (activeWorkflow.version || 1) + 1,
    nodes: middleNodes,
    edges: middleEdges,
    updatedAt: new Date().toISOString(),
  };

  // Save only middle nodes to Firebase
  try {
    await writeData('/workflow', middleNodesData);
    console.log('Workflow saved to Firebase (middle nodes only)');
  } catch (error) {
    console.error('Failed to save workflow to Firebase:', error);
  }

  // Wrap with system nodes for active workflow
  activeWorkflow = wrapWorkflowWithSystemNodes(middleNodesData);

  velocityCache.clear();
  res.json({ status: 'updated', workflow: activeWorkflow });
  io.emit('workflow:update', activeWorkflow);
});

app.get('/api/metrics', (req, res) => {
  res.json(metrics.snapshot());
});

app.get('/api/transactions', (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json(recentTransactions.slice(-limit).reverse());
});

app.get('/api/suggestions', (req, res) => {
  res.json(suggestionsCache);
});

app.post('/api/actions/block', (req, res) => {
  const { transactionId, reason } = req.body;
  res.json({ status: 'queued', transactionId, reason: reason || 'Manual block request accepted.' });
});

io.on('connection', (socket) => {
  socket.emit('workflow:update', activeWorkflow);
  socket.emit('metrics:update', metrics.snapshot());
  socket.emit('suggestions:update', suggestionsCache);
  socket.emit('transaction:seed', recentTransactions.slice(-50));
});

const PORT = process.env.PORT || 4000;

// Initialize server with Firebase workflow
async function startServer() {
  await loadWorkflowFromFirebase();

  httpServer.listen(PORT, () => {
    console.log(`GFDN backend listening on port ${PORT}`);
    console.log(`Active workflow: ${activeWorkflow.name} (v${activeWorkflow.version})`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
