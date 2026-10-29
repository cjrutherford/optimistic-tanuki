import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const enabled = process.env['RR09_I09_UI_LIVE_STACK'] === 'true';
const otOrigin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const tsOrigin = process.env['TS_BASE_URL'] ?? 'http://127.0.0.1:8087';
const credentialsPath =
  process.env['RR09_I04_NONOWNER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i04-nonowner-credentials.json';
const tsCredentialsPath =
  process.env['RR09_I09_TS_CREDENTIALS_FILE'] ?? credentialsPath;
const expectedTsProfileId = process.env['RR09_I09_TS_PROFILE_ID'];
const communityPostId = process.env['RR09_I09_POST_ID'];
const communityPostAuthorProfileId =
  process.env['RR09_I09_POST_AUTHOR_PROFILE_ID'];
const communityPostTitle =
  process.env['RR09_I09_POST_TITLE'] ?? 'RR09 I09 community report fixture';
const community = {
  id: '3bd16edb-3a0e-40c1-b382-f014d0f0bbd6',
  slug: 'permission-community-1791286545022',
};

type Credentials = { email: string; password: string };
type Session = { profileId: string; userId: string };

function credentials(path: string): Credentials {
  const value = JSON.parse(readFileSync(path, 'utf8')) as Credentials;
  if (typeof value.email !== 'string' || typeof value.password !== 'string') {
    throw new Error('Invalid configured synthetic I09 test credentials');
  }
  return value;
}

async function login(
  page: Page,
  origin: string,
  value: Credentials,
  appScope: 'client-interface' | 'local-hub'
): Promise<Session> {
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(value.email);
  await page.getByLabel('Password', { exact: true }).fill(value.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  expect(new URL(page.url()).origin).toBe(new URL(origin).origin);
  const response = await page.request.get(
    `${origin}/api/authentication/session`,
    {
      headers: {
        'x-ot-app-id': appScope,
        'x-ot-appscope': appScope,
      },
    }
  );
  expect(response.status(), 'session read').toBe(200);
  const valueFromSession = (await response.json()).data as Session;
  expect(valueFromSession.profileId).toBeTruthy();
  return valueFromSession;
}

function fixturePost(profileId: string) {
  return {
    id: 'rr09-i09-mocked-report-post',
    title: 'I09 controlled report UI fixture',
    content: 'This route-intercepted post is never persisted.',
    userId: 'rr09-i09-fixture-author-user',
    profileId,
    visibility: 'public',
    communityId: community.id,
    createdAt: '2026-10-11T12:00:00.000Z',
  };
}

async function assertFocusTrap(
  page: Page,
  dialog: ReturnType<Page['getByRole']>
) {
  const focusable = dialog.locator(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const count = await focusable.count();
  expect(count).toBeGreaterThan(2);

  await focusable.last().focus();
  await page.keyboard.press('Tab');
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement))
  ).toBe(true);

  await focusable.first().focus();
  await page.keyboard.press('Shift+Tab');
  expect(
    await dialog.evaluate((node) => node.contains(document.activeElement))
  ).toBe(true);
}

async function assertKeyboardVisibleFocus(
  page: Page,
  dialog: ReturnType<Page['getByRole']>
) {
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    const visible = await dialog.evaluate((node) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || !node.contains(active))
        return false;
      const target = active.closest('.radio-option') ?? active;
      const style = getComputedStyle(target);
      return (
        style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2
      );
    });
    if (visible) return;
  }
  throw new Error('Keyboard focus did not show the dialog focus indicator');
}

