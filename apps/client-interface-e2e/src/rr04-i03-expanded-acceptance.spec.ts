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
        bio: 'Local RR04 I03 acceptance fixture',
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

async function authenticateAccount(request: APIRequestContext, email: string) {
  const login = await request.post(origin + '/api/authentication/login', {
    headers: { ...headers, 'x-ot-session-mode': 'cookie' },
    data: { email, password },
  });
  expect(login.status(), `Cookie login status for ${email}`).toBe(201);
  const session = await request.get(origin + '/api/authentication/session', {
    headers,
  });
  expect(session.status(), `Cookie session status for ${email}`).toBe(200);
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
  const loginResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === '/api/authentication/login' &&
      response.request().method() === 'POST'
    );
  });
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  const response = await loginResponse;
  expect(response.status(), `Browser login status for ${email}`).toBe(201);
  await expect(page).not.toHaveURL(/\/login$/);
}

test('RR04 I03 API: primary feed pages stay chronological after engagement changes', async ({
  playwright,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'API gate runs once');
  test.setTimeout(90000);
  const authorContext = await playwright.request.newContext();
  const readerContext = await playwright.request.newContext();
  let postIds: string[] = [];
  let voteCreated = false;
  let authorProfileId: string | undefined;
  let reader: any;
  try {
    const author = await test.step('register timeline author', () =>
      account(authorContext, 'timeline-author'));
    reader = await test.step('register timeline reader', () =>
      account(readerContext, 'timeline-reader'));
    authorProfileId = author.profileId;
    const oldest = await createPost(
      author,
      `RR04-I03 timeline oldest ${Date.now()}`,
      'public'
    );
    const middle = await createPost(
      author,
      `RR04-I03 timeline middle ${Date.now()}`,
      'public'
    );
    const newest = await createPost(
      author,
      `RR04-I03 timeline newest ${Date.now()}`,
      'public'
    );
    postIds = [oldest.id, middle.id, newest.id];

    const vote = await readerContext.post(origin + '/api/social/vote', {
      headers: socialHeaders,
      data: {
        postId: oldest.id,
        profileId: reader.profileId,
        userId: reader.userId,
        value: 1,
      },
    });
    expect(vote.status(), await vote.text()).toBe(201);
    voteCreated = true;
    recordFixture({
      type: 'vote',
      id: oldest.id,
      ownerProfileId: reader.profileId,
      ownerUserId: reader.userId,
      name: 'timeline oldest post vote',
    });

    const readPage = async (offset: number, limit = 2) => {
      const response = await readerContext.get(
        origin +
          `/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false&limit=${limit}&offset=${offset}`,
        { headers: socialHeaders }
      );
      expect(response.status(), await response.text()).toBe(200);
      return (await response.json()) as Array<{ id: string }>;
    };
    const targetIds = [newest.id, middle.id, oldest.id];
    const completeWindow: Array<{ id: string }> = [];
    for (let offset = 0; offset < 5000; offset += 100) {
      const page = await readPage(offset, 100);
      completeWindow.push(...page);
      if (targetIds.every((id) => page.some((post) => post.id === id))) break;
      if (page.length < 100) break;
    }
    const positions = targetIds.map((id) =>
      completeWindow.findIndex((post) => post.id === id)
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(positions[1]).toBeLessThan(positions[2]);

    const pageOffsets = [
      ...new Set(positions.map((position) => Math.floor(position / 2) * 2)),
    ];
    const observedPages = await Promise.all(
      pageOffsets.map((offset) => readPage(offset, 2))
    );
    const pagedIds = observedPages.flatMap((page) =>
      page.map((post) => post.id)
    );
    const pagedTargets = pagedIds.filter((id) => targetIds.includes(id));
    expect(pagedTargets).toEqual(targetIds);
    expect(new Set(pagedIds).size).toBe(pagedIds.length);
  } finally {
    if (voteCreated && reader?.userId) {
      await readerContext.post(origin + '/api/social/vote', {
        headers: socialHeaders,
        data: {
          postId: postIds[0],
          profileId: reader.profileId,
          userId: reader.userId,
          value: 0,
        },
      });
    }
    if (authorProfileId) {
      for (const id of postIds.reverse()) await deletePost(authorContext, id);
    }
    await Promise.all([authorContext.dispose(), readerContext.dispose()]);
  }
});

test('RR04 I03 API: a stored share disappears after source deletion and scheduled posts stay unpublished', async ({
  playwright,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'API gate runs once');
  test.setTimeout(90000);
  const authorContext = await playwright.request.newContext();
  const sharerContext = await playwright.request.newContext();
  const readerContext = await playwright.request.newContext();
  let sourcePostId: string | undefined;
  let shareId: string | undefined;
  let scheduledPostId: string | undefined;
  let scheduledPublished = false;
  let author: any;
  try {
    author = await test.step('register source owner', () =>
      account(authorContext, 'share-source-owner'));
    const sharer = await test.step('register independent sharer', () =>
      account(sharerContext, 'share-source-reader'));
    await test.step('register scheduled-post reader', () =>
      account(readerContext, 'scheduled-reader'));

    const sourceMarker = `RR04-I03 shared source ${Date.now()}`;
    const source = await createPost(author, sourceMarker, 'public');
    sourcePostId = source.id;
    const createShare = await sharerContext.post(
      origin + `/api/posts/${source.id}/share`,
      { headers: socialHeaders, data: { visibility: 'public' } }
    );
    expect(createShare.status(), await createShare.text()).toBe(201);
    const share = await createShare.json();
    shareId = share.id;
    recordFixture({
      type: 'share',
      id: shareId,
      ownerProfileId: sharer.profileId,
      ownerUserId: sharer.userId,
      name: 'share of source post',
    });
    const beforeDelete = await sharerContext.get(
      origin + `/api/posts/profile/${sharer.profileId}/shared`,
      { headers: socialHeaders }
    );
    expect(beforeDelete.status(), await beforeDelete.text()).toBe(200);
    const shareRows = (await beforeDelete.json()) as Array<{
      id: string;
      originalPostId: string;
      sharedById: string;
      visibility: string;
    }>;
    expect(shareRows.find((row) => row.id === shareId)).toMatchObject({
      id: shareId,
      originalPostId: source.id,
      sharedById: sharer.profileId,
      visibility: 'public',
    });
    const visibleSource = await sharerContext.get(
      origin + `/api/social/post/${source.id}/shared`,
      { headers: socialHeaders }
    );
    expect(visibleSource.status(), await visibleSource.text()).toBe(200);
    expect(await visibleSource.text()).toContain(sourceMarker);

    await deletePost(authorContext, source.id);
    sourcePostId = undefined;
    const afterDelete = await sharerContext.get(
      origin + `/api/posts/profile/${sharer.profileId}/shared`,
      { headers: socialHeaders }
    );
    expect(afterDelete.status(), await afterDelete.text()).toBe(200);
    const survivingShares = (await afterDelete.json()) as Array<{ id: string }>;
    expect(survivingShares.some((row) => row.id === shareId)).toBe(false);
    const deletedSourceDirect = await readerContext.get(
      origin + `/api/social/post/${source.id}/shared`,
      { headers: socialHeaders }
    );
    expect(await deletedSourceDirect.text()).not.toContain(sourceMarker);
    const sharedSourceInFeed = await readerContext.get(
      origin +
        '/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false&limit=100',
      { headers: socialHeaders }
    );
    expect(sharedSourceInFeed.status(), await sharedSourceInFeed.text()).toBe(
      200
    );
    expect(await sharedSourceInFeed.text()).not.toContain(sourceMarker);
    const sharedSourceSearch = await readerContext.post(
      origin + '/api/social/post/find',
      {
        headers: socialHeaders,
        data: { criteria: { title: sourceMarker } },
      }
    );
    expect(sharedSourceSearch.status(), await sharedSourceSearch.text()).toBe(
      201
    );
    expect(await sharedSourceSearch.text()).not.toContain(sourceMarker);

    const scheduledMarker = `RR04-I03 scheduled unpublished ${Date.now()}`;
    const scheduled = await socialCommand<{ id: string }>(
      'CREATE_SCHEDULED_POST',
      {
        title: scheduledMarker,
        content: scheduledMarker,
        profileId: author.profileId,
        userId: author.userId,
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        visibility: 'public',
      }
    );
    scheduledPostId = scheduled.id;
    recordFixture({
      type: 'scheduled-post',
      id: scheduled.id,
      ownerProfileId: author.profileId,
      ownerUserId: author.userId,
      name: scheduledMarker,
    });
    const scheduledReadback = await socialCommand<{
      id: string;
      isScheduled: boolean;
      scheduledAt: string | Date;
      visibility: string;
      communityId?: string | null;
    }>('FIND_SCHEDULED_POST', { id: scheduled.id });
    expect(scheduledReadback).toMatchObject({
      id: scheduled.id,
      isScheduled: true,
      visibility: 'public',
      communityId: null,
    });
    expect(new Date(scheduledReadback.scheduledAt).getTime()).toBeGreaterThan(
      Date.now()
    );

    const feed = await readerContext.get(
      origin +
        '/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false&limit=100',
      { headers: socialHeaders }
    );
    expect(feed.status(), await feed.text()).toBe(200);
    expect(await feed.text()).not.toContain(scheduledMarker);
    const search = await readerContext.post(origin + '/api/social/post/find', {
      headers: socialHeaders,
      data: { criteria: { title: scheduledMarker } },
    });
    expect(search.status(), await search.text()).toBe(201);
    expect(await search.text()).not.toContain(scheduledMarker);
    const direct = await readerContext.get(
      origin + `/api/social/post/${scheduled.id}/shared`,
      { headers: socialHeaders }
    );
    expect([200, 404]).toContain(direct.status());
    expect(await direct.text()).not.toContain(scheduledMarker);
    const published = await socialCommand<{
      id: string;
      isScheduled: boolean;
      scheduledAt: string | null;
    }>('PUBLISH_SCHEDULED_POST', { id: scheduled.id });
    scheduledPublished = true;
    expect(published).toMatchObject({
      id: scheduled.id,
      isScheduled: false,
      scheduledAt: null,
    });
    const publishedDirect = await readerContext.get(
      origin + `/api/social/post/${scheduled.id}/shared`,
      { headers: socialHeaders }
    );
    expect(await publishedDirect.text()).toContain(scheduledMarker);
    const publishedSearch = await readerContext.post(
      origin + '/api/social/post/find',
      {
        headers: socialHeaders,
        data: { criteria: { title: scheduledMarker } },
      }
    );
    expect(publishedSearch.status(), await publishedSearch.text()).toBe(201);
    expect(await publishedSearch.text()).toContain(scheduledMarker);
  } finally {
    if (sourcePostId) await deletePost(authorContext, sourcePostId);
    if (scheduledPostId) {
      if (scheduledPublished) {
        await deletePost(authorContext, scheduledPostId);
      } else {
        await socialCommand('DELETE_SCHEDULED_POST', { id: scheduledPostId });
      }
    }
    if (shareId) {
      await sharerContext.delete(origin + `/api/posts/shares/${shareId}`, {
        headers: socialHeaders,
      });
    }
    await Promise.all([
      authorContext.dispose(),
      sharerContext.dispose(),
      readerContext.dispose(),
    ]);
  }
});

test('RR04 I03 browser: owner moderation hides and restores an otherwise public community post across read surfaces', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Moderation gate runs once'
  );
  test.setTimeout(150000);
  const viewport = testInfo.project.use.viewport;
  const ownerContext = await browser.newContext({ viewport });
  const reporterContext = await browser.newContext({ viewport });
  const outsideContext = await browser.newContext({ viewport });
  let communityId: string | undefined;
  let postId: string | undefined;
  let commentId: string | undefined;
  let notificationId: string | undefined;
  let reportId: string | undefined;
  let communityName: string | undefined;
  let postHidden = false;
  let ownerProfileId: string | undefined;
  let ownerUserId: string | undefined;
  let reporterProfileId: string | undefined;

  const moderate = async (moderationStatus: 'hidden' | 'visible') => {
    const response = await ownerContext.request.put(
      origin + `/api/privacy/admin/moderation?communityId=${communityId}`,
      {
        headers: socialHeaders,
        data: {
          contentType: 'post',
          contentId: postId,
          reportId,
          moderationStatus,
          adminNotes: `RR04-I03 controlled ${moderationStatus} state`,
        },
      }
    );
    expect(response.status(), await response.text()).toBe(200);
    postHidden = moderationStatus === 'hidden';
    recordFixture({
      type: `moderation-${moderationStatus}`,
      id: postId,
      ownerProfileId,
      ownerUserId,
      name: `report:${reportId}`,
    });
  };

  const readPost = async (
    request: APIRequestContext,
    marker: string,
    commentMarker: string
  ) => {
    const direct = await request.get(
      origin + `/api/social/post/${postId}/shared`,
      { headers: socialHeaders }
    );
    expect(await direct.text()).toContain(marker);
    const feed = await request.get(
      origin +
        '/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false&limit=100',
      { headers: socialHeaders }
    );
    expect(feed.status(), await feed.text()).toBe(200);
    expect(await feed.text()).toContain(marker);
    const search = await request.post(origin + '/api/social/post/find', {
      headers: socialHeaders,
      data: { criteria: { id: postId, title: marker } },
    });
    expect(search.status(), await search.text()).toBe(201);
    expect(await search.text()).toContain(marker);
    const comments = await request.post(origin + '/api/social/comments/find', {
      headers: socialHeaders,
      data: { postId, content: commentMarker },
    });
    expect(comments.status(), await comments.text()).toBe(201);
    expect(await comments.text()).toContain(commentMarker);
  };

  const assertPostHidden = async (
    request: APIRequestContext,
    notificationReader: APIRequestContext,
    marker: string,
    commentMarker: string
  ) => {
    const direct = await request.get(
      origin + `/api/social/post/${postId}/shared`,
      { headers: socialHeaders }
    );
    expect(await direct.text()).not.toContain(marker);
    const feed = await request.get(
      origin +
        '/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false&limit=100',
      { headers: socialHeaders }
    );
    expect(feed.status(), await feed.text()).toBe(200);
    expect(await feed.text()).not.toContain(marker);
    const search = await request.post(origin + '/api/social/post/find', {
      headers: socialHeaders,
      data: { criteria: { id: postId, title: marker } },
    });
    expect(search.status(), await search.text()).toBe(201);
    expect(await search.text()).not.toContain(marker);
    const comments = await request.post(origin + '/api/social/comments/find', {
      headers: socialHeaders,
      data: { postId, content: commentMarker },
    });
    expect(comments.status(), await comments.text()).toBe(201);
    expect(await comments.text()).not.toContain(commentMarker);
    const notifications = await notificationReader.get(
      origin + `/api/notifications/${reporterProfileId}`,
      { headers: socialHeaders }
    );
    expect(notifications.status(), await notifications.text()).toBe(200);
    const notification = (await notifications.json()).find(
      (entry: { id: string }) => entry.id === notificationId
    );
    expect(notification).toMatchObject({
      type: 'mention',
      body: 'Someone mentioned you in a post',
      resourceType: 'post',
      resourceId: postId,
      actionUrl: `/feed/post/${postId}`,
    });
    expect(JSON.stringify(notification)).not.toContain(marker);
  };

  try {
    const owner = await account(ownerContext.request, 'moderated-post-owner');
    const reporter = await account(
      reporterContext.request,
      'moderated-post-reporter'
    );
    const outsider = await account(
      outsideContext.request,
      'moderated-post-outsider'
    );
    ownerProfileId = owner.profileId;
    ownerUserId = owner.userId;
    reporterProfileId = reporter.profileId;
    communityName = `RR04 I03 moderation community ${Date.now()}`;
    const communityResponse = await ownerContext.request.post(
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
      id: communityId,
      ownerProfileId,
      ownerUserId,
      name: communityName,
    });

    const marker = `RR04-I03 moderated public marker ${Date.now()}`;
    const commentMarker = `RR04-I03 moderated comment ${Date.now()}`;
    const post = await createPost(owner, marker, 'public', community.id);
    postId = post.id;
    const comment = await ownerContext.request.post(
      origin + '/api/social/comment',
      {
        headers: socialHeaders,
        data: {
          postId: post.id,
          profileId: owner.profileId,
          userId: owner.userId,
          content: commentMarker,
        },
      }
    );
    expect(comment.status(), await comment.text()).toBe(201);
    commentId = (await comment.json()).id;
    recordFixture({
      type: 'comment',
      id: commentId,
      ownerProfileId,
      ownerUserId,
      name: commentMarker,
    });
    const outsiderDirect = await outsideContext.request.get(
      origin + `/api/social/post/${post.id}/shared`,
      { headers: socialHeaders }
    );
    expect(await outsiderDirect.text()).toContain(marker);

    const reportResponse = await reporterContext.request.post(
      origin + '/api/privacy/report',
      {
        headers: socialHeaders,
        data: {
          contentType: 'post',
          contentId: post.id,
          reason: 'spam',
          description: 'RR04-I03 controlled moderation acceptance fixture',
        },
      }
    );
    expect(reportResponse.status(), await reportResponse.text()).toBe(201);
    const report = await reportResponse.json();
    reportId = report.id;
    recordFixture({
      type: 'retained-moderation-report',
      id: reportId,
      ownerProfileId: reporterProfileId,
      ownerUserId: reporter.userId,
      name: `moderation target:${post.id}`,
    });

    const notificationResponse = await ownerContext.request.post(
      origin + '/api/notifications',
      {
        headers: socialHeaders,
        data: {
          recipientId: reporter.profileId,
          type: 'mention',
          title: 'You were mentioned',
          body: 'Someone mentioned you in a post',
          senderId: owner.profileId,
          resourceType: 'post',
          resourceId: post.id,
          actionUrl: `/feed/post/${post.id}`,
        },
      }
    );
    expect(
      notificationResponse.status(),
      await notificationResponse.text()
    ).toBe(201);
    notificationId = (await notificationResponse.json()).id;
    recordFixture({
      type: 'notification',
      id: notificationId,
      ownerProfileId: reporterProfileId,
      ownerUserId: reporter.userId,
      name: 'generic mention preview for moderated post',
    });

    await outsideContext.clearCookies();
    const outsidePage = await outsideContext.newPage();
    await signIn(outsidePage, outsider.email);
    await outsidePage.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });
    const postCard = outsidePage
      .locator('.post-container')
      .filter({ hasText: marker });
    await expect(postCard).toBeVisible();
    await readPost(outsideContext.request, marker, commentMarker);
    await moderate('hidden');
    await expect(postCard).toHaveCount(0);
    await assertPostHidden(
      outsideContext.request,
      reporterContext.request,
      marker,
      commentMarker
    );

    await moderate('visible');
    await expect(postCard).toBeVisible();
    await readPost(outsideContext.request, marker, commentMarker);

    const reportStatus = await ownerContext.request.put(
      origin +
        `/api/privacy/admin/reports/${reportId}?communityId=${communityId}`,
      {
        headers: socialHeaders,
        data: {
          status: 'reviewed',
          adminNotes: 'RR04-I03 restored after review',
        },
      }
    );
    expect(reportStatus.status(), await reportStatus.text()).toBe(200);
    recordFixture({
      type: 'retained-report-review',
      id: reportId,
      ownerProfileId,
      ownerUserId,
      name: 'reviewed after content restoration',
    });
  } finally {
    if (postHidden && communityId && postId && reportId) {
      await moderate('visible');
    }
    if (notificationId && reporterProfileId) {
      await reporterContext.request.delete(
        origin + `/api/notifications/${notificationId}`,
        { headers: socialHeaders }
      );
    }
    if (commentId) {
      await ownerContext.request.delete(
        origin + `/api/social/comment/${commentId}`,
        { headers: socialHeaders }
      );
    }
    if (postId) {
      const deletedPost = await ownerContext.request.delete(
        origin + `/api/social/post/${postId}`,
        { headers: socialHeaders }
      );
      expect(deletedPost.status(), await deletedPost.text()).toBe(200);
    }
    if (communityId) {
      const deletedCommunity = await ownerContext.request.delete(
        origin + `/api/social/community/${communityId}`,
        { headers: socialHeaders }
      );
      expect(deletedCommunity.status(), await deletedCommunity.text()).toBe(
        200
      );
    }
    await Promise.all([
      ownerContext.close(),
      reporterContext.close(),
      outsideContext.close(),
    ]);
  }
});

