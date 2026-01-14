import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

module.exports = async function () {
  console.log(globalThis.__TEARDOWN_MESSAGE__);

  const composeFile = globalThis.__COMPOSE_FILE__;
  const projectName = globalThis.__PROJECT_NAME__;

  if (composeFile && projectName) {
    try {
      console.log(`Stopping E2E environment for ${projectName}...`);
      await execAsync(
        `docker compose -p ${projectName} -f ${composeFile} down -v`
      );
      console.log('Cleanup complete.');
    } catch (e) {
      console.error('Error during teardown:', e);
    }
  }
};
