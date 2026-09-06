import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { of } from 'rxjs';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';

const execFileMock = jest.fn();
jest.mock('child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
import { BootstrapService } from './bootstrap.service';

function mockExecSuccess(stdout: string) {
  execFileMock.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      err: Error | null,
      result: { stdout: string; stderr: string }
    ) => void;
    callback(null, { stdout, stderr: '' });
  });
}

function mockExecFailure(message: string) {
  execFileMock.mockImplementation((...args: unknown[]) => {
    const callback = args[args.length - 1] as (
      err: Error | null,
      result: { stdout: string; stderr: string }
    ) => void;
    callback(new Error(message), { stdout: '', stderr: message });
  });
}

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

  it('upserts the configured owner auth user, profile, and owner roles', async () => {
    const authClient = {
      send: jest.fn().mockReturnValue(
        of({
          created: true,
          user: { id: 'owner-user-1' },
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
      { cmd: AuthCommands.BootstrapOwner },
      expect.objectContaining({
        bio: 'Platform owner',
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

  it('repairs global and owner-console permissions for the configured existing owner', async () => {
    const authClient = {
      send: jest
        .fn()
        .mockReturnValue(
          of({ created: false, user: { id: 'legacy-owner-user' } })
        ),
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
      name: 'Owner Console',
      profileId: 'legacy-owner-profile',
      userId: 'legacy-owner-user',
    });

    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.BootstrapOwner },
      expect.objectContaining({ email: 'owner@example.com' })
    );
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

  describe('file-backed operations', () => {
    let workspaceRoot: string;
    let wsDeploymentPath: string;
    let wsSecretsPath: string;

    const buildWorkspaceConfigService = () =>
      ({
        get: jest.fn((key: string) => {
          switch (key) {
            case 'admin-api.workspaceRoot':
              return workspaceRoot;
            case 'admin-api.deploymentPath':
              return wsDeploymentPath;
            case 'admin-api.secretsPath':
              return wsSecretsPath;
            case 'admin-api.gatewayBaseUrl':
              return 'http://127.0.0.1:3000/';
            default:
              return undefined;
          }
        }),
      } as unknown as ConfigService);

    const buildService = () => {
      const authClient = { send: jest.fn() };
      const profileClient = { send: jest.fn() };
      const roleInit = { processNow: jest.fn() };
      return new BootstrapService(
        buildWorkspaceConfigService(),
        authClient as any,
        profileClient as any,
        roleInit as any
      );
    };

    beforeEach(() => {
      workspaceRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'bootstrap-workspace-')
      );
      wsDeploymentPath = './deployments/production.yaml';
      wsSecretsPath = './.secrets';
      execFileMock.mockReset();
    });

    afterEach(() => {
      fs.rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it('reports an unconfigured status when no deployment or secrets exist yet', async () => {
      const service = buildService();
      const status = await service.getStatus();
      expect(status).toEqual({
        configured: false,
        phase: 'setup',
        checks: [
          expect.objectContaining({
            name: 'deployment-config',
            status: 'info',
          }),
          expect.objectContaining({ name: 'secrets', status: 'info' }),
          expect.objectContaining({ name: 'setup-complete', status: 'info' }),
        ],
      });
    });

    it('reports ready status once deployment, secrets, and setup-complete all exist', async () => {
      const service = buildService();
      const scaffold = await service.scaffoldConfig({
        name: 'prod',
        target: 'compose',
        operatorName: 'Op',
        operatorEmail: 'op@example.com',
        services: ['gateway'],
      });
      expect(scaffold.config.environment.name).toBe('prod');
      expect(scaffold.secrets.BOOTSTRAP_OPERATOR_EMAIL).toBe('op@example.com');

      await service.completeSetup();
      const status = await service.getStatus();
      expect(status.configured).toBe(true);
      expect(status.phase).toBe('ready');
      expect(status.checks.every((c) => c.status === 'pass')).toBe(true);
    });

    it('throws when scaffolding over an existing deployment config', async () => {
      const service = buildService();
      await service.scaffoldConfig({
        name: 'prod',
        target: 'compose',
        operatorName: 'Op',
        operatorEmail: 'op@example.com',
        services: [],
      });
      await expect(
        service.scaffoldConfig({
          name: 'prod2',
          target: 'compose',
          operatorName: 'Op',
          operatorEmail: 'op@example.com',
          services: [],
        })
      ).rejects.toThrow('Deployment config already exists');
    });

    it('reports error status when the deployment config cannot be parsed', async () => {
      const service = buildService();
      fs.mkdirSync(path.dirname(path.join(workspaceRoot, wsDeploymentPath)), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(workspaceRoot, wsDeploymentPath),
        ': : : not yaml : : :\n\tinvalid'
      );
      fs.writeFileSync(path.join(workspaceRoot, wsSecretsPath), 'A=1\n');
      const status = await service.getStatus();
      expect(status.configured).toBe(false);
      expect(status.phase).toBe('error');
    });

    it('round-trips deployment config via loadConfig/saveConfig', async () => {
      const service = buildService();
      await service.scaffoldConfig({
        name: 'prod',
        target: 'k8s',
        operatorName: 'Op',
        operatorEmail: 'op@example.com',
        services: ['gateway'],
      });
      const loaded = await service.loadConfig();
      expect(loaded.environment.targets).toEqual(['k8s']);

      loaded.environment.name = 'renamed';
      await service.saveConfig(loaded);
      const reloaded = await service.loadConfig();
      expect(reloaded.environment.name).toBe('renamed');
    });

    it('round-trips secrets via loadSecrets/saveSecrets, and returns {} when absent', async () => {
      const service = buildService();
      expect(await service.loadSecrets()).toEqual({});

      await service.saveSecrets({ FOO: 'bar', BAZ: 'qux' });
      expect(await service.loadSecrets()).toEqual({ FOO: 'bar', BAZ: 'qux' });
    });

    it('validate() returns parsed issues on success and a failure result when the CLI errors', async () => {
      const service = buildService();
      await service.scaffoldConfig({
        name: 'prod',
        target: 'compose',
        operatorName: 'Op',
        operatorEmail: 'op@example.com',
        services: [],
      });

      mockExecSuccess(JSON.stringify({ issues: [] }));
      await expect(service.validate()).resolves.toEqual({
        valid: true,
        issues: [],
      });

      mockExecFailure('boom');
      const failed = await service.validate();
      expect(failed.valid).toBe(false);
      expect(failed.issues[0].message).toContain('boom');
    });

    it('buildImages() reports missing binary, success, and failure paths', async () => {
      const service = buildService();
      const missing = await service.buildImages();
      expect(missing).toEqual({
        success: false,
        message: 'admin-env binary not found; unable to generate artifacts',
      });

      const goBinDir = path.join(workspaceRoot, 'tools', 'admin-env-wizard');
      fs.mkdirSync(goBinDir, { recursive: true });
      fs.writeFileSync(path.join(goBinDir, 'admin-env'), '#!/bin/sh\n');

      mockExecSuccess(JSON.stringify({ outputDir: 'dist/x' }));
      const success = await service.buildImages();
      expect(success).toEqual({
        success: true,
        message: 'Artifacts generated at dist/x',
      });

      mockExecFailure('generation not enabled right now');
      const skipped = await service.buildImages();
      expect(skipped.success).toBe(true);
      expect(skipped.message).toContain('skipped');

      mockExecFailure('catastrophic failure');
      const failed = await service.buildImages();
      expect(failed.success).toBe(false);
      expect(failed.message).toContain('Build failed');
    });

    it('provisionInfraCompose() handles a missing compose file, success, and failure', async () => {
      const service = buildService();
      const missing = await service.provisionInfraCompose();
      expect(missing.success).toBe(false);
      expect(missing.message).toContain('compose file not found');

      fs.writeFileSync(
        path.join(workspaceRoot, 'docker-compose.yaml'),
        'services: {}\n'
      );

      mockExecSuccess('infra up');
      const success = await service.provisionInfraCompose();
      expect(success).toEqual({ success: true, message: 'infra up' });

      mockExecFailure('docker down');
      const failed = await service.provisionInfraCompose();
      expect(failed.success).toBe(false);
      expect(failed.message).toContain('Infrastructure provisioning failed');
    });

    it('provisionInfraK8s() succeeds with and without a kubeconfig, and reports failures', async () => {
      const service = buildService();
      mockExecSuccess('k8s ready');
      await expect(service.provisionInfraK8s()).resolves.toEqual({
        success: true,
        message: 'k8s ready',
      });
      await expect(
        service.provisionInfraK8s('/path/to/kubeconfig')
      ).resolves.toEqual({ success: true, message: 'k8s ready' });

      mockExecFailure('k8s broke');
      const failed = await service.provisionInfraK8s();
      expect(failed.success).toBe(false);
      expect(failed.message).toContain('K8s provisioning failed');
    });

    it('initDatabases() succeeds even when the go binary and migrate script are both absent', async () => {
      const service = buildService();
      const result = await service.initDatabases();
      expect(result).toEqual({
        success: true,
        message: 'Databases initialized',
      });
    });

    it('initDatabases() runs the migrate script when present and tolerates its failure', async () => {
      const service = buildService();
      const scriptsDir = path.join(workspaceRoot, 'scripts');
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(
        path.join(scriptsDir, 'setup-and-migrate.sh'),
        '#!/bin/sh\n'
      );
      mockExecFailure('migrate failed');
      const result = await service.initDatabases();
      expect(result).toEqual({
        success: true,
        message: 'Databases initialized',
      });
    });

    it('deployServices() handles a missing compose file, success, and failure', async () => {
      const service = buildService();
      const missing = await service.deployServices();
      expect(missing.success).toBe(false);
      expect(missing.message).toContain('compose file not found');

      fs.writeFileSync(
        path.join(workspaceRoot, 'docker-compose.yaml'),
        'services: {}\n'
      );
      await service.scaffoldConfig({
        name: 'prod',
        target: 'compose',
        operatorName: 'Op',
        operatorEmail: 'op@example.com',
        services: ['gateway', 'authentication'],
      });

      mockExecSuccess('services up');
      const success = await service.deployServices();
      expect(success).toEqual({ success: true, message: 'services up' });

      mockExecFailure('deploy exploded');
      const failed = await service.deployServices();
      expect(failed.success).toBe(false);
      expect(failed.message).toContain('Deployment failed');
    });

    it('configureOAuthProvider() writes provider secrets and updates the deployment yaml', async () => {
      const service = buildService();
      await service.scaffoldConfig({
        name: 'prod',
        target: 'compose',
        operatorName: 'Op',
        operatorEmail: 'op@example.com',
        services: [],
      });

      await service.configureOAuthProvider('google', {
        enabled: true,
        clientId: 'client-id-1',
        clientSecret: 'client-secret-1',
        redirectUri: 'https://example.com/cb',
      });

      const secrets = await service.loadSecrets();
      expect(secrets.GOOGLE_CLIENT_ID).toBe('client-id-1');
      expect(secrets.GOOGLE_CLIENT_SECRET).toBe('client-secret-1');
      expect(secrets.GOOGLE_REDIRECT_URI).toBe('https://example.com/cb');

      const config = await service.loadConfig();
      expect(config.oauth.providers.google.enabled).toBe(true);
      expect(config.oauth.providers.google.redirectUri).toBe(
        'https://example.com/cb'
      );
    });

    it('configureOAuthProvider() skips the yaml update when no deployment config exists', async () => {
      const service = buildService();
      await expect(
        service.configureOAuthProvider('github', {
          enabled: false,
          clientId: 'id',
          clientSecret: 'secret',
          redirectUri: '',
        })
      ).resolves.toBeUndefined();
      const secrets = await service.loadSecrets();
      expect(secrets.GITHUB_CLIENT_ID).toBe('id');
    });

    it('completeSetup() writes the setup-complete marker file', async () => {
      const service = buildService();
      await service.completeSetup();
      expect(fs.existsSync(path.join(workspaceRoot, '.setup-complete'))).toBe(
        true
      );
    });
  });
});
