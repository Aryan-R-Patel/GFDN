import inputNode from './inputNode.js';
import geoCheck from './geoCheck.js';
import velocityCheck from './velocityCheck.js';
import anomalyDetection from './anomalyDetection.js';
import decisionNode from './decisionNode.js';
import geminiCheck from './geminiCheck.js';

export const nodeRegistry = {
  INPUT: inputNode,
  GEO_CHECK: geoCheck,
  VELOCITY_CHECK: velocityCheck,
  ANOMALY_CHECK: anomalyDetection,
  GEMINI_CHECK: geminiCheck,
  DECISION: decisionNode,
};

export const queueOrdering = [
  'INPUT',
  'GEO_CHECK',
  'VELOCITY_CHECK',
  'ANOMALY_CHECK',
  'GEMINI_CHECK',
  'DECISION',
];