async function tabTo(page: Page, target: ReturnType<Page['locator']>) {
  // Start from the document, then reach the control through ordinary browser Tab order.
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  for (let index = 0; index < 140; index += 1) {
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error('Target control was not reachable through natural Tab order');
}

async function exerciseReportDialog(
  page: Page,
  post: ReturnType<Page['locator']>,
  appScope: 'client-interface' | 'local-hub',
  sessionProfileId: string,
  expectedContentId?: string
) {
  let capturedPayload: unknown;
  let capturedHeaders: Record<string, string> | undefined;
  let requestCount = 0;
  let resolveHeadersReady!: () => void;
  const firstHeadersReady = new Promise<void>((resolve) => {
    resolveHeadersReady = resolve;
  });
  let releaseResponse!: (status: number) => void;
  let pendingResponse = new Promise<number>((resolve) => {
    releaseResponse = resolve;
  });
  await page.route('**/api/privacy/report', async (route) => {
    requestCount += 1;
    capturedPayload = route.request().postDataJSON();
    capturedHeaders = await route.request().allHeaders();
    if (requestCount === 1) resolveHeadersReady();
    const status = await pendingResponse;
    await route.fulfill({
      status,
      contentType: 'application/json',
      body:
        status === 201
          ? JSON.stringify({ id: 'rr09-i09-mocked-report' })
          : JSON.stringify({ message: 'controlled report failure' }),
    });
  });

  const trigger = post.getByRole('button', { name: '...', exact: true });
  await tabTo(page, trigger);
  await page.keyboard.press('Enter');
  const reportAction = post.getByRole('button', {
    name: 'Report post',
    exact: true,
  });
  await expect(reportAction).toBeVisible();
  // Move through the dropdown with ordinary Tab presses; do not focus the item directly.
  for (let index = 0; index < 12; index += 1) {
    if (await reportAction.evaluate((item) => item === document.activeElement))
      break;
    await page.keyboard.press('Tab');
  }
  await expect(reportAction).toBeFocused();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Report Post', exact: true });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Close report' })
  ).toBeVisible();
  await expect(dialog).toHaveAttribute(
    'aria-describedby',
    'report-dialog-instructions'
  );
  await expect(page.locator('#report-dialog-instructions')).toHaveCount(1);
  await expect(
    dialog.getByText('Why are you reporting this post?')
  ).toBeVisible();
  await expect(dialog.locator('input[name="report-reason"]')).toHaveCount(7);
  await assertFocusTrap(page, dialog);
  await assertKeyboardVisibleFocus(page, dialog);

  const submit = dialog.getByRole('button', {
    name: 'Submit Report',
    exact: true,
  });
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText(
    'Choose a reason before submitting.'
  );
  expect(requestCount, 'empty reason cannot reach the report gateway').toBe(0);

  await dialog.getByLabel('Spam', { exact: true }).check();
  const description = dialog.locator('textarea');
  await description.fill('Controlled UI retry context.');
  await submit.click();
  await expect(dialog.getByRole('status')).toContainText('Submitting report');
  await expect.poll(() => requestCount).toBe(1);
  await firstHeadersReady;
  await expect(
    dialog.locator('input[name="report-reason"]:disabled')
  ).toHaveCount(7);
  await expect(submit).toBeDisabled();
  expect(capturedHeaders?.['x-ot-appscope']).toBe(appScope);
  expect(capturedHeaders?.['x-ot-session-mode']).toBe('cookie');
  expect(sessionProfileId).toBeTruthy();
  expect(capturedPayload).toMatchObject({
    contentType: 'post',
    reason: 'spam',
    description: 'Controlled UI retry context.',
  });
  const submittedContentId = (
    capturedPayload as { contentId?: string } | undefined
  )?.contentId;
  expect(submittedContentId).toBeTruthy();
  if (expectedContentId) expect(submittedContentId).toBe(expectedContentId);
  expect(capturedPayload).not.toHaveProperty('profileId');
  expect(capturedPayload).not.toHaveProperty('appScope');

  releaseResponse(500);
  await expect(dialog.getByRole('status')).toContainText(
    'Failed to submit report'
  );
  await expect(dialog.getByLabel('Spam', { exact: true })).toBeChecked();
  await expect(description).toHaveValue('Controlled UI retry context.');
  await expect(submit).toBeEnabled();

  pendingResponse = new Promise<number>((resolve) => {
    releaseResponse = resolve;
  });
  await submit.click();
  await expect(dialog.getByRole('status')).toContainText('Submitting report');
  await expect.poll(() => requestCount).toBe(2);
  releaseResponse(201);
  await expect(dialog.getByRole('status')).toContainText('Report submitted');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await post.getByRole('button', { name: 'Report post', exact: true }).click();
  const closeDialog = page.getByRole('dialog', {
    name: 'Report Post',
    exact: true,
  });
  await closeDialog.getByRole('button', { name: 'Close report' }).click();
  await expect(closeDialog).toBeHidden();
  await expect(trigger).toBeFocused();

  expect(requestCount, 'all report calls were intercepted in the browser').toBe(
    2
  );
}

