import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

async function globalTeardown(config: FullConfig) {
  if (process.env.CI) {
    console.log('\n[Playwright Global Teardown] Skipping docker-compose cleanup because CI environment detected');
    return;
  }
  const composeFile = join(
    __dirname,
    '../../e2e/docker-compose.client-interface-e2e.yaml'
  );
  console.log(`
[Playwright Global Teardown] Stopping docker-compose: ${composeFile}`);

  try {
    await execAsync(`docker compose -f ${composeFile} down -v`);
    console.log('Cleanup complete.');
  } catch (error) {
    console.error('Error during teardown:', error);
  }
}

export default globalTeardown;
