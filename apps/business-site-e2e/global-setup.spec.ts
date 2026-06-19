import { join } from 'node:path';

import {
  getBuildCommand,
  getComposeArgs,
  getSetupSeedCommands,
  getStackStartupCommands,
} from './global-setup';

describe('business-site e2e global setup', () => {
  it('builds only the business-site workflow apps without replaying nx cache outputs', () => {
    const workspaceRoot = '/workspace';

    expect(getBuildCommand(workspaceRoot)).toEqual({
      command: 'pnpm',
      args: [
        'exec',
        'nx',
        'run-many',
        '--target=build',
        '--projects=authentication,profile,permissions,store,lead-tracker,gateway,business-site',
        '--configuration=development',
        '--skip-nx-cache',
      ],
      cwd: workspaceRoot,
      env: {
        NX_DAEMON: 'false',
        NX_ISOLATE_PLUGINS: 'false',
      },
    });
  });

  it('uses the business-site e2e compose overlay for a minimal gateway composition', () => {
    expect(getComposeArgs()).toEqual([
      'compose',
      '-f',
      'docker-compose.yaml',
      '-f',
      'docker-compose.dev.yaml',
      '-f',
      'apps/business-site-e2e/docker-compose.e2e.yaml',
    ]);
  });

  it('starts only the services needed for the business-site workflow stack', () => {
    const workspaceRoot = '/workspace';

    expect(getStackStartupCommands(workspaceRoot)).toEqual([
      {
        command: 'docker',
        args: [
          'compose',
          '-f',
          'docker-compose.yaml',
          '-f',
          'docker-compose.dev.yaml',
          '-f',
          'apps/business-site-e2e/docker-compose.e2e.yaml',
          'down',
          '-v',
          '--remove-orphans',
        ],
        cwd: workspaceRoot,
      },
      {
        command: 'docker',
        args: [
          'compose',
          '-f',
          'docker-compose.yaml',
          '-f',
          'docker-compose.dev.yaml',
          '-f',
          'apps/business-site-e2e/docker-compose.e2e.yaml',
          'up',
          '-d',
          'postgres',
          'redis',
        ],
        cwd: workspaceRoot,
      },
      {
        command: 'docker',
        args: [
          'compose',
          '-f',
          'docker-compose.yaml',
          '-f',
          'docker-compose.dev.yaml',
          '-f',
          'apps/business-site-e2e/docker-compose.e2e.yaml',
          'up',
          '-d',
          'db-setup',
        ],
        cwd: workspaceRoot,
      },
      {
        command: 'docker',
        args: [
          'compose',
          '-f',
          'docker-compose.yaml',
          '-f',
          'docker-compose.dev.yaml',
          '-f',
          'apps/business-site-e2e/docker-compose.e2e.yaml',
          'wait',
          'db-setup',
        ],
        cwd: workspaceRoot,
      },
      {
        command: 'docker',
        args: [
          'compose',
          '-f',
          'docker-compose.yaml',
          '-f',
          'docker-compose.dev.yaml',
          '-f',
          'apps/business-site-e2e/docker-compose.e2e.yaml',
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
        args: [
          'compose',
          '-f',
          'docker-compose.yaml',
          '-f',
          'docker-compose.dev.yaml',
          '-f',
          'apps/business-site-e2e/docker-compose.e2e.yaml',
          'up',
          '-d',
          '--no-deps',
          'business-site',
        ],
        cwd: workspaceRoot,
      },
    ]);
  });

  it('seeds permissions before business users', () => {
    const workspaceRoot = '/workspace';
    const commands = getSetupSeedCommands(workspaceRoot);

    expect(commands).toEqual([
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
          APP_SCOPE: 'business-site',
          GATEWAY_URL: 'http://localhost:3000/api',
          POSTGRES_HOST: '127.0.0.1',
        },
      },
    ]);
  });
});
