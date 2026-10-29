import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {
  MANIFEST_NAME,
  createDeploymentManifest,
} from '../rr12-deployment-manifest.mjs';
import {
  criticalAssetPaths,
  inspectSite,
  validateServedManifest,
} from '../rr12-probe-deployment.mjs';

const REVISION = 'a'.repeat(40);

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'rr12-evidence-'));
}

async function siteFixture({
  missingManifest = false,
  mutateAsset = false,
  externalCritical = false,
  sourceRevision = REVISION,
} = {}) {
  const index = Buffer.from('<!doctype html><title>Built</title>');
  const main = Buffer.from('window.app = true;');
  const files = new Map([
    ['/index.html', index],
    ['/main.js', mutateAsset ? Buffer.from('window.app = false;') : main],
  ]);
  const manifest = {
    schema: 'optimistic-tanuki.browser-deployment.v1',
    app: 'client-interface',
    sourceRevision,
    workflowRunId: '12345',
    workflowRunAttempt: '1',
    files: [
      { path: 'index.html', bytes: index.length, sha256: digest(index) },
      { path: 'main.js', bytes: main.length, sha256: digest(main) },
    ],
  };
  if (!missingManifest)
    files.set(`/${MANIFEST_NAME}`, Buffer.from(JSON.stringify(manifest)));

  const server = http.createServer((request, response) => {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      const external = externalCritical
        ? '<script src="https://outside.invalid/x.js?token=must-not-be-recorded"></script>'
        : '';
      response.end(
        `<main>Early access</main><script>const hiddenCopy = "Private by Default";</script><script src="/main.js"></script>${external}`
      );
      return;
    }
    const bytes = files.get(request.url);
    response.writeHead(bytes ? 200 : 404, {
      'content-type': request.url.endsWith('.js')
        ? 'text/javascript'
        : 'application/json',
    });
    response.end(bytes ?? 'not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function close(server) {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  );
}

test('manifest contains sorted browser-relative byte hashes and no server paths', async () => {
  const root = await tempDir();
  const browser = path.join(root, 'browser');
  await fs.mkdir(path.join(browser, 'nested'), { recursive: true });
  await fs.writeFile(path.join(browser, 'z.js'), 'z');
  await fs.writeFile(path.join(browser, 'nested', 'a.css'), 'a');

  const manifest = await createDeploymentManifest({
    app: 'client-interface',
    browserDir: browser,
    sourceRevision: REVISION,
    runId: '12345',
    runAttempt: '2',
  });

  assert.deepEqual(
    manifest.files.map((file) => file.path),
    ['nested/a.css', 'z.js']
  );
  assert.equal(manifest.files[0].sha256, digest(Buffer.from('a')));
  assert.equal(manifest.files[0].bytes, 1);
  assert.equal(JSON.stringify(manifest).includes(root), false);
  assert.equal(manifest.sourceRevision, REVISION);
  await assert.rejects(
    createDeploymentManifest({
      app: 'client-interface',
      browserDir: browser,
      sourceRevision: 'bad-sha',
    }),
    /full 40-character Git SHA/
  );
});

test('manifest writer refuses symlinks in public browser output', async () => {
  const root = await tempDir();
  const browser = path.join(root, 'browser');
  await fs.mkdir(browser);
  await fs.writeFile(path.join(root, 'private.txt'), 'private');
  await fs.symlink(
    path.join(root, 'private.txt'),
    path.join(browser, 'linked.txt')
  );

  await assert.rejects(
    createDeploymentManifest({
      app: 'local-hub',
      browserDir: browser,
      sourceRevision: REVISION,
    }),
    /Symlinks are not allowed/
  );
});

test('probe requires an explicit reviewed revision before reporting verified asset provenance', async () => {
  const fixture = await siteFixture();
  try {
    const inventoryOnly = await inspectSite({
      product: 'OT',
      siteUrl: fixture.url,
    });
    assert.equal(inventoryOnly.status, 'assets-match-only');
    assert.equal(inventoryOnly.expectedReviewedRevision, null);

    const result = await inspectSite({
      product: 'OT',
      siteUrl: fixture.url,
      expectedRevision: REVISION,
    });
    assert.equal(result.status, 'verified');
    assert.equal(result.manifest.sourceRevision, REVISION);
    assert.equal(result.expectedReviewedRevision, REVISION);
    assert.equal(result.checkedAssetCount, 2);
    assert.equal(result.mismatches.length, 0);
    assert.deepEqual(result.externalCriticalResources, []);
    assert.notEqual(
      result.root.sha256,
      digest(Buffer.from('<!doctype html><title>Built</title>'))
    );
    assert.deepEqual(result.visibleClaimContexts, []);
    assert.deepEqual(
      criticalAssetPaths('<script src="/main.js"></script>', fixture.url),
      {
        sameOriginPaths: ['main.js'],
        externalCriticalResources: [],
        uncheckedCriticalResources: [],
      }
    );
  } finally {
    await close(fixture.server);
  }
});

test('probe lists external critical resources without fetching or retaining query strings', async () => {
  const fixture = await siteFixture({ externalCritical: true });
  try {
    const result = await inspectSite({
      product: 'OT',
      siteUrl: fixture.url,
      expectedRevision: REVISION,
    });
    assert.equal(
      result.status,
      'verified-same-origin-assets-with-unchecked-critical-resources'
    );
    assert.deepEqual(result.externalCriticalResources, [
      {
        origin: 'https://outside.invalid',
        path: '/x.js',
        relation: 'script',
        reason: 'query-or-fragment-not-fetched',
        status: 'not-fetched',
      },
    ]);
    assert.equal(
      JSON.stringify(result).includes('must-not-be-recorded'),
      false
    );
  } finally {
    await close(fixture.server);
  }
});

test('critical query, unsupported scheme, missing, and unsafe references stay visible as unchecked', () => {
  const refs = criticalAssetPaths(
    '<script src="/main.js?v=4"></script>' +
      '<script src="data:text/javascript,alert(1)"></script>' +
      '<link rel="stylesheet">' +
      '<link rel="stylesheet" href="/%ZZ.css">',
    'https://example.test'
  );
  assert.deepEqual(refs.sameOriginPaths, []);
  assert.deepEqual(refs.externalCriticalResources, []);
  assert.deepEqual(refs.uncheckedCriticalResources, [
    {
      origin: 'data:',
      path: 'text/javascript,alert(1)',
      relation: 'script',
      reason: 'unsupported-scheme',
      status: 'not-fetched',
    },
    {
      origin: 'https://example.test',
      path: '/%ZZ.css',
      relation: 'stylesheet',
      reason: 'unsafe-path-not-fetched',
      status: 'not-fetched',
    },
    {
      origin: 'https://example.test',
      path: '/main.js',
      relation: 'script',
      reason: 'query-or-fragment-not-fetched',
      status: 'not-fetched',
    },
    {
      relation: 'stylesheet',
      reason: 'missing-reference',
      status: 'not-fetched',
    },
  ]);
});

test('OT source HTML external scripts and styles remain explicitly unchecked', async () => {
  const root = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../..'
  );
  const html = await fs.readFile(
    path.join(root, 'apps/client-interface/src/index.html'),
    'utf8'
  );
  const refs = criticalAssetPaths(html, 'https://ot.example.test');

  assert.deepEqual(refs.sameOriginPaths, []);
  assert.equal(refs.externalCriticalResources.length, 4);
  assert.ok(
    refs.externalCriticalResources.some(
      (resource) =>
        resource.origin === 'https://cdnjs.cloudflare.com' &&
        resource.relation === 'script'
    )
  );
  assert.ok(
    refs.externalCriticalResources.every(
      (resource) => resource.status === 'not-fetched'
    )
  );
  assert.equal(JSON.stringify(refs).includes('sha512-'), false);
});

test('probe fails when a self-reported source revision differs from reviewed revision', async () => {
  const fixture = await siteFixture();
  try {
    const result = await inspectSite({
      product: 'OT',
      siteUrl: fixture.url,
      expectedRevision: 'c'.repeat(40),
    });
    assert.equal(result.status, 'failed');
    assert.ok(
      result.mismatches.some(
        (mismatch) =>
          mismatch.reason ===
          'manifest source revision differs from expected reviewed revision'
      )
    );
  } finally {
    await close(fixture.server);
  }
});

test('probe fails when served bytes differ from manifest fingerprints', async () => {
  const fixture = await siteFixture({ mutateAsset: true });
  try {
    const result = await inspectSite({ product: 'OT', siteUrl: fixture.url });
    assert.equal(result.status, 'failed');
    assert.deepEqual(result.mismatches, [
      { path: 'main.js', reason: 'served bytes differ from build manifest' },
    ]);
  } finally {
    await close(fixture.server);
  }
});

test('probe records a missing manifest as unavailable instead of treating HTTP root success as provenance', async () => {
  const fixture = await siteFixture({ missingManifest: true });
  try {
    const result = await inspectSite({ product: 'OT', siteUrl: fixture.url });
    assert.equal(result.root.status, 200);
    assert.equal(result.status, 'unavailable');
    assert.match(result.error, /manifest request returned HTTP 404/);
  } finally {
    await close(fixture.server);
  }
});

test('probe can prove local asset matches without inventing an unavailable source revision', async () => {
  const fixture = await siteFixture({ sourceRevision: null });
  try {
    const result = await inspectSite({ product: 'OT', siteUrl: fixture.url });
    assert.equal(result.status, 'assets-match-only');
    assert.equal(result.manifest.sourceRevision, null);
    assert.match(result.error, /does not identify a Git revision/);
  } finally {
    await close(fixture.server);
  }
});

test('manifest validation rejects traversal, malformed SHA-256, duplicates, and wrong app', () => {
  const valid = {
    schema: 'optimistic-tanuki.browser-deployment.v1',
    app: 'client-interface',
    sourceRevision: REVISION,
    workflowRunId: null,
    workflowRunAttempt: null,
    files: [{ path: 'main.js', bytes: 1, sha256: 'b'.repeat(64) }],
  };
  assert.throws(
    () =>
      validateServedManifest(
        {
          ...valid,
          files: [{ ...valid.files[0], path: '../private.env' }],
        },
        'client-interface'
      ),
    /unsafe asset path/
  );
  assert.throws(
    () =>
      validateServedManifest(
        {
          ...valid,
          files: [{ ...valid.files[0], sha256: 'bad' }],
        },
        'client-interface'
      ),
    /manifest file entry invalid/
  );
  assert.throws(
    () =>
      validateServedManifest(
        {
          ...valid,
          files: [...valid.files, ...valid.files],
        },
        'client-interface'
      ),
    /manifest file entry invalid/
  );
  assert.throws(
    () => validateServedManifest(valid, 'local-hub'),
    /manifest contract mismatch/
  );
  assert.throws(
    () =>
      validateServedManifest(
        {
          ...valid,
          workflowRunId: 'run-123',
          workflowRunAttempt: '1',
        },
        'client-interface'
      ),
    /workflow run metadata invalid/
  );
  assert.throws(
    () =>
      validateServedManifest(
        {
          ...valid,
          workflowRunId: '123',
          workflowRunAttempt: 1,
        },
        'client-interface'
      ),
    /workflow run metadata invalid/
  );
  assert.throws(
    () =>
      validateServedManifest(
        {
          ...valid,
          workflowRunId: '123',
          workflowRunAttempt: null,
        },
        'client-interface'
      ),
    /workflow run metadata invalid/
  );
});

test('probe rejects query strings, credentials, and non-loopback HTTP origins', async () => {
  await assert.rejects(
    inspectSite({
      product: 'OT',
      siteUrl: 'https://example.test/?token=secret',
    }),
    /HTTPS origin without path, query, or credentials/
  );
  await assert.rejects(
    inspectSite({ product: 'OT', siteUrl: 'https://user:pass@example.test' }),
    /HTTPS origin without path, query, or credentials/
  );
  await assert.rejects(
    inspectSite({ product: 'OT', siteUrl: 'http://192.0.2.1' }),
    /HTTPS origin without path, query, or credentials/
  );
});

test('production deployment and image build pin and propagate the event revision', async () => {
  const root = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '../..'
  );
  const [deployWorkflow, buildWorkflow, clientDockerfile, hubDockerfile] =
    await Promise.all([
      fs.readFile(path.join(root, '.github/workflows/deploy.yml'), 'utf8'),
      fs.readFile(path.join(root, '.github/workflows/ci-cd.yml'), 'utf8'),
      fs.readFile(path.join(root, 'apps/client-interface/Dockerfile'), 'utf8'),
      fs.readFile(path.join(root, 'apps/local-hub/Dockerfile'), 'utf8'),
    ]);
  assert.match(deployWorkflow, /ref:\s*\$\{\{\s*github\.sha\s*\}\}/);
  assert.match(deployWorkflow, /git rev-parse HEAD/);
  assert.match(
    deployWorkflow,
    /if \[ "\$CHECKED_OUT_SHA" != "\$GITHUB_SHA" \]/
  );
  assert.match(buildWorkflow, /GIT_SHA=\$\{\{ github\.sha \}\}/);
  assert.match(
    buildWorkflow,
    /org\.opencontainers\.image\.revision=\$\{\{ github\.sha \}\}/
  );
  assert.match(clientDockerfile, /--app client-interface/);
  assert.match(hubDockerfile, /--app local-hub/);
  assert.match(clientDockerfile, /rr12-deployment-manifest\.mjs/);
  assert.match(hubDockerfile, /rr12-deployment-manifest\.mjs/);
});
