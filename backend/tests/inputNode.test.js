import inputNode from '../src/workflow/nodes/inputNode.js';

describe('Input Node', () => {
  let mockServices;

  beforeEach(() => {
    mockServices = {
      metrics: {
        increment: jest.fn(),
      },
    };
  });

  it('should accept a valid transaction and return CONTINUE', () => {
    const transaction = {
      id: 'tx-12345',
      amount: 500,
      origin: { country: 'US' },
      destination: { country: 'CA' },
      timestamp: Date.now(),
    };

    const result = inputNode({ transaction, services: mockServices });

    expect(result.status).toBe('CONTINUE');
    expect(result.reason).toBe('Transaction received and validated.');
    expect(result.metadata.transactionId).toBe('tx-12345');
    expect(result.metadata.entryTime).toBeDefined();
    expect(mockServices.metrics.increment).toHaveBeenCalledWith('transactionReceived');
  });

  it('should block when no transaction data is provided', () => {
    const result = inputNode({ transaction: null, services: mockServices });

    expect(result.status).toBe('BLOCK');
    expect(result.reason).toBe('No transaction data provided to input node.');
    expect(result.severity).toBe('critical');
  });

  it('should block when transaction is missing required ID field', () => {
    const transaction = {
      amount: 500,
      origin: { country: 'US' },
    };

    const result = inputNode({ transaction, services: mockServices });

    expect(result.status).toBe('BLOCK');
    expect(result.reason).toBe('Transaction missing required ID field.');
    expect(result.severity).toBe('critical');
  });

  it('should skip validation when validateTransaction is false', () => {
    const transaction = {
      amount: 500,
      // Missing id field
    };

    const config = { validateTransaction: false };
    const result = inputNode({ transaction, config, services: mockServices });

    expect(result.status).toBe('CONTINUE');
  });

  it('should skip logging when logEntry is false', () => {
    const transaction = {
      id: 'tx-12345',
      amount: 500,
    };

    const config = { logEntry: false };
    const result = inputNode({ transaction, config, services: mockServices });

    expect(result.status).toBe('CONTINUE');
    expect(mockServices.metrics.increment).not.toHaveBeenCalled();
  });

  it('should work without metrics service', () => {
    const transaction = {
      id: 'tx-12345',
      amount: 500,
    };

    const result = inputNode({ transaction, services: {} });

    expect(result.status).toBe('CONTINUE');
    expect(result.metadata.transactionId).toBe('tx-12345');
  });
});
