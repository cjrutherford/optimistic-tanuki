import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  let service: PasswordPolicyService;

  beforeEach(() => {
    service = new PasswordPolicyService();
  });

  it('rejects weak passwords', () => {
    expect(() => service.ensureStrongPassword('weak')).toThrow(
      'Password is too weak',
    );
  });

  it('rejects mismatched password confirmation', () => {
    expect(() =>
      service.ensurePasswordConfirmation('strongPass1!', 'strongPass2!'),
    ).toThrow('Passwords do not match');
  });

  it('accepts a strong confirmed password', () => {
    expect(() =>
      service.ensurePasswordConfirmation('strongPass1!', 'strongPass1!'),
    ).not.toThrow();
  });
});
