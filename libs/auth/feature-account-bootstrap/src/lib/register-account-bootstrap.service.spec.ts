import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import { of } from 'rxjs';
import { RegisterAccountBootstrapService } from './register-account-bootstrap.service';

describe('RegisterAccountBootstrapService', () => {
  it('initializes owner permissions for owner-console registrations', async () => {
    const authClient = {
      send: jest.fn().mockReturnValue(
        of({
          data: {
            user: {
              id: 'owner-user',
              firstName: 'Owner',
              lastName: 'User',
            },
          },
        }),
      ),
    };
    const profileClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(of([]))
        .mockReturnValueOnce(
          of({
            id: 'owner-profile',
            appScope: 'global',
          }),
        ),
    };
    const roleInit = { processNow: jest.fn().mockResolvedValue(undefined) };
    const service = new RegisterAccountBootstrapService(
      authClient as any,
      profileClient as any,
      roleInit as any,
    );

    const result = await service.register(
      {
        fn: 'Owner',
        ln: 'User',
        email: 'owner@test.com',
        password: 'secret',
        confirm: 'secret',
        bio: '',
      },
      'owner-console',
    );

    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Create },
      expect.objectContaining({
        userId: 'owner-user',
        appScope: 'global',
      }),
    );
    expect(roleInit.processNow).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeName: 'global',
        assignments: expect.arrayContaining([
          expect.objectContaining({ roleName: 'owner' }),
        ]),
      }),
    );
    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Register },
      expect.objectContaining({ email: 'owner@test.com' }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          user: expect.objectContaining({ id: 'owner-user' }),
        }),
      }),
    );
  });

  it('rejects owner-console self-registration after the first owner exists', async () => {
    const authClient = {
      send: jest.fn(),
    };
    const profileClient = {
      send: jest.fn().mockReturnValueOnce(of([{ id: 'existing-owner' }])),
    };
    const roleInit = { processNow: jest.fn().mockResolvedValue(undefined) };
    const service = new RegisterAccountBootstrapService(
      authClient as any,
      profileClient as any,
      roleInit as any,
    );

    await expect(
      service.register(
        {
          fn: 'Second',
          ln: 'Owner',
          email: 'second-owner@test.com',
          password: 'secret',
          confirm: 'secret',
          bio: '',
        },
        'owner-console',
      ),
    ).rejects.toThrow(
      'Owner Console registration is closed. An existing owner must invite or provision additional operators.',
    );
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('initializes scoped profile owner permissions for standard registrations', async () => {
    const authClient = {
      send: jest.fn().mockReturnValue(
        of({
          data: {
            user: {
              id: 'standard-user',
              firstName: 'Lead',
              lastName: 'User',
            },
          },
        }),
      ),
    };
    const profileClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'leads-profile',
          appScope: 'leads-app',
        }),
      ),
    };
    const roleInit = { processNow: jest.fn().mockResolvedValue(undefined) };
    const service = new RegisterAccountBootstrapService(
      authClient as any,
      profileClient as any,
      roleInit as any,
    );

    await service.register(
      {
        fn: 'Lead',
        ln: 'User',
        email: 'lead@test.com',
        password: 'secret',
        confirm: 'secret',
        bio: '',
      },
      'leads-app',
    );

    expect(roleInit.processNow).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeName: 'leads-app',
        assignments: expect.arrayContaining([
          expect.objectContaining({
            roleName: 'leads_app_member',
            profileId: 'leads-profile',
          }),
        ]),
      }),
    );
  });
});
