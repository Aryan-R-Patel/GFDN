import { jest } from '@jest/globals';
import geoCheck from '../src/workflow/nodes/geoCheck.js';

const buildTransaction = (originCountry, destinationCountry) => ({
  origin: { country: originCountry },
  destination: { country: destinationCountry },
});

describe('Geo Check node', () => {
  test('passes when countries are allowed', () => {
    const transaction = buildTransaction('US', 'CA');
    const result = geoCheck({ transaction, services: {} });
    expect(result.status).toBe('CONTINUE');
  });

  test('flags when action is FLAG and outside region', () => {
    const transaction = buildTransaction('RU', 'US');
    const services = { metrics: { increment: jest.fn() } };
    const result = geoCheck({
      transaction,
      services,
      config: { allowedCountries: ['US', 'CA'], action: 'FLAG' },
    });
    expect(result.status).toBe('FLAG');
    expect(result.reason).toMatch(/Geo Check triggered/);
    expect(services.metrics.increment).toHaveBeenCalledWith('geoAlert');
  });

  test('blocks when outside allowed countries', () => {
    const transaction = buildTransaction('RU', 'CN');
    const result = geoCheck({
      transaction,
      services: { metrics: { increment: jest.fn() } },
      config: { allowedCountries: ['US'] },
    });
    expect(result.status).toBe('BLOCK');
  });
});
