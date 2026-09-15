import assert from 'node:assert/strict';
import {
  access,
  chmod,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const root = process.cwd();
const script = join(root, 'scripts', 'start-learning-stack.sh');

async function writeExecutable(path, source) {
  await writeFile(path, source);
  await chmod(path, 0o755);
}

async function createCommandStubs(
  directory,
  logPath,
  statePath,
  optionsOrFailCurl
) {
  const options =
    typeof optionsOrFailCurl === 'boolean'
      ? { failCurl: optionsOrFailCurl }
      : optionsOrFailCurl;
  await writeExecutable(
    join(directory, 'tmux'),
    `#!/bin/sh
set -eu
log="$TMUX_LOG"
state="$TMUX_STATE"
cmd="$1"
shift || true
printf 'tmux %s %s\\n' "$cmd" "$*" >> "$log"
case "$cmd" in
  has-session)
    session="$2"
    awk -F'|' -v session="$session" '$1 == session { found = 1 } END { exit(found ? 0 : 1) }' "$state"
    ;;
  new-session)
    session=''
    cwd=''
    command=''
    while [ "$#" -gt 0 ]; do
      case "$1" in
        -s) session="$2"; shift 2 ;;
        -c) cwd="$2"; shift 2 ;;
        *) command="$1"; shift ;;
      esac
    done
    printf '%s|%s|%s|%s\\n' "$session" "$$" "$cwd" "$command" >> "$state"
    if [ -n "\${CAPTURE_ENV:-}" ]; then
      env_file=$(printf '%s' "$command" | sed -n 's/.*\\. \\([^;]*\\.env\\);.*/\\1/p')
      if [ -n "$env_file" ] && [ -f "$env_file" ]; then
        cat "$env_file" >> "$CAPTURE_ENV"
      fi
    fi
    ;;
  list-panes)
    [ "\${FAIL_LIST_PANES:-}" = "1" ] && exit 1
    session="$2"
    awk -F'|' -v session="$session" '$1 == session { print $2 }' "$state"
    ;;
  display-message)
    session="$3"
    if printf '%s' "$4" | grep -q 'pane_pid'; then
      awk -F'|' -v session="$session" '$1 == session { print $2 "|" $3 "|" $4 }' "$state"
    else
      awk -F'|' -v session="$session" '$1 == session { print $3 "|" $4 }' "$state"
    fi
    ;;
  kill-session)
    session="$2"
    awk -F'|' -v session="$session" '$1 != session' "$state" > "$state.next"
    mv "$state.next" "$state"
    ;;
esac
`
  );

  await writeExecutable(
    join(directory, 'ss'),
    `#!/bin/sh
set -eu
count=$(cat "$SS_COUNT")
count=$((count + 1))
printf '%s' "$count" > "$SS_COUNT"
if [ -n "\${OCCUPIED_PORT:-}" ] && [ "$count" -eq 1 ]; then
  printf 'LISTEN 0 0 127.0.0.1:%s 0.0.0.0:*\\n' "$OCCUPIED_PORT"
  exit 0
fi
if [ "$count" -le 10 ]; then exit 0; fi
for port in 3101 3102 3112 3199 3124 3125 3005 8109 3305 3306; do
  printf 'LISTEN 0 0 127.0.0.1:%s 0.0.0.0:*\\n' "$port"
done
`
  );

  await writeExecutable(
    join(directory, 'pnpm'),
    `#!/bin/sh
printf 'pnpm %s DATABASE_HOST=%s DATABASE_NAME=%s\\n' "$*" "\${DATABASE_HOST:-}" "\${DATABASE_NAME:-}" >> "$COMMAND_LOG"
`
  );
  if (options.generateSecrets) {
    await writeExecutable(
      join(directory, 'openssl'),
      `#!/bin/sh
set -eu
count=$(cat "$OPENSSL_COUNT")
count=$((count + 1))
printf '%s' "$count" > "$OPENSSL_COUNT"
if [ "$count" -eq 1 ]; then
  printf 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
else
  printf 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
fi
`
    );
    await writeFile(join(directory, 'openssl.count'), '0');
  }
  await writeExecutable(
    join(directory, 'node'),
    `#!/bin/sh
printf 'node %s\\n' "$*" >> "$COMMAND_LOG"
case "$*" in
  *"--input-type=module"*) exec "$REAL_NODE" "$@" ;;
esac
`
  );
  if (options.derivedHost) {
    await writeExecutable(
      join(directory, 'hostname'),
      `#!/bin/sh
printf '198.51.100.42\\n'
`
    );
  }
  await writeExecutable(
    join(directory, 'docker'),
    `#!/bin/sh
set -eu
printf 'docker %s\\n' "$*" >> "$COMMAND_LOG"
state="$DOCKER_STATE"
cmd="$1"
shift
lookup() {
  kind="$1"
  value="$2"
  awk -F'|' -v kind="$kind" -v value="$value" '$1 == kind && ($2 == value || $3 == value) { found = 1 } END { exit(found ? 0 : 1) }' "$state"
}
case "$cmd" in
  image)
    sub="$1"
    shift
    case "$sub" in
      inspect)
        lookup image "\${1:-}" ;;
      build)
        tag=''
        previous=''
        for arg in "$@"; do
          if [ "$previous" = "--tag" ]; then tag="$arg"; fi
          previous="$arg"
        done
        printf 'image|%s\\n' "$tag" >> "$state"
        ;;
      rm)
        image="$1"
        awk -F'|' -v image="$image" '$1 != "image" || $2 != image' "$state" > "$state.next"
        mv "$state.next" "$state"
        ;;
    esac
    ;;
  network)
    sub="$1"
    shift
    case "$sub" in
      inspect)
        format=''
        if [ "\${1:-}" = "--format" ]; then
          format="$2"
          shift 2
        fi
        lookup network "\${1:-}"
        if [ -n "$format" ]; then
          awk -F'|' -v value="\${1:-}" '$1 == "network" && ($2 == value || $3 == value) { print $3 }' "$state"
        fi
        ;;
      create)
        printf 'network-id\\n'
        name=''
        for arg in "$@"; do name="$arg"; done
        printf 'network|network-id|%s\\n' "$name" >> "$state"
        ;;
      rm)
        awk -F'|' -v value="$1" '$1 != "network" || ($2 != value && $3 != value)' "$state" > "$state.next"
        mv "$state.next" "$state"
        ;;
    esac
    ;;
  container)
    sub="$1"
    shift
    case "$sub" in
      inspect)
        format=''
        if [ "\${1:-}" = "--format" ]; then
          format="$2"
          shift 2
        fi
        lookup container "\${1:-}"
        if [ -n "$format" ]; then
          awk -F'|' -v value="\${1:-}" '$1 == "container" && ($2 == value || $3 == value) { print "/" $3 }' "$state"
        fi
        ;;
    esac
    ;;
  run)
    printf 'container-id\\n'
    name=''
    previous=''
    for arg in "$@"; do
      if [ "$previous" = "--name" ]; then name="$arg"; fi
      previous="$arg"
    done
    printf 'container|container-id|%s\\n' "$name" >> "$state"
    ;;
  inspect)
    printf '172.31.0.2\\n'
    ;;
  exec)
    printf '{"status":"ok"}\\n'
    ;;
  rm)
    value="$1"
    if [ "$value" = "--force" ]; then value="$2"; fi
    awk -F'|' -v value="$value" '$1 != "container" || ($2 != value && $3 != value)' "$state" > "$state.next"
    mv "$state.next" "$state"
    ;;
esac
`
  );
  await writeExecutable(
    join(directory, 'psql'),
    `#!/bin/sh
printf 'psql %s\\n' "$*" >> "$COMMAND_LOG"
    input=$(cat)
    case "$* $input" in
      *"role_assignment"*) printf '1\\n' ;;
  *"name = 'learning'"*) printf '1\\n' ;;
  *"learning_learner"*) printf '4\\n' ;;
esac
`
  );
  await writeExecutable(
    join(directory, 'curl'),
    `#!/bin/sh
set -eu
printf 'curl %s\\n' "$*" >> "$COMMAND_LOG"
if [ "\${FAIL_CURL:-}" = "1" ]; then exit 22; fi
output=''
cookiejar=''
previous=''
for arg in "$@"; do
  if [ "$previous" = "--output" ]; then output="$arg"; fi
  if [ "$previous" = "--cookie-jar" ]; then cookiejar="$arg"; fi
  previous="$arg"
done
case "$*" in
  *"/authentication/session"*)
    count=$(cat "$SESSION_COUNT")
    count=$((count + 1))
    printf '%s' "$count" > "$SESSION_COUNT"
    if [ "$count" -eq 1 ]; then
      if [ "\${FAIL_IDENTITY:-}" = "1" ]; then
        [ -z "$output" ] || printf '{"data":{"email":"wrong@example.test","profileId":"profile-test"}}' > "$output"
      else
        [ -z "$output" ] || printf '{"data":{"email":"%s","profileId":"profile-test"}}' "$SMOKE_EMAIL" > "$output"
      fi
      printf '200'
    else
      [ -z "$output" ] || printf '{}' > "$output"
      printf '401'
    fi
    ;;
  *"/learning/me"*)
    [ -z "$output" ] || printf '{"profileId":"profile-test","name":"Learning Review Smoke"}' > "$output"
    printf '200'
    ;;
  *"/authentication/register"*|*"/authentication/login"*|*"/authentication/logout"*)
    if printf '%s' "$*" | grep -q '/authentication/login'; then
      [ -z "$output" ] || printf '{"data":{"newToken":"smoke-token"}}' > "$output"
      [ -z "$cookiejar" ] || printf '# Netscape HTTP Cookie File\n127.0.0.1	FALSE	/	TRUE	0	ot_session	smoke-token\n' > "$cookiejar"
    else
      [ -z "$output" ] || printf '{}' > "$output"
    fi
    printf '201'
    ;;
  *) [ -z "$output" ] || printf '{}' > "$output"; printf '200' ;;
esac
`
  );
  await writeExecutable(join(directory, 'sleep'), '#!/bin/sh\nexit 0\n');
  await writeFile(join(directory, 'ss.count'), '0');
  await writeFile(join(directory, 'session.count'), '0');
  await writeFile(join(directory, 'docker.state'), '');
  return {
    env: {
      PATH: `${directory}:${process.env.PATH}`,
      TMUX_LOG: logPath,
      TMUX_STATE: statePath,
      COMMAND_LOG: join(directory, 'commands.log'),
      SS_COUNT: join(directory, 'ss.count'),
      SESSION_COUNT: join(directory, 'session.count'),
      DOCKER_STATE: join(directory, 'docker.state'),
      REAL_NODE: process.execPath,
      ...(options.generateSecrets
        ? {
            CAPTURE_ENV: join(directory, 'captured.env'),
            OPENSSL_COUNT: join(directory, 'openssl.count'),
          }
        : {}),
      ...(options.failCurl ? { FAIL_CURL: '1' } : {}),
    },
  };
}

function runScript(env) {
  return new Promise((resolve) => {
    const child = spawn('bash', [script], {
      cwd: root,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function makeCase(name, options = {}) {
  const directory = join(
    root,
    'tmp',
    `learning-stack-script-test-${name}-${process.pid}`
  );
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const logPath = join(directory, 'tmux.log');
  const statePath = join(directory, 'tmux.state');
  await writeFile(logPath, '');
  await writeFile(statePath, '');
  const stubs = await createCommandStubs(
    directory,
    logPath,
    statePath,
    options
  );
  const requiredArtifacts = [
    join(root, 'dist/apps/gateway/main.js'),
    join(root, 'dist/apps/learning/server/server.mjs'),
    join(root, 'dist/apps/learning/browser/index.csr.html'),
    join(root, 'dist/apps/learning-service/main.js'),
  ];
  const createdArtifacts = [];
  for (const artifact of requiredArtifacts) {
    try {
      await access(artifact);
    } catch {
      await mkdir(dirname(artifact), { recursive: true });
      await writeFile(artifact, '');
      createdArtifacts.push(artifact);
    }
  }
  return {
    directory,
    createdArtifacts,
    env: {
      ...stubs.env,
      LEARNING_STACK_TEST_MODE: 'true',
      LEARNING_STACK_ID: `test-${name}-${process.pid}`,
      LEARNING_STACK_INVOCATION_ID: 'first',
      LEARNING_STACK_RUNTIME_DIR: join(directory, 'runtime'),
      ...(options.generateSecrets
        ? {}
        : {
            REVIEW_JWT_SECRET: 'test-review-jwt-secret-value-1234567890',
            OAUTH_STATE_SECRET: 'test-review-oauth-secret-value-1234567890',
          }),
      ...(options.failCurl ? { FAIL_CURL: '1' } : {}),
      ...(options.failListPanes ? { FAIL_LIST_PANES: '1' } : {}),
      ...(options.failIdentity ? { FAIL_IDENTITY: '1' } : {}),
      ...(options.derivedHost ? { LEARNING_REVIEW_DERIVE_HOST: 'true' } : {}),
    },
    logPath,
    statePath,
  };
}

test('runs an isolated review auth stack, orders dependencies, and performs the smoke flow', async () => {
  const testCase = await makeCase('success', false);
  try {
    const result = await runScript({
      ...testCase.env,
      LEARNING_REVIEW_HOST: '192.0.2.10',
    });
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);

    const source = await readFile(script, 'utf8');
    const tmuxLog = await readFile(testCase.logPath, 'utf8');
    const commandLog = await readFile(
      join(testCase.directory, 'commands.log'),
      'utf8'
    );
    assert.doesNotMatch(source, /\bpkill\b/);
    assert.doesNotMatch(source, /docker compose/);
    assert.doesNotMatch(source, /node apps\/learning-runner\/server\.mjs/);
    assert.doesNotMatch(source, /192\.168\.1\.153/);
    assert.match(source, /TCP-LISTEN:\$LEARNING_RUNNER_PORT,bind=127\.0\.0\.1/);
    assert.doesNotMatch(
      source,
      /--publish "127\.0\.0\.1:\$LEARNING_RUNNER_PORT:3025"/
    );
    assert.match(source, /--read-only/);
    assert.match(source, /--cap-drop ALL/);
    assert.match(source, /--pids-limit 32/);
    assert.match(source, /--memory 256m/);
    assert.match(commandLog, /docker run --detach/);
    assert.match(commandLog, /http:\/\/192\.0\.2\.10:8109/);
    assert.doesNotMatch(source, /LOG_DIR="\/tmp/);
    assert.doesNotMatch(source, /LEARNING_SCRATCH_DIR=\/tmp/);
    assert.match(commandLog, /nx run authentication:typeorm:migration:run/);
    assert.match(commandLog, /nx run profile:typeorm:migration:run/);
    assert.match(commandLog, /nx run permissions:typeorm:migration:run/);
    assert.match(
      commandLog,
      /--projects=authentication,profile,permissions,gateway,learning-service,learning/
    );
    assert.match(commandLog, /--configuration=production/);
    assert.match(tmuxLog, /test-success-/);
    assert.match(tmuxLog, /NODE_ENV=production/);
    assert.match(source, /chmod 600 "\$ENV_FILE"/);
    assert.match(source, /chmod 600 "\$INVOCATION_DIR\/authentication\.yaml"/);
    assert.match(
      source,
      /OAUTH_STATE_SECRET="\$\{OAUTH_STATE_SECRET:-\$\(generate_secret\)\}"/
    );
    assert.doesNotMatch(source, /OAUTH_STATE_SECRET="\$STACK_ID"/);
    assert.doesNotMatch(source, /learning-review-\$STACK_ID/);
    assert.match(
      source,
      /LEARNING_REQUIRE_HASHED_ASSETS="\$REQUIRE_HASHED_ASSETS"/
    );
    assert.doesNotMatch(tmuxLog, /test-review-runtime-value/);
    assert.doesNotMatch(commandLog, /test-review-runtime-value|ReviewOnly/);
    await assert.rejects(
      access(
        join(
          testCase.directory,
          'runtime',
          'invocations',
          'first',
          'authentication.yaml'
        )
      )
    );
    await assert.rejects(
      access(
        join(
          testCase.directory,
          'runtime',
          'invocations',
          'first',
          'env',
          'authentication.env'
        )
      )
    );
    await assert.rejects(
      access(
        join(
          testCase.directory,
          'runtime',
          'invocations',
          'first',
          'smoke-register.json'
        )
      )
    );
    await assert.rejects(
      access(
        join(
          testCase.directory,
          'runtime',
          'invocations',
          'first',
          'smoke-login.json'
        )
      )
    );
    assert.match(commandLog, /\/authentication\/register/);
    assert.match(commandLog, /\/authentication\/login/);
    assert.match(commandLog, /\/authentication\/session/);
    assert.match(commandLog, /\/learning\/me/);
    assert.match(commandLog, /\/authentication\/logout/);
    assert.equal((tmuxLog.match(/kill-session/g) ?? []).length, 0);
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    } else {
      console.error(`kept test artifacts at ${testCase.directory}`);
    }
  }
});

test('generates separate 32-byte defaults and hands them off only through env files', async () => {
  const testCase = await makeCase('generated-secrets', {
    generateSecrets: true,
  });
  try {
    const result = await runScript(testCase.env);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);

    const capturedEnv = await readFile(
      join(testCase.directory, 'captured.env'),
      'utf8'
    );
    const jwtSecrets = [...capturedEnv.matchAll(/^JWT_SECRET=([a-z]+)$/gm)].map(
      (match) => match[1]
    );
    const oauthSecrets = [
      ...capturedEnv.matchAll(/^OAUTH_STATE_SECRET=([a-z]+)$/gm),
    ].map((match) => match[1]);
    assert.ok(jwtSecrets.length > 0);
    assert.ok(oauthSecrets.length > 0);
    assert.equal(new Set(jwtSecrets).size, 1);
    assert.equal(new Set(oauthSecrets).size, 1);
    assert.equal(jwtSecrets[0].length, 64);
    assert.equal(oauthSecrets[0].length, 64);
    assert.notEqual(jwtSecrets[0], oauthSecrets[0]);
    assert.doesNotMatch(jwtSecrets[0], /generated-secrets|STACK_ID/i);
    assert.doesNotMatch(oauthSecrets[0], /generated-secrets|STACK_ID/i);

    const tmuxLog = await readFile(testCase.logPath, 'utf8');
    assert.doesNotMatch(tmuxLog, /a{64}|b{64}/);
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    } else {
      console.error(`kept test artifacts at ${testCase.directory}`);
    }
  }
});

test('derives a review host when no explicit host is supplied', async () => {
  const testCase = await makeCase('derived-host', { derivedHost: true });
  try {
    const result = await runScript(testCase.env);
    assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
    const commandLog = await readFile(
      join(testCase.directory, 'commands.log'),
      'utf8'
    );
    assert.match(commandLog, /http:\/\/198\.51\.100\.42:8109/);
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    }
  }
});

test('fails before startup when host derivation is disabled without an explicit host', async () => {
  const testCase = await makeCase('missing-host', false);
  try {
    const result = await runScript({
      ...testCase.env,
      LEARNING_REVIEW_DERIVE_HOST: 'false',
      LEARNING_REVIEW_HOST: '',
    });
    assert.notEqual(result.code, 0);
    assert.match(
      result.stderr,
      /LEARNING_REVIEW_HOST is required when host derivation is disabled/
    );
    await assert.rejects(access(join(testCase.directory, 'commands.log')));
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    }
  }
});

test('fails closed on readiness failure and only kills owned sessions', async () => {
  const testCase = await makeCase('failure', true);
  try {
    const result = await runScript(testCase.env);
    assert.notEqual(result.code, 0, `${result.stdout}\n${result.stderr}`);
    const tmuxLog = await readFile(testCase.logPath, 'utf8');
    const commandLog = await readFile(
      join(testCase.directory, 'commands.log'),
      'utf8'
    );
    assert.match(tmuxLog, /display-message/);
    assert.equal(
      (tmuxLog.match(/kill-session/g) ?? []).length,
      6,
      `${result.stdout}\n${result.stderr}\n${commandLog}\n${tmuxLog}`
    );
    assert.equal((await readFile(testCase.statePath, 'utf8')).trim(), '');
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    } else {
      console.error(`kept test artifacts at ${testCase.directory}`);
    }
  }
});

