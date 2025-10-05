import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import 'dotenv/config';

import { TransactionGenerator } from './data/transactionGenerator.js';
import startWatcher from './data/watchTransactions.js';
import { executeWorkflow } from './workflow/executor.js';
import { nodeRegistry } from './workflow/nodes/index.js';
import { MetricsManager } from './metrics.js';
import { generateSuggestions } from './suggestions/engine.js';
import { fetchAll, writeData, pushData } from '../firebase.js';
import chatbotService from './chatbot/service.js';

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

const locationSchema = z.object({
  city: z.string().trim().min(1, 'Origin/destination city is required'),
  country: z
    .string()
    .trim()
    .min(2, 'Country code must have at least 2 characters')
    .transform((value) => value.toUpperCase()),
  region: z.string().trim().min(1, 'Region is required'),
  lat: z.coerce.number().finite('Latitude must be a number'),
  lng: z.coerce.number().finite('Longitude must be a number'),
});

const manualTransactionSchema = z.object({
  id: z.string().trim().min(1).optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  currency: z
    .string()
    .trim()
    .min(1, 'Currency is required')
    .transform((value) => value.toUpperCase()),
  timestamp: z.string().datetime().optional(),
  payment_method: z.string().trim().min(1, 'Payment method is required'),
  device_id: z.string().trim().min(1, 'Device ID is required'),
  display: z.string().trim().optional(),
  route_display: z.string().trim().optional(),
  latency_ms: z.coerce.number().nonnegative().optional(),
  metadata: z
    .object({
      note: z.string().trim().optional(),
    })
    .optional(),
  origin: locationSchema,
  destination: locationSchema,
});

function normalizeManualTransaction(input) {
  const now = new Date().toISOString();
  const transactionId = input.id?.trim() || uuid();
  const timestamp = input.timestamp || now;

  const origin = {
    ...input.origin,
    deviceId: input.device_id,
  };

  const destination = {
    ...input.destination,
  };

  const metadata = {
    paymentMethod: input.payment_method,
    ...(input.metadata?.note ? { note: input.metadata.note } : {}),
  };

  const defaultRouteDisplay = `${origin.country} → ${destination.country} (${origin.region} → ${destination.region})`;

  return {
    id: transactionId,
    amount: input.amount,
    currency: input.currency,
    timestamp,
    origin,
    destination,
    metadata,
    device_id: input.device_id,
    payment_method: input.payment_method,
    display:
      input.display ||
      `${new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: input.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(input.amount)} • ${input.payment_method}`,
    route_display: input.route_display || defaultRouteDisplay,
    latency_ms: input.latency_ms ?? 0,
    decision: 'PENDING',
    decisionDetails: {
      status: 'PENDING',
      reason: 'Awaiting workflow decision',
    },
    decision_reason: 'Awaiting workflow decision',
    createdAt: now,
    source: 'manual',
  };
}

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
    source: transaction.source || 'simulated',
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

app.post('/api/transactions/manual', async (req, res) => {
  const parseResult = manualTransactionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid transaction payload',
      details: parseResult.error.flatten(),
    });
  }

  const normalized = normalizeManualTransaction(parseResult.data);

  try {
    const firebaseKey = await pushData('/transactions', normalized);
    console.log('Manual transaction queued for workflow:', normalized.id, '→ key:', firebaseKey);
    return res.status(201).json({
      status: 'queued',
      transactionId: normalized.id,
      firebaseKey,
    });
  } catch (error) {
    console.error('Failed to write manual transaction to Firebase:', error);
    return res.status(500).json({ error: 'Failed to enqueue transaction' });
  }
});

