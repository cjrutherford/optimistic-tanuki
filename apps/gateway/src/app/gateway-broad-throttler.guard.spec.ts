import { GatewayBroadThrottlerGuard } from './gateway-broad-throttler.guard';

describe('GatewayBroadThrottlerGuard', () => {
  it('leaves websocket contexts to their websocket guards', async () => {
    const guard = Object.create(GatewayBroadThrottlerGuard.prototype) as any;
    guard.shouldSkip = jest.fn();
    guard.getRequestResponse = jest.fn();
    guard.storageService = { increment: jest.fn() };

    await expect(
      guard.canActivate({ getType: () => 'ws' } as any)
    ).resolves.toBe(true);
    expect(guard.shouldSkip).not.toHaveBeenCalled();
    expect(guard.getRequestResponse).not.toHaveBeenCalled();
    expect(guard.storageService.increment).not.toHaveBeenCalled();
  });

  it('uses independent socket-peer buckets and ignores route throttle overrides', async () => {
    const previousProfile = process.env.THROTTLER_PROFILE;
    const previousNodeEnv = process.env.NODE_ENV;
    delete process.env.THROTTLER_PROFILE;
    process.env.NODE_ENV = 'production';

    try {
      const guard = Object.create(GatewayBroadThrottlerGuard.prototype) as any;
      const increment = jest.fn().mockResolvedValue({
        totalHits: 1,
        timeToExpire: 1000,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
      guard.shouldSkip = jest.fn().mockResolvedValue(false);
      const response = { header: jest.fn(), setHeader: jest.fn() };
      guard.getRequestResponse = jest.fn().mockReturnValue({
        req: {
          socket: { remoteAddress: '10.1.2.3' },
          headers: { 'x-forwarded-for': '203.0.113.77' },
        },
        res: response,
      });
      guard.storageService = { increment };
      guard.generateKey = jest.fn(
        (_context, tracker, name) => `${name}:${tracker}`
      );

      const context = {
        getType: () => 'http',
        getClass: () => ({ name: 'PrivacyController' }),
        getHandler: () => ({ name: 'reportContent' }),
        switchToHttp: () => ({}),
      } as any;

      await guard.canActivate(context);

      expect(increment).toHaveBeenCalledTimes(3);
      expect(increment).toHaveBeenNthCalledWith(
        1,
        'network_short:ip:10.1.2.3',
        1000,
        100,
        1000,
        'network_short'
      );
      expect(increment).toHaveBeenNthCalledWith(
        3,
        'network_long:ip:10.1.2.3',
        60000,
        1200,
        60000,
        'network_long'
      );
      expect(response.header).toHaveBeenCalledWith(
        'X-RateLimit-network_long-Limit',
        1200
      );
    } finally {
      if (previousProfile === undefined) delete process.env.THROTTLER_PROFILE;
      else process.env.THROTTLER_PROFILE = previousProfile;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
