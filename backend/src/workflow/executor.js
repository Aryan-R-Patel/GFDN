import { nodeRegistry } from './nodes/index.js';

function sanitizeWorkflow(workflow) {
  if (!workflow || !Array.isArray(workflow.nodes)) {
    return [];
  }
  return workflow.nodes.filter((node) => nodeRegistry[node.type]);
}

export async function executeWorkflow(workflow, transaction, services) {
  const nodes = sanitizeWorkflow(workflow);
  const history = [];
  let decision = {
    status: 'APPROVE',
    reason: 'Default decision.',
  };

  for (const node of nodes) {
    const handler = nodeRegistry[node.type];
    if (!handler) continue;
    const result = await handler({
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

    // BLOCK immediately stops the workflow
    if (result.status === 'BLOCK') {
      decision = {
        status: 'BLOCK',
        reason: result.reason || `Blocked by ${node.label || node.type}`,
        triggeredBy: node.id,
      };
      break;
    }

    // APPROVE from DECISION node stops the workflow
    if (result.status === 'APPROVE' && node.type === 'DECISION') {
      decision = {
        status: 'APPROVE',
        reason: result.reason || `Approved by ${node.label || node.type}`,
        triggeredBy: node.id,
      };
      break;
    }

    // FLAG from DECISION node stops the workflow
    if (result.status === 'FLAG' && node.type === 'DECISION') {
      decision = {
        status: 'FLAG',
        reason: result.reason || `Flagged by ${node.label || node.type}`,
        triggeredBy: node.id,
      };
      break;
    }

    // For non-DECISION nodes, FLAG and APPROVE just continue to next node
  }

  if (decision.status !== 'BLOCK' && decision.status !== 'APPROVE' && decision.status !== 'FLAG') {
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
