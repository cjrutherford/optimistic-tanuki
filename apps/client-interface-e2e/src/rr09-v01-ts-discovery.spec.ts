import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const origin = new URL(process.env['TS_BASE_URL'] ?? 'http://127.0.0.1:8087')
  .origin;
const evidenceDirectory = join(
  process.cwd().endsWith('apps/client-interface-e2e')
    ? resolve(process.cwd(), '../..')
    : process.cwd(),
  '.runtime-artifacts',
  'rr09',
  'v01'
);
const evidencePath = join(evidenceDirectory, 'ts-discovery.jsonl');
const credentialsPath =
  process.env['RR09_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const scopeHeaders = {
  'X-ot-appscope': 'local-hub',
  'X-ot-app-id': 'local-hub',
};
const community = {
  id: '3bd16edb-3a0e-40c1-b382-f014d0f0bbd6',
  slug: 'permission-community-1791286545022',
};

function record(value: Record<string, unknown>): void {
  mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
  appendFileSync(
    evidencePath,
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
}

async function timedStage<T>(
  timings: Array<Record<string, unknown>>,
  stage: string,
  action: () => Promise<T>
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await action();
    timings.push({
      stage,
      durationMs: Math.round(performance.now() - startedAt),
      outcome: 'pass',
    });
    return result;
  } catch (error) {
    timings.push({
      stage,
      durationMs: Math.round(performance.now() - startedAt),
      outcome: 'fail',
    });
    throw error;
  }
}

async function settleTheme(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const read = () => {
      const body = getComputedStyle(document.body);
      return `${document.documentElement.getAttribute('data-theme')}|${
        body.color
      }|${body.backgroundColor}`;
    };
    let previous = read();
    let stable = 0;
    const deadline = Date.now() + 5_000;
    while (stable < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = read();
      stable = current === previous ? stable + 1 : 0;
      previous = current;
      if (Date.now() > deadline) throw new Error('Theme did not settle');
    }
  });
}

async function operateTheme(
  page: Page,
  theme: 'light' | 'dark'
): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('dialog', { name: 'Appearance controls' });
  const checkbox = menu.locator('input[type="checkbox"]');
  if ((await checkbox.isChecked()) !== (theme === 'dark')) {
    await checkbox.focus();
    await page.keyboard.press('Space');
  }
  await expect(checkbox).toHaveJSProperty('checked', theme === 'dark');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await settleTheme(page);
}

async function motionSnapshot(page: Page) {
  return page.evaluate(() => ({
    reducedPreference: matchMedia('(prefers-reduced-motion: reduce)').matches,
    animations: document.getAnimations().length,
    overOneSecond: document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return typeof timing?.duration === 'number' && timing.duration > 1000;
    }).length,
  }));
}

