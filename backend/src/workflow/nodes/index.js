import geoCheck from './geoCheck.js';
import velocityCheck from './velocityCheck.js';
import anomalyDetection from './anomalyDetection.js';
import decisionNode from './decisionNode.js';

export const nodeRegistry = {
  GEO_CHECK: geoCheck,
  VELOCITY_CHECK: velocityCheck,
  AI_ANOMALY: anomalyDetection,
  DECISION: decisionNode,
};

export const queueOrdering = ['GEO_CHECK', 'VELOCITY_CHECK', 'AI_ANOMALY', 'DECISION'];
