import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

async function globalTeardown(config: FullConfig) {
  const composeFile = join(
    __dirname,
    '../../e2e/docker-compose.video-client-e2e.yaml'
  );
  console.log(`
[Playwright Global Teardown] Stopping docker-compose: ${composeFile}`);

  try {
    await execAsync(`docker compose -f ${composeFile} down -v`);
    console.log('E2E environment stopped and cleaned up.');
  } catch (error) {
    console.error('Failed to teardown E2E environment:', error);
  }
}

export default globalTeardown;
