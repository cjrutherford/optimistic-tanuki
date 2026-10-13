#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MANIFEST_NAME = 'deployment-manifest.json';
export const MANIFEST_SCHEMA = 'optimistic-tanuki.browser-deployment.v1';

const fullSha = /^[a-f0-9]{40}$/i;

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || !argv[index + 1]) {
      throw new Error(`Expected --name value near ${key}`);
    }
    values.set(key.slice(2), argv[++index]);
  }
  return values;
}

function safeRelativePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 1024 ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#')
  ) {
    throw new Error(`Unsafe browser asset path: ${String(value)}`);
  }
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe browser asset path: ${value}`);
  }
  return parts.join('/');
}

async function walkFiles(root, current = root) {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(
        `Symlinks are not allowed in browser assets: ${absolutePath}`
      );
    }
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, absolutePath)));
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unsupported browser asset entry: ${absolutePath}`);
    }
    const relativePath = safeRelativePath(
      path.relative(root, absolutePath).split(path.sep).join('/')
    );
    if (relativePath !== MANIFEST_NAME) files.push(relativePath);
  }
  return files;
}

export async function createDeploymentManifest({
  app,
  browserDir,
  sourceRevision,
  runId = null,
  runAttempt = null,
}) {
  if (!['client-interface', 'local-hub'].includes(app)) {
    throw new Error(`Unsupported RR12 public app: ${String(app)}`);
  }
  if (sourceRevision !== 'unknown' && !fullSha.test(sourceRevision)) {
    throw new Error(
      'sourceRevision must be a full 40-character Git SHA or "unknown"'
    );
  }
  for (const [label, value] of [
    ['runId', runId],
    ['runAttempt', runAttempt],
  ]) {
    if (value !== null && !/^[0-9]{1,20}$/.test(String(value))) {
      throw new Error(`${label} must contain decimal digits only`);
    }
  }

  const root = await fs.realpath(browserDir);
  const relativePaths = (await walkFiles(root)).sort();
  if (relativePaths.length === 0) {
    throw new Error('Browser output contains no regular files');
  }

  const files = [];
  for (const assetPath of relativePaths) {
    const bytes = await fs.readFile(path.join(root, ...assetPath.split('/')));
    files.push({
      path: assetPath,
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    });
  }

  return {
    schema: MANIFEST_SCHEMA,
    app,
    sourceRevision:
      sourceRevision === 'unknown' ? null : sourceRevision.toLowerCase(),
    workflowRunId: runId === null ? null : String(runId),
    workflowRunAttempt: runAttempt === null ? null : String(runAttempt),
    files,
  };
}

export async function writeDeploymentManifest(options) {
  const manifest = await createDeploymentManifest(options);
  const root = await fs.realpath(options.browserDir);
  const output = path.join(root, MANIFEST_NAME);
  const temporary = path.join(root, `.${MANIFEST_NAME}.${process.pid}.tmp`);
  await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o644,
  });
  await fs.rename(temporary, output);
  return manifest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const browserDir = args.get('browser-dir');
  const app = args.get('app');
  const sourceRevision = args.get('source-revision') ?? 'unknown';
  if (!browserDir || !app) {
    throw new Error(
      'Usage: node scripts/rr12-deployment-manifest.mjs --app <client-interface|local-hub> --browser-dir <dir> [--source-revision <full-sha|unknown>] [--run-id <digits>] [--run-attempt <digits>]'
    );
  }
  const manifest = await writeDeploymentManifest({
    app,
    browserDir,
    sourceRevision,
    runId: args.get('run-id') ?? null,
    runAttempt: args.get('run-attempt') ?? null,
  });
  process.stdout.write(
    `Wrote ${MANIFEST_NAME}: app=${manifest.app} files=${
      manifest.files.length
    } source=${manifest.sourceRevision ?? 'unavailable'}\n`
  );
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
