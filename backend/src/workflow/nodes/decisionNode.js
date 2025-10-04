const defaultConfig = {
  autoApproveBelow: 40,
  escalateOnFlag: true,
};

function findLatestRisk(history) {
  const reversed = [...history].reverse();
  for (const record of reversed) {
    const risk = record.metadata?.riskScore;
    if (typeof risk === 'number') return risk;
  }
  return null;
}

export default function decisionNode({ history = [], config = {} }) {
  const { autoApproveBelow, escalateOnFlag } = { ...defaultConfig, ...config };
  const riskScore = findLatestRisk(history);
  const hasFlag = history.some((item) => item.status === 'FLAG');
  const hasBlock = history.some((item) => item.status === 'BLOCK');

  if (hasBlock) {
    return {
      status: 'BLOCK',
      reason: 'Decision node confirms upstream block.',
    };
  }

  if (hasFlag && escalateOnFlag) {
    return {
      status: 'FLAG',
      reason: 'Decision node escalating flagged transaction for review.',
      metadata: {
        escalated: true,
        riskScore,
      },
    };
  }

  if (typeof riskScore === 'number' && riskScore < autoApproveBelow) {
    return {
      status: 'APPROVE',
      reason: `Risk score ${riskScore} below auto-approve threshold (${autoApproveBelow}).`,
    };
  }

  return {
    status: hasFlag ? 'FLAG' : 'APPROVE',
    reason: hasFlag ? 'Flags present but auto approval not permitted.' : 'Decision node approval.',
    metadata: {
      riskScore,
    },
  };
}
