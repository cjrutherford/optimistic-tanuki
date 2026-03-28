import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

const baseURL = process.env['BASE_URL'] || 'http://localhost:8087';
const gatewayURL = process.env['GATEWAY_URL'] || 'http://localhost:3000';
const mockPaymentURL =
  process.env['MOCK_PAYMENT_URL'] || 'http://localhost:3019';
const skipServer =
  process.env['CI'] === 'true' ||
  process.env['E2E_DOCKER'] === 'true' ||
  process.env['SKIP_SERVER'] === 'true';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    extraHTTPHeaders: {
      'X-Gateway-URL': gatewayURL,
      'X-Mock-Payment-URL': mockPaymentURL,
    },
  },
  outputDir: './test-results',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  webServer: skipServer
    ? undefined
    : {
        command: 'npx nx run local-hub:serve',
        url: 'http://localhost:4200',
        reuseExistingServer: !process.env['CI'],
        timeout: 120000,
      },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-web-security'],
        },
      },
    },
  ],
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
});
