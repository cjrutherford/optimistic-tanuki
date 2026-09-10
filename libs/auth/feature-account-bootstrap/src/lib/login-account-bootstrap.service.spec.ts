import {
  AuthCommands,
  ProfileCommands,
  RoleCommands,
} from '@optimistic-tanuki/constants';
import { NEVER, of } from 'rxjs';
import { LoginAccountBootstrapService } from './login-account-bootstrap.service';

describe('LoginAccountBootstrapService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('connects the auth client before the first auth send', async () => {
    const callOrder: string[] = [];
    let resolveConnect!: () => void;
    const authClient = {
      connect: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            callOrder.push('connect');
            resolveConnect = resolve;
          })
      ),
      send: jest.fn((pattern: { cmd: string }) => {
        callOrder.push(pattern.cmd);
        return pattern.cmd === AuthCommands.UserIdFromEmail
          ? of('user-1')
          : of({ code: 0 });
      }),
    };
    const profileClient = {
      send: jest.fn().mockReturnValue(
        of([
          {
            id: 'profile-global',
            userId: 'user-1',
            profileName: 'Global User',
            appScope: 'global',
          },
        ])
      ),
    };
    const permissionsClient = {
      send: jest.fn().mockReturnValue(of([{ role: { name: 'owner' } }])),
    };
    const roleInit = { processNow: jest.fn() };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      permissionsClient as any,
      roleInit as any
    );

    const loginPromise = service.login(
      { email: 'user@app.com', password: 'secret' },
      'owner-console'
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(callOrder).toEqual(['connect']);
    expect(authClient.send).not.toHaveBeenCalled();

    resolveConnect();
    await loginPromise;

    expect(callOrder[0]).toBe('connect');
    expect(authClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: AuthCommands.UserIdFromEmail },
      { email: 'user@app.com' }
    );
  });

  it('bounds a non-emitting UserIdFromEmail request with a safe operation-specific timeout', async () => {
    jest.useFakeTimers();
    const authClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockReturnValue(NEVER),
    };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      { send: jest.fn() } as any,
      { send: jest.fn() } as any,
      { processNow: jest.fn() } as any
    );

    const loginPromise = service.login(
      { email: 'secret-user@app.com', password: 'secret-password' },
      'forgeofwill'
    );
    await Promise.resolve();
    await Promise.resolve();

    const rejection = expect(loginPromise).rejects.toThrow(
      'Auth UserIdFromEmail request timed out'
    );
    await jest.advanceTimersByTimeAsync(5000);
    await rejection;
    jest.useRealTimers();
  });

  it('connects the profile client before bounding a non-emitting GetAll request', async () => {
    jest.useFakeTimers();
    const callOrder: string[] = [];
    let resolveConnect!: () => void;
    const authClient = {
      send: jest.fn().mockReturnValueOnce(of('user-1')),
    };
    const profileClient = {
      connect: jest.fn(
        () =>
          new Promise<void>((resolve) => {
            callOrder.push('connect');
            resolveConnect = resolve;
          })
      ),
      send: jest.fn(() => {
        callOrder.push('send');
        return NEVER;
      }),
    };
    const permissionsClient = { send: jest.fn() };
    const roleInit = { processNow: jest.fn() };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      permissionsClient as any,
      roleInit as any
    );

    const loginPromise = service.login(
      { email: 'user@app.com', password: 'secret' },
      'forgeofwill'
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(callOrder).toEqual(['connect']);
    expect(profileClient.send).not.toHaveBeenCalled();

    resolveConnect();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(callOrder).toEqual(['connect', 'send']);

    const rejection = expect(loginPromise).rejects.toThrow(
      'Profile GetAll request timed out'
    );
    await jest.advanceTimersByTimeAsync(5000);
    await rejection;
  });

  it('bounds a NEVER-resolving profile connection and retries exactly once', async () => {
    jest.useFakeTimers();
    const neverConnect = () => new Promise<void>(() => undefined);
    const authClient = {
      send: jest.fn().mockReturnValue(of('user-1')),
    };
    const profileClient = {
      connect: jest.fn().mockImplementation(neverConnect),
      close: jest.fn(),
      send: jest.fn(),
    };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      { send: jest.fn() } as any,
      { processNow: jest.fn() } as any
    );

    const loginPromise = service.login(
      { email: 'secret-user@app.com', password: 'secret-password' },
      'forgeofwill'
    );
    const rejection = expect(loginPromise).rejects.toThrow(
      'Profile GetAll connection timed out'
    );
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.resolve();

    await rejection;
    expect(profileClient.connect).toHaveBeenCalledTimes(2);
    expect(profileClient.close).toHaveBeenCalledTimes(2);
    expect(profileClient.send).not.toHaveBeenCalled();
  });

  it('reconnects after a hung profile connection and sends GetAll once', async () => {
    jest.useFakeTimers();
    const neverConnect = () => new Promise<void>(() => undefined);
    let resolveReconnect!: () => void;
    const authClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(of('user-1'))
        .mockReturnValueOnce(of({ code: 0 })),
    };
    const profileClient = {
      connect: jest
        .fn()
        .mockImplementationOnce(neverConnect)
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveReconnect = resolve;
            })
        ),
      close: jest.fn(),
      send: jest.fn().mockReturnValue(
        of([
          {
            id: 'profile-forge',
            userId: 'user-1',
            profileName: 'User',
            appScope: 'forgeofwill',
          },
        ])
      ),
    };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      { send: jest.fn() } as any,
      { processNow: jest.fn() } as any
    );

    const loginPromise = service.login(
      { email: 'user@app.com', password: 'secret' },
      'forgeofwill'
    );
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.resolve();
    await Promise.resolve();
    expect(profileClient.send).not.toHaveBeenCalled();

    resolveReconnect();
    await loginPromise;

    expect(profileClient.connect).toHaveBeenCalledTimes(2);
    expect(profileClient.close).toHaveBeenCalledTimes(1);
    expect(profileClient.send).toHaveBeenCalledTimes(1);
    expect(authClient.send).toHaveBeenCalledTimes(2);
  });

  it('returns a safe operation-specific error when reconnect also fails', async () => {
    jest.useFakeTimers();
    const authClient = {
      send: jest.fn().mockReturnValue(of('user-1')),
    };
    const profileClient = {
      connect: jest
        .fn()
        .mockRejectedValueOnce(new Error('secret host and credential'))
        .mockRejectedValueOnce(new Error('another secret failure')),
      close: jest.fn(),
      send: jest.fn(),
    };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      { send: jest.fn() } as any,
      { processNow: jest.fn() } as any
    );

    const loginPromise = service.login(
      { email: 'secret-user@app.com', password: 'secret-password' },
      'forgeofwill'
    );

    await expect(loginPromise).rejects.toThrow(
      'Profile GetAll connection failed'
    );
    expect(profileClient.connect).toHaveBeenCalledTimes(2);
    expect(profileClient.close).toHaveBeenCalledTimes(2);
    expect(profileClient.send).not.toHaveBeenCalled();
    expect(
      String((await loginPromise.catch((error) => error)).message)
    ).not.toContain('secret');
  });

  it('creates an app-scoped profile from a global seed profile and initializes permissions', async () => {
    const authClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(of('user-1'))
        .mockReturnValueOnce(of({ code: 0, data: { token: 'jwt' } })),
    };
    const profileClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(
          of([
            {
              id: 'profile-global',
              userId: 'user-1',
              profileName: 'Global User',
              appScope: 'global',
              avatarUrl: 'pic',
              email: 'cross@app.com',
              bio: 'bio',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ])
        )
        .mockReturnValueOnce(
          of({
            id: 'profile-forge',
            userId: 'user-1',
            profileName: 'Global User',
            email: 'cross@app.com',
            bio: 'bio',
            avatarUrl: 'pic',
            createdAt: new Date(),
            updatedAt: new Date(),
            appScope: 'forgeofwill',
          })
        ),
    };
    const permissionsClient = {
      send: jest.fn().mockReturnValue(of([])),
    };
    const roleInit = { processNow: jest.fn().mockResolvedValue(undefined) };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      permissionsClient as any,
      roleInit as any
    );

    const result = await service.login(
      { email: 'cross@app.com', password: 'secret' },
      'forgeofwill'
    );

    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Create },
      expect.objectContaining({
        userId: 'user-1',
        name: 'Global User',
        appScope: 'forgeofwill',
        copyPermissionsFromGlobalProfile: false,
      })
    );
    expect(roleInit.processNow).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeName: 'forgeofwill',
        assignments: expect.arrayContaining([
          expect.objectContaining({
            profileId: 'profile-forge',
          }),
        ]),
      })
    );
    expect(authClient.send).toHaveBeenLastCalledWith(
      { cmd: AuthCommands.Login },
      {
        email: 'cross@app.com',
        password: 'secret',
        profileId: 'profile-forge',
      }
    );
    expect(result).toEqual({ code: 0, data: { token: 'jwt' } });
  });

  it('maps owner-console login to the global app scope', async () => {
    const authClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(of('user-1'))
        .mockReturnValueOnce(of({ code: 0 })),
    };
    const profileClient = {
      send: jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'profile-global',
            userId: 'user-1',
            profileName: 'Global User',
            email: 'owner@app.com',
            bio: '',
            avatarUrl: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            appScope: 'global',
          },
        ])
      ),
    };
    const permissionsClient = {
      send: jest.fn().mockReturnValue(of([{ role: { name: 'owner' } }])),
    };
    const roleInit = { processNow: jest.fn() };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      permissionsClient as any,
      roleInit as any
    );

    await service.login(
      { email: 'owner@app.com', password: 'secret' },
      'owner-console'
    );

    expect(authClient.send).toHaveBeenLastCalledWith(
      { cmd: AuthCommands.Login },
      {
        email: 'owner@app.com',
        password: 'secret',
        profileId: 'profile-global',
      }
    );
    expect(roleInit.processNow).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeName: 'owner-console',
        assignments: expect.arrayContaining([
          expect.objectContaining({ roleName: 'owner_console_owner' }),
        ]),
      })
    );
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.GetUserRoles },
      { profileId: 'profile-global', appScope: 'owner-console' }
    );
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.GetUserRoles },
      { profileId: 'profile-global', appScope: 'global' }
    );
  });

  it('rejects owner-console login when the profile lacks owner-console roles', async () => {
    const authClient = {
      send: jest.fn().mockReturnValueOnce(of('user-1')),
    };
    const profileClient = {
      send: jest.fn().mockReturnValueOnce(
        of([
          {
            id: 'profile-global',
            userId: 'user-1',
            profileName: 'Global User',
            email: 'member@app.com',
            bio: '',
            avatarUrl: '',
            createdAt: new Date(),
            updatedAt: new Date(),
            appScope: 'global',
          },
        ])
      ),
    };
    const permissionsClient = {
      send: jest
        .fn()
        .mockReturnValue(of([{ role: { name: 'community_member' } }])),
    };
    const roleInit = { processNow: jest.fn() };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      permissionsClient as any,
      roleInit as any
    );

    await expect(
      service.login(
        { email: 'member@app.com', password: 'secret' },
        'owner-console'
      )
    ).rejects.toThrow(
      'This account is not authorized for Owner Console access.'
    );
  });
});
