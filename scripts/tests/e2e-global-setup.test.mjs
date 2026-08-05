import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const setupFiles = [
  'ai-orchestrator',
  'app-configurator',
  'assets',
  'authentication',
  'blogging',
  'chat-collector',
  'gateway',
  'permissions',
  'profile',
  'project-planning',
  'prompt-proxy',
  'social',
  'telos-docs-service',
].map(
  (app) =>
    new URL(
      `../../apps/${app}-e2e/src/support/global-setup.ts`,
      import.meta.url
    )
);

test('microservice global setup resolves its wait target from BASE_URL', () => {
  for (const file of setupFiles) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /process\.env\.BASE_URL/);
    assert.doesNotMatch(source, /Waiting for : to be open/);
  }
});