app.get('/api/transactions/live', async (req, res) => {
  try {
    const raw = await fetchAll('/transactions');
    if (!raw) {
      return res.json([]);
    }

    const records = Object.entries(raw).map(([key, value]) => {
      const valueObj = value && typeof value === 'object' ? value : {};
      const lastWorkflowResult = valueObj.lastWorkflowResult && typeof valueObj.lastWorkflowResult === 'object'
        ? valueObj.lastWorkflowResult
        : null;
      const safeMetadata = valueObj.metadata && typeof valueObj.metadata === 'object' ? valueObj.metadata : {};
      const mergedMetadata = {
        paymentMethod:
          safeMetadata.paymentMethod ||
          lastWorkflowResult?.transaction?.metadata?.paymentMethod ||
          valueObj.payment_method ||
          'unknown',
        ...(safeMetadata.note ? { note: safeMetadata.note } : {}),
      };

      const transactionBase = lastWorkflowResult?.transaction || {};

      const transaction = {
        id: transactionBase.id || valueObj.id || key,
        amount: transactionBase.amount ?? valueObj.amount,
        currency: transactionBase.currency ?? valueObj.currency,
        timestamp: transactionBase.timestamp ?? valueObj.timestamp,
        origin: transactionBase.origin || valueObj.origin || {},
        destination: transactionBase.destination || valueObj.destination || {},
        metadata: {
          ...(transactionBase.metadata || {}),
          ...mergedMetadata,
        },
        device_id: transactionBase.device_id || valueObj.device_id,
        payment_method: transactionBase.payment_method || valueObj.payment_method,
        display: transactionBase.display || valueObj.display,
        route_display: transactionBase.route_display || valueObj.route_display,
        latency_ms: valueObj.latency_ms ?? lastWorkflowResult?.latency ?? null,
        source: transactionBase.source || valueObj.source || 'firebase',
      };

      const storedDecisionDetails = (valueObj.decisionDetails && typeof valueObj.decisionDetails === 'object'
        ? valueObj.decisionDetails
        : null) || (lastWorkflowResult?.decision && typeof lastWorkflowResult.decision === 'object'
        ? lastWorkflowResult.decision
        : null);

      const status = valueObj.decision || storedDecisionDetails?.status || 'PENDING';
      const reason = storedDecisionDetails?.reason || valueObj.decision_reason;

      return {
        id: transaction.id,
        transaction,
        decision: {
          status,
          reason:
            reason ||
            (status === 'PENDING' ? 'Awaiting workflow decision' : 'Decision synced from workflow'),
          ...(storedDecisionDetails?.severity ? { severity: storedDecisionDetails.severity } : {}),
          ...(storedDecisionDetails?.metadata ? { metadata: storedDecisionDetails.metadata } : {}),
        },
        history: Array.isArray(valueObj.history)
          ? valueObj.history
          : Array.isArray(lastWorkflowResult?.history)
            ? lastWorkflowResult.history
            : [],
        processedAt:
          valueObj.processedAt ||
          valueObj.lastWorkflowRun?.executedAt ||
          lastWorkflowResult?.processedAt ||
          valueObj.timestamp ||
          null,
        latency: typeof valueObj.latency_ms === 'number' ? valueObj.latency_ms : lastWorkflowResult?.latency ?? null,
        source: transaction.source || 'firebase',
        firebaseKey: key,
      };
    });

    records.sort((a, b) => {
      const aTs = a.transaction.timestamp ? Date.parse(a.transaction.timestamp) : 0;
      const bTs = b.transaction.timestamp ? Date.parse(b.transaction.timestamp) : 0;
      return bTs - aTs;
    });

    res.json(records.slice(0, 200));
  } catch (error) {
    console.error('Failed to fetch live transactions from Firebase:', error);
    res.status(500).json({ error: 'Failed to read live transactions' });
  }
});

app.get('/api/suggestions', (req, res) => {
  res.json(suggestionsCache);
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Generate a session ID based on request headers for conversation memory
    const sessionId = chatbotService.getSessionId(req);
    
    const response = await chatbotService.generateResponse(message, context, sessionId);
    res.json({ response });
  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      response: 'I apologize, but I encountered an error processing your request. Please try again.'
    });
  }
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

