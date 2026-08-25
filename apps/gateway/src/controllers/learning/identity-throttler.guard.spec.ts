import { IdentityThrottlerGuard } from './identity-throttler.guard';

/**
 * The guard exists to change what the limit is counted against. A test that
 * only checked it returned a string would pass on the default guard too, so
 * these check the tracker actually keys on the signed-in user.
 */
describe('IdentityThrottlerGuard', () => {
  // getTracker is protected, which is the point of it being an override.
  const trackerOf = (guard: IdentityThrottlerGuard, req: unknown) =>
    (
      guard as unknown as {
        getTracker(req: unknown): Promise<string>;
      }
    ).getTracker(req);

  let guard: IdentityThrottlerGuard;

  beforeEach(() => {
    guard = Object.create(
      IdentityThrottlerGuard.prototype
    ) as IdentityThrottlerGuard;
    // The base implementation is what the fallback delegates to.
    Object.getPrototypeOf(IdentityThrottlerGuard.prototype).getTracker = (req: {
      ip?: string;
    }) => Promise.resolve(req.ip ?? 'unknown');
  });

  it('counts a signed-in learner against their own id', async () => {
    const tracker = await trackerOf(guard, {
      ip: '10.0.0.1',
      user: { userId: 'user-1' },
    });

    expect(tracker).toBe('user:user-1');
  });

  it('gives two learners behind one address separate allowances', async () => {
    const shared = '10.0.0.1';
    const first = await trackerOf(guard, {
      ip: shared,
      user: { userId: 'user-1' },
    });
    const second = await trackerOf(guard, {
      ip: shared,
      user: { userId: 'user-2' },
    });

    expect(first).not.toBe(second);
  });

  it('follows one learner across addresses', async () => {
    const atHome = await trackerOf(guard, {
      ip: '10.0.0.1',
      user: { userId: 'user-1' },
    });
    const atWork = await trackerOf(guard, {
      ip: '192.168.0.9',
      user: { userId: 'user-1' },
    });

    expect(atHome).toBe(atWork);
  });

  it('falls back to the address when nobody is signed in', async () => {
    expect(await trackerOf(guard, { ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });

  it('does not treat a malformed user as an identity', async () => {
    for (const user of [{}, { userId: '' }, { userId: 42 }, null]) {
      expect(await trackerOf(guard, { ip: '10.0.0.1', user })).toBe(
        'ip:10.0.0.1'
      );
    }
  });

  it('cannot let a user id collide with an address', async () => {
    const spoofed = await trackerOf(guard, {
      ip: '10.0.0.1',
      user: { userId: '10.0.0.1' },
    });

    expect(spoofed).toBe('user:10.0.0.1');
    expect(spoofed).not.toBe('ip:10.0.0.1');
  });
});
