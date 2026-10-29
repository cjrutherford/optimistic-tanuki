import { expect, test, type Request } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve, sep } from 'node:path';

const origin = new URL(process.env['TS_BASE_URL'] ?? 'http://127.0.0.1:8087')
  .origin;
const workspaceRoot = process.cwd().endsWith('apps/local-hub-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const distRoot = resolve(workspaceRoot, 'dist/apps/local-hub/browser');
const credentialsPath = process.env['RR10_I03_TS_CREDENTIALS_FILE'];
const evidenceDirectory = resolve(workspaceRoot, '.runtime-artifacts/rr10');
const runId = new Date().toISOString().replaceAll(/[:.]/g, '-');

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function mainAssetPath(indexHtml: string): string {
  const scriptPaths = Array.from(
    indexHtml.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g),
    (match) => new URL(match[1], origin).pathname
  );
  const main = scriptPaths.find((path) =>
    /(?:^|\/)main(?:-[^/]+)?\.js$/.test(path)
  );
  if (!main) throw new Error('The served index has no main JavaScript bundle');
  return main;
}

function requestSummary(request: Request, status: number | null) {
  const url = new URL(request.url());
  return { method: request.method(), path: url.pathname, status };
}

function readOwnerCredentials(path: string): {
  email: string;
  password: string;
} {
  const contents = readFileSync(path, 'utf8');
  try {
    const parsed = JSON.parse(contents) as {
      email?: string;
      password?: string;
    };
    if (parsed.email && parsed.password) {
      return { email: parsed.email, password: parsed.password };
    }
  } catch {
    // The protected seed artifact is a shell-style environment file.
  }
  const values = new Map<string, string>();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(
      /^\s*(DEV_OWNER_EMAIL|DEV_OWNER_PASSWORD)=(.*)\s*$/
    );
    if (match) values.set(match[1], match[2].replace(/^['"]|['"]$/g, ''));
  }
  const email = values.get('DEV_OWNER_EMAIL');
  const password = values.get('DEV_OWNER_PASSWORD');
  if (!email || !password) {
    throw new Error(
      'Credential file must contain owner email and password fields'
    );
  }
  return { email, password };
}

test('RR10 I03 authenticated Towne Square account and community hydrate from current bundles', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR10_I03_TS_AUTH_HYDRATION'] !== 'true',
    'Requires the isolated current-source Towne Square stack and existing owner credentials'
  );
  test.skip(
    testInfo.project.name !== 'chromium',
    'Authenticated hydration provenance is recorded once in system Chrome'
  );
  test.setTimeout(90_000);
  expect(new URL(origin).port).toBe('8087');
  expect(
    credentialsPath,
    'provide the private existing-owner credential file'
  ).toBeTruthy();

  const credentials = readOwnerCredentials(credentialsPath as string);
  const fixturePath = resolve(
    workspaceRoot,
    process.env['RR10_I03_TS_FIXTURE_FILE'] ??
      '.runtime-artifacts/rr10/i03-ts-owner-community-fixture.json'
  );
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    community: { id: string; name: string; slug: string };
    conversationId: string;
  };
  expect(fixture.conversationId).toBeTruthy();
  const buildRunId = process.env['RR10_I03_TS_BUILD_RUN'];
  const buildCommand = process.env['RR10_I03_TS_BUILD_COMMAND'];
  expect(buildCommand, 'record the current-source build command').toBeTruthy();
  for (const name of [
    'RR10_I03_TS_CONTAINER_ID',
    'RR10_I03_TS_IMAGE_ID',
    'RR10_I03_TS_CONTAINER_STARTED',
  ]) {
    expect(
      process.env[name],
      `record ${name} for served-source qualification`
    ).toBeTruthy();
  }

  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  chmodSync(evidenceDirectory, 0o700);
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
  }).trim();
  const sourceFiles = [
    'apps/local-hub/src/app/app.routes.ts',
    'apps/local-hub/src/app/app.routes.server.ts',
    'apps/local-hub/src/app/app.config.ts',
    'apps/local-hub/src/app/services/auth-state.service.ts',
    'apps/local-hub/src/app/pages/account/account.component.ts',
    'apps/local-hub/src/app/pages/community/community.component.ts',
    'libs/chat-ui/src/lib/socket-chat.service.ts',
    'libs/community-ui/src/lib/community-ui/community-chat/community-chat.component.ts',
    'libs/community-ui/src/lib/community-ui/community-chat/community-chat.behaviour.spec.ts',
    'apps/local-hub-e2e/src/rr10-i03-authenticated-hydration.spec.ts',
  ];
  const relevantSourceSha256 = Object.fromEntries(
    sourceFiles.map((path) => [
      path,
      sha256(readFileSync(resolve(workspaceRoot, path))),
    ])
  );

  const requests = new Map<Request, ReturnType<typeof requestSummary>>();
  const pageErrors: string[] = [];
  page.on('request', (request) =>
    requests.set(request, requestSummary(request, null))
  );
  page.on('response', (response) => {
    const record = requests.get(response.request());
    if (record) record.status = response.status();
  });
  page.on('requestfailed', (request) => {
    const record = requests.get(request);
    if (record) record.status = 0;
  });
  page.on('pageerror', (error) => pageErrors.push(error.name));

  const indexResponse = await page.request.get(`${origin}/`);
  expect(indexResponse.status()).toBe(200);
  const servedIndex = await indexResponse.text();
  const bundlePath = mainAssetPath(servedIndex);
  const bundleFile = resolve(distRoot, `.${bundlePath}`);
  expect(bundleFile.startsWith(`${distRoot}${sep}`)).toBe(true);
  const servedMain = await page.request.get(new URL(bundlePath, origin).href);
  expect(servedMain.status()).toBe(200);
  const servedMainSha256 = sha256(await servedMain.body());
  const localMainSha256 = sha256(readFileSync(bundleFile));
  expect(servedMainSha256).toBe(localMainSha256);

  await page.goto(`${origin}/account`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/, { timeout: 20_000 });
  await expect(
    page.getByRole('heading', { name: 'My Account', exact: true })
  ).toBeVisible();
  await expect(page.locator('.profile-name')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'My Communities' })
  ).toBeVisible();
  await expect(page.locator('.loading-state')).toHaveCount(0, {
    timeout: 20_000,
  });
  const memberships = page.locator('.community-item');
  await expect(memberships.first()).toBeVisible({ timeout: 20_000 });
  const membershipCount = await memberships.count();
  expect(membershipCount).toBeGreaterThan(0);
  const targetMembership = page
    .locator('.community-item')
    .filter({ hasText: fixture.community.name });
  await expect(targetMembership).toHaveCount(1);
  const communityName = (
    await targetMembership.locator('.community-name').innerText()
  ).trim();
  expect(communityName).toBe(fixture.community.name);
  const sessionCookie = (await page.context().cookies(origin)).find(
    (cookie) => cookie.name === 'ot_session' && cookie.path === '/'
  );
  expect(sessionCookie).toMatchObject({ httpOnly: true, path: '/' });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page.getByRole('heading', { name: 'My Account', exact: true })
  ).toBeVisible();
  await expect(page.locator('.profile-name')).toBeVisible();
  await expect(memberships.first()).toBeVisible({ timeout: 20_000 });
  const communityResponsePromise = page
    .waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        /^\/api\/(?:communities(?:\/.*)?|social\/community\/slug\/[^/]+)$/.test(
          new URL(response.url()).pathname
        ),
      { timeout: 20_000 }
    )
    .catch(() => null);
  await targetMembership.locator('[role="button"]').click();
  await expect(page).toHaveURL(/\/c\/[^/]+$/);
  const communityResponse = await communityResponsePromise;
  expect(communityResponse?.status()).toBe(200);
  await expect(page.locator('h1.community-name')).toHaveText(communityName, {
    timeout: 20_000,
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/c\/[^/]+$/);
  await expect(page.locator('h1.community-name')).toHaveText(communityName, {
    timeout: 20_000,
  });
  const scopedHeaders = {
    'x-ot-app-id': 'local-hub',
    'x-ot-appscope': 'local-hub',
  };
  const communityRoomUrl = `${origin}/api/social/community/${fixture.community.id}/chat-room`;
  const messagesUrl = `${origin}/api/chat/messages/${fixture.conversationId}`;
  const roomBefore = await page.context().request.get(communityRoomUrl, {
    headers: scopedHeaders,
  });
  expect(roomBefore.status()).toBe(200);
  expect(await roomBefore.json()).toMatchObject({
    id: fixture.conversationId,
  });
  const messagesBeforeResponse = await page.context().request.get(messagesUrl, {
    headers: scopedHeaders,
  });
  expect(messagesBeforeResponse.status()).toBe(200);
  const messagesBefore = await messagesBeforeResponse.json();
  expect(messagesBefore).toEqual([]);
  const chatTab = page.getByRole('button', { name: 'Chat', exact: true });
  await expect(chatTab).toBeEnabled();
  const chatRoomEnsurePromise = page
    .waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname ===
          `/api/social/community/${fixture.community.id}/chat-room`,
      { timeout: 20_000 }
    )
    .catch(() => null);
  await chatTab.click();
  const chatRoomEnsure = await chatRoomEnsurePromise;
  expect(chatRoomEnsure?.status()).toBe(201);
  expect(await chatRoomEnsure?.json()).toMatchObject({
    id: fixture.conversationId,
  });
  const roomAfter = await page.context().request.get(communityRoomUrl, {
    headers: scopedHeaders,
  });
  expect(roomAfter.status()).toBe(200);
  expect(await roomAfter.json()).toMatchObject({
    id: fixture.conversationId,
  });
  const messagesAfterResponse = await page.context().request.get(messagesUrl, {
    headers: scopedHeaders,
  });
  expect(messagesAfterResponse.status()).toBe(200);
  expect(await messagesAfterResponse.json()).toEqual(messagesBefore);
  await expect(page.locator('lib-community-chat .loading')).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(
    page.locator('lib-community-chat lib-chat-ui, lib-community-chat .no-chat')
  ).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('lib-community-chat .error')).toHaveCount(0);

  const requestRecords = [...requests.values()];
  const disallowedMutations = requestRecords.filter((request) => {
    if (request.method === 'GET' || request.method === 'HEAD') return false;
    if (
      request.method === 'POST' &&
      request.path === '/api/authentication/login'
    ) {
      return false;
    }
    // This endpoint uses POST as a read-only search query; see CommunityService.findPosts.
    if (request.method === 'POST' && request.path === '/api/social/post/find') {
      return false;
    }
    // The app emits non-content telemetry and opens its Socket.IO transport.
    if (
      request.method === 'POST' &&
      request.path === '/api/performance/rum' &&
      request.status === 201
    ) {
      return false;
    }
    if (
      request.method === 'POST' &&
      request.path === '/socket.io/' &&
      request.status === 200
    ) {
      return false;
    }
    // Chat tab hydration calls this idempotent ensure route. The response
    // above must match the fixture's already-existing conversation ID.
    if (
      request.method === 'POST' &&
      request.path ===
        `/api/social/community/${fixture.community.id}/chat-room` &&
      request.status === 201
    ) {
      return false;
    }
    return true;
  });
  expect(disallowedMutations).toEqual([]);
  expect(pageErrors).toEqual([]);

  const evidencePath = resolve(
    evidenceDirectory,
    `i03-ts-authenticated-hydration-${runId}.json`
  );
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        origin,
        sourceCommit,
        buildRunId,
        buildCommand,
        buildRunIdUnavailable: !buildRunId,
        runtimeContainerId: process.env['RR10_I03_TS_CONTAINER_ID'],
        runtimeImageId: process.env['RR10_I03_TS_IMAGE_ID'],
        runtimeStartedAt: process.env['RR10_I03_TS_CONTAINER_STARTED'],
        servedIndexStatus: indexResponse.status(),
        servedMainPath: basename(bundlePath),
        servedMainSha256,
        localMainSha256,
        relevantSourceSha256,
        accountHydrated: true,
        profileHydrated: true,
        membershipCount,
        communityHydratedAfterDirectReload: true,
        authenticatedChatHydrated: true,
        communityRouteStatus: communityResponse?.status() ?? null,
        chatRoomEnsureStatus: chatRoomEnsure?.status() ?? null,
        chatRoomIdentityStable: true,
        chatMessagesUnchanged: true,
        requests: requestRecords,
        disallowedMutations,
        pageErrorCount: pageErrors.length,
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
});
