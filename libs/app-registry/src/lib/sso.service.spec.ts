import { of } from 'rxjs';
import { SsoService } from './sso.service';

describe('SsoService', () => {
  it('validates tokens through the gateway authentication API', (done) => {
    const http = {
      post: jest.fn().mockReturnValue(
        of({
          isValid: true,
          data: {
            userId: 'user-1',
            profileId: 'profile-1',
            exp: 1893456000,
          },
        })
      ),
    };
    const service = new SsoService(http as any, '/api/authentication');

    service.validateToken('token-1', 'user-1').subscribe((response) => {
      expect(response).toEqual({
        valid: true,
        userId: 'user-1',
        profileId: 'profile-1',
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
      expect(http.post).toHaveBeenCalledWith('/api/authentication/validate', {
        token: 'token-1',
        userId: 'user-1',
      });
      done();
    });
  });

  it('exchanges tokens for a target app through the gateway authentication API', (done) => {
    const http = {
      post: jest
        .fn()
        .mockReturnValue(of({ token: 'target-token', targetAppId: 'hai' })),
    };
    const service = new SsoService(http as any, '/api/authentication');

    service.exchangeToken('source-token', 'hai').subscribe((response) => {
      expect(response).toEqual({ token: 'target-token', targetAppId: 'hai' });
      expect(http.post).toHaveBeenCalledWith(
        '/api/authentication/exchange',
        { targetAppId: 'hai' },
        { headers: { Authorization: 'Bearer source-token' } }
      );
      done();
    });
  });
});
