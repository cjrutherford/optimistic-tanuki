import { execSync } from 'child_process';
import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  console.log('\nSetting up...\n');

  execSync(
    'docker compose -f ./apps/authentication-e2e/src/support/docker-compose.authentication-e2e.yaml up -d',
    {
      stdio: 'inherit',
    }
  );

  const host = process.env.HOST ?? '127.0.0.1';
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;

  await waitForPortOpen(port, { host });

  globalThis.socketConnectionOptions = {
    host,
    port,
  };

  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