test('RR04 I03 browser: audience narrowing clears active feed content and restores it after authorized refresh', async ({
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  const viewport = testInfo.project.use.viewport;
  const authorContext = await browser.newContext({ viewport });
  const readerContext = await browser.newContext({ viewport });
  let postId: string | undefined;
  let commentId: string | undefined;
  try {
    const author = await account(authorContext.request, 'cache-author');
    const reader = await account(readerContext.request, 'cache-reader');
    const marker = `RR04-I03 live cache marker ${Date.now()}`;
    const post = await createPost(author, marker, 'public');
    postId = post.id;
    const commentMarker = `RR04-I03 live cache comment ${Date.now()}`;
    const comment = await authorContext.request.post(
      origin + '/api/social/comment',
      {
        headers: socialHeaders,
        data: {
          postId: post.id,
          profileId: author.profileId,
          userId: author.userId,
          content: commentMarker,
        },
      }
    );
    expect(comment.status(), await comment.text()).toBe(201);
    commentId = (await comment.json()).id;
    recordFixture({
      type: 'comment',
      id: commentId,
      ownerProfileId: author.profileId,
      ownerUserId: author.userId,
      name: commentMarker,
    });

    await readerContext.clearCookies();
    const page = await readerContext.newPage();
    await signIn(page, reader.email);
    await page.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });
    const card = page.locator('.post-container').filter({ hasText: marker });
    await expect(card).toBeVisible();

    const narrow = await authorContext.request.put(
      origin + `/api/social/post/update/${post.id}`,
      { headers: socialHeaders, data: { visibility: 'followers' } }
    );
    expect(narrow.status(), await narrow.text()).toBe(200);
    await expect(card).toHaveCount(0);
    const deniedDirect = await readerContext.request.get(
      origin + `/api/social/post/${post.id}/shared`,
      { headers: socialHeaders }
    );
    expect(await deniedDirect.text()).not.toContain(marker);
    const deniedSearch = await readerContext.request.post(
      origin + '/api/social/post/find',
      {
        headers: socialHeaders,
        data: { criteria: { id: post.id, title: marker } },
      }
    );
    expect(deniedSearch.status(), await deniedSearch.text()).toBe(201);
    expect(await deniedSearch.text()).not.toContain(marker);
    const deniedComments = await readerContext.request.post(
      origin + '/api/social/comments/find',
      {
        headers: socialHeaders,
        data: { postId: post.id, content: commentMarker },
      }
    );
    expect(deniedComments.status(), await deniedComments.text()).toBe(201);
    expect(await deniedComments.text()).not.toContain(commentMarker);

    const restore = await authorContext.request.put(
      origin + `/api/social/post/update/${post.id}`,
      { headers: socialHeaders, data: { visibility: 'public' } }
    );
    expect(restore.status(), await restore.text()).toBe(200);
    await expect(card).toBeVisible();
    const restoredDirect = await readerContext.request.get(
      origin + `/api/social/post/${post.id}/shared`,
      { headers: socialHeaders }
    );
    expect(await restoredDirect.text()).toContain(marker);
    const restoredComments = await readerContext.request.post(
      origin + '/api/social/comments/find',
      {
        headers: socialHeaders,
        data: { postId: post.id, content: commentMarker },
      }
    );
    expect(restoredComments.status(), await restoredComments.text()).toBe(201);
    expect(await restoredComments.text()).toContain(commentMarker);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(card).toBeVisible();
  } finally {
    if (commentId) {
      await authorContext.request.delete(
        origin + `/api/social/comment/${commentId}`,
        { headers: socialHeaders }
      );
    }
    if (postId) await deletePost(authorContext.request, postId);
    await Promise.all([authorContext.close(), readerContext.close()]);
  }
});