test('RR09 V01 TS locality membership, listing and contact route discovery', async ({
  page,
}, testInfo) => {
  test.skip(
    process.env['RR09_V01_LIVE_STACK'] !== 'true',
    'Requires existing stack and retained RR09 owner account'
  );
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'The route probe sets its own viewport and uses system Chrome'
  );
  test.setTimeout(90_000);
  expect(
    new URL(origin).port,
    'TS discovery must target the Local Hub frontend port'
  ).toBe('8087');
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  const timings: Array<Record<string, unknown>> = [];
  const servedMainAssets: Array<{
    path: string;
    status: number;
    sha256: string;
  }> = [];
  const servedMainAssetReads: Promise<void>[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (
      response.request().resourceType() !== 'script' ||
      !/(^|\/)main(?:-[^/]*)?\.js$/.test(url.pathname)
    )
      return;
    servedMainAssetReads.push(
      response
        .body()
        .then((body) => {
          servedMainAssets.push({
            path: url.pathname,
            status: response.status(),
            sha256: createHash('sha256').update(body).digest('hex'),
          });
        })
        .catch(() => undefined)
    );
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await timedStage(timings, 'signed-in login and session hydration', async () => {
    await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  });
  expect(new URL(page.url()).origin, 'browser uses explicit TS origin').toBe(
    origin
  );

  const sessionResponse = await timedStage(
    timings,
    'authenticated session REST read',
    () =>
      page.request.get(`${origin}/api/authentication/session`, {
        headers: scopeHeaders,
      })
  );
  expect(sessionResponse.status()).toBe(200);
  const session = (await sessionResponse.json()).data as {
    userId: string;
    profileId: string;
  };

  const communityResponse = await timedStage(
    timings,
    'target community REST read',
    () =>
      page.request.get(
        `${origin}/api/social/community/slug/${community.slug}`,
        { headers: scopeHeaders }
      )
  );
  expect(communityResponse.status()).toBe(200);
  const communityBody = (await communityResponse.json()) as {
    id: string;
    slug: string;
  };
  expect(communityBody.id).toBe(community.id);
  const communitiesResponse = await page.request.get(
    `${origin}/api/communities`,
    {
      headers: scopeHeaders,
    }
  );
  expect(communitiesResponse.status()).toBe(200);
  const communitiesBody = await communitiesResponse.json();
  const knownCommunities = Array.isArray(communitiesBody)
    ? communitiesBody
    : communitiesBody?.data ?? [];
  const socialCommunitiesResponse = await page.request.get(
    `${origin}/api/social/community`,
    { headers: scopeHeaders }
  );
  const socialCommunitiesBody = socialCommunitiesResponse.ok()
    ? await socialCommunitiesResponse.json()
    : [];
  const socialCommunities = Array.isArray(socialCommunitiesBody)
    ? socialCommunitiesBody
    : socialCommunitiesBody?.data ?? [];
  const topActiveResponse = await page.request.get(
    `${origin}/api/social/community/top-active?limit=100&appScope=local-hub`,
    { headers: scopeHeaders }
  );
  const topActiveBody = topActiveResponse.ok()
    ? await topActiveResponse.json()
    : [];
  const topActiveCommunities = Array.isArray(topActiveBody)
    ? topActiveBody
    : topActiveBody?.data ?? [];
  const communityCatalog = [
    ...new Map(
      [...knownCommunities, ...socialCommunities, ...topActiveCommunities]
        .filter((row: { id?: string }) => row?.id)
        .map((row: { id: string; slug: string }) => [row.id, row])
    ).values(),
  ] as Array<{ id: string; slug: string }>;
  const membershipResponse = await page.request.get(
    `${origin}/api/social/community/${community.id}/membership`,
    { headers: scopeHeaders }
  );
  expect(membershipResponse.status()).toBe(200);
  const membership = await membershipResponse.json();
  const listingInventory: Array<{
    communityId: string;
    communitySlug: string;
    listingIds: string[];
    ownerProfileIds: string[];
  }> = [];
  for (const known of communityCatalog) {
    if (!known.id || !known.slug) continue;
    const response = await page.request.get(
      `${origin}/api/classifieds/community/${known.id}`,
      { headers: scopeHeaders }
    );
    if (!response.ok()) continue;
    const body = await response.json();
    const rows = Array.isArray(body) ? body : body?.data ?? [];
    if (rows.length) {
      listingInventory.push({
        communityId: known.id,
        communitySlug: known.slug,
        listingIds: rows.map((row: { id?: string }) => row.id).filter(Boolean),
        ownerProfileIds: [
          ...new Set(
            rows
              .map(
                (row: { profileId?: string; ownerProfileId?: string }) =>
                  row.profileId ?? row.ownerProfileId
              )
              .filter(Boolean)
          ),
        ] as string[],
      });
    }
  }
  const globalSearchResponse = await page.request.post(
    `${origin}/api/classifieds/search`,
    { headers: scopeHeaders, data: { page: 1, limit: 100 } }
  );
  const globalSearchBody = globalSearchResponse.ok()
    ? await globalSearchResponse.json()
    : [];
  const globalListings = Array.isArray(globalSearchBody)
    ? globalSearchBody
    : globalSearchBody?.data ?? [];
  const conversationsResponse = await page.request.get(
    `${origin}/api/chat/conversations/find`,
    { headers: scopeHeaders }
  );
  expect(conversationsResponse.status()).toBe(200);
  const conversationsBody = await conversationsResponse.json();
  const conversations = Array.isArray(conversationsBody)
    ? conversationsBody
    : conversationsBody?.data ?? [];
  const hasExistingCommunityChat = conversations.some(
    (conversation: { communityId?: string }) =>
      conversation.communityId === community.id
  );
  const directConversationIds = conversations
    .filter(
      (conversation: { type?: string; participants?: string[] }) =>
        conversation.type === 'direct' &&
        conversation.participants?.length === 2 &&
        conversation.participants.includes(session.profileId) &&
        conversation.participants.some((participant) =>
          listingInventory.some((entry) =>
            entry.ownerProfileIds.includes(participant)
          )
        )
    )
    .map((conversation: { id: string }) => conversation.id);
  const directMessageCounts: Record<string, number> = {};
  for (const conversationId of directConversationIds) {
    const response = await page.request.get(
      `${origin}/api/chat/messages/${conversationId}`,
      { headers: scopeHeaders }
    );
    if (!response.ok()) continue;
    const body = await response.json();
    const rows = Array.isArray(body) ? body : body?.data ?? [];
    directMessageCounts[conversationId] = rows.length;
  }

  const originalTheme = await page.locator('html').getAttribute('data-theme');
  expect(['light', 'dark']).toContain(originalTheme);
  await timedStage(timings, 'communities route and first render', async () => {
    await page.goto(`${origin}/communities`, { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: 'Local Communities', exact: true })
    ).toBeVisible();
  });
  expect(
    new URL(page.url()).origin,
    'communities page stays on TS origin'
  ).toBe(origin);
  const discover = await page.evaluate(() => ({
    mainHeadings: Array.from(document.querySelectorAll('main h1')).map(
      (heading) => heading.innerText.trim()
    ),
    searchLabel:
      document
        .querySelector<HTMLInputElement>('.search-input')
        ?.getAttribute('aria-label') ?? null,
    visibleJoinButtons: Array.from(document.querySelectorAll('button')).filter(
      (button) => /join/i.test(button.innerText)
    ).length,
    cardCount: document.querySelectorAll('.community-card').length,
    communityEntryHeadingCount: document.querySelectorAll('main h3').length,
  }));
  await timedStage(timings, 'signed-in community deep-link hydration', async () => {
    await page.goto(`${origin}/c/${community.slug}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('.community-page')).toBeVisible();
  });
  expect(new URL(page.url()).origin, 'community route stays on TS origin').toBe(
    origin
  );
  await expect(page.locator('.community-page')).toBeVisible();
  const joinButton = page.getByRole('button', {
    name: 'Join Community',
    exact: true,
  });
  const canJoin = await joinButton.isVisible().catch(() => false);
  const leaveButtonVisible = await page
    .getByRole('button', { name: 'Leave Community', exact: true })
    .isVisible()
    .catch(() => false);
  const listingContactButtons = page.getByRole('button', {
    name: 'Contact Seller',
    exact: true,
  });
  const contactButtonCount = await listingContactButtons.count();

  const themeEvidence: Array<Record<string, unknown>> = [];
  const initialTheme = originalTheme as 'light' | 'dark';
  try {
    for (const theme of ['light', 'dark'] as const) {
      await operateTheme(page, theme);
      await expect(page.locator('.community-page')).toBeVisible();
      themeEvidence.push({
        theme,
        communityHeadingVisible: await page
          .locator('.community-name')
          .isVisible(),
        foreground: await page.evaluate(
          () => getComputedStyle(document.body).color
        ),
        background: await page.evaluate(
          () => getComputedStyle(document.body).backgroundColor
        ),
      });
    }
    const normalMotion = await motionSnapshot(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.community-page')).toBeVisible();
    const reducedMotion = await motionSnapshot(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    record({
      type: 'authenticated-community-motion',
      route: `/c/${community.slug}`,
      normalMotion,
      reducedMotion,
    });
  } finally {
    await page
      .emulateMedia({ reducedMotion: 'no-preference' })
      .catch(() => undefined);
    await operateTheme(page, initialTheme).catch((error) =>
      record({
        type: 'theme-restore-failure',
        message: error instanceof Error ? error.message : String(error),
      })
    );
  }

  record({
    type: 'ts-locality-community-discovery',
    timings,
    browserOrigin: new URL(page.url()).origin,
    requestedTsOrigin: origin,
    route: '/communities',
    view: discover,
    communityId: community.id,
    communitySlug: community.slug,
    sessionScope: 'local-hub',
    selectedProfilePresent: Boolean(session.profileId),
    initialMembership: membership,
    hasExistingCommunityChat,
    membershipAction: canJoin
      ? hasExistingCommunityChat
        ? 'available; join not performed in read-only discovery'
        : 'not-run: join action would create a new community chat room'
      : leaveButtonVisible
      ? 'already-member; preserved baseline state'
      : 'join control unavailable',
    localityInventory: {
      communitiesRouteCount: knownCommunities.length,
      socialCommunityCount: socialCommunities.length,
      topActiveCount: topActiveCommunities.length,
      catalogCount: communityCatalog.length,
      routes: {
        communitiesStatus: communitiesResponse.status(),
        socialCommunityStatus: socialCommunitiesResponse.status(),
        topActiveStatus: topActiveResponse.status(),
      },
    },
    listingInventory,
    globalClassifiedSearch: {
      status: globalSearchResponse.status(),
      count: globalListings.length,
      listingIds: globalListings
        .map((row: { id?: string }) => row.id)
        .filter(Boolean),
    },
    directConversationCounts: directMessageCounts,
    contactSellerButtons: contactButtonCount,
    contactSeller:
      listingInventory.length || globalListings.length
        ? 'candidate listings exist; contact action not invoked pending controlled owner/conversation match'
        : 'NOT RUN: no classifieds found in the returned community catalog or global classifieds search; no listing or message fixture created',
    themes: themeEvidence,
    cleanup: 'read-only; no membership/community/listing/conversation writes',
  });

  await timedStage(timings, 'messages route hydration', () =>
    page.goto(`${origin}/messages`, { waitUntil: 'domcontentloaded' })
  );
  const messagesView = await page.evaluate(() => ({
    route: location.pathname,
    headingCount: document.querySelectorAll('h1,h2').length,
    chatUiPresent: Boolean(document.querySelector('lib-chat-ui')),
    errorAlertCount: document.querySelectorAll('[role="alert"]').length,
  }));
  record({ type: 'ts-messages-route', ...messagesView });

  const existingListingIds = [
    '9505c11f-7e79-4f38-8999-e9ccd6c71c0e',
    'c603e283-8f26-4e50-8b5e-06ea405cbc6e',
  ];
  const detailStates: Array<Record<string, unknown>> = [];
  for (const listingId of existingListingIds) {
    const listingResponse = await page.request.get(
      `${origin}/api/classifieds/${listingId}`,
      { headers: scopeHeaders }
    );
    if (!listingResponse.ok()) {
      detailStates.push({ listingId, listingStatus: listingResponse.status() });
      continue;
    }
    const listing = await listingResponse.json();
    const communityResponse = await page.request.get(
      `${origin}/api/social/community/${listing.communityId}`,
      { headers: scopeHeaders }
    );
    if (!communityResponse.ok()) {
      detailStates.push({
        listingId,
        listingStatus: listingResponse.status(),
        communityStatus: communityResponse.status(),
      });
      continue;
    }
    const listingCommunity = await communityResponse.json();
    await timedStage(timings, 'signed-in listing detail deep-link hydration', () =>
      page.goto(
        `${origin}/c/${encodeURIComponent(
          listingCommunity.slug
        )}/classifieds/${listingId}`,
        { waitUntil: 'domcontentloaded' }
      )
    );
    const detailPage = page.locator('.detail-page');
    const visible = await detailPage.isVisible().catch(() => false);
    const contact = page.getByRole('button', {
      name: 'Contact Seller',
      exact: true,
    });
    const contactVisible = await contact.isVisible().catch(() => false);
    let contactKeyboardReachable = false;
    let contactEnabled: boolean | null = null;
    if (contactVisible) {
      contactEnabled = await contact.isEnabled();
      await contact.focus();
      contactKeyboardReachable = await contact.evaluate(
        (element) => element === document.activeElement
      );
    }
    const membershipResponse = await page.request.get(
      `${origin}/api/social/community/${listing.communityId}/membership`,
      { headers: scopeHeaders }
    );
    const membershipBody = membershipResponse.ok()
      ? await membershipResponse.json()
      : null;
    detailStates.push({
      listingId,
      listingStatus: listingResponse.status(),
      listingActive: listing.status === 'active',
      communityId: listing.communityId,
      communitySlug: listingCommunity.slug,
      communityPublic: !listingCommunity.isPrivate,
      detailRoute: await page.evaluate(() => location.pathname),
      detailRendered: visible,
      contactVisible,
      contactEnabled,
      contactKeyboardReachable,
      buyerMembership: membershipBody === true || membershipBody?.data === true,
      contactInvoked: false,
      reason:
        'Preflight only: no approved membership or nonempty seller conversation; clicking may persist a direct chat and initial system message.',
    });
  }
  await Promise.all(servedMainAssetReads);
  record({
    type: 'ts-existing-listing-detail-preflight',
    rows: detailStates,
    timings,
    servedMainAssets,
    sourceProvenance: 'SHA256 captured from actual browser-served main JavaScript response; compare with workspace dist separately',
  });
});
