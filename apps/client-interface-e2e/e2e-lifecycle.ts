import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = resolve(__dirname, '../..');
const COMPOSE_FILE = 'e2e/docker-compose.e2e-stack.yaml';
const TARGET = 'client-interface-e2e';
const BUILD_EXCLUDED_SERVICES = new Set([
  'db',
  'redis',
  'permissions-seed',
  'app-configurator-seed',
]);

type LifecyclePhase = {
  name: string;
  services: string[];
  startWithDependencies?: boolean;
  profile?: string | null;
};

type E2eTarget = {
  stack: { profile?: string | null };
};

type E2eManifest = {
  resolveE2eLifecyclePhases: (target: E2eTarget) => LifecyclePhase[];
  resolveE2eServices: (target: E2eTarget) => string[];
  resolveE2eTarget: (target: string) => E2eTarget;
};

async function loadE2eManifest(): Promise<E2eManifest> {
  const manifestUrl = pathToFileURL(
    resolve(WORKSPACE_ROOT, 'scripts/e2e-environment-manifest.mjs')
  ).href;
  return import(manifestUrl) as Promise<E2eManifest>;
}

function composeProjectName(): string {
  const configured = process.env['E2E_COMPOSE_PROJECT'];
  if (configured) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(configured)) {
      throw new Error(
        'E2E_COMPOSE_PROJECT may contain only letters, numbers, underscores, and hyphens'
      );
    }
    return configured;
  }

  const project = `ot-e2e-local-client-interface-${process.pid}`;
  process.env['E2E_COMPOSE_PROJECT'] = project;
  return project;
}

async function run(command: string, args: string[]): Promise<void> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: WORKSPACE_ROOT,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (error) {
    const commandError = error as {
      stdout?: string;
      stderr?: string;
      message: string;
    };
    if (commandError.stdout) process.stdout.write(commandError.stdout);
    if (commandError.stderr) process.stderr.write(commandError.stderr);
    throw new Error(
      `${command} ${args.join(' ')} failed: ${commandError.message}`
    );
  }
}

function composeArgs(
  project: string,
  command: string[],
  profile?: string | null
): string[] {
  return [
    'compose',
    '--project-name',
    project,
    '-f',
    COMPOSE_FILE,
    ...(profile ? ['--profile', profile] : []),
    ...command,
  ];
}

async function compose(
  project: string,
  command: string[],
  profile?: string | null
): Promise<void> {
  await run('docker', composeArgs(project, command, profile));
}

export function shouldManageE2eEnvironment(): boolean {
  return process.env['CI'] !== 'true' && process.env['SKIP_SETUP'] !== 'true';
}

/**
 * Starts only the manifest-defined client-interface closure in an isolated
 * Compose project. This is intentionally independent of the E2E runner so a
 * direct `nx run client-interface-e2e:e2e` has the same prerequisites.
 */
export async function startClientInterfaceE2eEnvironment(): Promise<void> {
  const manifest = await loadE2eManifest();
  const target = manifest.resolveE2eTarget(TARGET);
  const project = composeProjectName();
  const services = manifest.resolveE2eServices(target);
  const buildableServices = services.filter(
    (service) => !BUILD_EXCLUDED_SERVICES.has(service)
  );

  await compose(
    project,
    ['down', '-v', '--remove-orphans'],
    target.stack.profile
  );
  if (buildableServices.length > 0) {
    await compose(
      project,
      ['build', ...buildableServices],
      target.stack.profile
    );
  }

  for (const phase of manifest.resolveE2eLifecyclePhases(target)) {
    await compose(
      project,
      [
        'up',
        '-d',
        '--no-build',
        ...(phase.startWithDependencies ? [] : ['--no-deps']),
        ...phase.services,
      ],
      phase.profile
    );
    await run('node', [
      'scripts/wait-for-e2e-readiness.mjs',
      '--target',
      TARGET,
      '--phase',
      phase.name,
      '--compose-project',
      project,
    ]);
  }

  await run('node', [
    'scripts/wait-for-e2e-readiness.mjs',
    '--target',
    TARGET,
    '--compose-project',
    project,
  ]);
}

export async function stopClientInterfaceE2eEnvironment(): Promise<void> {
  const project = process.env['E2E_COMPOSE_PROJECT'];
  if (!project) return;
  const target = (await loadE2eManifest()).resolveE2eTarget(TARGET);
  await compose(
    project,
    ['down', '-v', '--remove-orphans'],
    target.stack.profile
  );
}
