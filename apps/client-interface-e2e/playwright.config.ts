import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import { resolvePlaywrightHeadless } from '../../e2e/playwright-headless';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:8080';
const headless = resolvePlaywrightHeadless(!!process.env['CI']);

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// (dotenv loading commented out) require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL,
    headless,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  outputDir: './test-results',
  /* Run your local dev server before starting the tests */
  /* For e2e tests, docker-compose (started by global-setup) handles the server */
  /* Only start local dev server when USE_DOCKER is not set and not in CI */
  webServer:
    process.env['USE_DOCKER'] || process.env['CI']
      ? undefined
      : {
          command:
            'node ./node_modules/nx/bin/nx.js run client-interface:serve',
          url: 'http://localhost:4200',
          reuseExistingServer: true,
          cwd: workspaceRoot,
        },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        channel: 'chrome',
      },
    },
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad (gen 7)'],
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
  ],
});