test('RR04 I03 browser: followers-only content enters and leaves Following through the follow controls', async ({
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  const viewport = testInfo.project.use.viewport;
  const authorContext = await browser.newContext({ viewport });
  const readerContext = await browser.newContext({ viewport });
  let postId: string | undefined;
  let publicPostId: string | undefined;
  let following = false;
  let authorProfileId: string | undefined;
  let readerProfileId: string | undefined;
  try {
    const author = await account(authorContext.request, 'follow-loop-author');
    const reader = await account(readerContext.request, 'follow-loop-reader');
    authorProfileId = author.profileId;
    readerProfileId = reader.profileId;
    const publicMarker = `RR04-I03 follow control ${Date.now()}`;
    const followersMarker = `RR04-I03 followers-only ${Date.now()}`;
    const publicPost = await createPost(author, publicMarker, 'public');
    publicPostId = publicPost.id;
    const followersPost = await createPost(
      author,
      followersMarker,
      'followers'
    );
    postId = followersPost.id;

    await readerContext.clearCookies();
    const page = await readerContext.newPage();
    await signIn(page, reader.email);
    await page.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });
    const followersCard = page
      .locator('.post-container')
      .filter({ hasText: followersMarker });

    await page.getByRole('button', { name: 'Following Feed' }).click();
    await expect(followersCard).toHaveCount(0);
    const preFollowDirect = await readerContext.request.get(
      origin + `/api/social/post/${followersPost.id}/shared`,
      { headers: socialHeaders }
    );
    expect(await preFollowDirect.text()).not.toContain(followersMarker);

    await page.getByRole('button', { name: 'Public Feed' }).click();
    const publicCard = page
      .locator('.post-container')
      .filter({ hasText: publicMarker });
    await expect(publicCard).toBeVisible();
    await publicCard.locator('otui-dropdown button.dropdown-trigger').click();
    await publicCard
      .getByRole('button', { name: 'Follow', exact: true })
      .click();
    following = true;

    await page.getByRole('button', { name: 'Following Feed' }).click();
    await expect(followersCard).toBeVisible();
    const postFollowDirect = await readerContext.request.get(
      origin + `/api/social/post/${followersPost.id}/shared`,
      { headers: socialHeaders }
    );
    expect(await postFollowDirect.text()).toContain(followersMarker);

    await page.getByRole('button', { name: 'Public Feed' }).click();
    await expect(followersCard).toHaveCount(0);
    await publicCard.locator('otui-dropdown button.dropdown-trigger').click();
    await publicCard
      .getByRole('button', { name: 'Unfollow', exact: true })
      .click();
    following = false;

    await page.getByRole('button', { name: 'Following Feed' }).click();
    await expect(followersCard).toHaveCount(0);
    const postUnfollowDirect = await readerContext.request.get(
      origin + `/api/social/post/${followersPost.id}/shared`,
      { headers: socialHeaders }
    );
    expect(await postUnfollowDirect.text()).not.toContain(followersMarker);
  } finally {
    if (following && authorProfileId && readerProfileId) {
      await readerContext.request.post(origin + '/api/social/follow/unfollow', {
        headers: socialHeaders,
        data: { followerId: readerProfileId, followeeId: authorProfileId },
      });
    }
    if (postId) await deletePost(authorContext.request, postId);
    if (publicPostId) await deletePost(authorContext.request, publicPostId);
    await Promise.all([authorContext.close(), readerContext.close()]);
  }
});

