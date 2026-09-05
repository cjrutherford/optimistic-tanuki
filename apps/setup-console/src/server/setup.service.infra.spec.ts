import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SetupService } from './setup.service';

/**
 * `provisionInfra` invokes `docker` by bare name, so it is resolved through the
 * PATH of the real OS process. Jest hands each test file a sandboxed copy of
 * `process.env`, which means a PATH prepended from a test never reaches the
 * child process and a shell stub cannot shadow the real docker CLI. This file
 * therefore mocks `child_process.execFile` instead; `spawn` is passed through
 * untouched so nothing else in the service changes behaviour.
 *
 * The service promisifies `execFile` at module load, and generic
 * `util.promisify` resolves with whatever single value the callback receives --
 * hence the stub answers with a `{ stdout, stderr }` object rather than
 * positional arguments.
 */
type ExecFileCallback = (
  error: Error | null,
  result?: { stdout: string; stderr: string }
) => void;

const mockExecFile = jest.fn();

jest.mock('child_process', () => {
  const actual = jest.requireActual('child_process');
  return {
    ...actual,
    execFile: (...args: unknown[]) => mockExecFile(...args),
  };
});

describe('SetupService.provisionInfra', () => {
  const originalEnv = { ...process.env };
  let workspaceRoot: string;

  const succeedWith = (stdout: string): void => {
    mockExecFile.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: ExecFileCallback
      ) => callback(null, { stdout, stderr: '' })
    );
  };

  const failWith = (message: string): void => {
    mockExecFile.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: ExecFileCallback
      ) => callback(new Error(message))
    );
  };

  const writeComposeFile = (): void => {
    fs.writeFileSync(
      path.join(workspaceRoot, 'docker-compose.yaml'),
      'services:\n  gateway:\n    image: gateway:latest\n'
    );
  };

  beforeEach(() => {
    mockExecFile.mockReset();
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-infra-'));
    fs.mkdirSync(path.join(workspaceRoot, 'ops', 'deployments'), {
      recursive: true,
    });
    process.env['SETUP_WORKSPACE_ROOT'] = workspaceRoot;
    process.env['ADMIN_API_DEPLOYMENT_PATH'] =
      './ops/deployments/production.yaml';
    process.env['ADMIN_API_SECRETS_PATH'] = './.secrets';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  });

  it('refuses to provision without a compose file and never calls docker', async () => {
    const service = new SetupService();

    await expect(service.provisionInfra()).resolves.toEqual({
      success: false,
      message: 'docker-compose.yaml not found',
    });
    expect(mockExecFile).not.toHaveBeenCalled();
    expect(service.getDeployProgress().error).toBe(
      'docker-compose.yaml not found'
    );
  });

  it('brings up the shared infrastructure services and returns the docker output', async () => {
    writeComposeFile();
    succeedWith('Container postgres Started\n');
    const service = new SetupService();

    await expect(service.provisionInfra()).resolves.toEqual({
      success: true,
      message: 'Container postgres Started\n',
    });
    expect(mockExecFile).toHaveBeenCalledWith(
      'docker',
      [
        'compose',
        '-f',
        path.join(workspaceRoot, 'docker-compose.yaml'),
        'up',
        '-d',
        '--no-recreate',
        'postgres',
        'redis',
        'db-setup',
        'gateway',
        'authentication',
        'owner-console',
      ],
      expect.objectContaining({ cwd: workspaceRoot }),
      expect.any(Function)
    );

    const progress = service.getDeployProgress();
    expect(progress.phases.find((phase) => phase.id === 'infra')?.status).toBe(
      'done'
    );
    expect(progress.error).toBeNull();
  });

  it('falls back to a generic message when docker prints nothing', async () => {
    writeComposeFile();
    succeedWith('');
    const service = new SetupService();

    await expect(service.provisionInfra()).resolves.toEqual({
      success: true,
      message: 'Infrastructure provisioned',
    });
  });

  it.each([
    ['port is already in use'],
    ['Error response from daemon: Already exists'],
  ])('treats "%s" as an already-running stack', async (dockerError) => {
    writeComposeFile();
    failWith(`Command failed: docker compose up\n${dockerError}\n`);
    const service = new SetupService();

    await expect(service.provisionInfra()).resolves.toEqual({
      success: true,
      message: 'Infrastructure already running',
    });

    const progress = service.getDeployProgress();
    expect(progress.error).toBeNull();
    expect(progress.phases.find((phase) => phase.id === 'infra')?.status).toBe(
      'done'
    );
  });

  it('fails the infra phase on any other docker error', async () => {
    writeComposeFile();
    failWith('Cannot connect to the Docker daemon');
    const service = new SetupService();

    await expect(service.provisionInfra()).resolves.toEqual({
      success: false,
      message: 'Infra provisioning failed: Cannot connect to the Docker daemon',
    });

    const progress = service.getDeployProgress();
    expect(progress.activePhase).toBe('error');
    expect(progress.activeSubstepId).toBe('start-shared-services');
    expect(progress.phases.find((phase) => phase.id === 'infra')?.status).toBe(
      'error'
    );
  });
});
