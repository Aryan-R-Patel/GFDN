import { jest } from '@jest/globals';
import velocityCheck from '../src/workflow/nodes/velocityCheck.js';

describe('Velocity Check node', () => {
  const buildTransaction = (id) => ({
    origin: { deviceId: `device-${id}`, account: `acct-${id}` },
    destination: { account: `acct-dst-${id}` },
  });

  test('continues when under threshold', () => {
    const services = { velocityCache: new Map(), metrics: { increment: jest.fn() } };
    const transaction = buildTransaction(1);
    const result = velocityCheck({ transaction, config: { maxPerWindow: 3 }, services });
    expect(result.status).toBe('CONTINUE');
  });

  test('flags one step before block threshold', () => {
    const services = { velocityCache: new Map(), metrics: { increment: jest.fn() } };
    const transaction = buildTransaction(2);
    const result = velocityCheck({
      transaction,
      config: { maxPerWindow: 3 },
      services,
    });
    expect(result.status).toBe('CONTINUE');

    velocityCheck({ transaction, config: { maxPerWindow: 3 }, services });
    const warnResult = velocityCheck({ transaction, config: { maxPerWindow: 3 }, services });
    expect(warnResult.status).toBe('FLAG');
    expect(warnResult.metadata.count).toBeGreaterThanOrEqual(3);
  });

  test('blocks when exceeding threshold without flagOnly', () => {
    const services = { velocityCache: new Map(), metrics: { increment: jest.fn() } };
    const transaction = buildTransaction(3);
    for (let i = 0; i < 6; i += 1) {
      velocityCheck({
        transaction,
        config: { maxPerWindow: 2, windowMs: 10_000 },
        services,
      });
    }
    const result = velocityCheck({
      transaction,
      config: { maxPerWindow: 2, windowMs: 10_000 },
      services,
    });
    expect(result.status).toBe('BLOCK');
  });
});
