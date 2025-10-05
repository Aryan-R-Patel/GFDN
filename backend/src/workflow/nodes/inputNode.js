/**
 * Input Node - Entry point for all transactions in the workflow
 * This node receives the transaction and passes it through without modification.
 * It serves as the starting point that all workflows must begin with.
 */

const defaultConfig = {
  validateTransaction: true,
  logEntry: true,
};

export default function inputNode({ transaction, config = {}, services }) {
  const { validateTransaction, logEntry } = {
    ...defaultConfig,
    ...config,
  };

  // Basic validation if enabled
  if (validateTransaction) {
    if (!transaction) {
      return {
        status: 'BLOCK',
        reason: 'No transaction data provided to input node.',
        severity: 'critical',
      };
    }

    if (!transaction.id) {
      return {
        status: 'BLOCK',
        reason: 'Transaction missing required ID field.',
        severity: 'critical',
      };
    }
  }

  // Log the transaction entry if enabled
  if (logEntry && services.metrics) {
    services.metrics.increment('transactionReceived');
  }

  // Pass through to next node
  return {
    status: 'CONTINUE',
    reason: 'Transaction received and validated.',
    metadata: {
      entryTime: Date.now(),
      transactionId: transaction.id,
    },
  };
}
