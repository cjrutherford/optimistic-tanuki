import {
  AuthActionPurpose,
  AuthActionTokenEntity,
} from './auth-action-token.entity';

describe('AuthActionTokenEntity', () => {
  it('stores only a token hash and starts unconsumed', () => {
    const token = new AuthActionTokenEntity();
    token.tokenHash = 'a'.repeat(64);
    token.purpose = AuthActionPurpose.Verification;

    expect(token.tokenHash).toHaveLength(64);
    expect(token.consumedAt).toBeNull();
  });
});
