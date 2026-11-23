import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import path from 'path';
import { resolvePlaywrightHeadless } from '../../e2e/playwright-headless';

// For CI, you may want to set BASE_URL to the deployed application.
const isCI = !!process.env['CI'];
const baseURL =
  process.env['BASE_URL'] ||
  (isCI ? 'http://127.0.0.1:8084' : 'http://localhost:4200');
const headless = resolvePlaywrightHeadless(!!process.env['CI']);

// The `mocked` project runs against the built console with every /api call
// stubbed in the browser, so it needs no stack and no docker. It is opt-in
// (OWNER_CONSOLE_MOCKED=true), never part of the CI stack run:
//   OWNER_CONSOLE_MOCKED=true pnpm exec playwright test \
//     --config=apps/owner-console-e2e/playwright.config.ts
const FULL_STACK_SPECS = [
  '**/example.spec.ts',
  '**/nav-smoke.spec.ts',
  '**/happy-paths.spec.ts',
  '**/deny-path.spec.ts',
];
const mocked = process.env['OWNER_CONSOLE_MOCKED'] === 'true';
const mockedPort = process.env['OWNER_CONSOLE_MOCKED_PORT'] || '4310';
const mockedUrl = `http://127.0.0.1:${mockedPort}`;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const MOCKED_PROJECT = {
  name: 'mocked',
  use: { ...devices['Desktop Chrome'], channel: 'chrome' },
  testDir: './src/mocked',
  testMatch: '**/*.mocked.spec.ts',
};

const FULL_STACK_PROJECT = {
  name: 'chromium',
  use: { ...devices['Desktop Chrome'], channel: 'chrome' },
  testDir: './src',
  testMatch: FULL_STACK_SPECS,
};

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  globalSetup: mocked ? undefined : require.resolve('./global-setup'),
  globalTeardown: mocked ? undefined : require.resolve('./global-teardown'),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL: mocked ? mockedUrl : baseURL,
    headless,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  reporter: [['html', { open: 'never', outputFolder: './playwright-report' }]],
  outputDir: './test-results',
  /* Run your local dev server before starting the tests */
  webServer: mocked
    ? {
        // Serves dist/apps/owner-console (run `nx build owner-console` first).
        // The gateway address points nowhere: the browser never reaches it
        // because page.route answers every /api request first.
        command: `node dist/apps/owner-console/server/server.mjs`,
        url: `${mockedUrl}/login`,
        reuseExistingServer: false,
        cwd: workspaceRoot,
        env: {
          PORT: mockedPort,
          GATEWAY_URL: 'http://127.0.0.1:9',
          GATEWAY_WS_URL: 'http://127.0.0.1:9',
        },
      }
    : process.env['CI']
    ? undefined
    : {
        command: 'node ./node_modules/nx/bin/nx.js run owner-console:serve',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
        cwd: workspaceRoot,
      },
  testDir: './src',
  projects: isCI
    ? [mocked ? MOCKED_PROJECT : FULL_STACK_PROJECT]
    : mocked
    ? [MOCKED_PROJECT]
    : [
        // {
        //   name: 'chromium',
        //   use: { ...devices['Desktop Chrome'] },
        // },

        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },

        // {
        //   name: 'webkit',
        //   use: { ...devices['Desktop Safari'] },
        // },

        // Uncomment for mobile browsers support
        /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

        // Uncomment for branded browsers
        /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },*/
        {
          name: 'Google Chrome',
          use: { ...devices['Desktop Chrome'], channel: 'chrome' },
          testDir: './src',
          testMatch: FULL_STACK_SPECS,
        },
      ],
});
