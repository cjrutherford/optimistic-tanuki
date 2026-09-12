import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { resolvePlaywrightHeadless } from '../../e2e/playwright-headless';

// For CI, you may want to set BASE_URL to the deployed application.
const isCI = !!process.env['CI'];
const baseURL =
  process.env['BASE_URL'] ||
  (isCI ? 'http://127.0.0.1:8099' : 'http://localhost:4200');
const headless = resolvePlaywrightHeadless(!!process.env['CI']);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    headless,
    trace: 'on-first-retry',
  },
  reporter: [['html', { open: 'never', outputFolder: './playwright-report' }]],
  outputDir: './test-results',
  /* Run your local dev server before starting the tests */
  webServer: isCI
    ? undefined
    : {
        command: 'node ./node_modules/nx/bin/nx.js run learning:serve',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
        cwd: workspaceRoot,
      },
  projects: isCI
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'], channel: 'chrome' },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],
});