// Callback to process Firebase transactions through the workflow
async function onFirebaseTransaction(transactionData, key) {
  try {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔥 Processing Firebase Transaction through Workflow');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Ensure transaction has required fields
    const transaction = {
      id: key || transactionData.id || `fb-${Date.now()}`,
      amount: transactionData.amount,
      accountId: transactionData.accountId || transactionData.account_id,
      location: transactionData.location,
      timestamp: transactionData.timestamp || new Date().toISOString(),
      ...transactionData
    };

    transaction.source = transaction.source || 'firebase';

    const services = {
      metrics,
      velocityCache,
    };

    const start = Date.now();
    const result = executeWorkflow(activeWorkflow, transaction, services);
    const latency = Date.now() - start;

    // Update metrics
    metrics.incrementCounter(result.decision.status, transaction.amount);
    metrics.recordLatency(latency);

    // Create enriched transaction record
    const enriched = {
      id: transaction.id,
      transaction,
      decision: result.decision,
      history: result.history,
      processedAt: new Date().toISOString(),
      latency,
      source: transaction.source || 'firebase',
    };

    // Add to recent transactions and emit to frontend
    addRecentTransaction(enriched);
    io.emit('transaction:new', enriched);
    emitState();

    const transactionKey = key || transaction.id;
    if (transactionKey) {
      try {
        const baseRecord = {
          ...transactionData,
          id: transaction.id,
          decision: result.decision.status,
          decisionDetails: {
            status: result.decision.status,
            reason: result.decision.reason,
            ...(result.decision.severity ? { severity: result.decision.severity } : {}),
            ...(result.decision.metadata ? { metadata: result.decision.metadata } : {}),
          },
          decision_reason: result.decision.reason,
          history: result.history || [],
          latency_ms: latency,
          processedAt: enriched.processedAt,
          lastWorkflowRun: {
            workflowId: activeWorkflow.id,
            workflowName: activeWorkflow.name,
            executedAt: enriched.processedAt,
          },
          lastWorkflowResult: enriched,
        };

        await writeData(`/transactions/${transactionKey}`, baseRecord);
      } catch (persistError) {
        console.error(`Failed to persist decision for transaction ${transactionKey}:`, persistError);
      }
    } else {
      console.warn('Skipping decision persistence: missing transaction key');
    }

    // Print the decision in the terminal
    const statusEmoji = result.decision.status === 'APPROVE' ? '✅' :
                       result.decision.status === 'BLOCK' ? '🚫' : '⚠️';

    console.log(`\n${statusEmoji} DECISION: ${result.decision.status}`);
    console.log(`Reason: ${result.decision.reason}`);
    console.log(`Transaction ID: ${transaction.id}`);
    console.log(`Amount: $${transaction.amount}`);
    console.log(`Processing Time: ${latency}ms`);

    // Debug: Show workflow execution details
    if (result.history && result.history.length > 0) {
      console.log(`\nWorkflow Execution:`);
      result.history.forEach((step) => {
        const stepEmoji = step.status === 'CONTINUE' ? '→' :
                         step.status === 'FLAG' ? '⚠️' :
                         step.status === 'BLOCK' ? '🚫' : '✓';
        console.log(`  ${stepEmoji} ${step.label || step.type}: ${step.status} - ${step.reason || ''}`);
      });
    } else {
      console.log(`\n⚠️  Warning: No workflow nodes were executed!`);
      console.log(`   Active workflow has ${activeWorkflow.nodes?.length || 0} nodes`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('Error processing Firebase transaction through workflow:', error);
  }
}

// Start the watcher immediately (so its logs appear in the same terminal when nodemon runs)
let watcherStopFn = null;
startWatcher('/transactions', onFirebaseTransaction)
  .then((stopFn) => {
    watcherStopFn = stopFn;
  })
  .catch((err) => {
    console.error('Failed to start watcher:', err);
  });

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

process.on('SIGINT', () => {
  try {
    watcherStopFn && watcherStopFn();
  } catch (e) {
    console.warn('Error stopping watcher:', e);
  }
  try {
    process.exit(0);
  } catch (e) {
    process.exit(1);
  }
});