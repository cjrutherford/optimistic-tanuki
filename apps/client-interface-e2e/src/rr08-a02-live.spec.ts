import { expect, test, APIRequestContext, Page } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { execFileSync } from 'node:child_process';
import { firstValueFrom } from 'rxjs';

test.skip(
  process.env['RR08_A02_LIVE'] !== 'true',
  'Requires the existing client-interface development stack'
);

const origin = 'http://127.0.0.1:8080';
const headers = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};
const password = 'RR08-local-test-password!';
const marker = () =>
  `RR08-A02 ${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fixtureAssetName = (fixture: string, suffix: string) =>
  `${fixture}-${suffix}`.replace(/[^A-Za-z0-9_-]/g, '_').toLowerCase() + '.png';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGNkaPjPwMDAxMDAwMDAAAARHwGDXcgNqQAAAABJRU5ErkJggg==',
  'base64'
);

async function account(request: APIRequestContext, role: string) {
  const email = `rr08-a02-${role}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.test`;
  const registration = await request.post(
    origin + '/api/authentication/register',
    {
      headers,
      data: {
        fn: 'RR08-A02',
        ln: role,
        email,
        password,
        confirm: password,
        bio: 'Local asset authorization probe',
      },
    }
  );
  expect(registration.status(), await registration.text()).toBe(201);
  const login = await request.post(origin + '/api/authentication/login', {
    headers: { ...headers, 'x-ot-session-mode': 'cookie' },
    data: { email, password },
  });
  expect(login.status(), await login.text()).toBe(201);
  const session = await request.get(origin + '/api/authentication/session', {
    headers,
  });
  expect(session.status()).toBe(200);
  return { email, ...(await session.json()).data } as {
    email: string;
    userId: string;
    profileId: string;
  };
}

async function browserLogin(page: Page, email: string) {
  await page.goto(origin + '/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

async function upload(
  request: APIRequestContext,
  profileId: string,
  name: string,
  audienceRestrictions: Array<{
    type: 'owner' | 'followers';
    profileId: string;
  }> = [],
  communityId?: string
) {
  const response = await request.post(origin + '/api/asset', {
    headers,
    data: {
      name,
      profileId,
      type: 'image',
      content: `data:image/png;base64,${png.toString('base64')}`,
      fileExtension: 'png',
      ...(audienceRestrictions.length ? { audienceRestrictions } : {}),
      ...(communityId ? { communityId } : {}),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string };
}

async function stageRpc<T>(stage: string, operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
    throw new Error(`RR08-A02 RPC stage "${stage}" failed: ${detail}`);
  }
}

function resetExactFixtureToLegacyAudience(
  id: string,
  profileId: string,
  exactName: string
): void {
  if (process.env['RR08_A02_LEGACY_PROBE'] !== 'true') return;
  expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(profileId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(exactName).toMatch(/^[a-z0-9_-]+\.png$/);
  const updateResult = execFileSync(
    'docker',
    [
      'exec',
      'db',
      'psql',
      '-U',
      'postgres',
      '-d',
      'ot_assets',
      '-v',
      'ON_ERROR_STOP=1',
      '-Atc',
      `UPDATE "asset_entity" SET "audienceRestrictions" = '[]'::jsonb, "audienceCommunityIds" = '[]'::jsonb WHERE "id" = '${id}' AND "profileId" = '${profileId}' AND "name" = '${exactName}'`,
    ],
    { encoding: 'utf8' }
  ).trim();
  expect(updateResult, 'reset only the exact tagged A02 fixture').toBe(
    'UPDATE 1'
  );
}

test('RR08-A02 private social/forum image URLs follow their content audience', async ({
  playwright,
  browser,
}) => {
  test.setTimeout(120_000);
  const ownerContext = await playwright.request.newContext();
  const followerContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  const anonymous = await playwright.request.newContext();
  const fixture = marker();
  const assetIds: string[] = [];
  let forumAssetId: string | undefined;
  let socialPostId: string | undefined;
  let legacyPostId: string | undefined;
  let legacyAssetId: string | undefined;
  let legacyForumAssetId: string | undefined;
  let legacyForumPostId: string | undefined;
  let communityPostId: string | undefined;
  let communityId: string | undefined;
  let communityMemberId: string | undefined;
  let topicId: string | undefined;
  let threadId: string | undefined;
  let forumPostId: string | undefined;
  let ownerPage: Page | undefined;
  try {
    const owner = await account(ownerContext, 'owner');
    const follower = await account(followerContext, 'follower');
    await account(outsiderContext, 'outsider');

    const follow = await followerContext.post(origin + '/api/social/follow/', {
      headers,
      data: { followerId: follower.profileId, followeeId: owner.profileId },
    });
    expect([200, 201], await follow.text()).toContain(follow.status());

    const createdCommunity = await ownerContext.post(
      origin + '/api/social/community',
      {
        headers,
        data: {
          name: `${fixture} private community`,
          description: fixture,
          isPrivate: true,
          joinPolicy: 'approval_required',
        },
      }
    );
    expect(createdCommunity.status(), await createdCommunity.text()).toBe(201);
    const community = await createdCommunity.json();
    communityId = community.id;
    const join = await followerContext.post(
      `${origin}/api/social/community/${communityId}/join`,
      { headers }
    );
    expect(join.status(), await join.text()).toBe(201);
    const membership = await join.json();
    communityMemberId = membership.id;
    const approval = await ownerContext.post(
      `${origin}/api/social/community/members/${communityMemberId}/approve`,
      { headers }
    );
    expect(approval.status(), await approval.text()).toBe(201);

    const socialAsset = await upload(
      ownerContext,
      owner.profileId,
      `${fixture}-social.png`,
      [{ type: 'followers', profileId: owner.profileId }]
    );
    assetIds.push(socialAsset.id);
    const legacyAsset = await upload(
      ownerContext,
      owner.profileId,
      `${fixture}-legacy-public.png`
    );
    legacyAssetId = legacyAsset.id;
    assetIds.push(legacyAsset.id);
    const communityAsset = await upload(
      ownerContext,
      owner.profileId,
      `${fixture}-community.png`,
      [],
      communityId
    );
    assetIds.push(communityAsset.id);
    const socialImageUrl = `${origin}/api/asset/${socialAsset.id}`;
    const social = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3003 },
    });
    await social.connect();
    try {
      const post = await stageRpc(
        'create followers-only social post',
        firstValueFrom(
          social.send(
            { cmd: 'CREATE_POST' },
            {
              title: `${fixture} followers-only post`,
              content: `<p>${fixture}</p><img src="${socialImageUrl}">`,
              userId: owner.userId,
              profileId: owner.profileId,
              visibility: 'followers',
              appScope: 'social',
            }
          )
        )
      );
      socialPostId = post.id;
      await stageRpc(
        'confirm followers-only social post update',
        firstValueFrom(
          social.send(
            { cmd: 'UPDATE_POST' },
            {
              id: socialPostId,
              data: { visibility: 'followers' },
              userId: owner.userId,
              profileId: owner.profileId,
            }
          )
        )
      );
      const communityPost = await stageRpc(
        'create private-community social post',
        firstValueFrom(
          social.send(
            { cmd: 'CREATE_POST' },
            {
              title: `${fixture} private community post`,
              content: `<p>${fixture} community</p><img src="${origin}/api/asset/${communityAsset.id}">`,
              userId: owner.userId,
              profileId: owner.profileId,
              communityId,
              appScope: 'client-interface',
            }
          )
        )
      );
      communityPostId = communityPost.id;
      const legacyPost = await stageRpc(
        'create legacy public social post',
        firstValueFrom(
          social.send(
            { cmd: 'CREATE_POST' },
            {
              title: `${fixture} legacy followers-only post`,
              content: `<p>${fixture} legacy</p><img src="${origin}/api/asset/${legacyAsset.id}">`,
              userId: owner.userId,
              profileId: owner.profileId,
              appScope: 'client-interface',
            }
          )
        )
      );
      legacyPostId = legacyPost.id;
      await stageRpc(
        'latch legacy social post as followers-only',
        firstValueFrom(
          social.send(
            { cmd: 'UPDATE_POST' },
            {
              id: legacyPostId,
              data: { visibility: 'followers' },
              userId: owner.userId,
              profileId: owner.profileId,
            }
          )
        )
      );
    } finally {
      social.close();
    }

    const forum = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3015 },
    });
    await forum.connect();
    try {
      const topic = await stageRpc(
        'create private forum topic',
        firstValueFrom(
          forum.send(
            { cmd: 'CREATE_TOPIC' },
            {
              title: `${fixture} private topic`,
              description: fixture,
              visibility: 'private',
              userId: owner.userId,
              profileId: owner.profileId,
              appScope: 'client-interface',
            }
          )
        )
      );
      topicId = topic.id;
      const thread = await stageRpc(
        'create private forum thread',
        firstValueFrom(
          forum.send(
            { cmd: 'CREATE_THREAD' },
            {
              title: `${fixture} private thread`,
              description: fixture,
              content: fixture,
              topicId,
              visibility: 'private',
              userId: owner.userId,
              profileId: owner.profileId,
              appScope: 'client-interface',
            }
          )
        )
      );
      threadId = thread.id;
    } finally {
      forum.close();
    }

    ownerPage = await browser.newPage();
    const forumUploadDiagnostics: string[] = [];
    ownerPage.on('console', (message) => {
      if (message.type() === 'error') {
        forumUploadDiagnostics.push(`console: ${message.text()}`);
      }
    });
    ownerPage.on('pageerror', (error) => {
      forumUploadDiagnostics.push(`pageerror: ${error.message}`);
    });
    ownerPage.on('requestfailed', (request) => {
      if (/\/api\/asset(?:$|\?)/.test(request.url())) {
        forumUploadDiagnostics.push(
          `requestfailed: ${request.method()} ${
            new URL(request.url()).pathname
          } ${request.failure()?.errorText ?? ''}`
        );
      }
    });
    ownerPage.on('dialog', async (dialog) => {
      forumUploadDiagnostics.push(`dialog: ${dialog.message()}`);
      await dialog.accept();
    });
    await browserLogin(ownerPage, owner.email);
    await ownerPage.goto(`${origin}/forum/thread/${threadId}`);
    await ownerPage.getByRole('button', { name: 'New Post' }).click();
    await expect(ownerPage.locator('.forum-compose-card')).toBeVisible();
    const forumImageInput = ownerPage.locator('#forumImageInput');
    try {
      await expect(forumImageInput).toHaveAttribute(
        'data-profile-ready',
        'true',
        {
          timeout: 15_000,
        }
      );
    } catch (error) {
      throw new Error(
        `Forum composer did not receive an upload profile; ${
          forumUploadDiagnostics.join(' | ') || 'no browser errors captured'
        }; ${error instanceof Error ? error.message : String(error)}`
      );
    }
    const forumAssetResponse = ownerPage.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith('/api/asset') &&
        response.request().method() === 'POST',
      { timeout: 15_000 }
    );
    await forumImageInput.setInputFiles({
      name: `${fixture}-forum.png`,
      mimeType: 'image/png',
      buffer: png,
    });
    let uploadedForumAsset: Awaited<typeof forumAssetResponse>;
    try {
      uploadedForumAsset = await forumAssetResponse;
    } catch (error) {
      throw new Error(
        `Forum composer upload request was not observed; profileReady=${await forumImageInput.getAttribute(
          'data-profile-ready'
        )}; ${
          forumUploadDiagnostics.join(' | ') || 'no browser errors captured'
        }; ${error instanceof Error ? error.message : String(error)}`
      );
    }
    expect(uploadedForumAsset.status(), await uploadedForumAsset.text()).toBe(
      201
    );
    forumAssetId = (await uploadedForumAsset.json()).id;
    assetIds.push(forumAssetId!);
    const pendingForumRead = await outsiderContext.get(
      `${origin}/api/asset/${forumAssetId}`
    );
    expect([401, 403, 404], 'forum composer upload before submit').toContain(
      pendingForumRead.status()
    );
    expect((await pendingForumRead.body()).subarray(0, 8)).not.toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    await expect(
      ownerPage.locator(`.tiptap-editor-styles img[src*="${forumAssetId}"]`)
    ).toBeVisible();
    const forumPostResponse = ownerPage.waitForResponse(
      (response) =>
        response.url() === `${origin}/api/forum/post` &&
        response.request().method() === 'POST'
    );
    await ownerPage.getByRole('button', { name: 'Post to Forum' }).click();
    const savedForumPost = await forumPostResponse;
    expect(savedForumPost.status(), await savedForumPost.text()).toBe(201);
    forumPostId = (await savedForumPost.json()).id;

    // Exercise the older /asset/:id URL form and prove the owning service
    // latches it before the only private forum reference is deleted.
    const legacyForumAsset = await upload(
      ownerContext,
      owner.profileId,
      `${fixture}-legacy-forum.png`
    );
    legacyForumAssetId = legacyForumAsset.id;
    assetIds.push(legacyForumAsset.id);
    const legacyForumResponse = await ownerContext.post(
      `${origin}/api/forum/post`,
      {
        headers,
        data: {
          threadId,
          profileId: owner.profileId,
          userId: owner.userId,
          content: `<p>${fixture} forum legacy</p><img src="/asset/${legacyForumAsset.id}">`,
        },
      }
    );
    expect(legacyForumResponse.status(), await legacyForumResponse.text()).toBe(
      201
    );
    legacyForumPostId = (await legacyForumResponse.json()).id;
    const savedLegacyForum = await ownerContext.get(
      `${origin}/api/forum/post/${legacyForumPostId}`,
      { headers }
    );
    const savedLegacyForumText = await savedLegacyForum.text();
    expect(savedLegacyForum.status()).toBe(200);
    expect(savedLegacyForumText).toContain(`/asset/${legacyForumAsset.id}`);
    resetExactFixtureToLegacyAudience(
      legacyForumAsset.id,
      owner.profileId,
      fixtureAssetName(fixture, 'legacy-forum')
    );
    const legacyForumDenied = await outsiderContext.get(
      `${origin}/api/asset/${legacyForumAsset.id}`
    );
    expect([401, 403, 404], 'legacy private forum image').toContain(
      legacyForumDenied.status()
    );

    const decodedDimensions = await ownerPage.evaluate(async (assetUrl) => {
      const image = new Image();
      image.src = assetUrl;
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, `${origin}/api/asset/${forumAssetId}`);
    expect(decodedDimensions).toEqual({ width: 2, height: 2 });

    const cases = [
      { label: 'social anonymous', request: anonymous, id: socialAsset.id },
      {
        label: 'social non-follower',
        request: outsiderContext,
        id: socialAsset.id,
      },
      { label: 'forum anonymous', request: anonymous, id: forumAssetId! },
      { label: 'forum non-owner', request: outsiderContext, id: forumAssetId! },
      {
        label: 'private community outsider',
        request: outsiderContext,
        id: communityAsset.id,
      },
    ];
    const positiveCases = [
      {
        label: 'social current follower',
        request: followerContext,
        id: socialAsset.id,
      },
      {
        label: 'private forum owner',
        request: ownerContext,
        id: forumAssetId!,
      },
      {
        label: 'private community member',
        request: followerContext,
        id: communityAsset.id,
      },
    ];
    for (const item of positiveCases) {
      const response = await item.request.get(`${origin}/api/asset/${item.id}`);
      const bytes = await response.body();
      expect(response.status(), item.label).toBe(200);
      expect(bytes.subarray(0, 8), item.label).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    }
    const evidence: Array<{
      label: string;
      status: number;
      bytes: number;
      signature: string;
    }> = [];
    for (const item of cases) {
      const response = await item.request.get(`${origin}/api/asset/${item.id}`);
      const bytes = await response.body();
      evidence.push({
        label: item.label,
        status: response.status(),
        bytes: bytes.byteLength,
        signature: bytes.subarray(0, 8).toString('hex'),
      });
      expect.soft([401, 403, 404], item.label).toContain(response.status());
      expect
        .soft(bytes.subarray(0, 8), item.label)
        .not.toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        );
    }
    console.log(`RR08-A02 sanitized asset probe: ${JSON.stringify(evidence)}`);

    const publicAsset = await upload(
      ownerContext,
      owner.profileId,
      `${fixture}-public.png`
    );
    assetIds.push(publicAsset.id);
    const publicRange = await anonymous.get(
      `${origin}/api/asset/${publicAsset.id}`,
      { headers: { ...headers, range: 'bytes=0-7' } }
    );
    expect(publicRange.status()).toBe(206);
    expect(publicRange.headers()['cache-control']).toContain('no-store');
    expect(publicRange.headers()['content-range']).toMatch(/^bytes 0-7\//);
    expect((await publicRange.body()).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );

    const contentEvidence: Array<{
      label: string;
      status: number;
      bytes: number;
      containsFixture: boolean;
      containsAssetUrl: boolean;
    }> = [];
    for (const [label, request, path] of [
      ['social owner', ownerContext, `/api/social/post/${socialPostId}`],
      ['social follower', followerContext, `/api/social/post/${socialPostId}`],
      [
        'private community owner',
        ownerContext,
        `/api/social/post/${communityPostId}`,
      ],
      [
        'private community member',
        followerContext,
        `/api/social/post/${communityPostId}`,
      ],
      ['forum owner', ownerContext, `/api/forum/post/${forumPostId}`],
      ['social outsider', outsiderContext, `/api/social/post/${socialPostId}`],
      [
        'private community outsider',
        outsiderContext,
        `/api/social/post/${communityPostId}`,
      ],
      ['forum outsider', outsiderContext, `/api/forum/post/${forumPostId}`],
      ['legacy social owner', ownerContext, `/api/social/post/${legacyPostId}`],
    ] as const) {
      const response = await request.get(origin + path, { headers });
      const text = await response.text();
      contentEvidence.push({
        label,
        status: response.status(),
        bytes: Buffer.byteLength(text),
        containsFixture: text.includes(fixture),
        containsAssetUrl:
          text.includes(`${origin}/api/asset/${socialAsset.id}`) ||
          text.includes(`${origin}/api/asset/${communityAsset.id}`) ||
          text.includes(`${origin}/api/asset/${legacyAssetId}`) ||
          (forumAssetId ? text.includes(`/api/asset/${forumAssetId}`) : false),
      });
      if (
        label === 'social owner' ||
        label === 'social follower' ||
        label === 'private community owner' ||
        label === 'private community member' ||
        label === 'forum owner' ||
        label === 'legacy social owner'
      ) {
        expect.soft(response.status(), label).toBe(200);
        if (label !== 'forum owner') {
          expect.soft(text, label).toContain(fixture);
        }
      } else {
        // Social reads can return an empty 200 for an inaccessible record.
        // Status alone is not evidence of content disclosure or denial.
        if (response.status() === 200) {
          expect.soft(Buffer.byteLength(text), `${label} empty 200`).toBe(0);
        } else {
          expect.soft([401, 403, 404], label).toContain(response.status());
        }
        expect.soft(text, label).not.toContain(fixture);
        for (const privateAssetId of [
          socialAsset.id,
          communityAsset.id,
          legacyAssetId,
          forumAssetId,
        ]) {
          if (privateAssetId) {
            expect
              .soft(
                text,
                `${label} must not expose private asset ${privateAssetId}`
              )
              .not.toContain(`/api/asset/${privateAssetId}`);
          }
        }
      }
      if (label === 'social owner') {
        expect
          .soft(text, 'social owner response saves the uploaded image URL')
          .toContain(`${origin}/api/asset/${socialAsset.id}`);
      }
      if (label === 'forum owner') {
        expect
          .soft(
            text,
            'private forum reply readback keeps the exact uploaded URL'
          )
          .toContain(`/api/asset/${forumAssetId}`);
      }
      if (label === 'private community member') {
        expect
          .soft(text, 'saved community post preserves the uploaded URL')
          .toContain(`${origin}/api/asset/${communityAsset.id}`);
      }
      if (label === 'legacy social owner') {
        expect
          .soft(text, 'legacy post readback preserves the uploaded URL')
          .toContain(`${origin}/api/asset/${legacyAssetId}`);
      }
    }
    console.log(
      `RR08-A02 sanitized content probe: ${JSON.stringify(contentEvidence)}`
    );

    resetExactFixtureToLegacyAudience(
      legacyAsset.id,
      owner.profileId,
      fixtureAssetName(fixture, 'legacy-public')
    );
    const legacyDenied = await outsiderContext.get(
      `${origin}/api/asset/${legacyAssetId}`
    );
    expect([401, 403, 404], 'untagged legacy followers image').toContain(
      legacyDenied.status()
    );
    if (legacyPostId) {
      const removed = await ownerContext.delete(
        `${origin}/api/social/post/${legacyPostId}`,
        { headers }
      );
      expect([200, 204], await removed.text()).toContain(removed.status());
      legacyPostId = undefined;
    }
    const afterReferenceDrop = await outsiderContext.get(
      `${origin}/api/asset/${legacyAssetId}`
    );
    expect(
      [401, 403, 404],
      'legacy image stays restricted after reference deletion'
    ).toContain(afterReferenceDrop.status());
    if (legacyForumPostId) {
      const removedForumReference = await ownerContext.delete(
        `${origin}/api/forum/post/${legacyForumPostId}`,
        { headers }
      );
      const removeForumBody = await removedForumReference.text();
      if (![200, 204].includes(removedForumReference.status())) {
        throw new Error(
          `Delete exact private forum post reference failed with status ${removedForumReference.status()}: ${removeForumBody}`
        );
      }
      legacyForumPostId = undefined;
    }
    const afterForumReferenceDrop = await outsiderContext.get(
      `${origin}/api/asset/${legacyForumAssetId}`
    );
    expect(
      [401, 403, 404],
      'legacy forum image stays restricted after reference deletion'
    ).toContain(afterForumReferenceDrop.status());

    const leave = await followerContext.post(
      `${origin}/api/social/community/${communityId}/leave`,
      { headers }
    );
    expect(leave.status(), await leave.text()).toBe(201);
    const formerMemberRead = await followerContext.get(
      `${origin}/api/asset/${communityAsset.id}`
    );
    const formerMemberBytes = await formerMemberRead.body();
    expect([401, 403, 404], 'former community member').toContain(
      formerMemberRead.status()
    );
    expect(formerMemberBytes.subarray(0, 8)).not.toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const formerMemberContent = await followerContext.get(
      origin + `/api/social/post/${communityPostId}`,
      { headers }
    );
    const formerMemberContentBody = await formerMemberContent.text();
    if (formerMemberContent.status() === 200) {
      expect(formerMemberContentBody).toHaveLength(0);
    } else {
      expect([401, 403, 404]).toContain(formerMemberContent.status());
    }
    expect(formerMemberContentBody).not.toContain(fixture);
    expect(formerMemberContentBody).not.toContain(
      `/api/asset/${communityAsset.id}`
    );

    const unfollow = await followerContext.post(
      origin + '/api/social/follow/unfollow',
      {
        headers,
        data: { followerId: follower.profileId, followeeId: owner.profileId },
      }
    );
    expect([200, 201], await unfollow.text()).toContain(unfollow.status());
    const formerFollowerRead = await followerContext.get(
      `${origin}/api/asset/${socialAsset.id}`
    );
    const formerFollowerBytes = await formerFollowerRead.body();
    expect([401, 403, 404], 'former follower').toContain(
      formerFollowerRead.status()
    );
    expect(formerFollowerBytes.subarray(0, 8)).not.toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  } finally {
    // Use owning APIs for exact tagged fixture cleanup; accounts are isolated
    // local release fixtures and are not enumerated or bulk-deleted.
    if (forumPostId) {
      await ownerContext
        .delete(origin + `/api/forum/post/${forumPostId}`, { headers })
        .catch(() => undefined);
    }
    if (legacyForumPostId) {
      await ownerContext
        .delete(origin + `/api/forum/post/${legacyForumPostId}`, { headers })
        .catch(() => undefined);
    }
    if (threadId) {
      await ownerContext
        .delete(origin + `/api/forum/thread/${threadId}`, { headers })
        .catch(() => undefined);
    }
    if (topicId) {
      await ownerContext
        .delete(origin + `/api/forum/topic/${topicId}`, { headers })
        .catch(() => undefined);
    }
    if (socialPostId) {
      await ownerContext
        .delete(origin + `/api/social/post/${socialPostId}`, { headers })
        .catch(() => undefined);
    }
    if (legacyPostId) {
      await ownerContext
        .delete(origin + `/api/social/post/${legacyPostId}`, { headers })
        .catch(() => undefined);
    }
    if (communityPostId) {
      await ownerContext
        .delete(origin + `/api/social/post/${communityPostId}`, { headers })
        .catch(() => undefined);
    }
    if (communityId) {
      if (communityMemberId) {
        await ownerContext
          .delete(
            origin + `/api/social/community/members/${communityMemberId}`,
            { headers, data: { profileId: 'former-member', communityId } }
          )
          .catch(() => undefined);
      }
      await ownerContext
        .delete(origin + `/api/social/community/${communityId}`, { headers })
        .catch(() => undefined);
    }
    for (const id of assetIds) {
      await ownerContext
        .delete(origin + `/api/asset/${id}`, { headers })
        .catch(() => undefined);
    }
    await Promise.all([
      ownerContext.dispose(),
      followerContext.dispose(),
      outsiderContext.dispose(),
      anonymous.dispose(),
    ]);
    await ownerPage?.close();
  }
});
