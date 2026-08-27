import { FullConfig } from '@playwright/test';
import {
  shouldManageE2eEnvironment,
  startClientInterfaceE2eEnvironment,
} from './e2e-lifecycle';

async function globalSetup(_config: FullConfig) {
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

  if (!shouldManageE2eEnvironment()) return;

  console.log(
    '\n[Playwright Global Setup] Starting isolated manifest-defined E2E environment'
  );

  try {
    await startClientInterfaceE2eEnvironment();
  } catch (error) {
    console.error('Failed to start E2E environment:', error);
    throw error;
  }
}

export default globalSetup;
