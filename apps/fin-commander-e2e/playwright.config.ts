import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

const baseURL = process.env['BASE_URL'] || 'http://localhost:8089';
const isCI = process.env['CI'] === 'true';
const browserChannel = process.env['PLAYWRIGHT_CHANNEL'];

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  testIgnore: ['**/support/*.spec.ts'],
  // Explicit folder so CI's `apps/<target>/playwright-report/` upload finds it.
  reporter: [
    ['html', { open: 'never', outputFolder: './playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // No video: rendering one needs the ffmpeg binary, which the `ci`
    // configuration's `skipInstall` deliberately does not download, so every
    // test died in `browserContext.newPage` with "Executable doesn't exist at
    // .../ffmpeg-linux". No other suite records video; the trace and the
    // failure screenshot already carry what a failure needs.
    actionTimeout: 10000,
    navigationTimeout: 30000,
    headless: isCI,
  },
  outputDir: './test-results',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(browserChannel ? { channel: browserChannel } : {}),
      },
    },
  ],
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
});
