import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

const isCI = !!process.env['CI'];

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  // This Jest unit file lives under src for the existing Nx test target.
  // Playwright's default **/*.spec.ts discovery must not execute it.
  testIgnore: '**/global-setup.spec.ts',
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: process.env['BASE_URL'] || 'http://127.0.0.1:8094',
    trace: isCI ? 'on-first-retry' : 'on',
  },
  retries: isCI ? 1 : 0,
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
  ],
});
