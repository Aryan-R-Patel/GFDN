import { jest } from '@jest/globals';
import geminiCheck, { __resetGeminiState } from '../src/workflow/nodes/geminiCheck.js';

describe('Gemini AI check node', () => {
  const transaction = {
    id: 'txn-1',
    amount: 1250,
    currency: 'USD',
    origin: { country: 'US', deviceId: 'device-1' },
    destination: { country: 'GB' },
    metadata: { paymentMethod: 'card' },
    timestamp: new Date().toISOString(),
  };
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.GEMINI_API_KEY;
    __resetGeminiState();
  });

  afterEach(() => {
    if (originalKey) {
      process.env.GEMINI_API_KEY = originalKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    jest.restoreAllMocks();
  });

  test('falls back gracefully when Gemini is unavailable', async () => {
    const metrics = { recordRisk: jest.fn(), increment: jest.fn() };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.GEMINI_API_KEY;

    const result = await geminiCheck({
      transaction,
      services: { metrics },
    });

    expect(result.status).toBe('FLAG');
    expect(result.metadata.aiError).toBe(true);
    expect(metrics.increment).toHaveBeenCalledWith('geminiError');
    expect(warnSpy).toHaveBeenCalled();
  });

  test('uses Gemini output when provided via services', async () => {
    const metrics = { recordRisk: jest.fn(), increment: jest.fn() };
    const payload = {
      score: 78,
      verdict: 'FLAG',
      reason: 'Velocity and geography mismatch.',
      signals: ['High amount', 'Cross-border origin/destination'],
    };
    const mockModel = {
      generateContent: jest.fn().mockResolvedValue({
        response: Promise.resolve({
          text: () => JSON.stringify(payload),
        }),
      }),
    };

    const result = await geminiCheck({
      transaction,
      config: { flagThreshold: 60, blockThreshold: 90 },
      services: { metrics, geminiModel: mockModel },
    });

    expect(mockModel.generateContent).toHaveBeenCalledTimes(1);
    const prompt = mockModel.generateContent.mock.calls[0][0];
    expect(prompt).toContain('Transaction JSON');
    expect(metrics.recordRisk).toHaveBeenCalledWith(78);
    expect(metrics.increment).toHaveBeenCalledWith('geminiFlag');
    expect(result.status).toBe('FLAG');
    expect(result.metadata.aiScore).toBe(78);
    expect(result.metadata.aiSignals).toContain('High amount');
  });

  test('enters cooldown on rate limit and skips subsequent calls', async () => {
    const metrics = { recordRisk: jest.fn(), increment: jest.fn() };
    const warn = jest.fn();
    const rateLimitError = new Error('Quota exceeded. Please retry in 10.5s.');
    rateLimitError.status = 429;

    const rejectingModel = {
      generateContent: jest.fn().mockRejectedValue(rateLimitError),
    };

    const firstResult = await geminiCheck({
      transaction,
      services: { metrics, geminiModel: rejectingModel, logger: { warn } },
    });

    expect(firstResult.status).toBe('FLAG');
    expect(metrics.increment).toHaveBeenCalledWith('geminiError');
    expect(warn).toHaveBeenCalled();
  expect(rejectingModel.generateContent).toHaveBeenCalledTimes(1);

    metrics.increment.mockClear();

    const secondResult = await geminiCheck({
      transaction,
      services: { metrics, geminiModel: rejectingModel },
    });

    expect(secondResult.reason).toContain('skipped due to rate limiting');
    expect(metrics.increment).toHaveBeenCalledWith('geminiCooldownSkip');
    expect(rejectingModel.generateContent).toHaveBeenCalledTimes(1);
  });
});
