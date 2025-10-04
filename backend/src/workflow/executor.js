import { nodeRegistry } from './nodes/index.js';

function sanitizeWorkflow(workflow) {
  if (!workflow || !Array.isArray(workflow.nodes)) {
    return [];
  }
  return workflow.nodes.filter((node) => nodeRegistry[node.type]);
}

export function executeWorkflow(workflow, transaction, services) {
  const nodes = sanitizeWorkflow(workflow);
  const history = [];
  let decision = {
    status: 'APPROVE',
    reason: 'Default decision.',
  };

  for (const node of nodes) {
    const handler = nodeRegistry[node.type];
    if (!handler) continue;
    const result = handler({
      transaction,
      config: node.config,
      services,
      history,
    });

    const normalized = {
      nodeId: node.id,
      label: node.label,
      type: node.type,
      ...result,
    };
    history.push(normalized);

    if (result.status === 'BLOCK') {
      decision = {
        status: 'BLOCK',
        reason: result.reason || `Blocked by ${node.label || node.type}`,
        triggeredBy: node.id,
      };
      break;
    }

    if (result.status === 'APPROVE') {
      decision = {
        status: 'APPROVE',
        reason: result.reason || `Approved by ${node.label || node.type}`,
        triggeredBy: node.id,
      };
      break;
    }
  }

  if (decision.status !== 'BLOCK' && decision.status !== 'APPROVE') {
    const flaggedNodes = history.filter((item) => item.status === 'FLAG');
    if (flaggedNodes.length > 0) {
      decision = {
        status: 'FLAG',
        reason: flaggedNodes.map((item) => item.reason).join(' | ') || 'Flagged for review.',
        triggeredBy: flaggedNodes.map((item) => item.nodeId),
      };
    } else {
      decision = {
        status: 'APPROVE',
        reason: 'All nodes returned CONTINUE.',
      };
    }
  }

  return {
    decision,
    history,
  };
}
