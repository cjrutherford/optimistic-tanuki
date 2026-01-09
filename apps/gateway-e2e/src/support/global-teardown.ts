import { killPort } from '@nx/node/utils';

/* eslint-disable */
module.exports = async function () {
  // Put clean up logic here (e.g. stopping services, docker-compose, etc.).
  // Hint: `globalThis` is shared between setup and teardown.
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  const { execSync } = require('child_process');
  try {
    execSync(
      'docker compose -f ./apps/gateway-e2e/src/support/docker-compose.gateway-e2e.yaml down -v',
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error('Error running docker compose down -v:', error);
  }

  await killPort(port);
  console.log(globalThis.__TEARDOWN_MESSAGE__);
};