test('RR04 I03 browser: mention preview stays generic and its direct target remains protected after unfollow', async ({
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  const viewport = testInfo.project.use.viewport;
  const authorContext = await browser.newContext({ viewport });
  const recipientContext = await browser.newContext({ viewport });
  let postId: string | undefined;
  let notificationId: string | undefined;
  let following = false;
  let authorProfileId: string | undefined;
  let recipientProfileId: string | undefined;
  try {
    const author = await account(authorContext.request, 'preview-author');
    const recipient = await account(
      recipientContext.request,
      'preview-recipient'
    );
    authorProfileId = author.profileId;
    recipientProfileId = recipient.profileId;
    const marker = `RR04-I03 private notification content ${Date.now()}`;
    const post = await createPost(author, marker, 'followers');
    postId = post.id;
    const follow = await recipientContext.request.post(
      origin + '/api/social/follow',
      {
        headers: socialHeaders,
        data: { followerId: recipient.profileId, followeeId: author.profileId },
      }
    );
    expect(follow.status(), await follow.text()).toBe(201);
    following = true;
    const notification = await authorContext.request.post(
      origin + '/api/notifications',
      {
        headers: socialHeaders,
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
    expect(notification.status(), await notification.text()).toBe(201);
    notificationId = (await notification.json()).id;
    recordFixture({
      type: 'notification',
      id: notificationId,
      ownerProfileId: recipient.profileId,
      name: marker,
    });

    await recipientContext.clearCookies();
    const page = await recipientContext.newPage();
    await signIn(page, recipient.email);
    await page.goto(origin + '/notifications', {
      waitUntil: 'domcontentloaded',
    });
    const notificationBody = page.locator('.notification-body').filter({
      hasText: 'Someone mentioned you in a post',
    });
    await expect(notificationBody).toBeVisible();
    await expect(page.getByText(marker, { exact: false })).toHaveCount(0);

    const unfollow = await recipientContext.request.post(
      origin + '/api/social/follow/unfollow',
      {
        headers: socialHeaders,
        data: { followerId: recipient.profileId, followeeId: author.profileId },
      }
    );
    expect(unfollow.status(), await unfollow.text()).toBe(201);
    following = false;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(notificationBody).toBeVisible();
    await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
    const detailResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === `/api/social/post/${post.id}`;
    });
    await notificationBody.click();
    const detailResponse = await detailResponsePromise;
    expect(detailResponse.status()).toBe(200);
    expect((await detailResponse.text()).trim()).toBe('');
    await expect(page).toHaveURL(new RegExp(`/feed/post/${post.id}$`));
    await expect(page.locator('.feed-loading')).toHaveCount(0);
    await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
  } finally {
    if (following && recipientProfileId && authorProfileId) {
      await recipientContext.request.post(
        origin + '/api/social/follow/unfollow',
        {
          headers: socialHeaders,
          data: { followerId: recipientProfileId, followeeId: authorProfileId },
        }
      );
    }
    if (notificationId) {
      await recipientContext.request.delete(
        origin + `/api/notifications/${notificationId}`,
        { headers: socialHeaders }
      );
    }
    if (postId) await deletePost(authorContext.request, postId);
    await Promise.all([authorContext.close(), recipientContext.close()]);
  }
});

test('RR04 I03 API: a block in either direction removes posts and comments from feed, search, and direct reads', async ({
  playwright,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium-desktop', 'API gate runs once');
  test.setTimeout(120000);
  const firstContext = await playwright.request.newContext();
  const secondContext = await playwright.request.newContext();
  let firstProfileId: string | undefined;
  let secondProfileId: string | undefined;
  let firstPostId: string | undefined;
  let secondPostId: string | undefined;
  let firstCommentId: string | undefined;
  let secondCommentId: string | undefined;
  let firstBlockedSecond = false;
  let secondBlockedFirst = false;

  const assertHiddenFrom = async (
    reader: APIRequestContext,
    postId: string,
    marker: string,
    commentMarker: string
  ) => {
    const direct = await reader.get(
      origin + `/api/social/post/${postId}/shared`,
      { headers: socialHeaders }
    );
    expect(await direct.text()).not.toContain(marker);

    const feed = await reader.get(
      origin +
        '/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false&limit=100',
      { headers: socialHeaders }
    );
    expect(feed.status(), await feed.text()).toBe(200);
    expect(await feed.text()).not.toContain(marker);

    const posts = await reader.post(origin + '/api/social/post/find', {
      headers: socialHeaders,
      data: { criteria: { id: postId, title: marker } },
    });
    expect(posts.status(), await posts.text()).toBe(201);
    expect(await posts.text()).not.toContain(marker);

    const comments = await reader.post(origin + '/api/social/comments/find', {
      headers: socialHeaders,
      data: { postId, content: commentMarker },
    });
    expect(comments.status(), await comments.text()).toBe(201);
    expect(await comments.text()).not.toContain(commentMarker);
  };

  try {
    const first = await account(firstContext, 'block-first');
    const second = await account(secondContext, 'block-second');
    firstProfileId = first.profileId;
    secondProfileId = second.profileId;

    const firstMarker = `RR04-I03 block first post ${Date.now()}`;
    const secondMarker = `RR04-I03 block second post ${Date.now()}`;
    const firstCommentMarker = `RR04-I03 first comment ${Date.now()}`;
    const secondCommentMarker = `RR04-I03 second comment ${Date.now()}`;
    const firstPost = await createPost(first, firstMarker, 'public');
    firstPostId = firstPost.id;
    const secondPost = await createPost(second, secondMarker, 'public');
    secondPostId = secondPost.id;

    const firstComment = await firstContext.post(
      origin + '/api/social/comment',
      {
        headers: socialHeaders,
        data: {
          postId: firstPost.id,
          profileId: first.profileId,
          userId: first.userId,
          content: firstCommentMarker,
        },
      }
    );
    expect(firstComment.status(), await firstComment.text()).toBe(201);
    firstCommentId = (await firstComment.json()).id;
    recordFixture({
      type: 'comment',
      id: firstCommentId,
      ownerProfileId: first.profileId,
      ownerUserId: first.userId,
      name: firstCommentMarker,
    });
    const secondComment = await secondContext.post(
      origin + '/api/social/comment',
      {
        headers: socialHeaders,
        data: {
          postId: secondPost.id,
          profileId: second.profileId,
          userId: second.userId,
          content: secondCommentMarker,
        },
      }
    );
    expect(secondComment.status(), await secondComment.text()).toBe(201);
    secondCommentId = (await secondComment.json()).id;
    recordFixture({
      type: 'comment',
      id: secondCommentId,
      ownerProfileId: second.profileId,
      ownerUserId: second.userId,
      name: secondCommentMarker,
    });

    const blockSecond = await firstContext.post(origin + '/api/privacy/block', {
      headers: socialHeaders,
      data: { blockedId: second.profileId },
    });
    expect(blockSecond.status(), await blockSecond.text()).toBe(201);
    firstBlockedSecond = true;
    await assertHiddenFrom(
      firstContext,
      secondPost.id,
      secondMarker,
      secondCommentMarker
    );
    await assertHiddenFrom(
      secondContext,
      firstPost.id,
      firstMarker,
      firstCommentMarker
    );

    const unblockSecond = await firstContext.delete(
      origin + `/api/privacy/block/${second.profileId}`,
      { headers: socialHeaders }
    );
    expect([200, 204]).toContain(unblockSecond.status());
    firstBlockedSecond = false;

    const blockFirst = await secondContext.post(origin + '/api/privacy/block', {
      headers: socialHeaders,
      data: { blockedId: first.profileId },
    });
    expect(blockFirst.status(), await blockFirst.text()).toBe(201);
    secondBlockedFirst = true;
    await assertHiddenFrom(
      secondContext,
      firstPost.id,
      firstMarker,
      firstCommentMarker
    );
    await assertHiddenFrom(
      firstContext,
      secondPost.id,
      secondMarker,
      secondCommentMarker
    );
  } finally {
    if (firstBlockedSecond && secondProfileId) {
      await firstContext.delete(
        origin + `/api/privacy/block/${secondProfileId}`,
        { headers: socialHeaders }
      );
    }
    if (secondBlockedFirst && firstProfileId) {
      await secondContext.delete(
        origin + `/api/privacy/block/${firstProfileId}`,
        { headers: socialHeaders }
      );
    }
    if (firstCommentId) {
      await firstContext.delete(
        origin + `/api/social/comment/${firstCommentId}`,
        { headers: socialHeaders }
      );
    }
    if (secondCommentId) {
      await secondContext.delete(
        origin + `/api/social/comment/${secondCommentId}`,
        { headers: socialHeaders }
      );
    }
    if (firstPostId) await deletePost(firstContext, firstPostId);
    if (secondPostId) await deletePost(secondContext, secondPostId);
    await Promise.all([firstContext.dispose(), secondContext.dispose()]);
  }
});

test('RR04 I03 browser: chronological public pagination has no duplicate or cross-tab rows', async ({
  browser,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Pagination runs once'
  );
  test.setTimeout(120000);
  const authorContext = await browser.newContext({
    viewport: testInfo.project.use.viewport,
  });
  const readerContext = await browser.newContext({
    viewport: testInfo.project.use.viewport,
  });
  const postIds: string[] = [];
  try {
    const author = await account(authorContext.request, 'pagination-author');
    const reader = await account(readerContext.request, 'pagination-reader');
    const markers: string[] = [];
    for (let index = 0; index < 21; index += 1) {
      const marker = `RR04-I03 chronological page ${index} ${Date.now()}`;
      markers.push(marker);
      const post = await createPost(author, marker, 'public');
      postIds.push(post.id);
      await new Promise((resolve) => setTimeout(resolve, 15));
    }

    const markerById = new Map(
      postIds.map((id, index) => [id, markers[index]])
    );
    const feedResponse = await readerContext.request.get(
      origin +
        '/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false&limit=100&offset=0',
      { headers: socialHeaders }
    );
    expect(feedResponse.status(), await feedResponse.text()).toBe(200);
    const feedPosts = (await feedResponse.json()) as Array<{ id: string }>;
    const orderedMarkers = feedPosts.flatMap((post) => {
      const marker = markerById.get(post.id);
      return marker ? [marker] : [];
    });
    expect(orderedMarkers).toHaveLength(markers.length);

    await readerContext.clearCookies();
    const page = await readerContext.newPage();
    await signIn(page, reader.email);
    await page.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });
    const card = (marker: string) =>
      page.locator('.post-container').filter({ hasText: marker });
    const feedPageResponse = (offset: number) =>
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return (
          url.pathname === '/api/social/feed' &&
          url.searchParams.get('limit') === '20' &&
          url.searchParams.get('offset') === String(offset)
        );
      });
    const renderedFixtureMarkers = async () =>
      page
        .locator('.post-container')
        .allTextContents()
        .then((contents) =>
          contents.flatMap((content) => {
            const marker = markers.find((candidate) =>
              content.includes(candidate)
            );
            return marker ? [marker] : [];
          })
        );

    const firstPageResponsePromise = feedPageResponse(0);
    await page.getByRole('button', { name: 'Public Feed' }).click();
    const firstPageResponse = await firstPageResponsePromise;
    expect(firstPageResponse.status(), await firstPageResponse.text()).toBe(
      200
    );
    const firstPage = (await firstPageResponse.json()) as Array<{ id: string }>;
    const expectedFirstPageMarkers = firstPage.flatMap((post) => {
      const marker = markerById.get(post.id);
      return marker ? [marker] : [];
    });
    await expect.poll(renderedFixtureMarkers).toEqual(expectedFirstPageMarkers);

    const nextPageResponsePromise = feedPageResponse(20);
    await page.locator('.scroll-trigger').scrollIntoViewIfNeeded();
    const nextPageResponse = await nextPageResponsePromise;
    expect(nextPageResponse.status(), await nextPageResponse.text()).toBe(200);
    const nextPage = (await nextPageResponse.json()) as Array<{ id: string }>;
    const expectedNextPageMarkers = nextPage.flatMap((post) => {
      const marker = markerById.get(post.id);
      return marker ? [marker] : [];
    });
    expect(expectedNextPageMarkers).toEqual(orderedMarkers.slice(20));
    await expect
      .poll(renderedFixtureMarkers)
      .toEqual([...expectedFirstPageMarkers, ...expectedNextPageMarkers]);
    expect(new Set(await renderedFixtureMarkers()).size).toBe(markers.length);

    await page.getByRole('button', { name: 'Following Feed' }).click();
    for (const marker of markers) await expect(card(marker)).toHaveCount(0);

    const returnedFirstPagePromise = feedPageResponse(0);
    await page.getByRole('button', { name: 'Public Feed' }).click();
    const returnedFirstPage = await returnedFirstPagePromise;
    expect(returnedFirstPage.status(), await returnedFirstPage.text()).toBe(
      200
    );
    await expect.poll(renderedFixtureMarkers).toEqual(expectedFirstPageMarkers);
    const returnedNextPagePromise = feedPageResponse(20);
    await page.locator('.scroll-trigger').scrollIntoViewIfNeeded();
    const returnedNextPage = await returnedNextPagePromise;
    expect(returnedNextPage.status(), await returnedNextPage.text()).toBe(200);
    await expect
      .poll(renderedFixtureMarkers)
      .toEqual([...expectedFirstPageMarkers, ...expectedNextPageMarkers]);
  } finally {
    for (const id of postIds.reverse())
      await deletePost(authorContext.request, id);
    await Promise.all([authorContext.close(), readerContext.close()]);
  }
});

