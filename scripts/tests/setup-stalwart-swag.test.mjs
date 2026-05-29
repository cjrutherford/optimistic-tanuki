import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  '..',
  '..'
);

function writeExecutable(filePath, content) {
  fs.writeFileSync(filePath, content, { mode: 0o755 });
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stalwart-swag-'));
  const remoteRoot = path.join(root, 'remote');
  const homeDir = path.join(remoteRoot, 'home');
  const swagDir = path.join(
    remoteRoot,
    'opt',
    'swag',
    'config',
    'nginx',
    'site-confs'
  );
  const tmpDir = path.join(remoteRoot, 'tmp');
  const binDir = path.join(root, 'bin');
  const logDir = path.join(root, 'logs');

  fs.mkdirSync(homeDir, { recursive: true });
  fs.mkdirSync(swagDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  fs.writeFileSync(
    path.join(homeDir, 'docker-compose.yaml'),
    [
      'services:',
      '  swag:',
      '    image: lscr.io/linuxserver/swag',
      '  app:',
      '    image: demo/app',
      'volumes:',
      '  existing-data:',
      '',
    ].join('\n')
  );

  const mockLog = path.join(logDir, 'mock.log');
  const curlLog = path.join(logDir, 'curl.log');

  writeExecutable(
    path.join(binDir, 'scp'),
    String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const [srcArg, destArg] = args;
const logPath = process.env.MOCK_LOG;
const remoteRoot = process.env.REMOTE_FIXTURE_DIR;

function toLocal(target) {
  const colonIndex = target.indexOf(':');
  if (colonIndex === -1) return target;
  const remotePath = target.slice(colonIndex + 1);
  if (remotePath.startsWith('~/')) {
    return path.join(remoteRoot, 'home', remotePath.slice(2));
  }
  return path.join(remoteRoot, remotePath.replace(/^\//, ''));
}

fs.appendFileSync(logPath, JSON.stringify({ tool: 'scp', args }) + '\n');
const src = toLocal(srcArg);
const dest = toLocal(destArg);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
`
  );

  writeExecutable(
    path.join(binDir, 'ssh'),
    String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const args = process.argv.slice(2);
const command = args[1] || '';
const logPath = process.env.MOCK_LOG;
const remoteRoot = process.env.REMOTE_FIXTURE_DIR;
fs.appendFileSync(logPath, JSON.stringify({ tool: 'ssh', args, command }) + '\n');

if (!command) process.exit(0);

let translated = command
  .replace(/~\//g, '__REMOTE_HOME__/')
  .replace(/\/opt\//g, '__REMOTE_OPT__/')
  .replace(/\/tmp\//g, '__REMOTE_TMP__/');

translated = translated
  .replace(/__REMOTE_HOME__\//g, path.join(remoteRoot, 'home') + path.sep)
  .replace(/__REMOTE_OPT__\//g, path.join(remoteRoot, 'opt') + path.sep)
  .replace(/__REMOTE_TMP__\//g, path.join(remoteRoot, 'tmp') + path.sep);

if (translated.includes('docker compose') || translated.includes('docker restart')) {
  process.exit(0);
}

execSync(translated, { stdio: 'inherit', shell: '/bin/bash' });
`
  );

  writeExecutable(
    path.join(binDir, 'curl'),
    String.raw`#!/usr/bin/env node
const fs = require('node:fs');

const args = process.argv.slice(2);
const logPath = process.env.CURL_LOG;
let method = 'GET';
let url = '';
let data = '';

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '-X') {
    method = args[index + 1];
    index += 1;
  } else if (arg === '--data' || arg === '-d') {
    data = args[index + 1];
    index += 1;
  } else if (/^https?:\/\//.test(arg)) {
    url = arg;
  }
}

fs.appendFileSync(logPath, JSON.stringify({ method, url, data }) + '\n');

if (url.includes('/zones?name=christopherrutherford.net')) {
  process.stdout.write(JSON.stringify({ success: true, result: [{ id: 'zone-cr' }] }));
  process.exit(0);
}

if (url.includes('/zones?name=optimistic-tanuki.com')) {
  process.stdout.write(JSON.stringify({ success: true, result: [{ id: 'zone-ot' }] }));
  process.exit(0);
}

if (url.includes('/dns_records?')) {
  process.stdout.write(JSON.stringify({ success: true, result: [] }));
  process.exit(0);
}

if (url.includes('/dns_records')) {
  process.stdout.write(JSON.stringify({ success: true, result: { id: 'record-id' } }));
  process.exit(0);
}

process.stdout.write(JSON.stringify({ success: true, result: {} }));
`
  );

  return { root, remoteRoot, binDir, mockLog, curlLog };
}

test('prints usage when ssh target is missing', () => {
  const result = spawnSync('bash', ['scripts/setup-stalwart-swag.sh'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /user@endpoint/);
  assert.match(result.stderr + result.stdout, /--dry-run/);
  assert.match(result.stderr + result.stdout, /--ipv4/);
});

test('prints help text with --help', () => {
  const result = spawnSync(
    'bash',
    ['scripts/setup-stalwart-swag.sh', '--help'],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /setup-stalwart-swag\.sh/);
  assert.match(result.stdout, /CLOUDFLARE_API_TOKEN/);
  assert.match(result.stdout, /--swag-nginx-root/);
});

test('dry-run reports intended actions without mutating remote files or calling curl', () => {
  const fixture = makeFixture();
  const composePath = path.join(
    fixture.remoteRoot,
    'home',
    'docker-compose.yaml'
  );
  const before = fs.readFileSync(composePath, 'utf8');

  const result = spawnSync(
    'bash',
    [
      'scripts/setup-stalwart-swag.sh',
      'demo@example-host',
      '--dry-run',
      '--ipv4',
      '203.0.113.10',
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture.binDir}:${process.env.PATH}`,
        REMOTE_FIXTURE_DIR: fixture.remoteRoot,
        MOCK_LOG: fixture.mockLog,
        CURL_LOG: fixture.curlLog,
      },
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /DRY RUN/);
  assert.equal(fs.readFileSync(composePath, 'utf8'), before);
  assert.equal(
    fs.existsSync(
      path.join(
        fixture.remoteRoot,
        'opt',
        'swag',
        'config',
        'nginx',
        'site-confs',
        'stalwart-mail.conf'
      )
    ),
    false
  );
  assert.equal(fs.existsSync(fixture.curlLog), false);
});

test('updates compose, writes swag config, and creates cloudflare dns records', () => {
  const fixture = makeFixture();

  const result = spawnSync(
    'bash',
    [
      'scripts/setup-stalwart-swag.sh',
      'demo@example-host',
      '--ipv4',
      '203.0.113.10',
      '--recovery-admin',
      'admin:supersecret',
    ],
    {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture.binDir}:${process.env.PATH}`,
        REMOTE_FIXTURE_DIR: fixture.remoteRoot,
        MOCK_LOG: fixture.mockLog,
        CURL_LOG: fixture.curlLog,
        CLOUDFLARE_API_TOKEN: 'token-123',
      },
    }
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const composeContent = fs.readFileSync(
    path.join(fixture.remoteRoot, 'home', 'docker-compose.yaml'),
    'utf8'
  );

  assert.match(composeContent, /^  stalwart:\s*$/m);
  assert.match(
    composeContent,
    /STALWART_PUBLIC_URL=https:\/\/mail\.christopherrutherford\.net/
  );
  assert.match(composeContent, /"8080:8080"/);
  assert.match(composeContent, /^volumes:\s*$/m);
  assert.match(composeContent, /^  stalwart-etc:\s*$/m);
  assert.match(composeContent, /^  stalwart-data:\s*$/m);

  const stalwartIndex = composeContent.indexOf('  stalwart:');
  const volumesIndex = composeContent.indexOf('volumes:');
  assert.ok(
    stalwartIndex > -1 && stalwartIndex < volumesIndex,
    'stalwart service should be inserted before the top-level volumes block'
  );

  const nginxContent = fs.readFileSync(
    path.join(
      fixture.remoteRoot,
      'opt',
      'swag',
      'config',
      'nginx',
      'site-confs',
      'stalwart-mail.conf'
    ),
    'utf8'
  );

  assert.match(
    nginxContent,
    /server_name mail\.christopherrutherford\.net mail\.optimistic-tanuki\.com;/
  );
  assert.match(nginxContent, /proxy_pass http:\/\/127\.0\.0\.1:8080;/);

  const curlCalls = fs
    .readFileSync(fixture.curlLog, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const createCalls = curlCalls.filter(
    (call) => call.method === 'POST' && call.url.includes('/dns_records')
  );
  assert.ok(
    createCalls.length >= 6,
    'expected Cloudflare record creation calls'
  );
  assert.ok(
    createCalls.some(
      (call) =>
        call.data.includes('"type":"A"') &&
        call.data.includes('"name":"mail.christopherrutherford.net"') &&
        call.data.includes('"proxied":false')
    )
  );
  assert.ok(
    createCalls.some(
      (call) =>
        call.data.includes('"type":"A"') &&
        call.data.includes('"name":"mail.optimistic-tanuki.com"') &&
        call.data.includes('"proxied":false')
    )
  );
  assert.ok(
    createCalls.some(
      (call) =>
        call.data.includes('"type":"MX"') &&
        call.data.includes('"content":"mail.christopherrutherford.net"')
    )
  );
});
