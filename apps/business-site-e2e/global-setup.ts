import { FullConfig } from '@playwright/test';
import { spawn } from 'child_process';
import { join } from 'node:path';
import net from 'node:net';

type SetupCommand = {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

const BUSINESS_SITE_E2E_BUILD_PROJECTS = [
  'authentication',
  'profile',
  'permissions',
  'store',
  'lead-tracker',
  'gateway',
  'business-site',
].join(',');

export function getComposeArgs() {
  return [
    'compose',
    '-f',
    'docker-compose.yaml',
    '-f',
    'docker-compose.dev.yaml',
    '-f',
    'apps/business-site-e2e/docker-compose.e2e.yaml',
  ];
}

export function getBuildCommand(workspaceRoot: string): SetupCommand {
  return {
    command: 'pnpm',
    args: [
      'exec',
      'nx',
      'run-many',
      '--target=build',
      `--projects=${BUSINESS_SITE_E2E_BUILD_PROJECTS}`,
      '--configuration=development',
      '--skip-nx-cache',
    ],
    cwd: workspaceRoot,
    env: {
      NX_DAEMON: 'false',
      NX_ISOLATE_PLUGINS: 'false',
    },
  };
}

function run(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`${command} ${args.join(' ')} exited with code ${code}`)
      );
    });
  });
}

function waitForPort(port: number, host = '127.0.0.1', timeoutMs = 300000) {
  const startedAt = Date.now();

  return new Promise<void>((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect(port, host);

      socket.once('connect', () => {
        socket.end();
        resolve();
      });

      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1000);
      });
    };

    attempt();
  });
}

function waitForHttpOk(url: string, timeoutMs = 300000) {
  const startedAt = Date.now();

  return new Promise<void>((resolve, reject) => {
    const attempt = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Retry until the endpoint is ready.
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      setTimeout(() => {
        void attempt();
      }, 1000);
    };

    void attempt();
  });
}

export function getSetupSeedCommands(workspaceRoot: string): SetupCommand[] {
  return [
    {
      command: 'sh',
      args: [join(workspaceRoot, 'scripts/seed-permissions.sh')],
      env: {
        POSTGRES_HOST: '127.0.0.1',
        POSTGRES_DB: 'ot_permissions',
        SKIP_PERMISSION_USER_ASSIGNMENTS: 'true',
      },
    },
    {
      command: 'node',
      args: [join(workspaceRoot, 'apps/business-site/src/seed-business.mjs')],
      env: {
        GATEWAY_URL: 'http://localhost:3000/api',
        APP_SCOPE: 'business-site',
        POSTGRES_HOST: '127.0.0.1',
      },
    },
  ];
}

export function getStackStartupCommands(workspaceRoot: string): SetupCommand[] {
  const composeArgs = getComposeArgs();

  return [
    {
      command: 'docker',
      args: [...composeArgs, 'down', '-v', '--remove-orphans'],
      cwd: workspaceRoot,
    },
    {
      command: 'docker',
      args: [...composeArgs, 'up', '-d', 'postgres', 'redis'],
      cwd: workspaceRoot,
    },
    {
      command: 'docker',
      args: [...composeArgs, 'up', '-d', 'db-setup'],
      cwd: workspaceRoot,
    },
    {
      command: 'docker',
      args: [...composeArgs, 'wait', 'db-setup'],
      cwd: workspaceRoot,
    },
    {
      command: 'docker',
      args: [
        ...composeArgs,
        'up',
        '-d',
        '--no-deps',
        'authentication',
        'profile',
        'permissions',
        'store',
        'lead-tracker',
        'gateway',
      ],
      cwd: workspaceRoot,
    },
    {
      command: 'docker',
      args: [...composeArgs, 'up', '-d', '--no-deps', 'business-site'],
      cwd: workspaceRoot,
    },
  ];
}

async function globalSetup(_config: FullConfig) {
  if (process.env['SKIP_SETUP'] === 'true') {
    console.log(
      '\n[Playwright Global Setup] SKIP_SETUP=true, skipping Docker startup'
    );
    return;
  }

  const workspaceRoot = join(__dirname, '../../');
  const buildCommand = getBuildCommand(workspaceRoot);

  console.log(
    '\n[Playwright Global Setup] Building business-site stack artifacts...'
  );
  await run(
    buildCommand.command,
    buildCommand.args,
    buildCommand.cwd ?? workspaceRoot,
    buildCommand.env
  );

  console.log(
    '\n[Playwright Global Setup] Starting business-site stack via phased docker startup...'
  );
  for (const command of getStackStartupCommands(workspaceRoot)) {
    await run(
      command.command,
      command.args,
      command.cwd ?? workspaceRoot,
      command.env
    );
  }

  console.log(
    '[Playwright Global Setup] Waiting for gateway and business-site ports...'
  );
  await waitForPort(3000);
  await waitForPort(8094);
  await waitForHttpOk('http://127.0.0.1:3000/api/business/site-config');
  await waitForHttpOk('http://127.0.0.1:8094/api/business/site-config');

  const seedCommands = getSetupSeedCommands(workspaceRoot);

  console.log(
    '[Playwright Global Setup] Seeding permissions and business users...'
  );
  for (const seedCommand of seedCommands) {
    await run(
      seedCommand.command,
      seedCommand.args,
      workspaceRoot,
      seedCommand.env
    );
  }
}

export default globalSetup;
