import { join } from 'node:path';

import { getSetupSeedCommands, getStackStartupCommands } from './global-setup';

describe('business-site e2e global setup', () => {
  it('starts the stack with the dev compose override so gateway uses fresh dist output', () => {
    const workspaceRoot = '/workspace';

    expect(getStackStartupCommands(workspaceRoot)).toEqual([
      {
        command: 'pnpm',
        args: ['run', 'docker:dev:down'],
        cwd: workspaceRoot,
      },
      {
        command: 'bash',
        args: ['./scripts/docker-start-phased.sh', 'docker-compose.dev.yaml', '5'],
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
        args: [join(workspaceRoot, 'seed-permissions.sh')],
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
