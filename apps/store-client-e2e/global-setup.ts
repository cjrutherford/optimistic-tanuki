import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  const composeFile = join(__dirname, '../../e2e/docker-compose.store-client-e2e.yaml');
  console.log(`
[Playwright Global Setup] Starting docker-compose: ${composeFile}`);
  
  try {
    await execAsync(`docker compose -f ${composeFile} up -d --build`);
    console.log('Waiting for backend services to be ready (15s)...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Seeding
    console.log('Seeding data...');
    try {
      await execAsync(`docker compose -f ${composeFile} exec -T permissions node seed-permissions.js`);
      console.log('Permissions seeded.');
    } catch (e) {
      console.warn('Failed to seed permissions:', e.message);
    }

    try {
      await execAsync(`docker compose -f ${composeFile} exec -T store node seed-store.js`);
      console.log('Store seeded.');
    } catch (e) {
      console.warn('Failed to seed store:', e.message);
    }

    console.log('Waiting for store-client to be ready on port 4200...');
    // We can use a simple wait or a more sophisticated check
    await new Promise(resolve => setTimeout(resolve, 10000));
  } catch (error) {
    console.error('Failed to start E2E environment:', error);
    throw error;
  }
}

export default globalSetup;