test('does not clean up a prior successful invocation with the same stack id', async () => {
  const testCase = await makeCase('prior', false);
  try {
    const first = await runScript(testCase.env);
    assert.equal(first.code, 0, `${first.stdout}\n${first.stderr}`);

    await writeFile(join(testCase.directory, 'ss.count'), '0');
    const second = await runScript({
      ...testCase.env,
      FAIL_CURL: '1',
      LEARNING_STACK_INVOCATION_ID: 'second',
    });

    assert.notEqual(second.code, 0, `${second.stdout}\n${second.stderr}`);

    const state = await readFile(testCase.statePath, 'utf8');
    assert.match(state, /test-prior-.*-first-/);
    assert.doesNotMatch(state, /test-prior-.*-second-/);
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    } else {
      console.error(`kept test artifacts at ${testCase.directory}`);
    }
  }
});

test('refuses an occupied configured port before migrations or session creation', async () => {
  const testCase = await makeCase('occupied', false);
  try {
    const result = await runScript({
      ...testCase.env,
      OCCUPIED_PORT: '3101',
    });
    assert.notEqual(result.code, 0);
    assert.equal((await readFile(testCase.statePath, 'utf8')).trim(), '');
    await assert.rejects(access(join(testCase.directory, 'commands.log')));
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    } else {
      console.error(`kept test artifacts at ${testCase.directory}`);
    }
  }
});

