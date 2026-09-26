jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomInt: jest.fn(actual.randomInt),
    timingSafeEqual: jest.fn(actual.timingSafeEqual),
  };
});

import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as crypto from 'crypto';
import {
  DEFAULT_OTP_TENANT_ID,
  InMemoryOtpChallengeStore,
  TimeLockedOtpService,
} from '../index';
import { TimeLockedOtpGuard } from './time-locked-otp.guard';

type Clock = () => number;
type SecretResolver = (
  tokenId: string
) => Promise<string | undefined> | string | undefined;
type GuardConstructor = new (
  reflector: Reflector,
  service?: TimeLockedOtpService,
  secretResolver?: SecretResolver
) => TimeLockedOtpGuard;

type Harness = {
  service: TimeLockedOtpService;
  store: InMemoryOtpChallengeStore;
  messages: string[];
  issue: (tokenId: string, validitySeconds?: number) => Promise<string>;
};

function createHarness(clock: Clock = Date.now): Harness {
  const store = new InMemoryOtpChallengeStore();
  const messages: string[] = [];
  const dispatcher = {
    dispatchOtp: async ({ code }: { code: string }) => {
      messages.push(code);
      return { messageId: `message-${messages.length}` };
    },
  };
  const service = new TimeLockedOtpService(store, dispatcher, clock);
  return {
    service,
    store,
    messages,
    issue: async (tokenId, validitySeconds = 60) => {
      await service.generateOtp({
        tokenId,
        tenantId: DEFAULT_OTP_TENANT_ID,
        purpose: 'time-locked-otp',
        phoneNumber: '+15555550100',
        validitySeconds,
      });
      return messages[messages.length - 1];
    },
  };
}

function createGuard(
  reflector: Reflector,
  service: TimeLockedOtpService,
  secretResolver?: SecretResolver
): TimeLockedOtpGuard {
  const Constructor = TimeLockedOtpGuard as unknown as GuardConstructor;
  return new Constructor(reflector, service, secretResolver);
}

