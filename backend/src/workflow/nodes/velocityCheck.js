const defaultConfig = {
  windowMs: 60_000,
  maxPerWindow: 5,
  identifier: 'deviceId',
  flagOnly: false,
};

function pickIdentifier(transaction, identifier) {
  switch (identifier) {
    case 'deviceId':
      return transaction.origin?.deviceId;
    case 'originAccount':
      return transaction.origin?.account;
    case 'destinationAccount':
      return transaction.destination?.account;
    default:
      return transaction.origin?.deviceId || transaction.origin?.account || transaction.destination?.account;
  }
}

export default function velocityCheck({ transaction, config = {}, services }) {
  const { windowMs, maxPerWindow, identifier, flagOnly } = { ...defaultConfig, ...config };
  const cache = services.velocityCache;
  const id = pickIdentifier(transaction, identifier);

  if (!id) {
    return {
      status: 'CONTINUE',
      reason: 'Velocity Check skipped (missing identifier).',
    };
  }

  const now = Date.now();
  const timestamps = cache.get(id) || [];
  const filtered = timestamps.filter((ts) => now - ts <= windowMs);
  filtered.push(now);
  cache.set(id, filtered);

  if (filtered.length > maxPerWindow) {
    services.metrics?.increment('velocityAlert');
    return {
      status: flagOnly ? 'FLAG' : 'BLOCK',
      reason: `Velocity threshold exceeded: ${filtered.length} in ${(windowMs / 1000).toFixed(0)}s`,
      severity: flagOnly ? 'medium' : 'high',
      metadata: {
        count: filtered.length,
        threshold: maxPerWindow,
        identifier: id,
      },
    };
  }

  if (filtered.length === maxPerWindow) {
    services.metrics?.increment('velocityWarn');
    return {
      status: 'FLAG',
      reason: `Approaching velocity threshold (${filtered.length}/${maxPerWindow}).`,
      severity: 'medium',
      metadata: {
        count: filtered.length,
        threshold: maxPerWindow,
        identifier: id,
      },
    };
  }

  return {
    status: 'CONTINUE',
    reason: 'Velocity within acceptable range.',
  };
}
