import { gatewayThrottleLimits, gatewayWriteLimit } from './throttler-config';

describe('gatewayThrottleLimits', () => {
  it('uses bounded production defaults', () => {
    expect(gatewayThrottleLimits({ NODE_ENV: 'production' } as any)).toEqual([
      { name: 'short', ttl: 1000, limit: 100 },
      { name: 'medium', ttl: 10000, limit: 300 },
      { name: 'long', ttl: 60000, limit: 1200 },
    ]);
  });

  it('allows an explicit bounded relaxed profile outside production', () => {
    expect(
      gatewayThrottleLimits({
        THROTTLER_PROFILE: 'relaxed',
        NODE_ENV: 'test',
      } as any)
    ).toEqual([
      { name: 'short', ttl: 1000, limit: 1000 },
      { name: 'medium', ttl: 10000, limit: 5000 },
      { name: 'long', ttl: 60000, limit: 20000 },
    ]);
  });

  it('rejects relaxed profile in production and unbounded overrides', () => {
    expect(() =>
      gatewayThrottleLimits({
        THROTTLER_PROFILE: 'relaxed',
        NODE_ENV: 'production',
      } as any)
    ).toThrow('requires NODE_ENV=development or test');
    expect(() =>
      gatewayThrottleLimits({ THROTTLER_PROFILE: 'relaxed' } as any)
    ).toThrow('requires NODE_ENV=development or test');
    expect(() =>
      gatewayThrottleLimits({ THROTTLE_LONG_LIMIT: '1000000' } as any)
    ).toThrow('between 1 and 40000');
  });

  it('applies the explicit profile to write limits with a hard ceiling', () => {
    expect(
      gatewayWriteLimit('THROTTLE_REPORT_LIMIT', 10, 100, 500, {
        THROTTLER_PROFILE: 'relaxed',
        NODE_ENV: 'test',
      } as any)
    ).toBe(100);
    expect(() =>
      gatewayWriteLimit('THROTTLE_REPORT_LIMIT', 10, 100, 500, {
        THROTTLE_REPORT_LIMIT: '501',
      } as any)
    ).toThrow('between 1 and 500');
  });

  it('keeps chat websocket write limits bounded across production and relaxed profiles', () => {
    expect(
      gatewayWriteLimit('THROTTLE_CHAT_WRITE_LIMIT', 60, 1000, 2000, {
        NODE_ENV: 'production',
      } as any)
    ).toBe(60);
    expect(
      gatewayWriteLimit('THROTTLE_CHAT_WRITE_LIMIT', 60, 1000, 2000, {
        THROTTLER_PROFILE: 'relaxed',
        NODE_ENV: 'test',
      } as any)
    ).toBe(1000);
    expect(() =>
      gatewayWriteLimit('THROTTLE_CHAT_WRITE_LIMIT', 60, 1000, 2000, {
        THROTTLE_CHAT_WRITE_LIMIT: '2001',
      } as any)
    ).toThrow('between 1 and 2000');
  });
});