function createContext(request: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

function invokeGuard(
  guard: TimeLockedOtpGuard,
  context: ExecutionContext
): Promise<boolean> {
  return Promise.resolve().then(() => guard.canActivate(context));
}

describe('TimeLockedOtpGuard & Service', () => {
  let service: TimeLockedOtpService;
  let guard: TimeLockedOtpGuard;
  let reflector: Reflector;
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
    service = harness.service;
    reflector = new Reflector();
    guard = createGuard(reflector, service);
  });

  it('generates and validates session OTPs within validity window', async () => {
    const code = await harness.issue('escrow-token-42');
    expect(code).toHaveLength(6);
    expect(await service.verifyOtp('escrow-token-42', code)).toBe(true);
    expect(await service.verifyOtp('escrow-token-42', code)).toBe(false);
  });

  it('returns an independent expiresAt Date from the stored OTP session', async () => {
    let now = 1700000000000;
    const clocked = createHarness(() => now);
    const issued = await clocked.service.generateOtp({
      tokenId: 'independent-date-token',
      tenantId: DEFAULT_OTP_TENANT_ID,
      purpose: 'time-locked-otp',
      phoneNumber: '+15555550100',
      validitySeconds: 60,
    });

    issued.expiresAt.setTime(now + 600000);
    now += 60001;
    expect(
      await clocked.service.verifyOtp(
        'independent-date-token',
        clocked.messages[0]
      )
    ).toBe(false);
  });

  it.each([NaN, Infinity, -1, 0, 1.5, 15 * 60 + 1, Number.MAX_SAFE_INTEGER])(
    'rejects invalid OTP lifetime %s',
    async (validitySeconds) => {
      await expect(
        service.generateOtp({
          tokenId: 'invalid-validity',
          tenantId: DEFAULT_OTP_TENANT_ID,
          purpose: 'time-locked-otp',
          phoneNumber: '+15555550100',
          validitySeconds,
        })
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  );

  it('uses a cryptographically random six-digit session OTP', async () => {
    const randomIntMock = crypto.randomInt as jest.MockedFunction<
      typeof crypto.randomInt
    >;
    randomIntMock.mockClear();
    const code = await harness.issue('random-token');

    expect(code).toMatch(/^\d{6}$/);
    expect(Number(code)).toBeGreaterThanOrEqual(0);
    expect(Number(code)).toBeLessThan(1000000);
    expect(randomIntMock).toHaveBeenCalledWith(0, 1000000);
  });

  it('uses constant-time comparison for session OTPs', async () => {
    const timingSafeEqualMock = crypto.timingSafeEqual as jest.MockedFunction<
      typeof crypto.timingSafeEqual
    >;
    timingSafeEqualMock.mockClear();
    const code = await harness.issue('constant-time-token');

    expect(await service.verifyOtp('constant-time-token', code)).toBe(true);
    expect(timingSafeEqualMock).toHaveBeenCalled();
  });

  it('uses a 30-second RFC 6238 step and one-step drift by default', async () => {
    const secret = 'title-escrow-secret-key';
    const previousCode = service.generateRollingTotp(secret, 30, -1);
    const currentCode = service.generateRollingTotp(secret, 30);
    const nextCode = service.generateRollingTotp(secret, 30, 1);

    expect(await service.verifyRollingTotp(secret, previousCode)).toBe(true);
    expect(await service.verifyRollingTotp(secret, currentCode)).toBe(true);
    expect(await service.verifyRollingTotp(secret, nextCode)).toBe(true);
  });

  it('supports an explicitly selected TOTP step', async () => {
    const secret = 'title-escrow-secret-key';
    const code = service.generateRollingTotp(secret, 60);

    expect(await service.verifyRollingTotp(secret, code, 60)).toBe(true);
    expect(await service.verifyRollingTotp(secret, '000000', 60)).toBe(false);
  });

  it('rejects replay of an accepted rolling step', async () => {
    const secret = 'replay-secret';
    const code = service.generateRollingTotp(secret);

    expect(await service.verifyOtp('replay-token', code, secret)).toBe(true);
    expect(await service.verifyOtp('replay-token', code, secret)).toBe(false);
  });

  it('bounds accepted TOTP replay state and removes expired entries', async () => {
    let now = 1700000000000;
    const clocked = createHarness(() => now);
    for (let index = 0; index < 1000; index += 1) {
      const secret = `replay-secret-${index}`;
      const code = clocked.service.generateRollingTotp(secret);
      expect(
        await clocked.service.verifyOtp(`replay-token-${index}`, code, secret)
      ).toBe(true);
    }

    expect(await clocked.service.getTotpReplayStateCount()).toBeLessThanOrEqual(
      1000
    );
    now += 300001;
    expect(await clocked.service.getTotpReplayStateCount()).toBe(0);
  });

  it('rejects lower counters and long-window replays beyond the base marker TTL', async () => {
    let now = 1700000000000;
    const clocked = createHarness(() => now);
    const secret = 'long-window-replay-secret';
    const currentCode = clocked.service.generateRollingTotp(secret, 300);
    const previousCode = clocked.service.generateRollingTotp(secret, 300, -1);

    expect(
      await clocked.service.verifyOtp(
        'long-window-token',
        currentCode,
        secret,
        300
      )
    ).toBe(true);
    expect(
      await clocked.service.verifyOtp(
        'long-window-token',
        previousCode,
        secret,
        300
      )
    ).toBe(false);

    now += 300001;
    expect(
      await clocked.service.verifyOtp(
        'long-window-token',
        currentCode,
        secret,
        300
      )
    ).toBe(false);
    expect(await clocked.service.getTotpReplayStateCount()).toBe(1);
  });

  it('prunes replay state only after its expiry', async () => {
    let now = 1700000000000;
    const clocked = createHarness(() => now);
    const secret = 'long-lived-replay-secret';
    const code = clocked.service.generateRollingTotp(secret);

    expect(
      await clocked.service.verifyOtp('long-lived-token', code, secret)
    ).toBe(true);
    now += 120000;
    expect(await clocked.service.getTotpReplayStateCount()).toBe(1);
    now += 180001;
    expect(await clocked.service.getTotpReplayStateCount()).toBe(0);
  });

  it('rejects new rolling verification when replay state is full without evicting live markers', async () => {
    let now = 1700000000000;
    const clocked = createHarness(() => now);
    const firstSecret = 'replay-capacity-first';
    const firstCode = clocked.service.generateRollingTotp(firstSecret);

    expect(
      await clocked.service.verifyOtp(
        'replay-capacity-0',
        firstCode,
        firstSecret
      )
    ).toBe(true);
    for (let index = 1; index < 1000; index += 1) {
      const secret = `replay-capacity-${index}`;
      const code = clocked.service.generateRollingTotp(secret);
      expect(
        await clocked.service.verifyOtp(
          `replay-capacity-${index}`,
          code,
          secret
        )
      ).toBe(true);
    }

    const overflowSecret = 'replay-capacity-overflow';
    const overflowCode = clocked.service.generateRollingTotp(overflowSecret);
    expect(
      await clocked.service.verifyOtp(
        'replay-capacity-overflow',
        overflowCode,
        overflowSecret
      )
    ).toBe(false);
    expect(await clocked.service.getTotpReplayStateCount()).toBe(1000);
    expect(
      await clocked.service.verifyOtp(
        'replay-capacity-0',
        firstCode,
        firstSecret
      )
    ).toBe(false);
  });

  it('rejects new failed-attempt state when full without evicting live lockouts', async () => {
    let now = 1700000000000;
    const clocked = createHarness(() => now);
    const firstSecret = 'failed-capacity-first';
    const firstValidCode = clocked.service.generateRollingTotp(firstSecret);
    const firstInvalidCode = firstValidCode === '000000' ? '000001' : '000000';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(
        await clocked.service.verifyOtp(
          'failed-capacity-0',
          firstInvalidCode,
          firstSecret
        )
      ).toBe(false);
    }
    for (let index = 1; index < 1000; index += 1) {
      const secret = `failed-capacity-${index}`;
      const validCode = clocked.service.generateRollingTotp(secret);
      const invalidCode = validCode === '000000' ? '000001' : '000000';
      expect(
        await clocked.service.verifyOtp(
          `failed-capacity-${index}`,
          invalidCode,
          secret
        )
      ).toBe(false);
    }

    const overflowSecret = 'failed-capacity-overflow';
    const overflowCode = clocked.service.generateRollingTotp(overflowSecret);
    expect(
      await clocked.service.verifyOtp(
        'failed-capacity-overflow',
        '000000',
        overflowSecret
      )
    ).toBe(false);
    expect(
      await clocked.service.verifyOtp(
        'failed-capacity-overflow',
        overflowCode,
        overflowSecret
      )
    ).toBe(false);
    expect(await clocked.service.getTotpFailedAttemptCount()).toBe(1000);
    expect(
      await clocked.service.verifyOtp(
        'failed-capacity-0',
        firstValidCode,
        firstSecret
      )
    ).toBe(false);

    now += 60001;
    const recoveredCode = clocked.service.generateRollingTotp(overflowSecret);
    expect(
      await clocked.service.verifyOtp(
        'failed-capacity-overflow',
        recoveredCode,
        overflowSecret
      )
    ).toBe(true);
  });

  it('rejects OTP issuance when active session state is full', async () => {
    const clocked = createHarness(() => 0);
    let firstCode = '';
    for (let index = 0; index < 1000; index += 1) {
      const code = await clocked.issue(`session-capacity-${index}`, 60);
      if (index === 0) firstCode = code;
    }

    await expect(
      clocked.issue('session-capacity-overflow', 60)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(await clocked.service.getActiveSessionCount()).toBe(1000);
    expect(
      await clocked.service.verifyOtp('session-capacity-0', firstCode)
    ).toBe(true);
  });

  it('does not reset another token replay state when issuing a new OTP', async () => {
    const now = 1700000000000;
    const clocked = createHarness(() => now);
    const secret = 'issuance-replay-secret';
    const code = clocked.service.generateRollingTotp(secret);

    expect(await clocked.service.verifyOtp('first-token', code, secret)).toBe(
      true
    );
    await clocked.issue('second-token', 60);
    expect(await clocked.service.verifyOtp('first-token', code, secret)).toBe(
      false
    );
  });

  it('locks rolling TOTP after repeated failures and recovers after expiry', async () => {
    let now = 1700000000000;
    const clocked = createHarness(() => now);
    const secret = 'failed-attempt-secret';
    const validCode = clocked.service.generateRollingTotp(secret);
    const invalidCode = validCode === '000000' ? '000001' : '000000';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect(
        await clocked.service.verifyOtp('failed-token', invalidCode, secret)
      ).toBe(false);
    }
    expect(
      await clocked.service.verifyOtp('failed-token', validCode, secret)
    ).toBe(false);

    now += 60001;
    const recoveredCode = clocked.service.generateRollingTotp(secret);
    expect(
      await clocked.service.verifyOtp('failed-token', recoveredCode, secret)
    ).toBe(true);
  });

  it('bounds and expires failed rolling-TOTP attempt state', async () => {
    let now = 1700000000000;
    const clocked = createHarness(() => now);
    for (let index = 0; index < 1005; index += 1) {
      const secret = `failed-secret-${index}`;
      const validCode = clocked.service.generateRollingTotp(secret);
      const invalidCode = validCode === '000000' ? '000001' : '000000';
      expect(
        await clocked.service.verifyOtp(
          `failed-token-${index}`,
          invalidCode,
          secret
        )
      ).toBe(false);
    }

    expect(
      await clocked.service.getTotpFailedAttemptCount()
    ).toBeLessThanOrEqual(1000);
    now += 60001;
    expect(await clocked.service.getTotpFailedAttemptCount()).toBe(0);
  });

  it('prunes expired sessions when issuing new OTPs', async () => {
    let now = Date.now();
    const clocked = createHarness(() => now);
    await clocked.issue('expired-session', 1);
    now += 2000;
    await clocked.issue('active-session', 60);

    expect(await clocked.service.getActiveSessionCount()).toBe(1);
  });

  it('bounds the number of active ephemeral sessions', async () => {
    const clocked = createHarness(() => 0);
    for (let index = 0; index < 1000; index += 1) {
      await clocked.issue(`bounded-session-${index}`, 60);
    }

    expect(await clocked.service.getActiveSessionCount()).toBe(1000);
  });

  it('does not accept a universal code without an issued session or secret', async () => {
    expect(await service.verifyOtp('arbitrary-token', '849201')).toBe(false);
  });

  it('does not derive a verification secret from the token identifier', async () => {
    const defaultSeedCode = service.generateRollingTotp(
      'vault-escrow-seed-arbitrary-token'
    );
    expect(await service.verifyOtp('arbitrary-token', defaultSeedCode)).toBe(
      false
    );
  });

  it('does not log raw token identifiers', async () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    await harness.issue('raw-token-identifier');
    expect(logSpy.mock.calls.flat().join(' ')).not.toContain(
      'raw-token-identifier'
    );
    logSpy.mockRestore();
  });

  it('fails closed when the execution context is missing', async () => {
    await expect(invokeGuard(guard, {} as ExecutionContext)).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('fails closed when the request context is missing', async () => {
    await expect(invokeGuard(guard, createContext(undefined))).rejects.toThrow(
      UnauthorizedException
    );
  });

  it('fails closed when the request token is missing', async () => {
    await expect(
      invokeGuard(
        guard,
        createContext({ headers: { 'x-otp-code': '123456' }, body: {} })
      )
    ).rejects.toThrow(UnauthorizedException);
  });

  it('fails closed when no explicit OTP service is configured', async () => {
    const Constructor = TimeLockedOtpGuard as unknown as new (
      reflector: Reflector
    ) => TimeLockedOtpGuard;
    const unconfiguredGuard = new Constructor(reflector);

    await expect(
      invokeGuard(
        unconfiguredGuard,
        createContext({
          headers: { 'x-otp-code': '123456' },
          body: {},
          params: { token: 'configured-token' },
        })
      )
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('does not read OTP or token values from the query string', async () => {
    const code = await harness.issue('query-token', 60);
    await expect(
      invokeGuard(
        guard,
        createContext({
          headers: {},
          body: {},
          query: { otpCode: code, token: 'query-token' },
        })
      )
    ).rejects.toThrow(UnauthorizedException);
  });

  it('honors the configured window and uses a server-side secret resolver', async () => {
    const secret = 'server-side-secret';
    const code = service.generateRollingTotp(secret, 60);
    const resolver: SecretResolver = jest.fn(async (tokenId) => {
      expect(tokenId).toBe('configured-token');
      return secret;
    });
    const configuredGuard = createGuard(reflector, service, resolver);
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue({ windowSeconds: 60 });
    const request = {
      headers: { 'x-otp-code': code, secret: 'client-secret' },
      body: { secret: 'client-secret' },
      params: { token: 'configured-token' },
    };

    await expect(
      invokeGuard(configuredGuard, createContext(request))
    ).resolves.toBe(true);
    expect(resolver).toHaveBeenCalledWith('configured-token');
  });

  it('throws UnauthorizedException when OTP is missing from request', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({});
    await expect(
      invokeGuard(
        guard,
        createContext({
          headers: {},
          body: {},
          params: { token: 'escrow-token-42' },
        })
      )
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws ForbiddenException when OTP is incorrect', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({});
    await expect(
      invokeGuard(
        guard,
        createContext({
          headers: { 'x-otp-code': '123456' },
          body: {},
          params: { token: 'escrow-token-42' },
        })
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('approves activation when a service-issued session OTP is provided', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({});
    const code = await harness.issue('escrow-token-42', 60);
    const request = {
      headers: { 'x-otp-code': code },
      body: {},
      params: { token: 'escrow-token-42' },
    };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request).toHaveProperty('otpVerified', true);
  });
});

describe('RFC 6238 TOTP', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

  it('decodes the RFC reference secret to the ASCII test key', () => {
    expect(TimeLockedOtpService.base32Decode(rfcSecret).toString('utf8')).toBe(
      '12345678901234567890'
    );
  });

  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ])('matches the RFC 6238 SHA-1 vector at t=%i', (seconds, expected) => {
    const harness = createHarness(() => seconds * 1000);
    const counter = Math.floor(seconds / 30);
    expect(harness.service.rfc6238TotpForCounter(rfcSecret, counter, 8)).toBe(
      expected
    );
  });

  it('derives the 6-digit code as the low 6 digits of the 8-digit code', () => {
    const harness = createHarness(() => 1234567890 * 1000);
    const counter = Math.floor(1234567890 / 30);
    expect(harness.service.rfc6238TotpForCounter(rfcSecret, counter, 6)).toBe(
      harness.service.rfc6238TotpForCounter(rfcSecret, counter, 8).slice(-6)
    );
  });

  it('verifies the current authenticator code and rejects replays', async () => {
    const now = 1234567890 * 1000;
    const harness = createHarness(() => now);
    const code = harness.service.rfc6238TotpForCounter(
      rfcSecret,
      Math.floor(now / 1000 / 30)
    );

    await expect(
      harness.service.verifyRfc6238Totp(rfcSecret, code, 'escrow-1', {
        tenantId: 'tenant-a',
        purpose: 'escrow-wire',
      })
    ).resolves.toBe(true);
    await expect(
      harness.service.verifyRfc6238Totp(rfcSecret, code, 'escrow-1', {
        tenantId: 'tenant-a',
        purpose: 'escrow-wire',
      })
    ).resolves.toBe(false);
  });

  it('rejects wrong codes, short secrets, and malformed base32', async () => {
    const harness = createHarness(() => 1234567890 * 1000);

    await expect(
      harness.service.verifyRfc6238Totp(rfcSecret, '000000', 'escrow-1', {
        tenantId: 'tenant-a',
      })
    ).resolves.toBe(false);
    await expect(
      harness.service.verifyRfc6238Totp(
        'JBSWY3DPEHPK3PXP',
        '123456',
        'escrow-1',
        {
          tenantId: 'tenant-a',
        }
      )
    ).resolves.toBe(false);
    await expect(
      harness.service.verifyRfc6238Totp('not-base32!!', '123456', 'escrow-1', {
        tenantId: 'tenant-a',
      })
    ).resolves.toBe(false);
  });

  it('generates 20-byte base32 secrets', () => {
    const harness = createHarness();
    const secret = harness.service.generateRfc6238Secret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(TimeLockedOtpService.base32Decode(secret)).toHaveLength(20);
  });
});
