import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawn } from 'node:child_process';
import { resolve } from 'node:path';

const origin = new URL(process.env['BASE_URL'] ?? 'http://127.0.0.1:8080')
  .origin;
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDirectory = resolve(workspaceRoot, '.runtime-artifacts/rr10');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const missingId = '00000000-0000-4000-8000-000000000099';

test.describe.configure({ retries: 0 });

function recordEvidence(name: string, data: unknown): string {
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(evidenceDirectory, 0o700);
  const path = resolve(evidenceDirectory, `${name}-${runId}.json`);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}

async function buildProvenance() {
  const served = await fetch(`${origin}/main.js`);
  const servedBytes = Buffer.from(await served.arrayBuffer());
  const builtBytes = readFileSync(
    resolve(workspaceRoot, 'dist/apps/client-interface/browser/main.js')
  );
  const servedHash = createHash('sha256').update(servedBytes).digest('hex');
  const builtHash = createHash('sha256').update(builtBytes).digest('hex');
  expect(served.status).toBe(200);
  expect(servedHash).toBe(builtHash);
  return { servedMainStatus: served.status, servedHash, builtHash };
}

test('RR10 I03 slow topic response reaches a successful empty state', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the running OT stack'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Record this state once in system Chrome'
  );
  const buildRunId = process.env['RR10_I03_BUILD_RUN'];
  expect(buildRunId).toBeTruthy();
  const provenance = await buildProvenance();
  let releaseResponse!: () => void;
  let responseStarted!: () => void;
  const responseGate = new Promise<void>(
    (resolveGate) => (releaseResponse = resolveGate)
  );
  const started = new Promise<void>(
    (resolveStarted) => (responseStarted = resolveStarted)
  );
  await page.route('**/api/forum/topics', async (route) => {
    responseStarted();
    await responseGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    });
  });
  const navigation = page.goto(`${origin}/forum`, {
    waitUntil: 'domcontentloaded',
  });
  await started;
  await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
  const loadingObservedAt = new Date().toISOString();
  releaseResponse();
  await navigation;
  await expect(
    page.getByText('No topics found. Be the first to create one!')
  ).toBeVisible();
  const emptyObservedAt = new Date().toISOString();
  recordEvidence('i03-slow-empty-topics', {
    observedAt: new Date().toISOString(),
    origin,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    }).trim(),
    buildRunId,
    provenance,
    injectedResponse: {
      endpoint: '/api/forum/topics',
      status: 200,
      body: [],
      delay: 'held until loading UI observed',
    },
    loadingObservedAt,
    emptyObservedAt,
    finalUrl: page.url(),
    bodyText: (await page.locator('body').innerText()).slice(0, 2500),
  });
});

test('RR10 I03 missing topic and thread deep links show resource errors without empty states', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the running OT stack'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Record this state once in system Chrome'
  );
  const buildRunId = process.env['RR10_I03_BUILD_RUN'];
  expect(buildRunId).toBeTruthy();
  const provenance = await buildProvenance();
  const observed: Array<{ path: string; status: number; bodyText: string }> =
    [];
  for (const resource of ['topic', 'thread'] as const) {
    const path = `/forum/${resource}/${missingId}`;
    const apiPath = `/api/forum/${resource}/${missingId}`;
    const responsePromise = page.waitForResponse(
      (response) => new URL(response.url()).pathname === apiPath
    );
    await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
    const response = await responsePromise;
    expect(response.status()).toBe(404);
    const error = page.getByRole('alert').filter({
      hasText:
        resource === 'topic'
          ? 'This forum topic could not be loaded (not found).'
          : 'This forum thread could not be loaded (not found).',
    });
    await expect(error).toBeVisible();
    await expect(
      page.getByText('No topics found. Be the first to create one!')
    ).toHaveCount(0);
    await expect(
      page.getByText('No threads in this topic yet. Create the first one!')
    ).toHaveCount(0);
    observed.push({
      path,
      status: response.status(),
      bodyText: (await page.locator('body').innerText()).slice(0, 2500),
    });
  }
  recordEvidence('i03-missing-detail-links', {
    observedAt: new Date().toISOString(),
    origin,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    }).trim(),
    buildRunId,
    provenance,
    readOnly: true,
    observed,
  });
});

