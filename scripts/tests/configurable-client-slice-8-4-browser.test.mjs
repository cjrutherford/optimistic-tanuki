import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const scriptPath = path.join(
  repoRoot,
  'scripts',
  'configurable-client-slice-8-4-browser.sh'
);

test('Slice 8.4 proof is parameterized, redacts credentials, and constructs one session flow', () => {
  const script = readFileSync(scriptPath, 'utf8');

  assert.match(
    script,
    /CONFIGURABLE_CLIENT_OWNER_EMAIL:-configurable-client-owner-v2@optimistic-tanuki\.local/
  );
  assert.match(script, /CONFIGURABLE_CLIENT_OWNER_PASSWORD:-\$\(seed_default/);
  assert.match(script, /--base-url|--base_url/);
  assert.match(script, /--evidence-dir|--evidence_dir/);
  assert.match(script, /--session/);
  assert.match(script, /AGENT_BROWSER_SESSION/);
  assert.match(script, /redact/);
  assert.match(script, /timeout/);
  assert.match(script, /trap .*cleanup|trap cleanup/);
  assert.match(script, /trap .*ERR|trap on_error ERR/);
  assert.match(script, /capture_failure .*command|command-failure/);
  assert.match(
    script,
    /data-action=.?cancel-unsaved-navigation|cancel-unsaved-navigation/
  );
  assert.match(
    script,
    /data-action=.?confirm-unsaved-navigation|confirm-unsaved-navigation/
  );
  assert.match(script, /dialog status/);
  assert.match(script, /run_browser "ready-\$\{label\}" snapshot -i/);
  assert.match(script, /cookies clear/);
  assert.match(script, /storage local clear/);
  assert.match(script, /storage session clear/);
  assert.match(script, /supports.*cache|cache.*supported/i);
  assert.match(script, /\/login\?[^\n]*cb/);
  assert.match(script, /post-login.*snapshot -i/);
  assert.match(script, /post-login.*screenshot --full/);
  assert.match(script, /post-login.*get url/);
  assert.match(script, /post-login-network.*network requests --json/);
  assert.match(script, /Authorization|Cookie|password|token/);
  assert.match(script, /fresh|non-empty|readdirSync/);
  assert.doesNotMatch(script, /find role heading text --name/);
  assert.doesNotMatch(script, /run_browser wait-[^\n]+ find text/);
  assert.doesNotMatch(script, /find role heading get text/);
  assert.doesNotMatch(script, /networkidle/);
  assert.doesNotMatch(script, /sleep [0-9]/);
  assert.doesNotMatch(script, /echo .*CONFIGURABLE_CLIENT_OWNER_PASSWORD/);
  assert.doesNotMatch(script, /printf .*CONFIGURABLE_CLIENT_OWNER_PASSWORD/);
});

test('captures post-login evidence before waiting and keeps network metadata sanitized', () => {
  const script = readFileSync(scriptPath, 'utf8');
  const click = script.indexOf('run_browser submit-login');
  const afterClick = script.slice(click);
  const snapshot = afterClick.indexOf('capture_post_login');
  const screenshot = script.indexOf('run_browser post-login-screenshot');
  const url = script.indexOf('run_browser post-login-url');
  const network = afterClick.indexOf('capture_post_login_network');
  const ownerWait = afterClick.indexOf('run_browser wait-for-owner');

  assert.ok(click >= 0 && snapshot >= 0);
  assert.ok(
    snapshot >= 0 && network >= 0 && snapshot < network && network < ownerWait
  );
  assert.ok(
    script.indexOf('run_browser post-login-snapshot') < screenshot &&
      screenshot < url
  );
  assert.match(script, /sanitize|secret.*key/i);
});

test('hands authenticated users from the root landing page into semantic owner workspace discovery', () => {
  const script = readFileSync(scriptPath, 'utf8');
  const login = script.indexOf('run_browser submit-login');
  const rootAssertion = script.indexOf('assert_url_equals post-login-root');
  const landingAssertion = script.indexOf('assert_text authenticated-landing');
  const ownerClick = script.indexOf(
    'run_browser open-owner-workspace find first \'a[href="/owner"]\' click'
  );
  const ownerWait = script.indexOf('run_browser wait-for-owner wait');

  assert.ok(login >= 0, 'expected login submission');
  assert.ok(
    rootAssertion > login,
    'expected root redirect assertion after login'
  );
  assert.ok(
    landingAssertion > rootAssertion,
    'expected authenticated landing assertion after root redirect'
  );
  assert.ok(
    ownerClick > landingAssertion,
    'expected semantic owner workspace link click after landing assertion'
  );
  assert.ok(
    ownerWait > ownerClick,
    'expected owner/workspace discovery wait after owner link click'
  );
  assert.match(
    script,
    /assert_url_equals post-login-root ['"]\$BASE_URL\/['"]$/m
  );
  assert.match(
    script,
    /assert_text authenticated-landing ['"]Open owner workspace['"]$/m
  );
});

test('waits for the authenticated owner route and finalizes evidence when terminated', () => {
  const script = readFileSync(scriptPath, 'utf8');

  assert.match(
    script,
    /wait-for-owner wait ['"]main\[aria-labelledby="workspace-entry-title"\]['"]?/
  );
  assert.doesNotMatch(
    script,
    /wait-for-owner wait --text ['"]Choose a workspace\./
  );
  assert.match(script, /trap ['"]?[^\n]*exit 143[^\n]*['"]? TERM/);
  assert.match(script, /trap ['"]?[^\n]*exit 130[^\n]*['"]? INT/);
  assert.match(script, /run_browser close/);
  assert.match(script, /write_manifest "\$exit_code"/);
});

test('proof parses overrides and redacts the password while constructing browser commands', () => {
  const tempDir = mkdtempSync(
    path.join(os.tmpdir(), 'configurable-client-proof-')
  );
  const evidenceDir = path.join(tempDir, 'evidence');
  const fakeBrowser = path.join(tempDir, 'fake-agent-browser');
  writeFileSync(
    fakeBrowser,
    `#!/bin/sh
printf 'fake command %s\\n' "$*"
case "$3" in
  snapshot) printf '%s\\n' 'Sign in to continue. Open owner workspace Choose a workspace. 01 Edit configuration Refine the client-facing surface Slice 8.4 unsaved proof draft Save draft Shape the doorway. ← Back to owner desk Leave this configuration? You have unsaved changes.' ;;
  network) printf '%s\\n' '{"requests":[{"url":"http://proof.test/authentication/login","method":"POST","headers":{"X-Session-Mode":"cookie","Authorization":"secret","Cookie":"secret"}}]}' ;;
  screenshot) : > "\${5:-\$4}" ;;
  role|find) printf '%s\\n' 'Sign in to continue. Choose a workspace. 01 Edit configuration Refine the client-facing surface Shape the doorway. ← Back to owner desk Leave this configuration?' ;;
  get) if [ "$4" = attr ] && [ "$5" = 'a.action--primary' ] && [ "$6" = href ]; then printf '%s\\n' '/owner/workspace/seed/config/config-1'; elif [ ! -e "${path.join(
    evidenceDir,
    'url-count'
  )}" ]; then printf '1' > "${path.join(
      evidenceDir,
      'url-count'
    )}"; printf '%s\\n' 'http://proof.test/'; elif [ "$(cat "${path.join(
      evidenceDir,
      'url-count'
    )}")" = 1 ]; then printf '2' > "${path.join(
      evidenceDir,
      'url-count'
    )}"; printf '%s\\n' 'http://proof.test/'; else printf '%s\\n' 'http://proof.test/owner/workspace/seed/config/config-1'; fi ;;
  dialog) printf '%s\\n' 'No dialog pending.' ;;
esac
  `
  );
  chmodSync(fakeBrowser, 0o755);
  const secret = 'slice-8-4-test-secret';
  const result = spawnSync(
    scriptPath,
    [
      '--base-url',
      'http://proof.test',
      '--evidence-dir',
      evidenceDir,
      '--session',
      'slice-8-4-test-session',
    ],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        AGENT_BROWSER_BIN: fakeBrowser,
        CONFIGURABLE_CLIENT_OWNER_PASSWORD: secret,
      },
    }
  );

  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  const logs = readdirSync(path.join(evidenceDir, 'commands'))
    .map((file) =>
      readFileSync(path.join(evidenceDir, 'commands', file), 'utf8')
    )
    .join('\n');
  assert.match(logs, /--session slice-8-4-test-session/);
  assert.match(
    logs,
    /command=agent-browser --session slice-8-4-test-session open http:\/\/proof\.test\/login/
  );
  assert.match(logs, /cb=/);
  assert.match(logs, /cookies clear/);
  assert.match(logs, /storage local clear/);
  assert.match(logs, /storage session clear/);
  assert.ok(logs.includes('get attr a.action--primary href'));
  assert.equal(
    logs
      .split('\n')
      .filter(
        (line) =>
          line ===
          'command=agent-browser --session slice-8-4-test-session get attr a.action--primary href'
      ).length,
    2
  );
  assert.equal(
    logs
      .split('\n')
      .filter(
        (line) =>
          line ===
          'command=agent-browser --session slice-8-4-test-session open http://proof.test/owner/workspace/seed/config/config-1'
      ).length,
    2
  );
  assert.equal(
    logs
      .split('\n')
      .filter(
        (line) =>
          line ===
          'command=agent-browser --session slice-8-4-test-session wait --url http://proof.test/owner/workspace/seed/config/config-1'
      ).length,
    2
  );
  assert.ok(
    readFileSync(
      path.join(evidenceDir, 'dashboard-editor-href.log'),
      'utf8'
    ).includes('editor-href=/owner/workspace/seed/config/config-1')
  );
  assert.ok(
    readFileSync(
      path.join(evidenceDir, 'reopen-editor-href.log'),
      'utf8'
    ).includes('editor-href=/owner/workspace/seed/config/config-1')
  );
  assert.match(logs, /fill-password/);
  assert.doesNotMatch(logs, new RegExp(secret));
  const networkMetadata = readFileSync(
    path.join(evidenceDir, 'post-login-network.json'),
    'utf8'
  );
  assert.match(networkMetadata, /X-Session-Mode/);
  assert.doesNotMatch(
    networkMetadata,
    /"Authorization"\s*:|"Cookie"\s*:|"password"\s*:|"token"\s*:|secret/i
  );
  assert.match(
    readFileSync(path.join(evidenceDir, 'post-login.snapshot'), 'utf8'),
    /Sign in to continue/
  );
  assert.ok(readdirSync(evidenceDir).includes('post-login.png'));
  assert.match(
    readFileSync(path.join(evidenceDir, 'manifest.json'), 'utf8'),
    /"result": "passed"/
  );
});

test('captures the stable primary dashboard href for both editor entries', () => {
  const script = readFileSync(scriptPath, 'utf8');

  assert.doesNotMatch(script, /NEXT MOVES/);
  assert.match(script, /assert_role_link\(\)\s*\{/);
  assert.match(script, /assert_role_link dashboard ['"]Edit configuration['"]/);
  assert.match(
    script,
    /assert_role_link dashboard-after-internal-leave ['"]Edit configuration['"]/
  );
  assert.match(
    script,
    /assert_role_link final-dashboard ['"]Edit configuration['"]/
  );
  assert.equal(
    (script.match(/^open_editor_from_primary\(\) \{$/gm) ?? []).length,
    1
  );
  assert.equal(
    (
      script.match(
        /^open_editor_from_primary (?:dashboard-editor|reopen-editor)$/gm
      ) ?? []
    ).length,
    2
  );
  assert.match(script, /editor-href=/);
  assert.match(script, /BASE_URL\$href/);
  assert.match(script, /wait --url ['"]\$BASE_URL\$href['"]/);
  assert.doesNotMatch(script, /click ['"]a\.action--primary['"]/);
  assert.doesNotMatch(script, /find text ['"]Edit configuration['"] click/);
  assert.doesNotMatch(
    script,
    /find role link click --name ['"]Edit configuration['"]/
  );
});

test('waits for each captured editor URL and a stable editor control', () => {
  const script = readFileSync(scriptPath, 'utf8');

  assert.doesNotMatch(
    script,
    /wait --url ['"]\*\*\/owner\/workspace\/\*\/config\/\*['"]/
  );
  assert.equal(
    (script.match(/wait-for-editor-back wait ['"]a\.back-link['"]/g) ?? [])
      .length,
    1
  );
  assert.equal(
    (script.match(/internal-back click ['"]a\.back-link['"]/g) ?? []).length,
    1
  );
  assert.doesNotMatch(
    script,
    /assert_role_link editor-back|find role link click --name ['"](?:← )?Back to owner desk['"]/
  );
  assert.doesNotMatch(script, /wait --text ['"]Shape the doorway\.['"]/);
});

test('proves each dirty edit with the unsaved draft value and save action', () => {
  const script = readFileSync(scriptPath, 'utf8');

  assert.doesNotMatch(
    script,
    /assert_text dirty(?:-again)? ['"]Unsaved local changes['"]/
  );
  assert.equal(
    (
      script.match(
        /assert_text dirty(?:-again)?-proof ['"]Slice 8\.4 unsaved proof draft['"]/g
      ) ?? []
    ).length,
    2
  );
  assert.equal(
    (
      script.match(/assert_text dirty(?:-again)?-save ['"]Save draft['"]/g) ??
      []
    ).length,
    2
  );
});
