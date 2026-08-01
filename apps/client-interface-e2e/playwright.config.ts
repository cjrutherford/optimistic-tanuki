import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

// For CI, you may want to set BASE_URL to the deployed application.
const isCI = !!process.env['CI'];
const baseURL = process.env['BASE_URL'] || 'http://127.0.0.1:8080';
const rawHeadless = process.env['PLAYWRIGHT_HEADLESS']?.trim().toLowerCase();
const headless = ['1', 'true', 'yes', 'on'].includes(rawHeadless ?? '')
  ? true
  : ['0', 'false', 'no', 'off'].includes(rawHeadless ?? '')
  ? false
  : isCI;

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
  reporter: [['html', { open: 'never', outputFolder: './playwright-report' }]],
  use: {
    baseURL,
    headless,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  outputDir: './test-results',
  // The global setup owns an isolated Docker environment for direct local E2E.
  // CI and live-stack runs explicitly skip it, so never start an unrelated dev server.
  webServer: undefined,
  projects: isCI
    ? [
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
          testIgnore: '**/responsive-audit.spec.ts',
        },
        {
          name: 'tablet-chrome',
          use: {
            ...devices['iPad (gen 7)'],
            browserName: 'chromium',
            channel: 'chrome',
          },
          testIgnore: '**/responsive-audit.spec.ts',
        },
      ]
    : [
        {
          name: 'chromium-desktop',
          use: { ...devices['Desktop Chrome'], channel: 'chrome' },
        },
        {
          name: 'mobile-chrome',
          use: { ...devices['Pixel 5'], channel: 'chrome' },
          testIgnore: '**/responsive-audit.spec.ts',
        },
        {
          name: 'tablet-chrome',
          use: {
            ...devices['iPad (gen 7)'],
            browserName: 'chromium',
            channel: 'chrome',
          },
          testIgnore: '**/responsive-audit.spec.ts',
        },
      ],
});
