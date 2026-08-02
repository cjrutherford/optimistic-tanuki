import { FullConfig } from '@playwright/test';
import {
  shouldManageE2eEnvironment,
  stopClientInterfaceE2eEnvironment,
} from './e2e-lifecycle';

async function globalTeardown(_config: FullConfig) {
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

  if (!shouldManageE2eEnvironment()) return;

  console.log(
    '\n[Playwright Global Teardown] Stopping isolated E2E environment'
  );

  try {
    await stopClientInterfaceE2eEnvironment();
    console.log('Cleanup complete.');
  } catch (error) {
    console.error('Error during teardown:', error);
  }
}

export default globalTeardown;