test.skip(
  !enabled,
  'Requires existing local apps and retained synthetic RR09 profiles; report POST is route-intercepted'
);
test.describe.configure({ retries: 0 });

test('RR09 I09 OT feed report dialog keyboard, validation, and mock request states', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'One desktop system Chrome run'
  );
  test.setTimeout(90_000);
  const actor = await login(
    page,
    otOrigin,
    credentials(credentialsPath),
    'client-interface'
  );
  await page.goto(`${otOrigin}/feed`, { waitUntil: 'domcontentloaded' });
  const cards = page.locator('.post-container');
  await expect(cards.first()).toBeVisible({ timeout: 20_000 });
  let reportablePost: ReturnType<Page['locator']> | undefined;
  for (let index = 0; index < (await cards.count()); index += 1) {
    const card = cards.nth(index);
    const trigger = card.getByRole('button', { name: '...', exact: true });
    if (!(await trigger.isVisible().catch(() => false))) continue;
    await trigger.click();
    const reportAction = card.getByRole('button', {
      name: 'Report post',
      exact: true,
    });
    if (await reportAction.isVisible().catch(() => false)) {
      reportablePost = card;
      await trigger.click();
      break;
    }
    await trigger.click();
  }
  test.skip(
    !reportablePost,
    'No read-only non-owner feed post currently exposes Report post'
  );
  expect(actor.profileId).toBeTruthy();
  await exerciseReportDialog(
    page,
    reportablePost!,
    'client-interface',
    actor.profileId
  );
});

test('RR09 I09 community post dialog validates and restores keyboard focus with report writes intercepted', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'One desktop system Chrome run'
  );
  test.skip(
    !communityPostId || !communityPostAuthorProfileId,
    'Requires a verifier-provisioned read-only synthetic post and author profile ID'
  );
  test.setTimeout(90_000);
  const actor = await login(
    page,
    otOrigin,
    credentials(credentialsPath),
    'client-interface'
  );
  expect(actor.profileId).not.toBe(communityPostAuthorProfileId);
  await page.goto(`${otOrigin}/communities/${community.slug}/posts`, {
    waitUntil: 'domcontentloaded',
  });
  const postCard = page
    .locator('.post-container')
    .filter({ hasText: communityPostTitle });
  await expect(postCard).toBeVisible({ timeout: 20_000 });
  await exerciseReportDialog(
    page,
    postCard,
    'client-interface',
    actor.profileId,
    communityPostId
  );
});

test('RR09 I09 Local Hub city discussion uses the shared report dialog without a report write', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'One desktop system Chrome run'
  );
  test.skip(
    !expectedTsProfileId,
    'Requires a preflight-confirmed existing local-hub profile id'
  );
  test.setTimeout(90_000);
  const actor = await login(
    page,
    tsOrigin,
    credentials(tsCredentialsPath),
    'local-hub'
  );
  expect(
    actor.profileId,
    'must not create or switch to a new Local Hub actor'
  ).toBe(expectedTsProfileId);

  const root = {
    id: 'rr09-i09-ui-city-root',
    name: 'Savannah',
    slug: 'savannah-ga',
    localityType: 'city',
    city: 'Savannah',
    adminArea: 'GA',
    countryCode: 'US',
    description: 'Controlled no-write UI fixture',
    memberCount: 0,
    createdAt: '2026-10-11T12:00:00.000Z',
    coordinates: { lat: 32.08, lng: -81.09 },
  };
  const post = fixturePost('rr09-i09-ts-non-owner-profile');
  await page.route('**/api/social/community/slug/savannah-ga', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', json: root })
  );
  await page.route(
    '**/api/social/community/rr09-i09-ui-city-root/sub-communities',
    (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', json: [] })
  );
  await page.route('**/api/communities', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      json: [root],
    })
  );
  await page.route('**/api/social/post/find', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      json: [post],
    })
  );
  await page.goto(`${tsOrigin}/city/savannah-ga`, {
    waitUntil: 'domcontentloaded',
  });
  const postCard = page
    .locator('.post-container')
    .filter({ hasText: post.title });
  await expect(postCard).toBeVisible({ timeout: 20_000 });
  await exerciseReportDialog(
    page,
    postCard,
    'local-hub',
    actor.profileId,
    post.id
  );
  expect(actor.profileId).not.toBe(post.profileId);
});
