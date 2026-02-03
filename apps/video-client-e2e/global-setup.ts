import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

async function globalSetup(config: FullConfig) {
  const composeFile = join(
    __dirname,
    '../../e2e/docker-compose.video-client-e2e.yaml'
  );
  console.log(`
[Playwright Global Setup] Starting docker-compose: ${composeFile}`);

  try {
    await execAsync(`docker compose -f ${composeFile} up -d --build`);
    console.log('Waiting for backend services to be ready (20s)...');
    await new Promise((resolve) => setTimeout(resolve, 20000));

    // Seeding
    console.log('Seeding data...');
    try {
      await execAsync(
        `docker compose -f ${composeFile} exec -T permissions node seed-permissions.js`
      );
      console.log('Permissions seeded.');
    } catch (e) {
      console.warn('Failed to seed permissions:', e.message);
    }

    try {
      await execAsync(
        `docker compose -f ${composeFile} exec -T videos node seed-videos.js`
      );
      console.log('Videos seeded.');
    } catch (e) {
      console.warn('Failed to seed videos:', e.message);
    }

    console.log('Waiting for video-client to be ready on port 8086...');
    await new Promise((resolve) => setTimeout(resolve, 15000));
  } catch (error) {
    console.error('Failed to start E2E environment:', error);
    throw error;
  }
}

export default globalSetup;
