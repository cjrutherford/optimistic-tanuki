import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

test.skip(
  process.env['RR04_LIVE_STACK'] !== 'true',
  'Requires the existing development stack'
);

const origin = 'http://127.0.0.1:8080';
const password = 'RR04-local-test-password!';
const headers = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};
const socialHeaders = {
  'x-ot-app-id': 'social',
  'x-ot-appscope': 'social',
};

function recordFixture(fixture: Record<string, string | undefined>) {
  const directory = join(
    process.cwd(),
    '.runtime-artifacts',
    'rr04-i03-evidence'
  );
  mkdirSync(directory, { recursive: true });
  appendFileSync(
    join(directory, 'fixture-journal.jsonl'),
    JSON.stringify({ createdAt: new Date().toISOString(), ...fixture }) + '\n',
    { mode: 0o600 }
  );
}

async function account(request: APIRequestContext, suffix: string) {
  const email = `rr04-i03-${Date.now()}-${suffix}@example.test`;
  const registration = await request.post(
    origin + '/api/authentication/register',
    {
      headers,
      data: {
        fn: 'RR04',
        ln: suffix,
        email,
        password,
        confirm: password,
        bio: 'Local RR04 I03 privacy acceptance',
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
  expect(session.status(), await session.text()).toBe(200);
  const user = (await session.json()).data;
  recordFixture({
    type: 'account',
    ownerProfileId: user.profileId,
    ownerUserId: user.userId,
    name: suffix,
  });
  return { email, ...user };
}

async function socialCommand<T>(command: string, data: unknown): Promise<T> {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  await client.connect();
  try {
    return await firstValueFrom(client.send({ cmd: command }, data));
  } finally {
    client.close();
  }
}

async function createPost(
  author: { userId: string; profileId: string },
  marker: string,
  visibility: 'public' | 'followers' | 'community',
  communityId?: string
) {
  const post = await socialCommand<{ id: string }>('CREATE_POST', {
    title: marker,
    content: marker,
    visibility,
    userId: author.userId,
    profileId: author.profileId,
    appScope: 'social',
    ...(communityId ? { communityId } : {}),
  });
  recordFixture({
    type: 'post',
    id: post.id,
    ownerProfileId: author.profileId,
    ownerUserId: author.userId,
    name: marker,
  });
  return post;
}

async function deletePost(owner: APIRequestContext, id?: string) {
  if (!id) return;
  const response = await owner.delete(origin + `/api/social/post/${id}`, {
    headers,
  });
  expect(response.status(), await response.text()).toBe(200);
}

async function signIn(page: Page, email: string) {
  await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test('RR04 I03 API: notification previews stay generic after access loss and mutations stay recipient-owned', async ({
  playwright,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'API gate runs once');
  test.setTimeout(90000);
  const authorContext = await playwright.request.newContext();
  const recipientContext = await playwright.request.newContext();
  const attackerContext = await playwright.request.newContext();
  let postId: string | undefined;
  let notificationId: string | undefined;
  let following = false;
  let authorProfileId: string | undefined;
  let recipientProfileId: string | undefined;
  try {
    const author = await test.step('register notification post owner', () =>
      account(authorContext, 'notification-author'));
    const recipient = await test.step('register notification recipient', () =>
      account(recipientContext, 'notification-recipient'));
    authorProfileId = author.profileId;
    recipientProfileId = recipient.profileId;
    await test.step('register separate notification attacker', () =>
      account(attackerContext, 'notification-attacker'));

    const marker = `RR04-I03 notification private marker ${Date.now()}`;
    const post = await createPost(author, marker, 'followers');
    postId = post.id;
    const follow = {
      followerId: recipient.profileId,
      followeeId: author.profileId,
    };
    const followResponse = await recipientContext.post(
      origin + '/api/social/follow',
      { headers, data: follow }
    );
    expect(followResponse.status(), await followResponse.text()).toBe(201);
    following = true;
    const sharedPostUrl = origin + `/api/social/post/${post.id}/shared`;
    expect(await (await recipientContext.get(sharedPostUrl)).text()).toContain(
      marker
    );

    const createNotification = await authorContext.post(
      origin + '/api/notifications',
      {
        headers,
        data: {
          recipientId: recipient.profileId,
          type: 'mention',
          title: 'You were mentioned',
          body: 'Someone mentioned you in a post',
          senderId: author.profileId,
          resourceType: 'post',
          resourceId: post.id,
          actionUrl: `/feed/post/${post.id}`,
        },
      }
    );
    expect(createNotification.status(), await createNotification.text()).toBe(
      201
    );
    notificationId = (await createNotification.json()).id;
    recordFixture({
      type: 'notification',
      id: notificationId,
      ownerProfileId: recipient.profileId,
      name: 'mention preview visibility fixture',
    });

    const notificationsUrl =
      origin + `/api/notifications/${recipient.profileId}`;
    const beforeLossResponse = await recipientContext.get(notificationsUrl);
    expect(beforeLossResponse.status(), await beforeLossResponse.text()).toBe(
      200
    );
    const beforeLoss = (await beforeLossResponse.json()).find(
      (item: any) => item.id === notificationId
    );
    expect(beforeLoss).toMatchObject({
      type: 'mention',
      body: 'Someone mentioned you in a post',
      resourceType: 'post',
      resourceId: post.id,
      actionUrl: `/feed/post/${post.id}`,
      isRead: false,
    });
    expect(JSON.stringify(beforeLoss)).not.toContain(marker);

    const unfollow = await recipientContext.post(
      origin + '/api/social/follow/unfollow',
      { headers, data: follow }
    );
    expect(unfollow.status(), await unfollow.text()).toBe(201);
    following = false;
    expect(
      await (await recipientContext.get(sharedPostUrl)).text()
    ).not.toContain(marker);

    const afterLossResponse = await recipientContext.get(notificationsUrl);
    expect(afterLossResponse.status(), await afterLossResponse.text()).toBe(
      200
    );
    const afterLoss = (await afterLossResponse.json()).find(
      (item: any) => item.id === notificationId
    );
    expect(afterLoss).toMatchObject({
      type: 'mention',
      body: 'Someone mentioned you in a post',
      resourceType: 'post',
      resourceId: post.id,
      actionUrl: `/feed/post/${post.id}`,
      isRead: false,
    });
    expect(JSON.stringify(afterLoss)).not.toContain(marker);

    const attackerRead = await attackerContext.put(
      origin + `/api/notifications/${notificationId}/read`,
      { headers }
    );
    expect(attackerRead.status(), await attackerRead.text()).toBe(404);
    const stillUnreadResponse = await recipientContext.get(notificationsUrl);
    expect(
      (await stillUnreadResponse.json()).find(
        (item: any) => item.id === notificationId
      ).isRead
    ).toBe(false);

    const attackerDelete = await attackerContext.delete(
      origin + `/api/notifications/${notificationId}`,
      { headers }
    );
    expect(attackerDelete.status(), await attackerDelete.text()).toBe(404);
    expect(
      (await (await recipientContext.get(notificationsUrl)).json()).some(
        (item: any) => item.id === notificationId
      )
    ).toBe(true);

    const ownerRead = await recipientContext.put(
      origin + `/api/notifications/${notificationId}/read`,
      { headers }
    );
    expect(ownerRead.status(), await ownerRead.text()).toBe(200);
    expect(
      (await (await recipientContext.get(notificationsUrl)).json()).find(
        (item: any) => item.id === notificationId
      ).isRead
    ).toBe(true);
    const ownerDelete = await recipientContext.delete(
      origin + `/api/notifications/${notificationId}`,
      { headers }
    );
    expect(ownerDelete.status(), await ownerDelete.text()).toBe(200);
    notificationId = undefined;
  } finally {
    if (following && authorProfileId && recipientProfileId) {
      await recipientContext
        .post(origin + '/api/social/follow/unfollow', {
          headers,
          data: {
            followerId: recipientProfileId,
            followeeId: authorProfileId,
          },
        })
        .catch(() => undefined);
    }
    if (notificationId) {
      await recipientContext.delete(
        origin + `/api/notifications/${notificationId}`,
        { headers }
      );
    }
    if (postId) await deletePost(authorContext, postId);
    await Promise.all([
      authorContext.dispose(),
      recipientContext.dispose(),
      attackerContext.dispose(),
    ]);
  }
});

test('RR04 I03 API: either direction of a block removes member-only community content', async ({
  playwright,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'API gate runs once');
  test.setTimeout(90000);
  const ownerContext = await playwright.request.newContext();
  const memberContext = await playwright.request.newContext();
  let communityId: string | undefined;
  let postId: string | undefined;
  let ownerProfileId: string | undefined;
  let memberProfileId: string | undefined;
  let ownerBlockedMember = false;
  let memberBlockedOwner = false;
  try {
    const owner = await test.step('register community post owner', () =>
      account(ownerContext, 'block-owner'));
    const member = await test.step('register approved member', () =>
      account(memberContext, 'block-member'));
    ownerProfileId = owner.profileId;
    memberProfileId = member.profileId;
    const communityName = `RR04 I03 block community ${Date.now()}`;
    const communityResponse = await ownerContext.post(
      origin + '/api/social/community',
      {
        headers: socialHeaders,
        data: {
          name: communityName,
          isPrivate: false,
          joinPolicy: 'public',
          createChatRoom: false,
        },
      }
    );
    expect(communityResponse.status(), await communityResponse.text()).toBe(
      201
    );
    const community = await communityResponse.json();
    communityId = community.id;
    recordFixture({
      type: 'community',
      id: community.id,
      ownerProfileId: owner.profileId,
      ownerUserId: owner.userId,
      name: communityName,
    });
    const join = await memberContext.post(
      origin + `/api/social/community/${community.id}/join`,
      { headers: socialHeaders }
    );
    expect(join.status(), await join.text()).toBe(201);
    const membership = await join.json();
    recordFixture({
      type: 'community-membership',
      id: membership.id,
      ownerProfileId: member.profileId,
      ownerUserId: member.userId,
      name: communityName,
    });

    const marker = `RR04-I03 community block marker ${Date.now()}`;
    const post = await createPost(owner, marker, 'community', community.id);
    postId = post.id;
    const postUrl = origin + `/api/social/post/${post.id}/shared`;
    expect(await (await memberContext.get(postUrl)).text()).toContain(marker);

    const ownerBlocksMember = await ownerContext.post(
      origin + '/api/privacy/block',
      { headers, data: { blockedId: member.profileId } }
    );
    expect(ownerBlocksMember.status(), await ownerBlocksMember.text()).toBe(
      201
    );
    ownerBlockedMember = true;
    expect(await (await memberContext.get(postUrl)).text()).not.toContain(
      marker
    );

    const ownerUnblocksMember = await ownerContext.delete(
      origin + `/api/privacy/block/${member.profileId}`,
      { headers }
    );
    expect(ownerUnblocksMember.status(), await ownerUnblocksMember.text()).toBe(
      200
    );
    ownerBlockedMember = false;
    const memberBlocksOwner = await memberContext.post(
      origin + '/api/privacy/block',
      { headers, data: { blockedId: owner.profileId } }
    );
    expect(memberBlocksOwner.status(), await memberBlocksOwner.text()).toBe(
      201
    );
    memberBlockedOwner = true;
    expect(await (await memberContext.get(postUrl)).text()).not.toContain(
      marker
    );
    expect(await (await ownerContext.get(postUrl)).text()).toContain(marker);
  } finally {
    if (ownerBlockedMember && memberProfileId) {
      await ownerContext.delete(
        origin + `/api/privacy/block/${memberProfileId}`,
        { headers }
      );
    }
    if (memberBlockedOwner && ownerProfileId) {
      await memberContext.delete(
        origin + `/api/privacy/block/${ownerProfileId}`,
        { headers }
      );
    }
    if (communityId) {
      if (postId) await deletePost(ownerContext, postId);
      const deletedCommunity = await ownerContext.delete(
        origin + `/api/social/community/${communityId}`,
        { headers: socialHeaders }
      );
      expect(deletedCommunity.status(), await deletedCommunity.text()).toBe(
        200
      );
    }
    const priorRPCFixtures = await socialCommand<
      Array<{ id: string; name: string; ownerId: string }>
    >('FIND_MANY_COMMUNITY', {
      criteria: { name: 'RR04 I03 block community' },
      appScope: 'social',
    });
    for (const fixture of priorRPCFixtures) {
      if (fixture.id === communityId || !fixture.ownerId) continue;
      recordFixture({
        type: 'legacy-rpc-community-cleanup',
        id: fixture.id,
        ownerUserId: fixture.ownerId,
        name: fixture.name,
      });
    }
    await Promise.all([ownerContext.dispose(), memberContext.dispose()]);
  }
});

test('RR04 I03 browser: follow controls switch feed membership while Explore stays separate', async ({
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  const viewport = testInfo.project.use.viewport;
  const authorContext = await browser.newContext({ viewport });
  const readerContext = await browser.newContext({ viewport });
  let publicPostId: string | undefined;
  let followersPostId: string | undefined;
  let following = false;
  let authorProfileId: string | undefined;
  let readerProfileId: string | undefined;
  try {
    const author = await account(authorContext.request, 'follow-author');
    const reader = await account(readerContext.request, 'follow-reader');
    authorProfileId = author.profileId;
    readerProfileId = reader.profileId;
    const publicMarker = `RR04-I03 public feed marker ${Date.now()}`;
    const followersMarker = `RR04-I03 following feed marker ${Date.now()}`;
    publicPostId = (await createPost(author, publicMarker, 'public')).id;
    followersPostId = (await createPost(author, followersMarker, 'followers'))
      .id;

    await readerContext.clearCookies();
    const page = await readerContext.newPage();
    await signIn(page, reader.email);
    await page.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });

    const publicCard = page.locator('.post-container').filter({
      hasText: publicMarker,
    });
    await expect(publicCard).toBeVisible();
    await publicCard.locator('otui-dropdown button.dropdown-trigger').click();
    await publicCard
      .getByRole('button', { name: 'Follow', exact: true })
      .click();
    following = true;

    await page.getByRole('button', { name: 'Following Feed' }).click();
    await expect(
      page.locator('.post-container').filter({ hasText: followersMarker })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Public Feed' }).click();
    await expect(
      page.locator('.post-container').filter({ hasText: followersMarker })
    ).toHaveCount(0);

    await page.goto(origin + '/explore', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Explore' })).toBeVisible();
    await expect(page.getByText(publicMarker, { exact: false })).toHaveCount(0);
    await expect(page.getByText(followersMarker, { exact: false })).toHaveCount(
      0
    );

    await page.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });
    const updatedPublicCard = page.locator('.post-container').filter({
      hasText: publicMarker,
    });
    await expect(updatedPublicCard).toBeVisible();
    await updatedPublicCard
      .locator('otui-dropdown button.dropdown-trigger')
      .click();
    await updatedPublicCard
      .getByRole('button', { name: 'Unfollow', exact: true })
      .click();
    following = false;
    await page.getByRole('button', { name: 'Following Feed' }).click();
    await expect(
      page.locator('.post-container').filter({ hasText: followersMarker })
    ).toHaveCount(0);
  } finally {
    if (following && readerProfileId && authorProfileId) {
      await readerContext.request.post(origin + '/api/social/follow/unfollow', {
        headers,
        data: {
          followerId: readerProfileId,
          followeeId: authorProfileId,
        },
      });
    }
    if (authorProfileId) {
      await deletePost(authorContext.request, followersPostId);
      await deletePost(authorContext.request, publicPostId);
    }
    await Promise.all([authorContext.close(), readerContext.close()]);
  }
});
