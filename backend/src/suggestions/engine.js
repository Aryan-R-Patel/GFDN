import { v4 as uuid } from 'uuid';

export function generateSuggestions({ metrics, recentTransactions, workflow }) {
  const suggestions = [];
  const snapshot = metrics.snapshot();

  if (snapshot.totals.blocked > snapshot.totals.approved * 0.4) {
    suggestions.push({
      id: uuid(),
      priority: 'high',
      title: 'High block rate detected',
      body:
        'More than 40% of transactions are being blocked. Consider adding a behavioral check or lowering the velocity threshold to reduce false positives.',
      action: {
        type: 'WORKFLOW_HINT',
        data: {
          nodeType: 'VELOCITY_CHECK',
          recommendedConfig: {
            maxPerWindow: 7,
            flagOnly: true,
          },
        },
      },
    });
  }

  const avgRisk = snapshot.risk.averageScore;
  if (avgRisk > 65) {
    suggestions.push({
      id: uuid(),
      priority: 'medium',
      title: 'Elevated anomaly scores',
      body:
        'Average anomaly scores exceed 65. Add a secondary decision branch that requests manual review for high amounts instead of blocking outright.',
      action: {
        type: 'WORKFLOW_HINT',
        data: {
          nodeType: 'DECISION',
          recommendedConfig: {
            escalateOnFlag: true,
            autoApproveBelow: 35,
          },
        },
      },
    });
  }

  const flaggedFromEurope = recentTransactions
    .filter((txn) => txn.decision.status === 'BLOCK' || txn.decision.status === 'FLAG')
    .filter((txn) => txn.transaction.origin?.region === 'Europe').length;

  if (flaggedFromEurope >= 5) {
    suggestions.push({
      id: uuid(),
      priority: 'medium',
      title: 'European traffic experiencing friction',
      body:
        'Geo checks are impacting legitimate European traffic. Consider widening the allowedCountries list or inserting a velocity check before the geo block.',
      action: {
        type: 'WORKFLOW_HINT',
        data: {
          nodeType: 'GEO_CHECK',
          recommendedConfig: {
            allowedCountries: ['US', 'CA', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL'],
            action: 'FLAG',
          },
        },
      },
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: uuid(),
      priority: 'low',
      title: 'All systems normal',
      body: 'Current workflows are performing within expected thresholds. Keep monitoring for anomalies.',
      action: { type: 'INFO' },
    });
  }

  return suggestions;
}
