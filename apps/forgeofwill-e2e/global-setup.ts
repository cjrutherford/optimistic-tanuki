import { FullConfig } from '@playwright/test';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join, resolve } from 'path';

const execFileAsync = promisify(execFile);

async function globalSetup(config: FullConfig) {
  if (process.env['CI']) {
    console.log(
      '\n[Playwright Global Setup] Skipping docker-compose because CI environment detected'
    );
    return;
  }

  if (process.env['SKIP_SETUP'] === 'true') {
    console.log(
      '\n[Playwright Global Setup] SKIP_SETUP=true detected, skipping docker-compose'
    );
    return;
  }

  const composeFile = join(
    __dirname,
    '../../e2e/docker-compose.forgeofwill-e2e.yaml'
  );
  console.log(`
[Playwright Global Setup] Starting docker-compose: ${composeFile}`);

  try {
    await execFileAsync('docker', [
      'compose',
      '-f',
      composeFile,
      'up',
      '-d',
      '--build',
    ]);
    await execFileAsync('node', [
      resolve(__dirname, '../../scripts/wait-for-e2e-readiness.mjs'),
      '--compose-file',
      composeFile,
      '--service',
      'db-setup,authentication,profile,project-planning,permissions,gateway,oauth-provider,forgeofwill-client-interface',
      '--url',
      // Node does not consistently resolve subdomains of .localhost on every
      // runner; the published Forge port is still reached through loopback.
      'http://127.0.0.1:8081',
    ]);
  } catch (error) {
    console.error('Failed to start E2E environment:', error);
    throw error;
  }
}

export default globalSetup;
