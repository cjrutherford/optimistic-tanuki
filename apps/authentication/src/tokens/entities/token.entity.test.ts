import { TokenEntity } from './token.entity';

describe('TokenEntity', () => {
  it('should have an id of type string', () => {
    const token = new TokenEntity();
    token.id = '123e4567-e89b-12d3-a456-426614174000';
    expect(typeof token.id).toBe('string');
  });

  it('should have a default revoked value of false', () => {
    const token = new TokenEntity();
    expect(token.revoked).toBe(false);
  });

  it('should allow setting and getting tokenData', () => {
    const token = new TokenEntity();
    token.tokenData = 'sampleTokenData';
    expect(token.tokenData).toBe('sampleTokenData');
  });

  it('should allow setting and getting userId', () => {
    const token = new TokenEntity();
    token.userId = 'user123'; //njsscan-ignore: node_username
    expect(token.userId).toBe('user123');
  });

  it('should allow setting and getting user', () => {
    const token = new TokenEntity();
    const user = {
      id: 'user123',
      tokens: [],
      email: 'someone@somewhere.net',
      firstName: 'Tom',
      lastName: 'morrow',
      bio: 'only a day away',
      password: 'xxxx',
      keyData: null,
    }; // Mock user entity
    token.user = user;
    expect(token.user).toBe(user);
  });
});

// We recommend installing an extension to run jest tests.
