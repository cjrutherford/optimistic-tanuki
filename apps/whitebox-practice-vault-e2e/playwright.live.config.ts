import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { chromium } from '@playwright/test';
import * as path from 'node:path';

const workspaceRoot = path.resolve(__dirname, '..', '..');
const staticServer = path.join(
  workspaceRoot,
  'apps/whitebox-practice-vault-e2e/static-server.js'
);
const browserDist = path.join(
  workspaceRoot,
  'dist/apps/whitebox-practice-vault/browser'
);
const baseURL = process.env['BASE_URL'] || 'http://127.0.0.1:8096';
const liveApiUrl = process.env['LIVE_API_URL'] || 'http://127.0.0.1:3000';
const useManagedChromium =
  process.env['PLAYWRIGHT_USE_MANAGED_CHROMIUM'] === 'true';
const managedChromiumPath =
  process.env['PLAYWRIGHT_EXECUTABLE_PATH'] || chromium.executablePath();

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  testMatch: /vault-live\.spec\.ts/,
  reporter: [
    ['html', { open: 'never', outputFolder: './playwright-report-live' }],
  ],
  use: {
    baseURL,
    headless: true,
    launchOptions: {
      args: ['--disable-crash-reporter'],
      ...(useManagedChromium ? { executablePath: managedChromiumPath } : {}),
    },
    trace: 'on-first-retry',
  },
  outputDir: './test-results-live',
  webServer: {
    command: `node ${staticServer} 8096 ${browserDist}`,
    url: 'http://127.0.0.1:8096/',
    reuseExistingServer: !process.env['CI'],
    timeout: 60 * 1000,
    env: { LIVE_API_URL: liveApiUrl },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
