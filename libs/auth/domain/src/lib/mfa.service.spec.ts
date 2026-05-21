import { MfaService } from './mfa.service';

describe('MfaService', () => {
  it('requires a token when a secret is configured', () => {
    const service = new MfaService({ check: jest.fn() } as any);

    expect(() => service.assertLoginToken('secret-value')).toThrow(
      'MFA token is required for this user.',
    );
  });

  it('rejects an invalid configured token', () => {
    const service = new MfaService({
      check: jest.fn().mockReturnValue(false),
    } as any);

    expect(() => service.assertLoginToken('secret-value', '123456')).toThrow(
      'Invalid MFA token',
    );
  });

  it('allows login when no secret is configured', () => {
    const service = new MfaService({ check: jest.fn() } as any);

    expect(() => service.assertLoginToken(null, undefined)).not.toThrow();
  });
});
