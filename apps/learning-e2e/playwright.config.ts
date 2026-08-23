import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

/**
 * Learning Studio end-to-end tests.
 *
 * These run against the client with the gateway stubbed at the network layer,
 * so `nx e2e learning-e2e` works on a laptop with nothing else running. The
 * point is to prove the client behaves: routing, rendering, the editor
 * fallback, and what a learner sees when the API is unhappy.
 *
 * Point BASE_URL at a running stack to exercise the real gateway instead.
 */
const PORT = 4310;
const baseURL = process.env['BASE_URL'] || `http://localhost:${PORT}`;

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  reporter: [['html', { open: 'never' }]],
  // Skipped when BASE_URL is set, so the same specs can run against a stack.
  //
  // This runs the real server-rendered app, the same entry point the
  // container uses. A static file server cannot serve it: the build emits
  // index.csr.html and leaves the shell to be rendered per request.
  webServer: process.env['BASE_URL']
    ? undefined
    : {
        command: `node ./node_modules/nx/bin/nx.js run learning:build && PORT=${PORT} node dist/apps/learning/server/server.mjs`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: true,
        cwd: workspaceRoot,
        timeout: 300_000,
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
