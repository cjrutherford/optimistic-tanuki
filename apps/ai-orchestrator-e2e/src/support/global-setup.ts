import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { waitForPortOpen } from '@nx/node/utils';

const execAsync = promisify(exec);

export default async function () {
  const projectName = 'ai-orchestrator-e2e';
  const port = 3010;
  const composeFile = join(__dirname, '../../../../e2e/docker-compose.ai-orchestrator-e2e.yaml');
  
  console.log(`\nSetting up E2E environment for ${projectName}...\n`);

  try {
    console.log(`Cleaning up any existing environment for ${projectName}...`);
    await execAsync(`docker compose -p ${projectName} -f ${composeFile} down -v --remove-orphans`);
  } catch (e) {
    // ignore
  }

  console.log(`Starting docker-compose using ${composeFile}...`);
  await execAsync(`docker compose -p ${projectName} -f ${composeFile} up -d --build`);

  // Wait for telos-docs-service health (as per original script requirement)
  console.log('Waiting for telos-docs-service to be healthy...');
  const containerName = 'ot_telos_docs_service_e2e';
  let healthy = false;
  let attempts = 0;
  while (!healthy && attempts < 60) {
    try {
        const { stdout } = await execAsync(`docker inspect -f '{{.State.Health.Status}}' ${containerName}`);
        if (stdout.trim() === 'healthy') {
            healthy = true;
        }
    } catch (e) { }
    if (!healthy) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
    }
  }

  // Seeding
  console.log('Seeding data...');
  await execAsync(`docker compose -p ${projectName} -f ${composeFile} exec telos-docs-service node seed-persona.js`);

  console.log(`Waiting for port ${port}...`);
  await waitForPortOpen(port, { retries: 60, retryDelay: 2000 });
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('Setup complete.');
  globalThis.__TEARDOWN_MESSAGE__ = `\nTearing down ${projectName} environment...\n`;
  globalThis.__COMPOSE_FILE__ = composeFile;
  globalThis.__PROJECT_NAME__ = projectName;
  globalThis.socketConnectionOptions = { host: 'localhost', port };
};
