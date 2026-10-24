import { emitSafeDiagnostic } from './safe-diagnostic';

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
