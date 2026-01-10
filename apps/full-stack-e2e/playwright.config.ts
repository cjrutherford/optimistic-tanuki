import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';

const clientBaseURL =
  process.env['CLIENT_INTERFACE_BASE_URL'] || 'http://localhost:8080';
const forgeOfWillBaseURL =
  process.env['FORGEOFWILL_BASE_URL'] || 'http://localhost:8081';
const digitalHomesteadBaseURL =
  process.env['DIGITAL_HOMESTEAD_BASE_URL'] || 'http://localhost:8082';
const ownerConsoleBaseURL =
  process.env['OWNER_CONSOLE_BASE_URL'] || 'http://localhost:8084';

const isCI = !!process.env.CI;

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    headless: isCI,
    trace: isCI ? 'on-first-retry' : 'on',
  },
  retries: isCI ? 1 : 0,
  projects: [
    {
      name: 'client-interface-fullstack',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: clientBaseURL,
      },
      testDir: './src/client-interface',
    },
    {
      name: 'forgeofwill-fullstack',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: forgeOfWillBaseURL,
      },
      testDir: './src/forgeofwill',
    },
    {
      name: 'digital-homestead-fullstack',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: digitalHomesteadBaseURL,
      },
      testDir: './src/digital-homestead',
    },
    {
      name: 'owner-console-fullstack',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: ownerConsoleBaseURL,
      },
      testDir: './src/owner-console',
    },
  ],
});
