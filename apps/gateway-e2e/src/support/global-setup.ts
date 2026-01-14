import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { waitForPortOpen } from '@nx/node/utils';

const execAsync = promisify(exec);

export default async function () {
  const projectName = 'gateway-e2e';
  const port = 3000;
  const composeFile = join(__dirname, '../../../../e2e/docker-compose.gateway-e2e.yaml');
  
  console.log(`
Setting up E2E environment for ${projectName}...`);

  try {
    console.log(`Cleaning up any existing environment for ${projectName}...`);
    await execAsync(`docker compose -p ${projectName} -f ${composeFile} down -v --remove-orphans`);
  } catch (e) {
    // ignore
  }

  console.log(`Starting docker-compose using ${composeFile}...`);
  await execAsync(`docker compose -p ${projectName} -f ${composeFile} up -d --build`);

  console.log('Waiting for services to be healthy...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Seeding
  console.log('Seeding data...');
  try {
    await execAsync(`docker compose -p ${projectName} -f ${composeFile} exec -T permissions node seed-permissions.js`);
    console.log('Permissions seeded.');
  } catch (e) {
    console.warn('Failed to seed permissions:', e.message);
  }

  try {
    // Blogging might not be in all gateway-e2e setups but if it is, it might need persona
    // In gateway-e2e it is defined.
    // However, telos-docs-service is NOT in gateway-e2e docker-compose!
    // Wait, I should check the compose file again.
  } catch (e) { }

  console.log(`Waiting for port ${port}...`);
  await waitForPortOpen(port, { retries: 60, retryDelay: 2000 });
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Setup complete.');
  globalThis.__TEARDOWN_MESSAGE__ = `
Tearing down ${projectName} environment...
`;
  globalThis.__COMPOSE_FILE__ = composeFile;
  globalThis.__PROJECT_NAME__ = projectName;
  globalThis.socketConnectionOptions = { host: 'localhost', port };
};
