import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const suites = [
  ['client-interface-e2e', 8080],
  ['forgeofwill-e2e', 8081],
  ['digital-homestead-e2e', 8082],
  ['christopherrutherford-net-e2e', 8083],
  ['owner-console-e2e', 8084],
  ['store-client-e2e', 8085],
  ['configurable-client-e2e', 8090],
];

test('UI E2E CI targets use preinstalled Chrome and isolated artifacts', () => {
  for (const [suite, port] of suites) {
    const project = JSON.parse(
      readFileSync(`apps/${suite}/project.json`, 'utf8')
    );
    const config = readFileSync(`apps/${suite}/playwright.config.ts`, 'utf8');

    assert.equal(
      project.targets.e2e.configurations.ci.skipInstall,
      true,
      suite
    );
    assert.equal('env' in project.targets.e2e.configurations.ci, false, suite);
    assert.match(config, new RegExp(`http://127\\.0\\.0\\.1:${port}`), suite);
    assert.match(config, /outputDir:\s*['"]\.\/test-results['"]/, suite);
    assert.match(
      config,
      /outputFolder:\s*['"]\.\/playwright-report['"]/,
      suite
    );
    assert.match(config, /channel:\s*['"]chrome['"]/, suite);
  }
});

test('CI limits browser projects while client responsive projects omit the audit', () => {
  const client = readFileSync(
    'apps/client-interface-e2e/playwright.config.ts',
    'utf8'
  );
  assert.match(client, /projects:\s*isCI\s*\?\s*\[/);
  assert.match(
    client,
    /testIgnore:\s*['"]\*\*\/responsive-audit\.spec\.ts['"]/
  );

  for (const [suite] of suites.slice(1)) {
    const config = readFileSync(`apps/${suite}/playwright.config.ts`, 'utf8');
    assert.match(config, /projects:\s*isCI\s*\?\s*\[/, suite);
  }
});

test('Docker lifecycle hooks retain shared CI and SKIP_SETUP environments', () => {
  for (const suite of [
    'client-interface-e2e',
    'forgeofwill-e2e',
    'digital-homestead-e2e',
    'christopherrutherford-net-e2e',
    'owner-console-e2e',
    'store-client-e2e',
  ]) {
    for (const hook of ['global-setup.ts', 'global-teardown.ts']) {
      const source = readFileSync(`apps/${suite}/${hook}`, 'utf8');
      assert.match(source, /process\.env\['CI'\]/, `${suite}/${hook}`);
      assert.match(
        source,
        /process\.env\['SKIP_SETUP'\]\s*===\s*'true'/,
        `${suite}/${hook}`
      );
    }
  }
});

test('the UI E2E workflow uses the runner Chrome channel and validates CI config loading', () => {
  const workflow = readFileSync('.github/workflows/ci-cd.yml', 'utf8');

  assert.doesNotMatch(workflow, /name: Install Google Chrome/);
  assert.match(workflow, /PLAYWRIGHT_CHANNEL:\s*chrome/);
  assert.doesNotMatch(workflow, /browser-actions\/setup-chrome/);
  assert.match(
    workflow,
    /name: Validate UI E2E CI contract[\s\S]*scripts\/tests\/e2e-environment-manifest\.test\.mjs[\s\S]*scripts\/tests\/wait-for-e2e-readiness\.test\.mjs[\s\S]*scripts\/tests\/ui-e2e-ci-contract\.test\.mjs/
  );
  assert.match(
    workflow,
    /CI=true env -u BASE_URL pnpm exec playwright test --config="apps\/\$target\/playwright\.config\.ts" --list/
  );
  assert.match(
    workflow,
    /Stop target stack[\s\S]*--profile "\$\{\{ matrix\.profile \}\}" down -v/
  );
});

test('isolated UI E2E raises credential throttles without changing production defaults', () => {
  const compose = readFileSync('e2e/docker-compose.e2e-stack.yaml', 'utf8');

  assert.match(
    compose,
    /gateway:[\s\S]*?THROTTLE_LOGIN_LIMIT:\s*100/,
    'the isolated gateway must support repeated independent E2E logins'
  );
});
