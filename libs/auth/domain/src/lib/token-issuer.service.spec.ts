import { TokenIssuerService } from './token-issuer.service';

describe('TokenIssuerService', () => {
  it('issues a one-hour token with normalized profile id', () => {
    const signer = {
      sign: jest.fn().mockReturnValue('signed-token'),
    };
    const service = new TokenIssuerService(signer, 'test-secret');

    const token = service.issueForUser({
      userId: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
    });

    expect(token).toBe('signed-token');
    expect(signer.sign).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        profileId: '',
      },
      {
        secret: 'test-secret',
        expiresIn: '1h',
      },
    );
  });

  it('includes the requested profile id in the token payload', () => {
    const signer = {
      sign: jest.fn().mockReturnValue('profile-token'),
    };
    const service = new TokenIssuerService(signer, 'test-secret');

    service.issueForUser(
      {
        userId: 'user-1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
      },
      'profile-1',
    );

    expect(signer.sign).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'profile-1' }),
      expect.any(Object),
    );
  });
});
