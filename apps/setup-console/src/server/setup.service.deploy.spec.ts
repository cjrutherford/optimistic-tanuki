import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { dump } from 'js-yaml';
import { SetupService } from './setup.service';

/**
 * Deployment-side coverage for SetupService: the streaming child-process
 * helper, the four rollout stages (build / infra / db / services) and the
 * owner activation that closes setup out.
 *
 * The service shells out with `execFile` and `spawn` against binaries it
 * discovers on disk (`tools/admin-env-wizard/admin-env`, the migrate script).
 * Rather than mocking `child_process` -- which would stop these tests from
 * proving the argument lists the service actually builds -- each test writes a
 * real shell stub into the temp workspace and the stub records its argv to a
 * log file, so assertions can check the command line the service produced.
 *
 * Only absolute-path commands can be stubbed this way: jest hands the test a
 * sandboxed copy of `process.env`, so a PATH prepended here is not the PATH
 * child processes are resolved against. PATH-resolved commands (`docker`) are
 * covered in setup.service.infra.spec.ts, which mocks `child_process.execFile`.
 */
describe('SetupService deployment pipeline', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  let workspaceRoot: string;
  let fakeBinDir: string;
  let argvLog: string;

  /** Writes a POSIX shell stub and marks it executable (mode must be set after write). */
  const writeExecutable = (filePath: string, script: string): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `#!/bin/sh\n${script}\n`, 'utf-8');
    fs.chmodSync(filePath, 0o755);
  };

  /** Stub for the Go `admin-env` binary the service resolves inside the workspace. */
  const writeAdminEnv = (script: string): string => {
    const binPath = path.join(
      workspaceRoot,
      'tools',
      'admin-env-wizard',
      'admin-env'
    );
    writeExecutable(binPath, script);
    return binPath;
  };

  const readArgvLog = (): string[] =>
    fs.existsSync(argvLog)
      ? fs
          .readFileSync(argvLog, 'utf-8')
          .split('\n')
          .filter((line) => line.length > 0)
      : [];

  const writeComposeFile = (): void => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'docker-compose.yaml'),
      'services:\n  gateway:\n    image: gateway:latest\n'
    );
  };

  const writeDeployment = (config: Record<string, unknown>): void => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
      dump(config)
    );
  };

  const deploymentWith = (
    environment: Record<string, unknown>,
    services: Array<{ serviceId: string; enabled: boolean }>
  ): Record<string, unknown> => ({
    version: 'v1alpha1',
    environment: { name: 'production', ...environment },
    services,
    apps: [],
    oauth: { enabled: false, bridgeAppId: 'client-interface', providers: {} },
  });

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-deploy-'));
    fakeBinDir = path.join(workspaceRoot, 'fake-bin');
    argvLog = path.join(workspaceRoot, 'argv.log');
    fs.mkdirSync(path.join(workspaceRoot, 'ops', 'deployments'), {
      recursive: true,
    });
    fs.mkdirSync(fakeBinDir, { recursive: true });

    process.env['SETUP_WORKSPACE_ROOT'] = workspaceRoot;
    process.env['ADMIN_API_DEPLOYMENT_PATH'] =
      './ops/deployments/production.yaml';
    process.env['ADMIN_API_SECRETS_PATH'] = './.secrets';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  describe('runStreamingCommand', () => {
    interface StreamingCommandInput {
      command: string;
      args: string[];
      cwd?: string;
      env?: Record<string, string>;
      onLine?: (line: string) => void;
    }

    /**
     * `runStreamingCommand` is private but is the only place the deploy log is
     * fed from, so it is driven directly through a narrow structural cast
     * rather than through a mock.
     */
    const runStreaming = (
      service: SetupService,
      input: StreamingCommandInput
    ): Promise<void> =>
      (
        service as unknown as {
          runStreamingCommand: (i: StreamingCommandInput) => Promise<void>;
        }
      ).runStreamingCommand(input);

    it('streams stdout and stderr line by line and flushes a trailing partial line', async () => {
      const service = new SetupService();
      const lines: string[] = [];

      await runStreaming(service, {
        command: process.execPath,
        args: [
          '-e',
          "process.stdout.write('first\\nsecond\\n');process.stderr.write('warned\\n');process.stdout.write('no-newline-tail')",
        ],
        onLine: (line) => lines.push(line),
      });

      // The tail has no newline, so it can only surface via the close handler.
      expect(lines).toEqual(
        expect.arrayContaining(['first', 'second', 'warned', 'no-newline-tail'])
      );
    });

    it('runs in the requested cwd with the supplied environment overlaid on process.env', async () => {
      const service = new SetupService();
      const lines: string[] = [];

      await runStreaming(service, {
        command: process.execPath,
        args: [
          '-e',
          "process.stdout.write(process.env.DEPLOY_FLAG + '|' + process.cwd())",
        ],
        cwd: fakeBinDir,
        env: { DEPLOY_FLAG: 'overlaid' },
        onLine: (line) => lines.push(line),
      });

      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(`overlaid|${fs.realpathSync(fakeBinDir)}`);
    });

    it('rejects with the exit code and only the last eight output lines', async () => {
      const service = new SetupService();

      // 25 lines exercises the 20-entry recent-line ring buffer as well.
      await expect(
        runStreaming(service, {
          command: process.execPath,
          args: [
            '-e',
            "for (let i = 1; i <= 25; i += 1) process.stdout.write('line-' + i + '\\n');process.exit(3)",
          ],
        })
      ).rejects.toThrow(
        'exited with code 3. Last output: line-18 | line-19 | line-20 | line-21 | line-22 | line-23 | line-24 | line-25'
      );
    });

    it('rejects when the child process cannot be spawned at all', async () => {
      const service = new SetupService();

      await expect(
        runStreaming(service, {
          command: path.join(fakeBinDir, 'not-a-real-binary'),
          args: [],
        })
      ).rejects.toThrow(/ENOENT/);
    });
  });

  describe('validate', () => {
    it('reports a missing admin-env binary as an error issue', async () => {
      const service = new SetupService();

      await expect(service.validate()).resolves.toEqual({
        valid: false,
        issues: [{ severity: 'error', message: 'admin-env binary not found' }],
      });
    });

    it('reports a missing deployment file once the binary is present', async () => {
      writeAdminEnv('exit 0');
      const service = new SetupService();

      await expect(service.validate()).resolves.toEqual({
        valid: false,
        issues: [{ severity: 'error', message: 'No deployment config' }],
      });
    });

    it('passes the deployment and secrets paths to admin-env validate', async () => {
      writeDeployment(deploymentWith({}, []));
      writeAdminEnv(
        `printf '%s\\n' "$*" >> "${argvLog}"\nprintf '{"issues":[]}'`
      );
      const service = new SetupService();

      await expect(service.validate()).resolves.toEqual({
        valid: true,
        issues: [],
      });
      expect(readArgvLog()[0]).toBe(
        [
          'validate',
          '-deployment',
          path.join(workspaceRoot, 'ops', 'deployments', 'production.yaml'),
          '-secrets',
          path.join(workspaceRoot, '.secrets'),
          '--json',
        ].join(' ')
      );
    });

    it('surfaces the issues reported by admin-env', async () => {
      writeDeployment(deploymentWith({}, []));
      writeAdminEnv(
        `printf '{"issues":[{"severity":"warning","message":"missing tag"}]}'`
      );
      const service = new SetupService();

      await expect(service.validate()).resolves.toEqual({
        valid: false,
        issues: [{ severity: 'warning', message: 'missing tag' }],
      });
    });

    it('turns a non-zero admin-env exit into a validation failure issue', async () => {
      writeDeployment(deploymentWith({}, []));
      writeAdminEnv('echo "schema blew up" >&2\nexit 2');
      const service = new SetupService();

      const result = await service.validate();

      expect(result.valid).toBe(false);
      expect(result.issues[0].severity).toBe('error');
      expect(result.issues[0].message).toContain('Validation failed:');
    });
  });

  describe('buildImages', () => {
    it('generates artifacts and reports the output directory admin-env chose', async () => {
      writeDeployment(deploymentWith({ composeMode: 'image' }, []));
      writeAdminEnv(
        `printf '%s\\n' "$*" >> "${argvLog}"\nprintf '{"outputDir":"dist/custom-env"}'`
      );
      const service = new SetupService();

      await expect(service.buildImages()).resolves.toEqual({
        success: true,
        message: 'Artifacts generated at dist/custom-env',
      });
      expect(readArgvLog()[0]).toContain('generate -deployment');

      const progress = service.getDeployProgress();
      expect(progress.error).toBeNull();
      expect(
        progress.phases.find((phase) => phase.id === 'building')?.status
      ).toBe('done');
      expect(progress.logs).toContain(
        'Generated deployment artifacts at dist/custom-env.'
      );
    });

    it('falls back to the default artifact directory when admin-env omits one', async () => {
      // No deployment file at all, so the compose-mode lookup falls back to 'image'.
      writeAdminEnv(`printf '{}'`);
      const service = new SetupService();

      await expect(service.buildImages()).resolves.toEqual({
        success: true,
        message: 'Artifacts generated at dist/admin-env',
      });
    });

    it('runs the batched docker build script for enabled services in build mode', async () => {
      writeDeployment(
        deploymentWith({ composeMode: 'build' }, [
          { serviceId: 'gateway', enabled: true },
          { serviceId: 'profile', enabled: false },
          { serviceId: 'assets', enabled: true },
        ])
      );
      writeAdminEnv(`printf '{"outputDir":"dist/admin-env"}'`);
      process.env['SETUP_CONSOLE_DOCKER_BUILD_BATCH_SIZE'] = '3';

      const service = new SetupService();
      const runStreamingCommand = jest
        .spyOn(
          service as unknown as { runStreamingCommand: () => Promise<void> },
          'runStreamingCommand'
        )
        .mockResolvedValue(undefined);

      await expect(service.buildImages()).resolves.toEqual({
        success: true,
        message:
          'Artifacts generated and Docker builds completed at dist/admin-env',
      });
      expect(runStreamingCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'bash',
          args: [
            './scripts/docker-build-batched.sh',
            '3',
            'docker-compose.yaml',
            '--services',
            'gateway,assets',
          ],
          env: { DOCKER_BATCH_SIZE: '3' },
        })
      );
    });

    it('skips docker builds in build mode when no service is enabled', async () => {
      writeDeployment(
        deploymentWith({ composeMode: 'build' }, [
          { serviceId: 'gateway', enabled: false },
        ])
      );
      writeAdminEnv(`printf '{"outputDir":"dist/admin-env"}'`);

      const service = new SetupService();
      const runStreamingCommand = jest
        .spyOn(
          service as unknown as { runStreamingCommand: () => Promise<void> },
          'runStreamingCommand'
        )
        .mockResolvedValue(undefined);

      await expect(service.buildImages()).resolves.toEqual({
        success: true,
        message:
          'Artifacts generated and Docker builds completed at dist/admin-env',
      });
      expect(runStreamingCommand).not.toHaveBeenCalled();
      expect(service.getDeployProgress().logs).toContain(
        'No enabled services required Docker build work for this deployment.'
      );
    });

    it('treats a wizard-state validation failure as a skipped, still-successful build', async () => {
      writeDeployment(deploymentWith({ composeMode: 'image' }, []));
      writeAdminEnv('echo "deployment validation failed" >&2\nexit 1');
      const service = new SetupService();

      await expect(service.buildImages()).resolves.toEqual({
        success: true,
        message: 'Artifact generation skipped (config in wizard state)',
      });

      const progress = service.getDeployProgress();
      expect(progress.error).toBeNull();
      expect(
        progress.phases.find((phase) => phase.id === 'building')?.status
      ).toBe('done');
    });

    it('fails the building phase when admin-env errors for any other reason', async () => {
      writeDeployment(deploymentWith({ composeMode: 'image' }, []));
      writeAdminEnv('echo "disk on fire" >&2\nexit 1');
      const service = new SetupService();

      const result = await service.buildImages();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Build failed:');

      const progress = service.getDeployProgress();
      expect(progress.activePhase).toBe('error');
      expect(progress.error).toContain('Build failed:');
      expect(
        progress.phases
          .find((phase) => phase.id === 'building')
          ?.substeps.find((substep) => substep.id === 'build-or-pull')?.status
      ).toBe('error');
    });
  });

  describe('initDatabases', () => {
    it('runs admin-env validation and the migrate script when both exist', async () => {
      writeDeployment(deploymentWith({}, []));
      writeAdminEnv(`printf 'admin-env\\n' >> "${argvLog}"\nprintf '{}'`);
      writeExecutable(
        path.join(workspaceRoot, 'scripts', 'setup-and-migrate.sh'),
        `printf 'migrate\\n' >> "${argvLog}"`
      );
      const service = new SetupService();

      await expect(service.initDatabases()).resolves.toEqual({
        success: true,
        message: 'Databases initialized',
      });
      expect(readArgvLog()).toEqual(['admin-env', 'migrate']);
      expect(
        service.getDeployProgress().phases.find((phase) => phase.id === 'db')
          ?.status
      ).toBe('done');
    });

    it('carries on when only the advisory validation fails', async () => {
      // Validation is a pre-check; the migration below is the step that has to
      // succeed, so a validation failure is logged rather than fatal.
      writeDeployment(deploymentWith({}, []));
      writeAdminEnv('exit 1');
      writeExecutable(
        path.join(workspaceRoot, 'scripts', 'setup-and-migrate.sh'),
        `printf 'migrate\\n' >> "${argvLog}"`
      );
      const service = new SetupService();

      await expect(service.initDatabases()).resolves.toEqual({
        success: true,
        message: 'Databases initialized',
      });
      expect(readArgvLog()).toEqual(['migrate']);
      expect(service.getDeployProgress().error).toBeNull();
    });

    it('fails the deployment when the migration script fails', async () => {
      // A silent success here would let deployAll start every service against
      // an unmigrated database.
      writeDeployment(deploymentWith({}, []));
      writeExecutable(
        path.join(workspaceRoot, 'scripts', 'setup-and-migrate.sh'),
        'exit 1'
      );
      const service = new SetupService();

      const result = await service.initDatabases();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Database migration failed');

      const progress = service.getDeployProgress();
      expect(progress.error).toContain('Database migration failed');
      expect(
        progress.phases
          .find((phase) => phase.id === 'db')
          ?.substeps.find((substep) => substep.id === 'run-migrations')?.status
      ).toBe('error');
    });

    it('skips both commands when neither the binary nor the script exists', async () => {
      const service = new SetupService();

      await expect(service.initDatabases()).resolves.toEqual({
        success: true,
        message: 'Databases initialized',
      });
      expect(readArgvLog()).toEqual([]);
    });
  });

  describe('deployServices', () => {
    it('fails when the compose file is missing', async () => {
      const service = new SetupService();

      await expect(service.deployServices()).resolves.toEqual({
        success: false,
        message: 'docker-compose.yaml not found',
      });
      expect(
        service
          .getDeployProgress()
          .phases.find((phase) => phase.id === 'deploying')
          ?.substeps.find((substep) => substep.id === 'resolve-services')
          ?.status
      ).toBe('error');
    });

    it('fails the deploying phase when no service is enabled', async () => {
      writeComposeFile();
      writeDeployment(
        deploymentWith({ composeMode: 'image' }, [
          { serviceId: 'gateway', enabled: false },
        ])
      );
      const service = new SetupService();

      await expect(service.deployServices()).resolves.toEqual({
        success: false,
        message:
          'Deployment failed: No enabled services found in deployment config',
      });
      expect(service.getDeployProgress().activePhase).toBe('error');
    });

    it('pulls in batches sized by SETUP_CONSOLE_DOCKER_PULL_BATCH_SIZE', async () => {
      writeComposeFile();
      writeDeployment(
        deploymentWith({ composeMode: 'image', defaultTag: 'sha-batch' }, [
          { serviceId: 'gateway', enabled: true },
          { serviceId: 'profile', enabled: true },
          { serviceId: 'assets', enabled: true },
        ])
      );
      process.env['SETUP_CONSOLE_DOCKER_PULL_BATCH_SIZE'] = '2';

      const service = new SetupService();
      const runStreamingCommand = jest
        .spyOn(
          service as unknown as { runStreamingCommand: () => Promise<void> },
          'runStreamingCommand'
        )
        .mockResolvedValue(undefined);

      await expect(service.deployServices()).resolves.toEqual({
        success: true,
        message:
          'Services pulled, recreated, and seeded through the batched production rollout script.',
      });

      // Two pull batches (2 + 1) followed by the single recreate command.
      expect(runStreamingCommand).toHaveBeenCalledTimes(3);
      expect(runStreamingCommand).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          args: expect.arrayContaining(['pull', 'gateway', 'profile']),
        })
      );
      expect(runStreamingCommand).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          args: expect.arrayContaining(['pull', 'assets']),
        })
      );
      expect(service.getDeployProgress().logs).toContain(
        'Pulling batch 2: assets'
      );
    });

    it('runs a plain compose up when the environment builds locally', async () => {
      writeComposeFile();
      writeDeployment(
        deploymentWith({ composeMode: 'build' }, [
          { serviceId: 'gateway', enabled: true },
        ])
      );

      const service = new SetupService();
      const runStreamingCommand = jest
        .spyOn(
          service as unknown as { runStreamingCommand: () => Promise<void> },
          'runStreamingCommand'
        )
        .mockResolvedValue(undefined);

      await expect(service.deployServices()).resolves.toEqual({
        success: true,
        message: 'Services deployed',
      });
      expect(runStreamingCommand).toHaveBeenCalledTimes(1);
      expect(runStreamingCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'docker',
          args: [
            'compose',
            '-f',
            path.join(workspaceRoot, 'docker-compose.yaml'),
            'up',
            '-d',
            'gateway',
          ],
        })
      );
    });

    it('records the rollout error when the compose command fails', async () => {
      writeComposeFile();
      writeDeployment(
        deploymentWith({ composeMode: 'build' }, [
          { serviceId: 'gateway', enabled: true },
        ])
      );

      const service = new SetupService();
      jest
        .spyOn(
          service as unknown as { runStreamingCommand: () => Promise<void> },
          'runStreamingCommand'
        )
        .mockRejectedValue(new Error('compose up exploded'));

      await expect(service.deployServices()).resolves.toEqual({
        success: false,
        message: 'Deployment failed: compose up exploded',
      });
      expect(service.getDeployProgress().error).toBe(
        'Deployment failed: compose up exploded'
      );
    });
  });

  describe('deployAll', () => {
    interface StageStubs {
      buildImages: jest.SpyInstance;
      provisionInfra: jest.SpyInstance;
      initDatabases: jest.SpyInstance;
      deployServices: jest.SpyInstance;
    }

    const stubStages = (service: SetupService): StageStubs => ({
      buildImages: jest
        .spyOn(service, 'buildImages')
        .mockResolvedValue({ success: true, message: 'built' }),
      provisionInfra: jest
        .spyOn(service, 'provisionInfra')
        .mockResolvedValue({ success: true, message: 'infra' }),
      initDatabases: jest
        .spyOn(service, 'initDatabases')
        .mockResolvedValue({ success: true, message: 'db' }),
      deployServices: jest
        .spyOn(service, 'deployServices')
        .mockResolvedValue({ success: true, message: 'services' }),
    });

    it('runs every stage in order and returns the rollout result', async () => {
      const service = new SetupService();
      const stages = stubStages(service);

      await expect(service.deployAll()).resolves.toEqual({
        success: true,
        message: 'services',
      });
      expect(stages.buildImages).toHaveBeenCalledTimes(1);
      expect(stages.provisionInfra).toHaveBeenCalledTimes(1);
      expect(stages.initDatabases).toHaveBeenCalledTimes(1);
      expect(stages.deployServices).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['buildImages', 'build-images'] as const,
      ['provisionInfra', 'infra-compose'] as const,
      ['initDatabases', 'init-databases'] as const,
    ])(
      'stops at %s and tags the failing phase as %s',
      async (stageName, phase) => {
        const service = new SetupService();
        const stages = stubStages(service);
        stages[stageName].mockResolvedValue({
          success: false,
          message: 'stage broke',
        });

        await expect(service.deployAll()).resolves.toEqual({
          phase,
          success: false,
          message: 'stage broke',
        });
        expect(stages.deployServices).not.toHaveBeenCalled();
      }
    );
  });

  describe('createOwner and completeSetup', () => {
    it('returns the identifiers from the admin-api bootstrap response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { user: { id: 'user-9' } },
          profileId: 'profile-9',
        }),
      }) as typeof fetch;

      const service = new SetupService();

      await expect(
        service.createOwner('Owner', '  Owner@Example.COM ', 'pw')
      ).resolves.toEqual({
        userId: 'user-9',
        profileId: 'profile-9',
        email: 'owner@example.com',
        name: 'Owner',
      });
    });

    it('throws with the status and body when owner registration is rejected', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 409,
        text: async () => 'email already registered',
      }) as typeof fetch;

      const service = new SetupService();

      await expect(
        service.createOwner('Owner', 'owner@example.com', 'pw')
      ).rejects.toThrow(
        'Owner registration failed (409): email already registered'
      );
    });

    it('creates the saved operator, clears the operator file and finishes the run', async () => {
      const fetchMock = jest
        .fn()
        // getExistingOwnerUsers -> nobody yet
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        // createOwner
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ userId: 'owner-new' }),
        })
        // activateOwnerBootstrap
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      global.fetch = fetchMock as typeof fetch;

      const service = new SetupService();
      await service.saveOperator('New Owner', 'new@example.com', 'pw');

      await service.completeSetup();

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        'http://127.0.0.1:8098/api/bootstrap/owner',
        expect.objectContaining({ method: 'POST' })
      );
      // The stored credentials must not outlive a successful bootstrap.
      expect(
        fs.existsSync(path.join(workspaceRoot, '.setup-operator.json'))
      ).toBe(false);

      const progress = service.getDeployProgress();
      expect(progress.activePhase).toBe('done');
      expect(progress.message).toBe(
        'Setup complete! Redirecting to owner console...'
      );
      expect(
        progress.phases.find((phase) => phase.id === 'rebooting')?.status
      ).toBe('done');
    });

    it('fails the save-owner substep and rethrows when owner creation fails', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: async () => 'boom',
        });
      global.fetch = fetchMock as typeof fetch;

      const service = new SetupService();
      await service.saveOperator('New Owner', 'new@example.com', 'pw');

      await expect(service.completeSetup()).rejects.toThrow(
        'Owner registration failed (500): boom'
      );

      const progress = service.getDeployProgress();
      expect(progress.activePhase).toBe('error');
      expect(progress.error).toContain('Owner registration failed (500)');
      // The operator file is kept so the operator can retry.
      expect(
        fs.existsSync(path.join(workspaceRoot, '.setup-operator.json'))
      ).toBe(true);
    });

    it('fails the mark-setup substep when owner activation is rejected', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'admin api down',
      }) as typeof fetch;

      const service = new SetupService();

      await expect(service.completeSetup()).rejects.toThrow(
        'Owner activation failed (503): admin api down'
      );

      const progress = service.getDeployProgress();
      expect(progress.activePhase).toBe('error');
      expect(progress.activeSubstepId).toBe('mark-setup');
    });

    it('resets deploy progress back to the idle snapshot', async () => {
      const service = new SetupService();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => '',
      }) as typeof fetch;

      await expect(service.completeSetup()).rejects.toThrow(
        'Owner activation failed (500)'
      );
      expect(service.getDeployProgress().activePhase).toBe('error');

      service.resetDeployProgress();

      const progress = service.getDeployProgress();
      expect(progress.activePhase).toBe('idle');
      expect(progress.error).toBeNull();
      expect(
        progress.phases.every((phase) =>
          phase.substeps.every((substep) => substep.status === 'pending')
        )
      ).toBe(true);
    });
  });
});
