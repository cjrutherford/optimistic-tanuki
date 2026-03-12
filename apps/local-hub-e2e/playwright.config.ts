import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

const baseURL = process.env['BASE_URL'] || 'http://localhost:4201';

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  outputDir: './test-results',
  webServer:
    process.env['CI']
      ? undefined
      : {
          command: 'npx nx run local-hub:serve',
          url: 'http://localhost:4201',
          reuseExistingServer: true,
          cwd: workspaceRoot,
        },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