test('RR10 I03 missing post response displays an error instead of the empty state', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the running OT stack'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Record this state once in system Chrome'
  );
  const buildRunId = process.env['RR10_I03_BUILD_RUN'];
  expect(buildRunId).toBeTruthy();
  const provenance = await buildProvenance();
  const headers = { 'x-ot-appscope': 'client-interface' };
  const topicsResponse = await page.request.get(`${origin}/api/forum/topics`, {
    headers,
  });
  expect(topicsResponse.ok()).toBeTruthy();
  const topics = (await topicsResponse.json()) as Array<{ id: string }>;
  let selected: { topicId: string; threadId: string } | undefined;
  for (const topic of topics.slice(0, 80)) {
    const response = await page.request.get(
      `${origin}/api/forum/topic/${topic.id}/threads`,
      { headers }
    );
    if (!response.ok()) continue;
    const threads = (await response.json()) as Array<{ id: string }>;
    if (threads.length > 0) {
      selected = { topicId: topic.id, threadId: threads[0].id };
      break;
    }
  }
  expect(
    selected,
    'find an existing public topic/thread with read-only GETs'
  ).toBeTruthy();
  const postPath = `/api/forum/thread/${selected!.threadId}/posts`;
  let injected = false;
  await page.route(`**${postPath}`, async (route) => {
    injected = true;
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 404,
        message: 'Deleted post collection',
      }),
    });
  });
  const postResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === postPath
  );
  await page.goto(`${origin}/forum/thread/${selected!.threadId}`, {
    waitUntil: 'domcontentloaded',
  });
  const response = await postResponse;
  expect(response.status()).toBe(404);
  expect(injected).toBe(true);
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Posts for this thread were not found.' })
  ).toBeVisible();
  await expect(
    page.getByText('No posts in this thread yet. Be the first to post!')
  ).toHaveCount(0);
  recordEvidence('i03-missing-post-collection', {
    observedAt: new Date().toISOString(),
    origin,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    }).trim(),
    buildRunId,
    provenance,
    selected,
    responseStatus: response.status(),
    controlled404: true,
    bodyText: (await page.locator('body').innerText()).slice(0, 2500),
  });
});

