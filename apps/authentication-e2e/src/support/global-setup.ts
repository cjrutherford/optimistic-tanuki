import { execSync } from 'child_process';
import { waitForPortOpen } from '@nx/node/utils';

/* eslint-disable */
var __TEARDOWN_MESSAGE__: string;

module.exports = async function () {
  // Start services that that the app needs to run (e.g. database, docker-compose, etc.).
  console.log('\nSetting up...\n');

  // execSync('docker compose -f ./apps/authentication-e2e/src/support/docker-compose.authentication-e2e.yaml up -d', {
  //   stdio: 'inherit',
  // });

  const host = process.env.HOST ?? '127.0.0.1';
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;

  globalThis.socketConnectionOptions = {
    host: host,
    port: port,
  };

  // Hint: Use `globalThis` to pass variables to global teardown.
  globalThis.__TEARDOWN_MESSAGE__ = '\nTearing down...\n';
};