test('refuses a held per-stack lock without touching existing runtime state', async () => {
  const testCase = await makeCase('locked', false);
  const lockDir = `${join(testCase.directory, 'runtime')}.lock`;
  try {
    await mkdir(lockDir, { recursive: true });
    const result = await runScript(testCase.env);
    assert.notEqual(result.code, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /stack lock is held/);
    assert.equal((await readFile(testCase.statePath, 'utf8')).trim(), '');
    await assert.rejects(access(join(testCase.directory, 'commands.log')));
  } finally {
    await rm(lockDir, { recursive: true, force: true });
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    }
  }
});

test('cleans a session whose pane ownership check fails after creation', async () => {
  const testCase = await makeCase('pane-failure', { failListPanes: true });
  try {
    const result = await runScript(testCase.env);
    assert.notEqual(result.code, 0);
    const tmuxLog = await readFile(testCase.logPath, 'utf8');
    assert.match(tmuxLog, /new-session/);
    assert.match(tmuxLog, /kill-session/);
    assert.equal((await readFile(testCase.statePath, 'utf8')).trim(), '');
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    }
  }
});

test('cleans response and smoke artifacts when identity assertion fails', async () => {
  const testCase = await makeCase('identity-failure', { failIdentity: true });
  try {
    const result = await runScript(testCase.env);
    assert.notEqual(result.code, 0);
    assert.equal((await readFile(testCase.statePath, 'utf8')).trim(), '');
    const commandLog = await readFile(
      join(testCase.directory, 'commands.log'),
      'utf8'
    );
    const tmuxLog = await readFile(testCase.logPath, 'utf8');
    const source = await readFile(script, 'utf8');
    assert.match(commandLog, /runtime\/invocations\/first\/response\.json/);
    assert.match(
      commandLog,
      /runtime\/invocations\/first\/smoke-register\.json/
    );
    assert.match(
      tmuxLog,
      /runtime\/invocations\/first\/env\/authentication\.env/
    );
    assert.match(
      source,
      /write_env_value AUTHENTICATION_CONFIG_PATH "\$INVOCATION_DIR\/authentication\.yaml"/
    );
    await assert.rejects(
      access(join(testCase.directory, 'runtime', 'invocations', 'first'))
    );
  } finally {
    if (process.env.KEEP_LEARNING_STACK_TEST_ARTIFACTS !== '1') {
      await rm(testCase.directory, { recursive: true, force: true });
      await Promise.all(
        testCase.createdArtifacts.map((artifact) =>
          rm(artifact, { force: true })
        )
      );
    }
  }
});
