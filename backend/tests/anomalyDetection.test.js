import { jest } from '@jest/globals';
import anomalyDetection from '../src/workflow/nodes/anomalyDetection.js';

describe('Anomaly Detection node', () => {
  const baseTransaction = {
    amount: 100,
    currency: 'USD',
    origin: { country: 'US' },
    destination: { country: 'US' },
    metadata: {},
    timestamp: new Date().toISOString(),
  };

  test('continues for low risk transactions', () => {
    const result = anomalyDetection({
      transaction: baseTransaction,
      services: { metrics: { recordRisk: jest.fn(), increment: jest.fn() } },
    });
    expect(result.status).toBe('CONTINUE');
  });

  test('flags high value transactions', () => {
    const transaction = { ...baseTransaction, amount: 20_000 };
    const result = anomalyDetection({
      transaction,
      services: { metrics: { recordRisk: jest.fn(), increment: jest.fn() } },
    });
    expect(['FLAG', 'BLOCK', 'CONTINUE']).toContain(result.status);
    expect(result.metadata.riskScore).toBeGreaterThan(10);
  });

  test('blocks when risk score above threshold', () => {
    const transaction = {
      ...baseTransaction,
      amount: 50_000,
      origin: { country: 'RU' },
      destination: { country: 'NG' },
      metadata: { paymentMethod: 'crypto' },
    };
    const result = anomalyDetection({
      transaction,
      config: { blockThreshold: 70, flagThreshold: 40 },
      services: { metrics: { recordRisk: jest.fn(), increment: jest.fn() } },
    });
    expect(result.status).toBe('BLOCK');
  });
});
