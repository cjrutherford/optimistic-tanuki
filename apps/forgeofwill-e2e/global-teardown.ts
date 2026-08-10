import { FullConfig } from '@playwright/test';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execFileAsync = promisify(execFile);

async function globalTeardown(config: FullConfig) {
  if (process.env['CI']) {
    console.log(
      '\n[Playwright Global Teardown] Skipping docker-compose cleanup because CI environment detected'
    );
    return;
  }

  if (process.env['SKIP_SETUP'] === 'true') {
    console.log(
      '\n[Playwright Global Teardown] SKIP_SETUP=true detected, skipping docker-compose cleanup'
    );
    return;
  }

  const composeFile = join(
    __dirname,
    '../../e2e/docker-compose.forgeofwill-e2e.yaml'
  );
  console.log(`
[Playwright Global Teardown] Stopping docker-compose: ${composeFile}`);

  try {
    await execFileAsync('docker', ['compose', '-f', composeFile, 'down', '-v']);
    console.log('Cleanup complete.');
  } catch (error) {
    console.error('Error during teardown:', error);
  }
}

export default globalTeardown;
