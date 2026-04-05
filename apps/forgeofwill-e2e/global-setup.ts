import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

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
    await execAsync(`docker compose -f ${composeFile} up -d --build`);
    console.log('Waiting for backend services to be ready (15s)...');
    await new Promise((resolve) => setTimeout(resolve, 15000));
  } catch (error) {
    console.error('Failed to start E2E environment:', error);
    throw error;
  }
}

export default globalSetup;
