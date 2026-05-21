import { FullConfig } from '@playwright/test';
import { spawn } from 'child_process';
import { join } from 'node:path';

function run(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function globalTeardown(_config: FullConfig) {
  if (process.env['SKIP_SETUP'] === 'true') {
    console.log('\n[Playwright Global Teardown] SKIP_SETUP=true, skipping Docker cleanup');
    return;
  }

  const workspaceRoot = join(__dirname, '../../');

  console.log('\n[Playwright Global Teardown] Stopping business-site stack via docker:dev:down');
  await run('pnpm', ['run', 'docker:dev:down'], workspaceRoot);
}

export default globalTeardown;
