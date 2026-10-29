import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const enabled = process.env['RR09_I04_LIVE_STACK'] === 'true';
const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const scopeHeaders = {
  'X-ot-appscope': 'client-interface',
  'X-ot-app-id': 'client-interface',
};
const credentialsPath =
  process.env['RR09_I04_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const evidencePath = `${process.cwd()}/.runtime-artifacts/rr09/i04/evidence.jsonl`;
const nonOwnerCredentialsPath =
  process.env['RR09_I04_NONOWNER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i04-nonowner-credentials.json';
const baselinePath = `${process.cwd()}/.runtime-artifacts/rr09/i04/baseline.json`;

type SavedCredentials = { email: string; password: string };
type Session = { userId: string; profileId: string };
type Profile = {
  id: string;
  userId: string;
  profileName: string;
  appScope?: string | null;
};
type Post = {
  id: string;
  userId: string;
  profileId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  visibility?: string;
  moderationStatus?: string;
};

function record(value: Record<string, unknown>): void {
  const directory = dirname(evidencePath);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  appendFileSync(
    evidencePath,
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
}

function savedCredentials(path: string, prefix: string): SavedCredentials {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (existsSync(path)) {
    chmodSync(path, 0o600);
    const saved = JSON.parse(readFileSync(path, 'utf8')) as {
      email?: unknown;
      password?: unknown;
    };
    if (typeof saved.email !== 'string' || typeof saved.password !== 'string') {
      throw new Error(`Invalid ${prefix} credential file`);
    }
    return { email: saved.email, password: saved.password };
  }

  const value = {
    email: `${prefix}-${randomUUID()}@example.test`,
    password: `${prefix}-${randomUUID()}!`,
  };
  writeFileSync(path, JSON.stringify(value), {
    mode: 0o600,
    flag: 'wx',
  });
  chmodSync(path, 0o600);
  return value;
}

function credentials(): SavedCredentials {
  return savedCredentials(credentialsPath, 'rr09-i04-owner');
}

function postSnapshot(post: Post): Record<string, string | undefined> {
  return {
    id: post.id,
    userId: post.userId,
    profileId: post.profileId,
    title: post.title,
    content: post.content,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    visibility: post.visibility,
    moderationStatus: post.moderationStatus,
  };
}

function postDigest(post: Post): string {
  return createHash('sha256')
    .update(JSON.stringify(postSnapshot(post)))
    .digest('hex');
}

async function readSession(api: APIRequestContext): Promise<Session> {
  const response = await api.get(`${origin}/api/authentication/session`);
  expect(response.status()).toBe(200);
  return (await response.json()).data as Session;
}

async function readProfiles(api: APIRequestContext): Promise<Profile[]> {
  const response = await api.get(`${origin}/api/profile`);
  expect(response.status()).toBe(200);
  return (await response.json()) as Profile[];
}

async function readPublicPosts(
  api: APIRequestContext,
  profileId: string
): Promise<Post[]> {
  const response = await api.post(`${origin}/api/social/post/find`, {
    headers: scopeHeaders,
    data: { criteria: { profileId } },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as Post[];
}

async function switchProfileThroughUi(
  page: Page,
  target: Profile,
  expectedPreviousProfileId: string
): Promise<void> {
  const currentSession = await readSession(page.context().request);
  if (currentSession.profileId === target.id) {
    expect(currentSession.userId).toBe(target.userId);
    return;
  }
  expect(currentSession.profileId).toBe(expectedPreviousProfileId);
  await page.goto(`${origin}/profile/${expectedPreviousProfileId}`, {
    waitUntil: 'domcontentloaded',
  });
  const selector = page.locator('lib-profile-selector');
  await expect(selector).toBeVisible({ timeout: 15_000 });
  const selectButton = selector.getByRole('button', {
    name: `Select profile ${target.profileName}`,
    exact: true,
  });
  await selectButton.click();
  await expect
    .poll(async () => (await readSession(page.context().request)).profileId)
    .toBe(target.id);
  await expect(page).toHaveURL(new RegExp(`/profile/${target.id}$`));
  const selectedProfile = await readSession(page.context().request);
  expect(selectedProfile.userId).toBe(target.userId);
  expect(selectedProfile.profileId).toBe(target.id);
}

async function expectEditAction(
  page: Page,
  marker: string,
  expectedVisible: boolean
): Promise<void> {
  const post = page.locator('lib-post').filter({ hasText: marker });
  await expect(post).toHaveCount(1);
  const trigger = post.locator('.dropdown-trigger').first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const editAction = post.getByRole('button', {
    name: 'Edit post',
    exact: true,
  });
  if (expectedVisible) {
    await expect(editAction).toBeVisible();
  } else {
    await expect(editAction).toBeHidden();
  }
  await page.keyboard.press('Escape');
}

async function capturePostScreenshot(
  page: Page,
  marker: string,
  label: string
): Promise<void> {
  const post = page.locator('lib-post').filter({ hasText: marker });
  await expect(post).toBeVisible();
  const directory = `${process.cwd()}/.runtime-artifacts/rr09/i04/screenshots`;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const screenshotPath = join(directory, `${label}.png`);
  writeFileSync(screenshotPath, await post.screenshot(), { mode: 0o600 });
  chmodSync(screenshotPath, 0o600);
  record({
    type: 'synthetic-post-screenshot',
    label,
    relativePath: `.runtime-artifacts/rr09/i04/screenshots/${label}.png`,
    mode: '0600',
  });
}

async function ensureNonOwnerAccount(api: APIRequestContext): Promise<Session> {
  const value = savedCredentials(nonOwnerCredentialsPath, 'rr09-i04-nonowner');
  let login = await api.post(`${origin}/api/authentication/login`, {
    headers: { ...scopeHeaders, 'x-ot-session-mode': 'cookie' },
    data: value,
  });
  if (login.status() !== 201) {
    const registration = await api.post(
      `${origin}/api/authentication/register`,
      {
        headers: scopeHeaders,
        data: {
          fn: 'RR09',
          ln: 'I04NonOwner',
          email: value.email,
          password: value.password,
          confirm: value.password,
          bio: 'Synthetic RR09-I04 non-owner account',
        },
      }
    );
    expect([201, 409]).toContain(registration.status());
    login = await api.post(`${origin}/api/authentication/login`, {
      headers: { ...scopeHeaders, 'x-ot-session-mode': 'cookie' },
      data: value,
    });
  }
  expect(login.status()).toBe(201);
  return readSession(api);
}

test.describe('RR09-I04 OT feed own-post editing', () => {
  test('enforces selected-profile edit ownership and recovers failed saves', async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(
      !enabled,
      'Set RR09_I04_LIVE_STACK=true for the authorized local live-stack check'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Run the focused acceptance once with system Chrome'
    );
    test.setTimeout(240_000);

    const { email, password } = credentials();
    await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });

    // Keep owner cleanup independent from browser teardown and profile switches.
    const api = await playwrightRequest.newContext({
      baseURL: origin,
      storageState: await page.context().storageState(),
      extraHTTPHeaders: scopeHeaders,
    });
    const anonymousApi = await playwrightRequest.newContext({
      baseURL: origin,
      extraHTTPHeaders: scopeHeaders,
    });
    let nonOwnerContext: Awaited<ReturnType<typeof browser.newContext>> | null =
      null;
    const fixtureIds: string[] = [];
    const fixtureProfileIds = new Map<string, string>();
    let alternateProfile: Profile | null = null;
    let alternateProfileCreated = false;
    let originalProfileForCleanup: Profile | null = null;
    let mainFailure: unknown;
    const cleanupErrors: string[] = [];
    let session: Session | null = null;
    let baselinePosts: Post[] = [];
    try {
      session = await readSession(api);
      expect(session.profileId).toBeTruthy();
      const baselineProof = JSON.parse(readFileSync(baselinePath, 'utf8')) as {
        visiblePostCount: number;
        posts: Array<{ id: string; state_sha256: string }>;
      };
      baselinePosts = await readPublicPosts(anonymousApi, session.profileId);
      expect(baselinePosts.map((post) => post.id).sort()).toEqual(
        baselineProof.posts.map((post) => post.id).sort()
      );
      expect(baselinePosts).toHaveLength(baselineProof.visiblePostCount);
      const baselineBefore = baselinePosts.map((post) => ({
        id: post.id,
        digest: postDigest(post),
      }));
      record({
        type: 'public-post-baseline-before',
        ownerProfileId: session.profileId,
        count: baselinePosts.length,
        posts: baselineBefore,
      });

      const fixtureMarker = `RR09-I04 A ${randomUUID()}`;
      const createResponse = await api.post(`${origin}/api/social/post`, {
        headers: scopeHeaders,
        data: {
          title: fixtureMarker,
          content: `Original body for ${fixtureMarker}`,
          profileId: session.profileId,
          visibility: 'public',
        },
      });
      expect(createResponse.status()).toBe(201);
      const createdPost = (await createResponse.json()) as Post;
      fixtureIds.push(createdPost.id);
      fixtureProfileIds.set(createdPost.id, session.profileId);
      expect(createdPost.profileId).toBe(session.profileId);
      record({
        type: 'fixture-post-created',
        postId: createdPost.id,
        ownerUserId: session.userId,
        ownerProfileId: session.profileId,
        appScope: 'client-interface',
      });

      const alternateName = `RR09-I04 Global Alternate ${session.userId.slice(
        0,
        8
      )}`;
      let ownedProfiles = await readProfiles(api);
      const ownedProfileCountBefore = ownedProfiles.length;
      const originalProfile = ownedProfiles.find(
        (profile) => profile.id === session?.profileId
      );
      originalProfileForCleanup = originalProfile ?? null;
      expect(originalProfile?.userId).toBe(session.userId);
      expect(originalProfile?.appScope).toBe('client-interface');
      record({
        type: 'owned-profile-baseline',
        ownerUserId: session.userId,
        count: ownedProfiles.length,
        profiles: ownedProfiles.map((profile) => ({
          id: profile.id,
          appScope: profile.appScope ?? null,
        })),
      });

      alternateProfile =
        ownedProfiles.find(
          (profile) =>
            profile.userId === session?.userId &&
            profile.id !== session.profileId &&
            profile.appScope === 'global' &&
            profile.profileName === alternateName
        ) ?? null;
      if (!alternateProfile) {
        const createProfileResponse = await api.post(`${origin}/api/profile`, {
          headers: scopeHeaders,
          data: {
            name: alternateName,
            description: 'Controlled RR09-I04 alternate profile',
            userId: session.userId,
            profilePic: '',
            coverPic: '',
            bio: 'Controlled RR09-I04 profile fixture',
            location: '',
            occupation: '',
            interests: '',
            skills: '',
            appScope: 'global',
          },
        });
        expect(createProfileResponse.status()).toBe(201);
        const createdProfileBody = (await createProfileResponse.json()) as
          | Profile
          | { profile: Profile; newToken?: string };
        alternateProfile =
          'profile' in createdProfileBody
            ? createdProfileBody.profile
            : createdProfileBody;
        alternateProfileCreated = alternateProfile.id !== session.profileId;
        record({
          type: 'alternate-owned-profile-created',
          profileId: alternateProfile.id,
          ownerUserId: alternateProfile.userId,
          appScope: alternateProfile.appScope ?? null,
          createdByNormalOwnerApi: true,
          selectedByUiRequired: true,
        });
      }
      expect(alternateProfile.id).not.toBe(session.profileId);
      expect(alternateProfile.userId).toBe(session.userId);
      expect(alternateProfile.appScope).toBe('global');
      expect(await readSession(api)).toMatchObject({
        userId: session.userId,
        profileId: session.profileId,
      });
      ownedProfiles = await readProfiles(api);
      expect(ownedProfiles.map((profile) => profile.id)).toContain(
        alternateProfile.id
      );
      expect(ownedProfiles).toHaveLength(
        ownedProfileCountBefore + (alternateProfileCreated ? 1 : 0)
      );
      record({
        type: 'owned-profile-fixture-readback',
        ownerUserId: session.userId,
        countBefore: ownedProfileCountBefore,
        countAfter: ownedProfiles.length,
        alternateProfileId: alternateProfile.id,
        alternateProfileScope: alternateProfile.appScope,
        createdByThisRun: alternateProfileCreated,
      });

      await switchProfileThroughUi(page, alternateProfile, session.profileId);
      await page.reload({ waitUntil: 'domcontentloaded' });
      expect(await readSession(page.context().request)).toMatchObject({
        userId: session.userId,
        profileId: alternateProfile.id,
      });

      // A foreign-user profile creation attempt must be rejected before it can
      // create a profile or issue a token for that account.
      const nonOwnerApi = await playwrightRequest.newContext({
        baseURL: origin,
        extraHTTPHeaders: scopeHeaders,
      });
      let nonOwnerSession: Session;
      try {
        nonOwnerSession = await ensureNonOwnerAccount(nonOwnerApi);
        const otherProfilesBefore = await readProfiles(nonOwnerApi);
        const foreignCreateResponse = await api.post(`${origin}/api/profile`, {
          headers: {
            ...scopeHeaders,
            'x-ot-session-mode': 'cookie',
          },
          data: {
            name: `RR09-I04 rejected cross-user profile ${randomUUID()}`,
            description: 'Must be rejected before creation',
            userId: nonOwnerSession.userId,
            profilePic: '',
            coverPic: '',
            bio: '',
            location: '',
            occupation: '',
            interests: '',
            skills: '',
            appScope: 'global',
          },
        });
        expect(foreignCreateResponse.status()).toBe(403);
        expect(foreignCreateResponse.headers()['set-cookie']).toBeUndefined();
        expect(await readSession(api)).toMatchObject({
          userId: session.userId,
          profileId: session.profileId,
        });
        expect(await readProfiles(nonOwnerApi)).toEqual(otherProfilesBefore);
        expect(await readSession(nonOwnerApi)).toMatchObject(nonOwnerSession);
        record({
          type: 'cross-user-profile-create-denied',
          ownerUserId: session.userId,
          targetUserId: nonOwnerSession.userId,
          status: foreignCreateResponse.status(),
          setCookie: false,
          targetProfileCountUnchanged: true,
          ownerSessionUnchanged: true,
        });

        for (const [scope, appId, caseName] of [
          ['forgeofwill', 'forgeofwill', 'registered-foreign-app-scope'],
          [
            'rr09-i04-unknown-scope',
            'rr09-i04-unknown-scope',
            'unknown-app-scope',
          ],
        ] as const) {
          const issueResponse = await page
            .context()
            .request.post(`${origin}/api/authentication/issue`, {
              headers: {
                'X-ot-appscope': scope,
                'X-ot-app-id': appId,
                'x-ot-session-mode': 'cookie',
              },
              data: { profileId: session.profileId },
            });
          expect(issueResponse.status()).toBe(403);
          expect(issueResponse.headers()['set-cookie']).toBeUndefined();
          expect(await readSession(page.context().request)).toMatchObject({
            userId: session.userId,
            profileId: alternateProfile.id,
          });
          record({
            type: 'profile-issue-scope-denied',
            case: caseName,
            requestedAppScope: scope,
            requestedAppId: appId,
            requestedProfileId: session.profileId,
            activeProfileId: alternateProfile.id,
            status: issueResponse.status(),
            setCookie: false,
            ownerSessionUnchanged: true,
          });
        }

        const wrongOwnerIssue = await page
          .context()
          .request.post(`${origin}/api/authentication/issue`, {
            headers: {
              ...scopeHeaders,
              'x-ot-session-mode': 'cookie',
            },
            data: { profileId: nonOwnerSession.profileId },
          });
        expect(wrongOwnerIssue.status()).toBe(403);
        expect(wrongOwnerIssue.headers()['set-cookie']).toBeUndefined();
        expect(await readSession(page.context().request)).toMatchObject({
          userId: session.userId,
          profileId: alternateProfile.id,
        });
        record({
          type: 'profile-issue-wrong-owner-denied',
          requestedProfileId: nonOwnerSession.profileId,
          status: wrongOwnerIssue.status(),
          setCookie: false,
          ownerSessionUnchanged: true,
        });
      } finally {
        await nonOwnerApi.dispose();
      }

      const alternateMarker = `RR09-I04 B ${randomUUID()}`;
      const alternateCreateResponse = await page
        .context()
        .request.post(`${origin}/api/social/post`, {
          headers: scopeHeaders,
          data: {
            title: alternateMarker,
            content: `Original body for ${alternateMarker}`,
            profileId: alternateProfile.id,
            visibility: 'public',
          },
        });
      expect(alternateCreateResponse.status()).toBe(201);
      const alternatePost = (await alternateCreateResponse.json()) as Post;
      fixtureIds.push(alternatePost.id);
      fixtureProfileIds.set(alternatePost.id, alternateProfile.id);
      expect(alternatePost.profileId).toBe(alternateProfile.id);
      expect(alternatePost.userId).toBe(session.userId);
      record({
        type: 'fixture-post-created',
        postId: alternatePost.id,
        ownerUserId: session.userId,
        ownerProfileId: alternateProfile.id,
        appScope: 'global',
      });

      await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
      await expect(
        page.locator('lib-post').filter({ hasText: alternateMarker })
      ).toBeVisible({ timeout: 20_000 });
      await expectEditAction(page, alternateMarker, true);
      await expectEditAction(page, fixtureMarker, false);
      const crossProfileUpdate = await page
        .context()
        .request.put(`${origin}/api/social/post/update/${createdPost.id}`, {
          headers: scopeHeaders,
          data: {
            title: `${fixtureMarker} unauthorized alternate edit`,
            content: 'This attempted update must be denied',
          },
        });
      const ownerSessionAfterCrossProfileAttempt = await readSession(
        page.context().request
      );
      expect(ownerSessionAfterCrossProfileAttempt).toMatchObject({
        userId: session.userId,
        profileId: alternateProfile.id,
      });
      const originalPostAfterCrossProfileAttempt = await api.get(
        `${origin}/api/social/post/${createdPost.id}`
      );
      expect(originalPostAfterCrossProfileAttempt.status()).toBe(200);
      expect(
        (await originalPostAfterCrossProfileAttempt.json()) as Post
      ).toMatchObject({
        title: fixtureMarker,
        content: `Original body for ${fixtureMarker}`,
      });
      record({
        type: 'cross-profile-update-denied',
        postId: createdPost.id,
        selectedProfileId: alternateProfile.id,
        status: crossProfileUpdate.status(),
        ownerSessionUnchanged: true,
        persistedOwnerPostUnchanged: true,
      });
      expect(crossProfileUpdate.status()).toBe(403);

      const alternatePostLocator = page
        .locator('lib-post')
        .filter({ hasText: alternateMarker });
      await alternatePostLocator.locator('.dropdown-trigger').focus();
      await page.keyboard.press('Enter');
      await alternatePostLocator
        .getByRole('button', { name: 'Edit post', exact: true })
        .click();
      await expect(
        alternatePostLocator.locator('input.edit-title')
      ).toHaveValue(alternateMarker);
      await expect(
        alternatePostLocator.locator('textarea.edit-content')
      ).toHaveValue(`Original body for ${alternateMarker}`);
      await alternatePostLocator
        .getByRole('button', { name: 'Cancel', exact: true })
        .click();
      await expect(alternatePostLocator.locator('.title')).toHaveText(
        alternateMarker
      );
      await alternatePostLocator.locator('.dropdown-trigger').focus();
      await page.keyboard.press('Enter');
      await alternatePostLocator
        .getByRole('button', { name: 'Edit post', exact: true })
        .click();
      const alternateSavedTitle = `${alternateMarker} saved`;
      const alternateSavedContent = `Saved body for ${alternateMarker}`;
      await alternatePostLocator
        .locator('input.edit-title')
        .fill(alternateSavedTitle);
      await alternatePostLocator
        .locator('textarea.edit-content')
        .fill(alternateSavedContent);
      await alternatePostLocator
        .locator('.edit-actions')
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect(alternatePostLocator.locator('.title')).toHaveText(
        alternateSavedTitle
      );
      await expect(alternatePostLocator.locator('.post-content')).toHaveText(
        alternateSavedContent
      );
      await expect(
        page.locator('lib-post').filter({ hasText: alternateMarker })
      ).toHaveCount(1);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const reloadedAlternatePost = page
        .locator('lib-post')
        .filter({ hasText: alternateSavedTitle });
      await expect(reloadedAlternatePost).toBeVisible({ timeout: 20_000 });
      await expect(reloadedAlternatePost.locator('.post-content')).toHaveText(
        alternateSavedContent
      );
      await capturePostScreenshot(page, alternateSavedTitle, 'profile-b-saved');
      record({
        type: 'alternate-profile-edit-acceptance',
        postId: alternatePost.id,
        ownerProfileId: alternateProfile.id,
        cancelPreservedOriginal: true,
        reloadPreservedSavedValues: true,
        rowCount: await page
          .locator('lib-post')
          .filter({ hasText: alternateMarker })
          .count(),
      });

      await switchProfileThroughUi(
        page,
        originalProfile as Profile,
        alternateProfile.id
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      expect(await readSession(page.context().request)).toMatchObject({
        userId: session.userId,
        profileId: session.profileId,
      });
      await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
      await expectEditAction(page, fixtureMarker, true);
      await expectEditAction(page, alternateMarker, false);

      // The original-profile path remains the primary reproduction and also
      // verifies keyboard reachability, cancel, save, reload, failure, retry.
      const post = page.locator('lib-post').filter({ hasText: fixtureMarker });
      await expect(post).toBeVisible({ timeout: 20_000 });
      const menuTrigger = post.locator('.dropdown-trigger').first();
      await menuTrigger.focus();
      await expect(menuTrigger).toBeFocused();
      await page.keyboard.press('Enter');
      const editAction = post.getByRole('button', {
        name: 'Edit post',
        exact: true,
      });
      await expect(editAction).toBeVisible();
      const viewProfileAction = post.getByRole('button', {
        name: 'View Profile',
        exact: true,
      });
      await page.keyboard.press('Tab');
      await expect(viewProfileAction).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(editAction).toBeFocused();
      await page.keyboard.press('Enter');
      const titleInput = post.locator('input.edit-title');
      const contentInput = post.locator('textarea.edit-content');
      await expect(titleInput).toHaveValue(fixtureMarker);
      await expect(contentInput).toHaveValue(
        `Original body for ${fixtureMarker}`
      );
      await post.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(post.locator('.title')).toHaveText(fixtureMarker);
      await expect(post.locator('.post-content')).toHaveText(
        `Original body for ${fixtureMarker}`
      );

      await menuTrigger.focus();
      await page.keyboard.press('Enter');
      await post
        .getByRole('button', { name: 'Edit post', exact: true })
        .click();
      await titleInput.fill(`${fixtureMarker} saved`);
      await contentInput.fill(`Saved body for ${fixtureMarker}`);
      await post
        .locator('.edit-actions')
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect(post.locator('.title')).toHaveText(`${fixtureMarker} saved`);
      await expect(post.locator('.post-content')).toHaveText(
        `Saved body for ${fixtureMarker}`
      );
      await expect(
        page.locator('lib-post').filter({ hasText: fixtureMarker })
      ).toHaveCount(1);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const reloadedPost = page
        .locator('lib-post')
        .filter({ hasText: fixtureMarker });
      await expect(reloadedPost).toBeVisible({ timeout: 20_000 });
      await expect(reloadedPost.locator('.post-content')).toHaveText(
        `Saved body for ${fixtureMarker}`
      );
      await capturePostScreenshot(
        page,
        `${fixtureMarker} saved`,
        'profile-a-saved'
      );

      await reloadedPost.locator('.dropdown-trigger').focus();
      await page.keyboard.press('Enter');
      await reloadedPost
        .getByRole('button', { name: 'Edit post', exact: true })
        .click();
      const draftTitle = `${fixtureMarker} retry draft`;
      const draftContent = `Retry body for ${fixtureMarker}`;
      await reloadedPost.locator('input.edit-title').fill(draftTitle);
      await reloadedPost.locator('textarea.edit-content').fill(draftContent);

      let injectedFailures = 0;
      let editorUpdateRequests = 0;
      const updateUrl = `${origin}/api/social/post/update/${createdPost.id}`;
      page.on('request', (request) => {
        if (request.url() === updateUrl && request.method() === 'PUT') {
          editorUpdateRequests += 1;
        }
      });
      await page.route(
        updateUrl,
        async (route) => {
          injectedFailures += 1;
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Controlled RR09-I04 failure' }),
          });
        },
        { times: 1 }
      );
      await reloadedPost
        .locator('.edit-actions')
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      await expect.poll(() => injectedFailures).toBe(1);
      await expect.poll(() => editorUpdateRequests).toBe(1);
      await expect(reloadedPost.locator('input.edit-title')).toBeVisible({
        timeout: 5_000,
      });
      await expect(reloadedPost.locator('input.edit-title')).toHaveValue(
        draftTitle
      );
      await expect(reloadedPost.locator('textarea.edit-content')).toBeVisible();
      await expect(reloadedPost.locator('textarea.edit-content')).toHaveValue(
        draftContent
      );
      await expect(reloadedPost.getByRole('alert')).toBeVisible({
        timeout: 5_000,
      });
      await capturePostScreenshot(
        page,
        `${fixtureMarker} saved`,
        'failed-save-draft'
      );
      const persistedAfterFailure = await api.get(
        `${origin}/api/social/post/${createdPost.id}`
      );
      expect(persistedAfterFailure.status()).toBe(200);
      const originalAfterFailure = (await persistedAfterFailure.json()) as Post;
      expect(originalAfterFailure).toMatchObject({
        title: `${fixtureMarker} saved`,
        content: `Saved body for ${fixtureMarker}`,
      });
      record({
        type: 'failed-save-recovery-probe',
        postId: createdPost.id,
        ownerUserId: session.userId,
        ownerProfileId: session.profileId,
        injectedFailures,
        visibleEditorRetained: true,
        visibleErrorRetained: true,
        persistedOriginalPreserved: true,
      });
      await page.unroute(updateUrl);
      const retryResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === updateUrl && response.request().method() === 'PUT'
      );
      await reloadedPost
        .locator('.edit-actions')
        .getByRole('button', { name: 'Save', exact: true })
        .click();
      const retryResponse = await retryResponsePromise;
      expect(retryResponse.status()).toBe(200);
      await expect.poll(() => editorUpdateRequests).toBe(2);
      const persistedAfterRetry = await api.get(
        `${origin}/api/social/post/${createdPost.id}`
      );
      expect(persistedAfterRetry.status()).toBe(200);
      expect((await persistedAfterRetry.json()) as Post).toMatchObject({
        title: draftTitle,
        content: draftContent,
      });
      await expect(reloadedPost.locator('.title')).toHaveText(draftTitle);
      await expect(reloadedPost.locator('.post-content')).toHaveText(
        draftContent
      );
      await expect(
        page.locator('lib-post').filter({ hasText: fixtureMarker })
      ).toHaveCount(1);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const retriedPost = page
        .locator('lib-post')
        .filter({ hasText: draftTitle });
      await expect(retriedPost).toBeVisible({ timeout: 20_000 });
      await expect(retriedPost.locator('.post-content')).toHaveText(
        draftContent
      );
      record({
        type: 'failed-save-retry-acceptance',
        postId: createdPost.id,
        retryStatus: retryResponse.status(),
        editorUpdateRequestCount: editorUpdateRequests,
        authoritativeReadbackMatchesDraft: true,
        reloadMatchesDraft: true,
        uniquePostCount: await page
          .locator('lib-post')
          .filter({ hasText: fixtureMarker })
          .count(),
      });

      // A separate authenticated account sees the public fixture but gets no
      // Edit action and a direct update is rejected by the server.
      nonOwnerContext = await browser.newContext();
      const nonOwnerPage = await nonOwnerContext.newPage();
      const nonOwnerValue = savedCredentials(
        nonOwnerCredentialsPath,
        'rr09-i04-nonowner'
      );
      await nonOwnerPage.goto(`${origin}/login`, {
        waitUntil: 'domcontentloaded',
      });
      await nonOwnerPage
        .getByLabel('Email', { exact: true })
        .fill(nonOwnerValue.email);
      await nonOwnerPage
        .getByLabel('Password', { exact: true })
        .fill(nonOwnerValue.password);
      await nonOwnerPage
        .getByRole('button', { name: 'Login', exact: true })
        .click();
      await expect(nonOwnerPage).not.toHaveURL(/\/login(?:$|\?)/, {
        timeout: 20_000,
      });
      await nonOwnerPage.goto(`${origin}/feed`, {
        waitUntil: 'domcontentloaded',
      });
      await expectEditAction(nonOwnerPage, fixtureMarker, false);
      const nonOwnerUpdate = await nonOwnerContext.request.put(
        `${origin}/api/social/post/update/${createdPost.id}`,
        {
          headers: scopeHeaders,
          data: {
            title: `${fixtureMarker} unauthorized non-owner edit`,
            content: 'This attempted update must be denied',
          },
        }
      );
      expect(nonOwnerUpdate.status()).toBe(403);
      const persistedAfterNonOwner = await api.get(
        `${origin}/api/social/post/${createdPost.id}`
      );
      expect(persistedAfterNonOwner.status()).toBe(200);
      expect((await persistedAfterNonOwner.json()) as Post).toMatchObject({
        title: draftTitle,
        content: draftContent,
      });
      record({
        type: 'non-owner-edit-denied',
        postId: createdPost.id,
        ownerProfileId: session.profileId,
        status: nonOwnerUpdate.status(),
        editActionUnavailable: true,
        persistedOwnerPostUnchanged: true,
      });

      await switchProfileThroughUi(
        page,
        originalProfile as Profile,
        session.profileId
      );
      const ownerSessionAfterSwitchBack = await readSession(
        page.context().request
      );
      expect(ownerSessionAfterSwitchBack).toMatchObject({
        userId: session.userId,
        profileId: session.profileId,
      });
      record({
        type: 'owner-profile-edit-acceptance',
        postId: createdPost.id,
        alternatePostId: alternatePost.id,
        ownerUserId: session.userId,
        ownerProfileId: session.profileId,
        alternateProfileId: alternateProfile.id,
        cancelPreservedOriginal: true,
        retryPreservedPostId: true,
        rowCount: await page
          .locator('lib-post')
          .filter({ hasText: fixtureMarker })
          .count(),
        reloadedTitle: draftTitle,
        reloadedContent: draftContent,
      });
    } catch (error) {
      mainFailure = error;
      throw error;
    } finally {
      try {
        await page.unrouteAll({ behavior: 'wait' }).catch(() => undefined);
      } catch {
        // Browser teardown must not prevent independent API cleanup.
      }
      if (session && originalProfileForCleanup) {
        try {
          const selected = await readSession(page.context().request);
          if (
            selected.userId === session.userId &&
            selected.profileId !== session.profileId
          ) {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await switchProfileThroughUi(
              page,
              originalProfileForCleanup,
              selected.profileId
            );
          }
          expect(await readSession(page.context().request)).toMatchObject({
            userId: session.userId,
            profileId: session.profileId,
          });
          record({
            type: 'owner-profile-selection-restored',
            ownerUserId: session.userId,
            ownerProfileId: session.profileId,
            restored: true,
          });
        } catch {
          cleanupErrors.push('owner-profile-selection-restore');
          record({
            type: 'owner-profile-selection-restore-failed',
            ownerUserId: session.userId,
            ownerProfileId: session.profileId,
          });
        }
      }
      for (const fixtureId of fixtureIds.slice().reverse()) {
        try {
          const cleanupResponse = await api.delete(
            `${origin}/api/social/post/${fixtureId}`
          );
          expect([200, 204]).toContain(cleanupResponse.status());
          const readback = await api.get(
            `${origin}/api/social/post/${fixtureId}`
          );
          expect(readback.status()).toBe(200);
          expect((await readback.text()).length).toBe(0);
          const profileId = fixtureProfileIds.get(fixtureId);
          expect(profileId).toBeTruthy();
          const activePosts = await readPublicPosts(anonymousApi, profileId!);
          const absentFromProfileFeed = !activePosts.some(
            (post) => post.id === fixtureId
          );
          expect(absentFromProfileFeed).toBe(true);
          record({
            type: 'fixture-cleanup',
            postId: fixtureId,
            profileId,
            deleteStatus: cleanupResponse.status(),
            tombstoneStatus: readback.status(),
            tombstoneEmpty: true,
            absentFromProfileFeed,
            cleanupPassed: true,
          });
        } catch {
          cleanupErrors.push(`post:${fixtureId}`);
          record({
            type: 'fixture-cleanup-failed',
            postId: fixtureId,
          });
        }
      }
      if (session) {
        try {
          const baselineAfter = await readPublicPosts(
            anonymousApi,
            session.profileId
          );
          const before = baselinePosts.map((post) => ({
            id: post.id,
            digest: postDigest(post),
          }));
          const after = baselineAfter.map((post) => ({
            id: post.id,
            digest: postDigest(post),
          }));
          expect(after).toEqual(before);
          record({
            type: 'public-post-baseline-after',
            ownerProfileId: session.profileId,
            count: baselineAfter.length,
            posts: after,
            unchanged: true,
          });
        } catch {
          cleanupErrors.push('baseline-readback');
          record({
            type: 'public-post-baseline-readback-failed',
            ownerProfileId: session.profileId,
          });
        }
      }
      if (alternateProfile) {
        record({
          type: 'alternate-profile-retained',
          profileId: alternateProfile.id,
          ownerUserId: alternateProfile.userId,
          appScope: alternateProfile.appScope ?? null,
          createdByThisRun: alternateProfileCreated,
          reason: 'ProfileCommands.Delete has no profile-service handler',
          noPostFixturesRemain: !cleanupErrors.some((entry) =>
            entry.startsWith('post:')
          ),
        });
      }
      record({
        type: 'test-cleanup-summary',
        postFixtureIds: fixtureIds,
        cleanupErrors,
        primaryFailure: Boolean(mainFailure),
      });
      if (nonOwnerContext) await nonOwnerContext.close();
      await api.dispose();
      await anonymousApi.dispose();
      if (!mainFailure) expect(cleanupErrors).toEqual([]);
    }
  });
});