test('RR10 I03 failed thread-list response does not render the empty state', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true',
    'Requires the running OT stack'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Record this state once in system Chrome'
  );
  const buildRunId = process.env['RR10_I03_BUILD_RUN'];
  expect(buildRunId).toBeTruthy();
  const provenance = await buildProvenance();
  const headers = { 'x-ot-appscope': 'client-interface' };
  const topicsResponse = await page.request.get(`${origin}/api/forum/topics`, {
    headers,
  });
  expect(topicsResponse.ok()).toBeTruthy();
  const topics = (await topicsResponse.json()) as Array<{ id: string }>;
  let topicId: string | undefined;
  for (const topic of topics.slice(0, 80)) {
    const response = await page.request.get(
      `${origin}/api/forum/topic/${topic.id}`,
      { headers }
    );
    if (response.ok()) {
      topicId = topic.id;
      break;
    }
  }
  expect(
    topicId,
    'find an existing public topic with read-only GETs'
  ).toBeTruthy();
  const threadListPath = `/api/forum/topic/${topicId}/threads`;
  let injected = false;
  await page.route(`**${threadListPath}`, async (route) => {
    if (!injected) {
      injected = true;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 503,
          message: 'Controlled thread-list outage',
        }),
      });
      return;
    }
    await route.continue();
  });
  const topicResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/forum/topic/${topicId}`
  );
  const threadResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === threadListPath
  );
  await page.goto(`${origin}/forum/topic/${topicId}`, {
    waitUntil: 'domcontentloaded',
  });
  expect((await topicResponse).status()).toBe(200);
  expect((await threadResponse).status()).toBe(503);
  expect(injected).toBe(true);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible();
  await expect(
    page.getByRole('alert').filter({
      hasText: 'Threads for this topic could not be loaded (unavailable).',
    })
  ).toBeVisible();
  await expect(
    page.getByText('No threads in this topic yet. Create the first one!')
  ).toHaveCount(0);
  const retryResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === threadListPath &&
      response.status() === 200
  );
  await page
    .getByRole('button', { name: 'Retry loading threads', exact: true })
    .click();
  const retried = await retryResponse;
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Threads for this topic could not be loaded' })
  ).toHaveCount(0);
  recordEvidence('i03-thread-list-error-retry', {
    observedAt: new Date().toISOString(),
    origin,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    }).trim(),
    buildRunId,
    provenance,
    topicId,
    controlledFailure: 503,
    retriedStatus: retried.status(),
    emptyStateSuppressed: true,
    readOnlyFixtureDiscovery: true,
  });
});

test('RR10 I03 real gateway deadline returns 408 and forum recovers', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_LIVE_STACK'] !== 'true' ||
      process.env['RR10_I03_GATEWAY_TIMEOUT'] !== 'true',
    'Explicitly enabled live test pauses only ot_forum for the configured gateway deadline'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Record this state once in system Chrome'
  );
  const buildRunId = process.env['RR10_I03_BUILD_RUN'];
  expect(buildRunId).toBeTruthy();
  const provenance = await buildProvenance();
  const rawTimeout = execFileSync(
    'docker',
    [
      'inspect',
      '-f',
      '{{range .Config.Env}}{{println .}}{{end}}',
      'ot_gateway',
    ],
    { encoding: 'utf8' }
  )
    .split('\n')
    .find((item) => item.startsWith('GATEWAY_REQUEST_TIMEOUT_MS='))
    ?.split('=')[1];
  const configuredTimeout = Number(rawTimeout);
  const timeoutMs =
    rawTimeout?.trim() && Number.isFinite(configuredTimeout)
      ? configuredTimeout
      : 30_000;
  expect(timeoutMs).toBeGreaterThan(0);
  test.setTimeout(Math.min(timeoutMs + 30_000, 180_000));
  execFileSync('docker', ['pause', 'ot_forum'], { stdio: 'pipe' });
  const watchdogDelaySeconds = String(Math.ceil((timeoutMs + 15_000) / 1_000));
  const watchdog = spawn(
    'sh',
    [
      '-c',
      'sleep "$1"; if [ "$(docker inspect -f \'{{.State.Paused}}\' ot_forum 2>/dev/null)" = true ]; then docker unpause ot_forum >/dev/null 2>&1; fi',
      'rr10-i03-forum-watchdog',
      watchdogDelaySeconds,
    ],
    { detached: true, stdio: 'ignore' }
  );
  watchdog.unref();
  let responseStatus: number | undefined;
  let elapsedMs = 0;
  let gatewayLog = '';
  let responseBody = '';
  try {
    const startedAt = Date.now();
    const response = await page.request.get(`${origin}/api/forum/topics`, {
      headers: { 'x-ot-appscope': 'client-interface' },
      timeout: timeoutMs + 10_000,
    });
    elapsedMs = Date.now() - startedAt;
    responseStatus = response.status();
    responseBody = await response.text();
    expect(responseStatus).toBe(408);
    gatewayLog = execFileSync(
      'docker',
      ['logs', '--since', '2m', 'ot_gateway'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    expect(gatewayLog).toContain('Gateway request timed out');
    expect(gatewayLog).toContain('/api/forum/topics');
  } finally {
    try {
      execFileSync('docker', ['unpause', 'ot_forum'], { stdio: 'pipe' });
    } catch {
      // An independent watchdog may have restored the service already.
    }
    const forumState = JSON.parse(
      execFileSync('docker', ['inspect', '-f', '{{json .State}}', 'ot_forum'], {
        encoding: 'utf8',
      })
    ) as { Status: string; Paused: boolean };
    expect(forumState.Status).toBe('running');
    expect(forumState.Paused).toBe(false);
  }
  const recovered = await page.request.get(`${origin}/api/forum/topics`, {
    headers: { 'x-ot-appscope': 'client-interface' },
  });
  expect(recovered.status()).toBe(200);

  let injected408 = false;
  await page.route('**/api/forum/topics', async (route) => {
    if (!injected408) {
      injected408 = true;
      await route.fulfill({
        status: 408,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 408, error: 'Request Timeout' }),
      });
      return;
    }
    await route.continue();
  });
  const browser408 = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/forum/topics' &&
      response.status() === 408
  );
  await page.goto(`${origin}/forum`, { waitUntil: 'domcontentloaded' });
  expect((await browser408).status()).toBe(408);
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Forum topics are temporarily unavailable.' })
  ).toBeVisible();
  const retryResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/forum/topics' &&
      response.status() === 200
  );
  await page
    .getByRole('button', { name: 'Retry loading topics', exact: true })
    .click();
  const retried = await retryResponse;
  await expect(page.getByRole('alert')).toHaveCount(0);
  recordEvidence('i03-gateway-deadline-recovery', {
    observedAt: new Date().toISOString(),
    origin,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workspaceRoot,
      encoding: 'utf8',
    }).trim(),
    buildRunId,
    provenance,
    controlledUpstream:
      'ot_forum paused during Playwright API-context GET /api/forum/topics, unpaused in finally before direct and browser retries',
    configuredTimeoutMs: timeoutMs,
    elapsedMs,
    responseStatus,
    responseBody,
    recoveredStatus: recovered.status(),
    browserControlled408: injected408,
    browserRetryStatus: retried.status(),
    gatewayTimeoutLog:
      gatewayLog
        .split('\n')
        .filter((line) => line.includes('Gateway request timed out'))
        .slice(-1)[0] ?? null,
  });
});
