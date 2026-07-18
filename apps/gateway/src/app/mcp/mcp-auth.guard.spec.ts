import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const verifyAsyncMock = jest.fn();

jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    verifyAsync: verifyAsyncMock,
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { McpAuthGuard } from './mcp-auth.guard';

describe('McpAuthGuard', () => {
  let configService: ConfigService;
  let guard: McpAuthGuard;

  const mockPayload = {
    userId: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    profileId: 'profile-1',
  };

  const buildContext = (headers: Record<string, string> = {}) => {
    const request: Record<string, unknown> = { headers, user: undefined };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    verifyAsyncMock.mockReset();
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'auth.jwtSecret') return 'test-secret';
        return undefined;
      }),
    } as unknown as ConfigService;

    guard = new McpAuthGuard(configService);
  });

  it('throws UnauthorizedException when no Authorization header is provided', async () => {
    const { context } = buildContext();

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException
    );
    expect(verifyAsyncMock).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the Authorization header has no token', async () => {
    const { context } = buildContext({ authorization: 'Bearer' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException
    );
    expect(verifyAsyncMock).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when the token fails verification', async () => {
    verifyAsyncMock.mockRejectedValue(new Error('bad signature'));
    const { context } = buildContext({ authorization: 'Bearer bad-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException
    );
    expect(verifyAsyncMock).toHaveBeenCalledWith('bad-token');
  });

  it('returns true and attaches a UserContext with profileId for a valid token', async () => {
    verifyAsyncMock.mockResolvedValue(mockPayload);
    const { context, request } = buildContext({
      authorization: 'Bearer good-token',
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual({
      userId: mockPayload.userId,
      email: mockPayload.email,
      name: mockPayload.name,
      profileId: mockPayload.profileId,
      scopes: [],
      roles: [],
    });
  });

  it('throws a clear error when no JWT secret is configured', async () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);
    const unconfiguredGuard = new McpAuthGuard(configService);
    const { context } = buildContext({ authorization: 'Bearer some-token' });

    await expect(unconfiguredGuard.canActivate(context)).rejects.toThrow(
      /JWT secret is not configured/
    );
    expect(verifyAsyncMock).not.toHaveBeenCalled();
  });

  it('falls back to auth.jwt_secret when auth.jwtSecret is absent', async () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'auth.jwt_secret') return 'fallback-secret';
      return undefined;
    });
    verifyAsyncMock.mockResolvedValue(mockPayload);
    const fallbackGuard = new McpAuthGuard(configService);
    const { context } = buildContext({ authorization: 'Bearer good-token' });

    await expect(fallbackGuard.canActivate(context)).resolves.toBe(true);
  });
});
