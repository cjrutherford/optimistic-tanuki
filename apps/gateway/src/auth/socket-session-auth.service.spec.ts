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
      authenticationService as never,
      {
        apps: [{ appId: 'client-interface', uiBaseUrl: 'https://ot.example' }],
      } as any
    );
    const socket = {
      handshake: {
        headers: {
          origin: 'https://ot.example',
          'x-ot-appscope': 'local-hub',
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
      { token: 'cookie-token', userId: 'user-1', appId: 'client-interface' }
    );
    expect(socket.data.user).toEqual({
      userId: 'user-1',
      profileId: 'profile-1',
    });
  });

  it('rejects a socket with no session or legacy bearer credential', async () => {
    const service = new SocketSessionAuthService(
      jwt,
      authenticationService as never,
      { apps: [] } as any
    );

    await expect(
      service.authenticate({
        handshake: { headers: {}, auth: {} },
        data: {},
      } as any)
    ).rejects.toThrow('Unauthorized socket connection');
  });

  it('rejects an Origin that conflicts with the signed session app scope', async () => {
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({
      userId: 'user-1',
      profileId: 'profile-1',
      appId: 'local-hub',
    });
    const service = new SocketSessionAuthService(
      jwt,
      authenticationService as never,
      {
        apps: [
          { appId: 'client-interface', uiBaseUrl: 'https://ot.example' },
          { appId: 'local-hub', uiBaseUrl: 'https://ts.example' },
        ],
      } as any
    );
    const socket = {
      handshake: {
        headers: { origin: 'https://ot.example', cookie: 'ot_session=token' },
        auth: {},
      },
      data: {},
    } as any;

    await expect(service.authenticate(socket)).rejects.toThrow(
      'Unauthorized socket connection'
    );
    expect(authenticationService.send).not.toHaveBeenCalled();
  });
});
