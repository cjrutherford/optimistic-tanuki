import { execSync } from 'child_process';
import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  console.log('\nSetting up...\n');

  execSync(
    'docker compose -f ./apps/profile-e2e/src/support/docker-compose.profile-e2e.yaml up -d',
    {
      stdio: 'inherit',
    }
  );

  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ? Number(process.env.PORT) : 3002;
  await waitForPortOpen(port, { host });

  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
