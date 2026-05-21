import {
  AuthCommands,
  ProfileCommands,
  RoleCommands,
} from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { LoginAccountBootstrapService } from './login-account-bootstrap.service';

describe('LoginAccountBootstrapService', () => {
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
          ]),
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
          }),
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
      roleInit as any,
    );

    const result = await service.login(
      { email: 'cross@app.com', password: 'secret' },
      'forgeofwill',
    );

    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Create },
      expect.objectContaining({
        userId: 'user-1',
        name: 'Global User',
        appScope: 'forgeofwill',
        copyPermissionsFromGlobalProfile: false,
      }),
    );
    expect(roleInit.processNow).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeName: 'forgeofwill',
        assignments: expect.arrayContaining([
          expect.objectContaining({
            profileId: 'profile-forge',
          }),
        ]),
      }),
    );
    expect(authClient.send).toHaveBeenLastCalledWith(
      { cmd: AuthCommands.Login },
      {
        email: 'cross@app.com',
        password: 'secret',
        profileId: 'profile-forge',
      },
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
        ]),
      ),
    };
    const permissionsClient = {
      send: jest.fn().mockReturnValueOnce(
        of([{ role: { name: 'owner' } }]),
      ),
    };
    const roleInit = { processNow: jest.fn() };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      permissionsClient as any,
      roleInit as any,
    );

    await service.login(
      { email: 'owner@app.com', password: 'secret' },
      'owner-console',
    );

    expect(authClient.send).toHaveBeenLastCalledWith(
      { cmd: AuthCommands.Login },
      {
        email: 'owner@app.com',
        password: 'secret',
        profileId: 'profile-global',
      },
    );
    expect(roleInit.processNow).not.toHaveBeenCalled();
    expect(permissionsClient.send).toHaveBeenCalledWith(
      { cmd: RoleCommands.GetUserRoles },
      { profileId: 'profile-global', appScope: 'global' },
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
        ]),
      ),
    };
    const permissionsClient = {
      send: jest.fn().mockReturnValueOnce(
        of([{ role: { name: 'community_member' } }]),
      ),
    };
    const roleInit = { processNow: jest.fn() };
    const service = new LoginAccountBootstrapService(
      authClient as any,
      profileClient as any,
      permissionsClient as any,
      roleInit as any,
    );

    await expect(
      service.login(
        { email: 'member@app.com', password: 'secret' },
        'owner-console',
      ),
    ).rejects.toThrow(
      'This account is not authorized for Owner Console access.',
    );
  });
});
