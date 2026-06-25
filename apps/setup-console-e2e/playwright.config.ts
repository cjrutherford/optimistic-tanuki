import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { resolvePlaywrightHeadless } from '../../e2e/playwright-headless';

const baseURL = process.env['BASE_URL'] || 'http://localhost:8099';
const headless = resolvePlaywrightHeadless(!!process.env['CI']);

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    headless,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node dist/apps/setup-console/server/server.mjs',
    url: 'http://localhost:8099/api/setup/status',
    cwd: workspaceRoot,
  },
  testDir: './src',
  projects: [
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
