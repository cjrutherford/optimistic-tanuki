import {
  emitSafeDiagnostic,
  registerSafeEventCatalogue,
} from './safe-diagnostic';

describe('Safe diagnostic projection', () => {
  it('emits only closed event fields, excluding account/content/credential sentinels', () => {
    const records: unknown[] = [];
    const sink = { log: (record: unknown) => records.push(record) };
    const secret = 'N04_PRIVATE_SUBJECT_BODY_BEARER_URL_SENTINEL';
    emitSafeDiagnostic(sink, 'social.comment.requested', {
      statusCode: 403,
      outcome: 'denied',
      count: 2,
      userId: secret,
      profileId: secret,
      body: secret,
      error: new Error(secret),
      url: 'https://example.test/' + secret,
      authorization: secret,
    });
    expect(records).toEqual([
      {
        event: 'social.comment.requested',
        statusCode: 403,
        outcome: 'denied',
        count: 2,
      },
    ]);
    expect(JSON.stringify(records)).not.toContain(secret);
  });
  it('does not invoke getters or toJSON, or echo unrecognized codes/metadata', () => {
    const log = jest.fn(),
      getter = jest.fn(() => {
        throw new Error('SECRET');
      });
    const metadata = Object.defineProperties(
      { toJSON: getter },
      { statusCode: { get: getter }, outcome: { get: getter } }
    );
    emitSafeDiagnostic({ log }, 'SECRET_CODE', metadata);
    expect(getter).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith({ event: 'diagnostic.rejected' });
  });
  it('discards invalid status/count values and contains sink errors', () => {
    const log = jest.fn();
    emitSafeDiagnostic({ log }, 'profile.operation', {
      statusCode: Infinity,
      count: -1,
      outcome: 'SECRET',
    });
    expect(log).toHaveBeenCalledWith({ event: 'profile.operation' });
    expect(() =>
      emitSafeDiagnostic(
        {
          log: () => {
            throw new Error('SECRET');
          },
        },
        'profile.operation'
      )
    ).not.toThrow();
  });
});

describe('Safe event catalogues', () => {
  const sentinel = 'person@example.test token=SECRET';

  beforeAll(() => {
    registerSafeEventCatalogue({
      'catalogue.test.failed': {
        step: ['state', 'exchange'],
        scope: /^[a-z][a-z0-9-]{0,31}$/,
      },
    });
  });

  it('emits only allow-listed fields with allow-listed values', () => {
    const records: unknown[] = [];
    emitSafeDiagnostic(
      { log: (r: unknown) => records.push(r) },
      'catalogue.test.failed',
      {
        step: 'exchange',
        scope: 'owner-console',
        email: sentinel,
        message: sentinel,
        outcome: 'failed',
      }
    );
    expect(records).toEqual([
      {
        event: 'catalogue.test.failed',
        outcome: 'failed',
        step: 'exchange',
        scope: 'owner-console',
      },
    ]);
  });

  it('drops values outside the rule, including emails and long strings', () => {
    const log = jest.fn();
    emitSafeDiagnostic({ log }, 'catalogue.test.failed', {
      step: sentinel,
      scope: 'x'.repeat(200),
    });
    expect(log).toHaveBeenCalledWith({ event: 'catalogue.test.failed' });
  });

  it('still rejects unregistered codes and refuses unsafe registrations', () => {
    const log = jest.fn();
    emitSafeDiagnostic({ log }, 'catalogue.unregistered', { step: 'state' });
    expect(log).toHaveBeenCalledWith({ event: 'diagnostic.rejected' });
    expect(() =>
      registerSafeEventCatalogue({ 'profile.operation': {} })
    ).toThrow();
    expect(() => registerSafeEventCatalogue({ 'Bad Code': {} })).toThrow();
    expect(() =>
      registerSafeEventCatalogue({ 'catalogue.test.x': { event: ['a'] } })
    ).toThrow();
    expect(() =>
      registerSafeEventCatalogue({ 'catalogue.test.failed': { step: ['x'] } })
    ).toThrow();
  });
});
