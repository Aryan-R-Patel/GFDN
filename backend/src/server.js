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

// Default workflow if Firebase doesn't have one
const getDefaultWorkflow = () => ({
  id: uuid(),
  name: 'Default Risk Flow',
  version: 1,
  nodes: [
    {
      id: 'input-node',
      label: 'Input',
      type: 'INPUT',
      config: {
        validateTransaction: true,
        logEntry: true,
      },
      position: { x: 0, y: 0 },
    },
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
    {
      id: 'decision',
      label: 'Decision',
      type: 'DECISION',
      config: {
        autoApproveBelow: 40,
        escalateOnFlag: true,
      },
      position: { x: 1000, y: 0 },
    },
  ],
  edges: [
    { id: 'e1', source: 'input-node', target: 'geo-check' },
    { id: 'e2', source: 'geo-check', target: 'velocity-check' },
    { id: 'e3', source: 'velocity-check', target: 'anomaly' },
    { id: 'e4', source: 'anomaly', target: 'decision' },
  ],
});

let activeWorkflow = getDefaultWorkflow();

// Load workflow from Firebase on startup
async function loadWorkflowFromFirebase() {
  try {
    const workflowData = await fetchAll('/workflow');
    if (workflowData) {
      console.log('Loaded workflow from Firebase:', workflowData.name);
      activeWorkflow = workflowData;
    } else {
      console.log('No workflow found in Firebase, using default and saving it');
      activeWorkflow = getDefaultWorkflow();
      await writeData('/workflow', activeWorkflow);
    }
  } catch (error) {
    console.error('Failed to load workflow from Firebase:', error);
    console.log('Using default workflow');
    activeWorkflow = getDefaultWorkflow();
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

  activeWorkflow = {
    ...parseResult.data,
    version: (activeWorkflow.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  };

  // Save to Firebase
  try {
    await writeData('/workflow', activeWorkflow);
    console.log('Workflow saved to Firebase');
  } catch (error) {
    console.error('Failed to save workflow to Firebase:', error);
  }

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
