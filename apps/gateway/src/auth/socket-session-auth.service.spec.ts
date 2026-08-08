import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import { AuthCommands } from '@optimistic-tanuki/constants';
import { SocketSessionAuthService } from './socket-session-auth.service';

describe('SocketSessionAuthService', () => {
  const jwt = {
    verifyAsync: jest.fn(),
  } as unknown as JwtService;
  const authenticationService = {
    send: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(jwt, 'verifyAsync')
      .mockResolvedValue({ userId: 'user-1', profileId: 'profile-1' } as never);
    authenticationService.send.mockReturnValue(of({ isValid: true }));
  });

  it('authenticates the HttpOnly session cookie before legacy handshake credentials', async () => {
    const service = new SocketSessionAuthService(
      jwt,
      authenticationService as never
    );
    const socket = {
      handshake: {
        headers: {
          cookie: 'ot_session=cookie-token',
          authorization: 'Bearer header-token',
        },
        auth: { token: 'handshake-token' },
      },
      data: {},
    } as any;

    await expect(service.authenticate(socket)).resolves.toEqual({
      userId: 'user-1',
      profileId: 'profile-1',
    });
    expect(jwt.verifyAsync).toHaveBeenCalledWith('cookie-token');
    expect(authenticationService.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Validate },
      { token: 'cookie-token', userId: 'user-1' }
    );
    expect(socket.data.user).toEqual({
      userId: 'user-1',
      profileId: 'profile-1',
    });
  });

  it('rejects a socket with no session or legacy bearer credential', async () => {
    const service = new SocketSessionAuthService(
      jwt,
      authenticationService as never
    );

    await expect(
      service.authenticate({
        handshake: { headers: {}, auth: {} },
        data: {},
      } as any)
    ).rejects.toThrow('Unauthorized socket connection');
  });
});