test('RR04 I03 browser: community blocks clear both members from active feeds and every read surface', async ({
  browser,
  playwright,
}, testInfo) => {
  test.setTimeout(150000);
  const viewport = testInfo.project.use.viewport;
  const ownerContext = await browser.newContext({ viewport });
  const memberContext = await browser.newContext({ viewport });
  const ownerApi = await playwright.request.newContext();
  const memberApi = await playwright.request.newContext();
  let communityId: string | undefined;
  let ownerPostId: string | undefined;
  let memberPostId: string | undefined;
  let ownerCommentId: string | undefined;
  let memberCommentId: string | undefined;
  let ownerProfileId: string | undefined;
  let memberProfileId: string | undefined;
  let ownerBlockedMember = false;
  let memberBlockedOwner = false;
  let primaryFailure: unknown;
  let hasPrimaryFailure = false;
  const cleanupFailures: string[] = [];
  const cleanup = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      cleanupFailures.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const assertCommunityPostHidden = async (
    reader: Page,
    request: APIRequestContext,
    id: string,
    marker: string,
    commentMarker: string
  ) => {
    const card = reader.locator('.post-container').filter({ hasText: marker });
    await expect(card).toHaveCount(0);
    const direct = await request.get(origin + `/api/social/post/${id}/shared`, {
      headers: socialHeaders,
    });
    expect(await direct.text()).not.toContain(marker);
    const posts = await request.post(origin + '/api/social/post/find', {
      headers: socialHeaders,
      data: { criteria: { id, title: marker } },
    });
    expect(posts.status(), await posts.text()).toBe(201);
    expect(await posts.text()).not.toContain(marker);
    const comments = await request.post(origin + '/api/social/comments/find', {
      headers: socialHeaders,
      data: { postId: id, content: commentMarker },
    });
    expect(comments.status(), await comments.text()).toBe(201);
    expect(await comments.text()).not.toContain(commentMarker);
  };

  try {
    const owner = await account(ownerContext.request, 'community-block-owner');
    const member = await account(
      memberContext.request,
      'community-block-member'
    );
    ownerProfileId = owner.profileId;
    memberProfileId = member.profileId;
    await Promise.all([
      authenticateAccount(ownerApi, owner.email),
      authenticateAccount(memberApi, member.email),
    ]);
    const communityName = `RR04 I03 active block ${Date.now()}`;
    const communityResponse = await ownerApi.post(
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
    const join = await memberApi.post(
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
      name: 'approved member in active block community',
    });

    const ownerMarker = `RR04-I03 community owner block ${Date.now()}`;
    const memberMarker = `RR04-I03 community member block ${Date.now()}`;
    const ownerCommentMarker = `RR04-I03 owner community comment ${Date.now()}`;
    const memberCommentMarker = `RR04-I03 member community comment ${Date.now()}`;
    const ownerPost = await createPost(
      owner,
      ownerMarker,
      'community',
      community.id
    );
    ownerPostId = ownerPost.id;
    const memberPost = await createPost(
      member,
      memberMarker,
      'community',
      community.id
    );
    memberPostId = memberPost.id;
    const ownerComment = await ownerApi.post(origin + '/api/social/comment', {
      headers: socialHeaders,
      data: {
        postId: ownerPost.id,
        profileId: owner.profileId,
        userId: owner.userId,
        content: ownerCommentMarker,
      },
    });
    expect(ownerComment.status(), await ownerComment.text()).toBe(201);
    ownerCommentId = (await ownerComment.json()).id;
    recordFixture({
      type: 'comment',
      id: ownerCommentId,
      ownerProfileId: owner.profileId,
      ownerUserId: owner.userId,
      name: ownerCommentMarker,
    });
    const memberComment = await memberApi.post(origin + '/api/social/comment', {
      headers: socialHeaders,
      data: {
        postId: memberPost.id,
        profileId: member.profileId,
        userId: member.userId,
        content: memberCommentMarker,
      },
    });
    expect(memberComment.status(), await memberComment.text()).toBe(201);
    memberCommentId = (await memberComment.json()).id;
    recordFixture({
      type: 'comment',
      id: memberCommentId,
      ownerProfileId: member.profileId,
      ownerUserId: member.userId,
      name: memberCommentMarker,
    });

    await Promise.all([
      ownerContext.clearCookies(),
      memberContext.clearCookies(),
    ]);
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();
    await Promise.all([
      signIn(ownerPage, owner.email),
      signIn(memberPage, member.email),
    ]);
    await Promise.all([
      ownerPage.goto(origin + '/feed', { waitUntil: 'domcontentloaded' }),
      memberPage.goto(origin + '/feed', { waitUntil: 'domcontentloaded' }),
    ]);
    await Promise.all([
      ownerPage.getByRole('button', { name: 'My Communities' }).click(),
      memberPage.getByRole('button', { name: 'My Communities' }).click(),
    ]);
    for (const page of [ownerPage, memberPage]) {
      await expect(
        page.locator('.post-container').filter({ hasText: ownerMarker })
      ).toBeVisible();
      await expect(
        page.locator('.post-container').filter({ hasText: memberMarker })
      ).toBeVisible();
    }

    const ownerBlock = await ownerApi.post(origin + '/api/privacy/block', {
      headers: socialHeaders,
      data: { blockedId: member.profileId },
    });
    expect(ownerBlock.status(), await ownerBlock.text()).toBe(201);
    ownerBlockedMember = true;
    await assertCommunityPostHidden(
      ownerPage,
      ownerApi,
      memberPost.id,
      memberMarker,
      memberCommentMarker
    );
    await assertCommunityPostHidden(
      memberPage,
      memberApi,
      ownerPost.id,
      ownerMarker,
      ownerCommentMarker
    );

    const ownerUnblock = await ownerApi.delete(
      origin + `/api/privacy/block/${member.profileId}`,
      { headers: socialHeaders }
    );
    expect([200, 204]).toContain(ownerUnblock.status());
    ownerBlockedMember = false;
    await expect(
      ownerPage.locator('.post-container').filter({ hasText: memberMarker })
    ).toBeVisible();
    await expect(
      memberPage.locator('.post-container').filter({ hasText: ownerMarker })
    ).toBeVisible();

    const memberBlock = await memberApi.post(origin + '/api/privacy/block', {
      headers: socialHeaders,
      data: { blockedId: owner.profileId },
    });
    expect(memberBlock.status(), await memberBlock.text()).toBe(201);
    memberBlockedOwner = true;
    await assertCommunityPostHidden(
      memberPage,
      memberApi,
      ownerPost.id,
      ownerMarker,
      ownerCommentMarker
    );
    await assertCommunityPostHidden(
      ownerPage,
      ownerApi,
      memberPost.id,
      memberMarker,
      memberCommentMarker
    );

    await Promise.all([
      ownerPage.reload({ waitUntil: 'domcontentloaded' }),
      memberPage.reload({ waitUntil: 'domcontentloaded' }),
    ]);
    const hasCommunityFeed = (
      response: import('@playwright/test').Response
    ) => {
      const url = new URL(response.url());
      return (
        url.pathname === '/api/social/feed' &&
        url.searchParams.get('includeCommunities') === 'true'
      );
    };
    const ownerReconnectFeedPromise =
      ownerPage.waitForResponse(hasCommunityFeed);
    const memberReconnectFeedPromise =
      memberPage.waitForResponse(hasCommunityFeed);
    await Promise.all([
      ownerPage.getByRole('button', { name: 'My Communities' }).click(),
      memberPage.getByRole('button', { name: 'My Communities' }).click(),
    ]);
    const [ownerReconnectFeed, memberReconnectFeed] = await Promise.all([
      ownerReconnectFeedPromise,
      memberReconnectFeedPromise,
    ]);
    expect(ownerReconnectFeed.status()).toBe(200);
    expect(memberReconnectFeed.status()).toBe(200);
    expect(await ownerReconnectFeed.text()).not.toContain(memberMarker);
    expect(await memberReconnectFeed.text()).not.toContain(ownerMarker);
    await expect(
      ownerPage.locator('.post-container').filter({ hasText: memberMarker })
    ).toHaveCount(0);
    await expect(
      memberPage.locator('.post-container').filter({ hasText: ownerMarker })
    ).toHaveCount(0);
  } catch (error) {
    primaryFailure = error;
    hasPrimaryFailure = true;
  } finally {
    if (ownerBlockedMember && memberProfileId) {
      await cleanup('unblock member from owner', async () => {
        const response = await ownerApi.delete(
          origin + `/api/privacy/block/${memberProfileId}`,
          { headers: socialHeaders }
        );
        expect([200, 204]).toContain(response.status());
      });
    }
    if (memberBlockedOwner && ownerProfileId) {
      await cleanup('unblock owner from member', async () => {
        const response = await memberApi.delete(
          origin + `/api/privacy/block/${ownerProfileId}`,
          { headers: socialHeaders }
        );
        expect([200, 204]).toContain(response.status());
      });
    }
    if (ownerCommentId) {
      await cleanup('delete owner comment', async () => {
        const response = await ownerApi.delete(
          origin + `/api/social/comment/${ownerCommentId}`,
          { headers: socialHeaders }
        );
        expect(response.status()).toBe(200);
      });
    }
    if (memberCommentId) {
      await cleanup('delete member comment', async () => {
        const response = await memberApi.delete(
          origin + `/api/social/comment/${memberCommentId}`,
          { headers: socialHeaders }
        );
        expect(response.status()).toBe(200);
      });
    }
    if (ownerPostId) {
      await cleanup('delete owner post', () =>
        deletePost(ownerApi, ownerPostId)
      );
    }
    if (memberPostId) {
      await cleanup('delete member post', () =>
        deletePost(memberApi, memberPostId)
      );
    }
    if (communityId) {
      await cleanup('delete community', async () => {
        const response = await ownerApi.delete(
          origin + `/api/social/community/${communityId}`,
          { headers: socialHeaders }
        );
        expect(response.status()).toBe(200);
      });
    }
    await cleanup('dispose authenticated API contexts', async () => {
      await Promise.all([ownerApi.dispose(), memberApi.dispose()]);
    });
    await cleanup('close browser contexts', async () => {
      await Promise.all([ownerContext.close(), memberContext.close()]);
    });
  }
  if (hasPrimaryFailure) {
    if (cleanupFailures.length > 0) {
      console.error('Fixture cleanup also failed:', cleanupFailures.join('; '));
    }
    throw primaryFailure;
  }
  if (cleanupFailures.length > 0) {
    throw new Error(`Fixture cleanup failed: ${cleanupFailures.join('; ')}`);
  }
});
