import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { of } from 'rxjs';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import { BootstrapService } from './bootstrap.service';

describe('BootstrapService', () => {
  let deploymentPath: string;

  const buildConfigService = () =>
    ({
      get: jest.fn((key: string) => {
        switch (key) {
          case 'admin-api.workspaceRoot':
            return process.cwd();
          case 'admin-api.deploymentPath':
            return deploymentPath;
          case 'admin-api.gatewayBaseUrl':
            return 'http://127.0.0.1:3000';
          default:
            return undefined;
        }
      }),
    } as unknown as ConfigService);

  beforeEach(() => {
    const fixtureDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bootstrap-service-')
    );
    deploymentPath = path.join(fixtureDirectory, 'production.yaml');
    fs.writeFileSync(deploymentPath, 'apps: []\n');
  });

  afterEach(() => {
    fs.rmSync(path.dirname(deploymentPath), { force: true, recursive: true });
  });

  it('creates the initial owner auth user, profile, and owner roles', async () => {
    const authClient = {
      send: jest.fn().mockReturnValue(
        of({
          data: {
            user: {
              id: 'owner-user-1',
              firstName: 'Owner',
              lastName: 'Console',
            },
          },
        })
      ),
    };
    const profileClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(of([]))
        .mockReturnValueOnce(
          of({
            id: 'owner-profile-1',
            appScope: 'global',
          })
        ),
    };
    const roleInit = {
      processNow: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BootstrapService(
      buildConfigService(),
      authClient as any,
      profileClient as any,
      roleInit as any
    );

    await expect(
      service.createOwner('Owner Console', 'OWNER@EXAMPLE.COM', 'password')
    ).resolves.toEqual({
      created: true,
      email: 'owner@example.com',
      name: 'Owner Console',
      profileId: 'owner-profile-1',
      userId: 'owner-user-1',
    });

    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Register },
      expect.objectContaining({
        bio: 'Platform owner',
        confirm: 'password',
        email: 'owner@example.com',
        fn: 'Owner',
        ln: 'Console',
        password: 'password',
      })
    );
    expect(profileClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: ProfileCommands.GetAll },
      { where: [{ appScope: 'global' }, { appScope: null }] }
    );
    expect(profileClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: ProfileCommands.Create },
      expect.objectContaining({
        appScope: 'global',
        name: 'Owner Console',
        userId: 'owner-user-1',
      })
    );
    expect(roleInit.processNow).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeName: 'global',
        assignments: expect.arrayContaining([
          expect.objectContaining({ roleName: 'owner' }),
        ]),
      })
    );
  });

  it('repairs global and owner-console permissions for an existing global owner', async () => {
    const authClient = {
      send: jest.fn(),
    };
    const profileClient = {
      send: jest.fn().mockReturnValue(
        of([
          {
            id: 'legacy-owner-profile',
            name: 'Existing Owner',
            appScope: null,
            userId: 'legacy-owner-user',
          },
        ])
      ),
    };
    const roleInit = {
      processNow: jest.fn().mockResolvedValue(undefined),
    };

    const service = new BootstrapService(
      buildConfigService(),
      authClient as any,
      profileClient as any,
      roleInit as any
    );

    await expect(
      service.createOwner('Owner Console', 'OWNER@EXAMPLE.COM', 'password')
    ).resolves.toEqual({
      created: false,
      email: 'owner@example.com',
      name: 'Existing Owner',
      profileId: 'legacy-owner-profile',
      userId: 'legacy-owner-user',
    });

    expect(authClient.send).not.toHaveBeenCalled();
    expect(roleInit.processNow).toHaveBeenCalledTimes(2);
    expect(roleInit.processNow).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        scopeName: 'global',
        assignments: expect.arrayContaining([
          expect.objectContaining({ roleName: 'owner' }),
        ]),
      })
    );
    expect(roleInit.processNow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        scopeName: 'owner-console',
        assignments: expect.arrayContaining([
          expect.objectContaining({ roleName: 'owner_console_owner' }),
        ]),
      })
    );
  });
});
