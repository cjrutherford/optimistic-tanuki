import { test, expect, APIRequestContext } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { writeFile } from 'node:fs/promises';
import { firstValueFrom } from 'rxjs';
import { io } from 'socket.io-client';

// Release-gate checks against the existing stack, without intercepted APIs.
// Restricted fixtures use the owning service because the HTTP write DTO does
// not expose audience selection yet. These do not prove composer acceptance.
test.skip(
  process.env['RR04_LIVE_STACK'] !== 'true',
  'Requires the development stack'
);
const origin = 'http://127.0.0.1:8080';
const password = 'RR04-local-test-password!';
const headers = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};
async function privacyText(
  request: APIRequestContext,
  url: string,
  requestHeaders?: Record<string, string>
) {
  const response = await request.get(url, { headers: requestHeaders });
  expect([200, 404]).toContain(response.status());
  return response.text();
}
async function account(request: APIRequestContext, suffix: string) {
  const email = `rr04-${Date.now()}-${suffix}@example.test`;
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
        bio: 'Local privacy regression',
      },
    }
  );
  expect(registration.status()).toBe(201);
  const login = await request.post(origin + '/api/authentication/login', {
    headers: { ...headers, 'x-ot-session-mode': 'cookie' },
    data: { email, password },
  });
  expect(login.status()).toBe(201);
  const session = await request.get(origin + '/api/authentication/session', {
    headers,
  });
  expect(session.status()).toBe(200);
  return { email, ...(await session.json()).data };
}
async function fixture(
  author: { userId: string; profileId: string },
  community: boolean,
  appScope = 'client-interface',
  existingCommunityId?: string
) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  await client.connect();
  try {
    const communityId =
      existingCommunityId ??
      (community
        ? (
            await firstValueFrom(
              client.send(
                { cmd: 'CREATE_COMMUNITY' },
                {
                  dto: {
                    name: `RR04 private ${Date.now()}`,
                    isPrivate: true,
                    joinPolicy: 'invite_only',
                  },
                  userId: author.userId,
                  profileId: author.profileId,
                  appScope,
                }
              )
            )
          ).id
        : undefined);
    const marker = `RR04 restricted marker ${Date.now()}`;
    const post = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_POST' },
        {
          title: marker,
          content: marker,
          userId: author.userId,
          profileId: author.profileId,
          appScope: 'social',
          ...(communityId ? { communityId } : {}),
        }
      )
    );
    if (!community)
      await firstValueFrom(
        client.send(
          { cmd: 'UPDATE_POST' },
          {
            id: post.id,
            data: { visibility: 'followers' },
            userId: author.userId,
            profileId: author.profileId,
          }
        )
      );
    return { id: post.id, marker, communityId, authorId: author.userId };
  } finally {
    client.close();
  }
}

async function publicCommunityPosts(author: {
  userId: string;
  profileId: string;
}) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  await client.connect();
  try {
    const community = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_COMMUNITY' },
        {
          dto: {
            name: `RR04 public ${Date.now()}`,
            isPrivate: false,
            joinPolicy: 'open',
          },
          userId: author.userId,
          profileId: author.profileId,
          appScope: 'social',
        }
      )
    );
    const memberMarker = `RR04 members default ${Date.now()}`;
    const memberPost = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_POST' },
        {
          title: memberMarker,
          content: memberMarker,
          userId: author.userId,
          profileId: author.profileId,
          communityId: community.id,
          appScope: 'social',
        }
      )
    );
    const publicMarker = `RR04 explicit public ${Date.now()}`;
    const publicPost = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_POST' },
        {
          title: publicMarker,
          content: publicMarker,
          visibility: 'public',
          userId: author.userId,
          profileId: author.profileId,
          communityId: community.id,
          appScope: 'social',
        }
      )
    );
    return {
      communityId: community.id,
      memberPost,
      memberMarker,
      publicPost,
      publicMarker,
      authorId: author.userId,
    };
  } finally {
    client.close();
  }
}

test('RR04 API: anonymous and non-followers cannot read a followers-only post', async ({
  playwright,
}) => {
  const authorContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  const anonymous = await playwright.request.newContext();
  try {
    const author = await account(authorContext, 'author');
    const outsider = await account(outsiderContext, 'outsider');
    const post = await fixture(author, false);
    const url = origin + `/api/social/post/${post.id}/shared`;
    expect((await (await authorContext.get(url)).json()).content).toBe(
      post.marker
    );
    for (const reader of [anonymous, outsiderContext]) {
      const response = await reader.get(url);
      expect(response.status()).toBe(200);
      expect(await response.text()).not.toContain(post.marker);
      const search = await reader.post(origin + '/api/social/post/find', {
        headers: { 'x-ot-appscope': 'social' },
        data: { criteria: { title: post.marker } },
      });
      expect(search.status()).toBe(201);
      expect(await search.text()).not.toContain(post.marker);
    }
    const follow = {
      followerId: outsider.profileId,
      followeeId: author.profileId,
    };
    expect(
      (
        await outsiderContext.post(origin + '/api/social/follow', {
          data: follow,
        })
      ).status()
    ).toBe(201);
    expect((await (await outsiderContext.get(url)).json()).content).toBe(
      post.marker
    );
    const report = { contentType: 'post', contentId: post.id, reason: 'spam' };
    expect(
      (
        await outsiderContext.post(origin + '/api/privacy/report', {
          headers: { 'x-ot-appscope': 'social' },
          data: report,
        })
      ).status()
    ).toBe(201);
    expect(
      (
        await outsiderContext.post(origin + '/api/social/follow/unfollow', {
          data: follow,
        })
      ).status()
    ).toBe(201);
    expect(await (await outsiderContext.get(url)).text()).not.toContain(
      post.marker
    );
    expect(
      (
        await outsiderContext.post(origin + '/api/privacy/report', {
          headers: { 'x-ot-appscope': 'social' },
          data: report,
        })
      ).status()
    ).toBe(400);
  } finally {
    await authorContext.dispose();
    await outsiderContext.dispose();
    await anonymous.dispose();
  }
});

test('RR04 API: public-community posts default to members and require explicit public selection for broader reads', async ({
  playwright,
}) => {
  const authorContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  const anonymous = await playwright.request.newContext();
  let posts: Awaited<ReturnType<typeof publicCommunityPosts>> | undefined;
  try {
    const author = await account(authorContext, 'public-community-author');
    await account(outsiderContext, 'public-community-outsider');
    posts = await publicCommunityPosts(author);
    expect(posts.memberPost.visibility).toBe('community');
    expect(posts.publicPost.visibility).toBe('public');
    for (const reader of [anonymous, outsiderContext]) {
      const memberRead = await reader.get(
        origin + `/api/social/post/${posts.memberPost.id}/shared`
      );
      expect(await memberRead.text()).not.toContain(posts.memberMarker);
      const explicitRead = await reader.get(
        origin + `/api/social/post/${posts.publicPost.id}/shared`
      );
      expect(await explicitRead.text()).toContain(posts.publicMarker);
    }
  } finally {
    if (posts) {
      for (const postId of [posts.memberPost.id, posts.publicPost.id]) {
        const result = await socialFixtureCommand('DELETE_POST', {
          id: postId,
          userId: posts.authorId,
        });
        expect(result?.success).toBe(true);
      }
      const communityDelete = await socialFixtureCommand('DELETE_COMMUNITY', {
        id: posts.communityId,
        userId: posts.authorId,
      });
      expect(communityDelete?.success).toBe(true);
    }
    await Promise.all([
      authorContext.dispose(),
      outsiderContext.dispose(),
      anonymous.dispose(),
    ]);
  }
});

test('RR04 browser: public community composer defaults to members and honors explicit public', async ({
  browser,
  playwright,
}, testInfo) => {
  test.setTimeout(60000);
  const ownerContext = await browser.newContext({
    viewport: testInfo.project.use.viewport,
  });
  const outsider = await playwright.request.newContext();
  let communityId: string | undefined;
  const postIds: string[] = [];
  const assetIds: string[] = [];
  try {
    const owner = await account(
      ownerContext.request,
      'community-compose-owner'
    );
    await account(outsider, 'community-compose-outsider');
    await ownerContext.clearCookies();
    const page = await ownerContext.newPage();
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).fill(owner.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);

    const slug = `rr04-public-${Date.now()}`;
    const communityResponse = await ownerContext.request.post(
      origin + '/api/social/community',
      {
        headers,
        data: {
          name: `RR04 public composer ${Date.now()}`,
          slug,
          description: 'RR04 browser audience fixture',
          isPrivate: false,
          joinPolicy: 'public',
          localityType: 'city',
          countryCode: 'US',
          adminArea: 'New York',
          city: 'New York',
        },
      }
    );
    expect(communityResponse.status(), await communityResponse.text()).toBe(
      201
    );
    communityId = (await communityResponse.json()).id;
    await page.goto(origin + `/communities/${slug}/posts`, {
      waitUntil: 'domcontentloaded',
    });
    if (
      !(await page
        .getByLabel('Who can see this post?')
        .isVisible()
        .catch(() => false))
    ) {
      await page
        .getByRole('button', { name: 'Create Post', exact: true })
        .click();
    }
    await expect(page.getByLabel('Who can see this post?')).toHaveValue(
      'community'
    );

    const publish = async (visibility: 'community' | 'public') => {
      const marker = `RR04 community ${visibility} ${Date.now()}`;
      const audienceSelector = page.getByLabel('Who can see this post?');
      if (!(await audienceSelector.isVisible().catch(() => false))) {
        await page
          .getByRole('button', { name: 'Create Post', exact: true })
          .click();
      }
      await expect(audienceSelector).toBeVisible();
      await audienceSelector.selectOption(visibility);
      await page
        .getByRole('textbox', { name: 'Name your Masterpiece', exact: true })
        .fill(marker);
      await page.locator('tiptap-editor [contenteditable="true"]').fill(marker);
      let imageReference: string | undefined;
      if (visibility === 'community') {
        const upload = page.waitForResponse(
          (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === '/api/asset'
        );
        await page.locator('#imageInput').setInputFiles({
          name: 'rr04-public-community-member.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7b8AAAAASUVORK5CYII=',
            'base64'
          ),
        });
        const uploaded = await upload;
        expect(uploaded.status(), await uploaded.text()).toBe(201);
        const pendingImage = page.locator('tiptap-editor img').first();
        await expect(pendingImage).toBeVisible();
        imageReference = (await pendingImage.getAttribute('src')) ?? undefined;
        expect(imageReference).toBeTruthy();
        const pendingUrl = new URL(imageReference!, origin).href;
        expect(
          (
            await outsider.get(pendingUrl, {
              headers: { 'x-ot-appscope': 'social' },
            })
          ).status()
        ).toBe(404);
        expect(
          (
            await ownerContext.request.get(pendingUrl, {
              headers: { 'x-ot-appscope': 'social' },
            })
          ).status()
        ).toBe(200);
        const imageId = imageReference!.match(/[0-9a-f-]{36}/i)?.[0];
        expect(imageId).toBeDefined();
        assetIds.push(imageId!);
      }
      const created = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === '/api/social/post'
      );
      await page.getByRole('button', { name: 'Post', exact: true }).click();
      const response = await created;
      expect(response.status()).toBe(201);
      const post = await response.json();
      postIds.push(post.id);
      expect(post.visibility).toBe(visibility);
      expect(post.communityId).toBe(communityId);
      if (imageReference) {
        expect(post.content).toContain(imageReference);
        const postCard = page
          .locator('.post-container')
          .filter({ hasText: marker });
        const persistedImage = postCard.locator(`img[src="${imageReference}"]`);
        await expect(persistedImage).toBeVisible();
        await expect
          .poll(() =>
            persistedImage.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
            )
          )
          .toBe(true);
        expect(
          (
            await outsider.get(new URL(imageReference, origin).href, {
              headers: { 'x-ot-appscope': 'social' },
            })
          ).status()
        ).toBe(404);
      }
      return { marker, post };
    };

    const membersOnly = await publish('community');
    const explicitPublic = await publish('public');
    const memberRead = await outsider.get(
      origin + `/api/social/post/${membersOnly.post.id}/shared`
    );
    expect(await memberRead.text()).not.toContain(membersOnly.marker);
    const publicRead = await outsider.get(
      origin + `/api/social/post/${explicitPublic.post.id}/shared`
    );
    expect(await publicRead.text()).toContain(explicitPublic.marker);
  } finally {
    for (const id of postIds) {
      const response = await ownerContext.request.delete(
        origin + `/api/social/post/${id}`,
        { headers }
      );
      expect(response.status(), await response.text()).toBe(200);
    }
    for (const id of assetIds) {
      const response = await ownerContext.request.delete(
        origin + `/api/asset/${id}`,
        { headers }
      );
      expect(response.status(), await response.text()).toBe(200);
    }
    if (communityId) {
      const response = await ownerContext.request.delete(
        origin + `/api/social/community/${communityId}`,
        { headers }
      );
      expect(response.status(), await response.text()).toBe(200);
    }
    await Promise.allSettled([ownerContext.close(), outsider.dispose()]);
  }
});

test('RR04 browser: private-community direct post is visible to its author and hidden from a non-member', async ({
  browser,
}, testInfo) => {
  test.setTimeout(60000);
  const viewport = testInfo.project.use.viewport;
  const authorContext = await browser.newContext({ viewport });
  const outsiderContext = await browser.newContext({ viewport });
  const memberContext = await browser.newContext({ viewport });
  const anonymousContext = await browser.newContext({ viewport });
  const anonymous = await anonymousContext.newPage();
  let post: Awaited<ReturnType<typeof fixture>> | undefined;
  let commentAssetId: string | undefined;
  try {
    const author = await account(authorContext.request, 'community-author');
    const outsider = await account(
      outsiderContext.request,
      'community-outsider'
    );
    const member = await account(memberContext.request, 'community-commenter');
    const communitySlug = `rr04-private-media-${Date.now()}`;
    const communityResponse = await authorContext.request.post(
      origin + '/api/social/community',
      {
        headers,
        data: {
          name: `RR04 private media ${Date.now()}`,
          slug: communitySlug,
          description: 'RR04 private comment media fixture',
          isPrivate: true,
          joinPolicy: 'invite_only',
          localityType: 'city',
          countryCode: 'US',
          adminArea: 'New York',
          city: 'New York',
        },
      }
    );
    expect(communityResponse.status(), await communityResponse.text()).toBe(
      201
    );
    const provisionedCommunityId = (await communityResponse.json())
      .id as string;
    post = await fixture(
      author,
      true,
      'client-interface',
      provisionedCommunityId
    );
    await socialFixtureCommand('UPDATE_POST', {
      id: post.id,
      data: { visibility: 'public' },
      userId: author.userId,
      profileId: author.profileId,
    });
    const membership = await joinFixture(
      post.communityId!,
      member,
      author.userId
    );
    expect(
      (
        await (
          await authorContext.request.get(
            origin + `/api/social/post/${post.id}/shared`
          )
        ).json()
      ).content
    ).toBe(post.marker);
    for (const [context, user] of [
      [authorContext, author],
      [outsiderContext, outsider],
    ] as const) {
      await context.clearCookies();
      const page = await context.newPage();
      page.on('response', (response) => {
        if (response.url().includes('/api/social/post/'))
          console.log(
            'Post response',
            response.status(),
            new URL(response.url()).pathname
          );
      });
      await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Email', { exact: true }).fill(user.email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Login', exact: true }).click();
      await expect(page).not.toHaveURL(/\/login$/);
      await page.goto(origin + `/feed/post/${post.id}`, {
        waitUntil: 'domcontentloaded',
      });
      if (user === author)
        await expect(
          page.getByText(post.marker, { exact: true }).first()
        ).toBeVisible();
      else {
        // A backend denial is required even if the UI happens to hide the post.
        const response = await context.request.get(
          origin + `/api/social/post/${post.id}/shared`
        );
        expect(await response.text()).not.toContain(post.marker);
        await expect(page.getByText(post.marker, { exact: true })).toHaveCount(
          0
        );
      }
    }
    await memberContext.clearCookies();
    const memberPage = await memberContext.newPage();
    await memberPage.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
    await memberPage.getByLabel('Email', { exact: true }).fill(member.email);
    await memberPage.getByLabel('Password', { exact: true }).fill(password);
    await memberPage
      .getByRole('button', { name: 'Login', exact: true })
      .click();
    await expect(memberPage).not.toHaveURL(/\/login$/);
    const communityInfoLoaded = memberPage.waitForResponse(
      (r) =>
        r.request().method() === 'GET' &&
        new URL(r.url()).pathname ===
          `/api/social/community/${post.communityId}`
    );
    await memberPage.goto(origin + `/feed/post/${post.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await communityInfoLoaded;
    const postCard = memberPage
      .locator('.post-container')
      .filter({ hasText: post.marker });
    await expect(postCard).toBeVisible();
    await postCard
      .getByRole('button', { name: 'Leave a Comment', exact: true })
      .click();
    const editor = postCard.locator(
      'tiptap-editor.comment-editor [contenteditable="true"]'
    );
    await expect(editor).toBeVisible();
    await editor.fill('RR04 private community comment image');
    const uploaded = memberPage.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname === '/api/asset'
    );
    await postCard.locator('#commentImageInput').setInputFiles({
      name: 'rr04-private-community-comment.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7b8AAAAASUVORK5CYII=',
        'base64'
      ),
    });
    const uploadResponse = await uploaded;
    expect(uploadResponse.status(), await uploadResponse.text()).toBe(201);
    const image = editor.locator('img').first();
    await expect(image).toBeVisible();
    const imageReference = await image.getAttribute('src');
    expect(imageReference).toBeTruthy();
    commentAssetId = imageReference!.match(/[0-9a-f-]{36}/i)?.[0];
    expect(commentAssetId).toBeDefined();
    const imageUrl = new URL(imageReference!, origin).href;
    expect(
      (
        await anonymousContext.request.get(imageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(404);
    expect(
      (
        await outsiderContext.request.get(imageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(404);
    expect(
      (
        await memberContext.request.get(imageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(200);
    const saved = memberPage.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname === '/api/social/comment'
    );
    await postCard.getByRole('button', { name: 'Submit', exact: true }).click();
    const savedResponse = await saved;
    expect(savedResponse.status()).toBe(201);
    const comment = await savedResponse.json();
    const commentId = comment.id;
    const visibleComment = postCard
      .locator('.comment-content')
      .filter({ hasText: 'RR04 private community comment image' });
    await expect(visibleComment.locator('img')).toHaveCount(1);
    await expect
      .poll(() =>
        visibleComment
          .locator('img')
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
          )
      )
      .toBe(true);
    const removedBody = await memberContext.request.put(
      origin + `/api/social/comment/update/${commentId}`,
      {
        headers: { 'x-ot-appscope': 'social' },
        data: { content: 'RR04 image reference removed' },
      }
    );
    expect(removedBody.status()).toBe(200);
    expect(
      (
        await memberContext.request.get(imageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(200);
    const revoke = await authorContext.request.delete(
      origin + `/api/social/community/members/${membership.id}`,
      {
        headers,
        data: { profileId: member.profileId, communityId: post.communityId },
      }
    );
    expect(revoke.status()).toBe(200);
    expect(
      (
        await memberContext.request.get(imageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(404);
  } finally {
    if (commentAssetId) {
      const assetDelete = await memberContext.request.delete(
        origin + `/api/asset/${commentAssetId}`,
        { headers }
      );
      expect(assetDelete.status(), await assetDelete.text()).toBe(200);
    }
    if (post) {
      const postDelete = await socialFixtureCommand('DELETE_POST', {
        id: post.id,
        userId: post.authorId,
      });
      expect(postDelete?.success).toBe(true);
      if (post.communityId) {
        const communityDelete = await authorContext.request.delete(
          origin + `/api/social/community/${post.communityId}`,
          { headers }
        );
        expect(communityDelete.status(), await communityDelete.text()).toBe(
          200
        );
      }
    }
    await Promise.allSettled([
      authorContext.close(),
      outsiderContext.close(),
      memberContext.close(),
      anonymousContext.close(),
    ]);
  }
});

test('RR04 browser: compose publishes the selected audience and outsiders cannot widen it', async ({
  browser,
  playwright,
}, testInfo) => {
  test.setTimeout(120000);
  const authorContext = await browser.newContext({
    viewport: testInfo.project.use.viewport,
  });
  const outsider = await playwright.request.newContext();
  const commentOutsider = await playwright.request.newContext();
  const anonymous = await playwright.request.newContext();
  const createdPostIds: string[] = [];
  const createdAssets: Array<{ id: string; owner: APIRequestContext }> = [];
  let createdShareId: string | undefined;
  let readerContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  let primaryError: unknown;
  try {
    const author = await test.step('register compose author', () =>
      account(authorContext.request, 'compose-audience-author'));
    const reader = await test.step('register API share reader', () =>
      account(outsider, 'compose-audience-reader'));
    await test.step('register separate authenticated nonfollower', () =>
      account(commentOutsider, 'compose-comment-outsider'));
    readerContext = await browser.newContext({
      viewport: testInfo.project.use.viewport,
    });
    const readerBrowserUser =
      await test.step('register open-feed browser reader', () =>
        account(readerContext!.request, 'compose-realtime-reader'));
    await readerContext.clearCookies();
    const readerPage = await readerContext.newPage();
    let realtimeMarker = '';
    let realtimePostId = '';
    const realtimeSockets: Array<{
      pageRole: 'reader';
      socketIndex: number;
      origin: string;
      pathname: string;
      namespace: 'social';
      sid?: string;
    }> = [];
    const realtimeWireEvents: Array<{
      socketIndex: number;
      socketSid?: string;
      direction: 'sent' | 'received';
      event: string;
      containsMarker: boolean;
      containsPostId: boolean;
    }> = [];
    const recordRealtimeFrame = (
      socket: (typeof realtimeSockets)[number],
      direction: 'sent' | 'received',
      frame: string | Buffer
    ) => {
      const raw = String(frame);
      const arrayStart = raw.indexOf('[');
      if (arrayStart < 0) return;
      try {
        const packet = JSON.parse(raw.slice(arrayStart));
        if (!Array.isArray(packet) || typeof packet[0] !== 'string') return;
        const event = packet[0] as string;
        if (
          ![
            'feed',
            'post_created',
            'social_content_invalidated',
            'GET_FEED',
            'SUBSCRIBE_POSTS',
            'subscribed',
            'UNSUBSCRIBE_POSTS',
            'unsubscribed',
            'error',
            'exception',
            'connect_error',
          ].includes(event)
        ) {
          return;
        }
        const serializedData = JSON.stringify(packet[1] ?? null);
        realtimeWireEvents.push({
          socketIndex: socket.socketIndex,
          ...(socket.sid ? { socketSid: socket.sid } : {}),
          direction,
          event,
          containsMarker:
            !!realtimeMarker && serializedData.includes(realtimeMarker),
          containsPostId:
            !!realtimePostId && serializedData.includes(realtimePostId),
        });
      } catch {
        // Socket.IO control frames are intentionally ignored.
      }
    };
    let realtimeSocketIndex = 0;
    readerPage.on('websocket', (socket) => {
      const socketUrl = new URL(socket.url());
      if (
        socketUrl.port !== '3301' ||
        !socketUrl.pathname.startsWith('/socket.io')
      ) {
        return;
      }
      let connection: (typeof realtimeSockets)[number] | undefined;
      const recordFrame = (
        direction: 'sent' | 'received',
        payload: string | Buffer
      ) => {
        const raw = String(payload);
        const namespacePacket = '40/social,';
        if (raw.startsWith(namespacePacket)) {
          if (!connection) {
            connection = {
              pageRole: 'reader',
              socketIndex: ++realtimeSocketIndex,
              origin: socketUrl.origin,
              pathname: socketUrl.pathname,
              namespace: 'social',
            };
            realtimeSockets.push(connection);
          }
          if (direction === 'received') {
            try {
              const connectData = JSON.parse(raw.slice(namespacePacket.length));
              if (typeof connectData?.sid === 'string') {
                connection.sid = connectData.sid;
              }
            } catch {
              // No handshake metadata is emitted unless sid parses cleanly.
            }
          }
          return;
        }
        if (!connection) return;
        recordRealtimeFrame(connection, direction, payload);
      };
      socket.on('framesent', (frame) => recordFrame('sent', frame.payload));
      socket.on('framereceived', (frame) =>
        recordFrame('received', frame.payload)
      );
      socket.on('close', () => {
        if (!connection) return;
        realtimeWireEvents.push({
          socketIndex: connection.socketIndex,
          ...(connection.sid ? { socketSid: connection.sid } : {}),
          direction: 'received',
          event: 'socket_close',
          containsMarker: false,
          containsPostId: false,
        });
      });
      socket.on('socketerror', () => {
        if (!connection) return;
        realtimeWireEvents.push({
          socketIndex: connection.socketIndex,
          ...(connection.sid ? { socketSid: connection.sid } : {}),
          direction: 'received',
          event: 'socket_error',
          containsMarker: false,
          containsPostId: false,
        });
      });
    });
    await readerPage.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
    await readerPage
      .getByLabel('Email', { exact: true })
      .fill(readerBrowserUser.email);
    await readerPage.getByLabel('Password', { exact: true }).fill(password);
    await readerPage
      .getByRole('button', { name: 'Login', exact: true })
      .click();
    await expect(readerPage).not.toHaveURL(/\/login$/);
    await readerPage.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });
    await authorContext.clearCookies();
    const page = await authorContext.newPage();
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).fill(author.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    await page.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });

    const marker = `RR04 browser audience ${Date.now()}`;
    await page.getByLabel('Who can see this post?').selectOption('followers');
    await page
      .getByRole('textbox', { name: 'Name your Masterpiece', exact: true })
      .fill(marker);
    await page.locator('tiptap-editor [contenteditable="true"]').fill(marker);
    const imageUpload = page.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname === '/api/asset'
    );
    await page.locator('#imageInput').setInputFiles({
      name: 'rr04-pending.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7b8AAAAASUVORK5CYII=',
        'base64'
      ),
    });
    const imageUploadResponse = await imageUpload;
    expect(imageUploadResponse.status(), await imageUploadResponse.text()).toBe(
      201
    );
    const pendingImage = page.locator('tiptap-editor img').first();
    await expect(pendingImage).toBeVisible();
    const imageReference = await pendingImage.getAttribute('src');
    expect(imageReference).toBeTruthy();
    const imageId = imageReference!.match(/[0-9a-f-]{36}$/i)?.[0];
    expect(imageId).toBeDefined();
    createdAssets.push({ id: imageId!, owner: authorContext.request });
    const pendingImageUrl = new URL(imageReference!, origin).href;
    for (const context of [anonymous, outsider]) {
      expect(
        (
          await context.get(pendingImageUrl, {
            headers: { 'x-ot-appscope': 'social' },
          })
        ).status()
      ).toBe(404);
    }
    expect(
      (
        await authorContext.request.get(pendingImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(200);
    await expect
      .poll(() =>
        pendingImage.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
        )
      )
      .toBe(true);
    const created = page.waitForResponse((response) => {
      const request = response.request();
      return (
        request.method() === 'POST' &&
        new URL(response.url()).pathname === '/api/social/post'
      );
    });
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const createdPost = await response.json();
    createdPostIds.push(createdPost.id);
    expect(createdPost.visibility).toBe('followers');
    expect(createdPost.profileId).toBe(author.profileId);
    expect(createdPost.content).toContain(imageReference);

    for (const context of [anonymous, outsider]) {
      const direct = await context.get(
        origin + `/api/social/post/${createdPost.id}/shared`
      );
      expect(await direct.text()).not.toContain(marker);
    }
    const follow = {
      followerId: reader.profileId,
      followeeId: author.profileId,
    };
    expect(
      (
        await outsider.post(origin + '/api/social/follow', { data: follow })
      ).status()
    ).toBe(201);
    expect(
      await (
        await outsider.get(origin + `/api/social/post/${createdPost.id}/shared`)
      ).text()
    ).toContain(marker);
    const browserFollow = {
      followerId: readerBrowserUser.profileId,
      followeeId: author.profileId,
    };
    expect(
      (
        await readerContext.request.post(origin + '/api/social/follow', {
          data: browserFollow,
        })
      ).status()
    ).toBe(201);
    await readerPage
      .getByRole('button', { name: 'Following Feed', exact: true })
      .click();
    const followedPost = readerPage
      .locator('.post-container')
      .filter({ hasText: marker });
    await expect(followedPost).toBeVisible();
    await expect
      .poll(() =>
        followedPost
          .locator('img')
          .first()
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
          )
      )
      .toBe(true);

    await followedPost
      .getByRole('button', { name: 'Leave a Comment', exact: true })
      .click();
    const commentEditor = followedPost.locator(
      'tiptap-editor.comment-editor [contenteditable="true"]'
    );
    await expect(commentEditor).toBeVisible();
    await commentEditor.fill('RR04 different-author comment image');
    const commentUpload = readerPage.waitForResponse(
      (r) =>
        r.request().method() === 'POST' &&
        new URL(r.url()).pathname === '/api/asset'
    );
    await followedPost.locator('#commentImageInput').setInputFiles({
      name: 'rr04-comment.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7b8AAAAASUVORK5CYII=',
        'base64'
      ),
    });
    expect((await commentUpload).status()).toBe(201);
    const pendingCommentImage = commentEditor.locator('img').first();
    await expect(pendingCommentImage).toBeVisible();
    const commentImageReference = await pendingCommentImage.getAttribute('src');
    expect(commentImageReference).toBeTruthy();
    const commentAssetId = commentImageReference!.match(/[0-9a-f-]{36}/i)?.[0];
    expect(commentAssetId).toBeDefined();
    createdAssets.push({ id: commentAssetId!, owner: readerContext.request });
    const commentImageUrl = new URL(commentImageReference!, origin).href;
    expect(
      (
        await anonymous.get(commentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(404);
    expect(
      (
        await commentOutsider.get(commentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(404);
    expect(
      (
        await readerContext.request.get(commentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(200);
    await expect(followedPost).toBeVisible();
    const submitComment = followedPost.getByRole('button', {
      name: 'Submit',
      exact: true,
    });
    await expect(submitComment).toBeVisible();
    await expect(submitComment).toBeEnabled();
    const savedCommentResponse = readerPage.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/social/comment'
    );
    await submitComment.click();
    expect((await savedCommentResponse).status()).toBe(201);
    const savedComment = followedPost
      .locator('.comment-content')
      .filter({ hasText: 'RR04 different-author comment image' });
    await expect(savedComment).toBeVisible();
    await expect(savedComment.locator('img')).toHaveCount(1);
    await expect
      .poll(() =>
        savedComment
          .locator('img')
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
          )
      )
      .toBe(true);
    await readerPage.reload();
    await readerPage
      .getByRole('button', { name: 'Following Feed', exact: true })
      .click();
    const persistedComment = readerPage
      .locator('.post-container')
      .filter({ hasText: marker })
      .locator('.comment-content')
      .filter({ hasText: 'RR04 different-author comment image' });
    await expect(persistedComment.locator('img')).toHaveCount(1);
    await expect
      .poll(() =>
        persistedComment
          .locator('img')
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
          )
      )
      .toBe(true);
    expect(
      (
        await readerContext.request.post(
          origin + '/api/social/follow/unfollow',
          { data: browserFollow }
        )
      ).status()
    ).toBe(201);
    await readerPage
      .getByRole('button', { name: 'Public Feed', exact: true })
      .click();
    await readerPage
      .getByRole('button', { name: 'Following Feed', exact: true })
      .click();
    await expect(
      readerPage.locator('.post-container').filter({ hasText: marker })
    ).toHaveCount(0);
    expect(
      (
        await readerContext.request.get(commentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(404);
    await readerPage
      .getByRole('button', { name: 'Public Feed', exact: true })
      .click();
    const authorizedAsset = await outsider.get(
      new URL(imageReference!, origin).href,
      { headers: { 'x-ot-appscope': 'social' } }
    );
    expect(authorizedAsset.status()).toBe(200);
    const invalidAudience = await outsider.post(
      origin + `/api/posts/${createdPost.id}/share`,
      {
        data: { visibility: 'everyone' },
      }
    );
    expect(invalidAudience.status()).toBe(400);
    expect(
      await (
        await outsider.get(origin + `/api/posts/${createdPost.id}/shares`)
      ).json()
    ).toEqual([]);
    const wideningAttempt = await outsider.post(
      origin + `/api/posts/${createdPost.id}/share`,
      {
        data: { visibility: 'public' },
      }
    );
    expect(wideningAttempt.status()).toBe(403);
    const spoofedShare = await outsider.post(
      origin + `/api/posts/${createdPost.id}/share`,
      {
        data: { sharedById: author.userId },
      }
    );
    expect(spoofedShare.status()).toBe(400);
    expect(
      await (
        await outsider.get(origin + `/api/posts/${createdPost.id}/shares`)
      ).json()
    ).toEqual([]);
    const shareResponse = await outsider.post(
      origin + `/api/posts/${createdPost.id}/share`,
      { data: {} }
    );
    expect(shareResponse.status()).toBe(201);
    const share = await shareResponse.json();
    createdShareId = share.id;
    expect(share.sharedById).toBe(reader.profileId);
    expect(share.visibility).toBe('followers');
    const listedShares = await outsider.get(
      origin + `/api/posts/${createdPost.id}/shares`
    );
    expect(
      (await listedShares.json()).map((item: { id: string }) => item.id)
    ).toContain(share.id);
    const nonOwnerDelete = await authorContext.request.delete(
      origin + `/api/posts/shares/${share.id}`
    );
    expect(nonOwnerDelete.status()).toBe(403);
    const unfollow = await outsider.post(
      origin + '/api/social/follow/unfollow',
      {
        data: { followerId: reader.profileId, followeeId: author.profileId },
      }
    );
    expect(unfollow.status()).toBe(201);
    expect(
      await (
        await outsider.get(origin + `/api/posts/${createdPost.id}/shares`)
      ).json()
    ).toEqual([]);
    expect(
      (
        await outsider.post(origin + '/api/social/follow', { data: follow })
      ).status()
    ).toBe(201);
    const deleteOwnedShare = await outsider.delete(
      origin + `/api/posts/shares/${share.id}`
    );
    expect(deleteOwnedShare.status()).toBe(200);
    const deleteMissingShare = await outsider.delete(
      origin + `/api/posts/shares/${share.id}`
    );
    expect(deleteMissingShare.status()).toBe(404);
    createdShareId = undefined;
    expect(
      await (
        await outsider.get(origin + `/api/posts/${createdPost.id}/shares`)
      ).json()
    ).toEqual([]);
    const removedReference = await authorContext.request.put(
      origin + `/api/social/post/update/${createdPost.id}`,
      {
        headers: { ...headers, 'x-ot-appscope': 'social' },
        data: { content: marker },
      }
    );
    expect(removedReference.status()).toBe(200);
    const afterReferenceRemoval = await outsider.get(
      new URL(imageReference!, origin).href,
      { headers: { 'x-ot-appscope': 'social' } }
    );
    expect(afterReferenceRemoval.status()).toBe(200);
    const anonymousAsset = await anonymous.get(
      new URL(imageReference!, origin).href,
      { headers: { 'x-ot-appscope': 'social' } }
    );
    expect(anonymousAsset.status()).toBe(404);
    const publicMarker = `RR04 realtime public ${Date.now()}`;
    realtimeMarker = publicMarker;
    await page.getByLabel('Who can see this post?').selectOption('public');
    await page
      .getByRole('textbox', { name: 'Name your Masterpiece', exact: true })
      .fill(publicMarker);
    await page
      .locator('tiptap-editor [contenteditable="true"]')
      .fill(publicMarker);
    const publicCreated = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/social/post'
    );
    await page.getByRole('button', { name: 'Post', exact: true }).click();
    const publicResponse = await publicCreated;
    expect(publicResponse.status()).toBe(201);
    const publicPost = await publicResponse.json();
    createdPostIds.push(publicPost.id);
    realtimePostId = publicPost.id;
    expect(publicPost.visibility).toBe('public');
    const readerDirectPost = await readerContext.request.get(
      origin + `/api/social/post/${publicPost.id}`,
      { headers }
    );
    expect(readerDirectPost.status()).toBe(200);
    expect((await readerDirectPost.json()).content).toContain(publicMarker);
    const anonymousDirectPost = await anonymous.get(
      origin + `/api/social/post/${publicPost.id}/shared`,
      { headers: { 'x-ot-appscope': 'social' } }
    );
    expect(anonymousDirectPost.status()).toBe(200);
    expect((await anonymousDirectPost.json()).content).toContain(publicMarker);
    // This reader had the feed open before the server committed the new post.
    let realtimeAssertionError: unknown;
    try {
      await expect(
        readerPage.locator('.post-container').filter({ hasText: publicMarker })
      ).toBeVisible({ timeout: 15000 });
    } catch (error) {
      realtimeAssertionError = error;
    } finally {
      console.log(
        'RR04_SAFE_REALTIME_WIRE',
        JSON.stringify(realtimeWireEvents)
      );
      console.log(
        'RR04_SAFE_REALTIME_SOCKETS',
        JSON.stringify({ pageRole: 'reader', sockets: realtimeSockets })
      );
      await writeFile(
        testInfo.outputPath('rr04-safe-realtime-wire.json'),
        JSON.stringify(
          {
            pageRole: 'reader',
            sockets: realtimeSockets,
            events: realtimeWireEvents,
          },
          null,
          2
        )
      );
      await testInfo.attach('rr04-safe-realtime-wire-events', {
        body: Buffer.from(JSON.stringify(realtimeWireEvents, null, 2)),
        contentType: 'application/json',
      });
    }
    if (realtimeAssertionError) throw realtimeAssertionError;
    const publicPostCard = readerPage
      .locator('.post-container')
      .filter({ hasText: publicMarker });
    await publicPostCard
      .getByRole('button', { name: 'Leave a Comment', exact: true })
      .click();
    const publicCommentEditor = publicPostCard.locator(
      'tiptap-editor.comment-editor [contenteditable="true"]'
    );
    await expect(publicCommentEditor).toBeVisible();
    await publicCommentEditor.fill('RR04 personal public comment image');
    const publicCommentUpload = readerPage.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/asset'
    );
    await publicPostCard.locator('#commentImageInput').setInputFiles({
      name: 'rr04-public-comment.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/7b8AAAAASUVORK5CYII=',
        'base64'
      ),
    });
    const publicCommentUploadResponse = await publicCommentUpload;
    expect(
      publicCommentUploadResponse.status(),
      await publicCommentUploadResponse.text()
    ).toBe(201);
    const pendingPublicCommentImage = publicCommentEditor
      .locator('img')
      .first();
    await expect(pendingPublicCommentImage).toBeVisible();
    const publicCommentImageReference =
      await pendingPublicCommentImage.getAttribute('src');
    expect(publicCommentImageReference).toBeTruthy();
    const publicCommentAssetId =
      publicCommentImageReference!.match(/[0-9a-f-]{36}/i)?.[0];
    expect(publicCommentAssetId).toBeDefined();
    createdAssets.push({
      id: publicCommentAssetId!,
      owner: readerContext.request,
    });
    const publicCommentImageUrl = new URL(publicCommentImageReference!, origin)
      .href;
    expect(
      (
        await anonymous.get(publicCommentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(200);
    await expect
      .poll(() =>
        pendingPublicCommentImage.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
        )
      )
      .toBe(true);
    await publicPostCard
      .getByRole('button', { name: 'Submit', exact: true })
      .click();
    const savedPublicComment = publicPostCard
      .locator('.comment-content')
      .filter({ hasText: 'RR04 personal public comment image' });
    await expect(savedPublicComment.locator('img')).toHaveCount(1);
    await expect
      .poll(() =>
        savedPublicComment
          .locator('img')
          .evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
          )
      )
      .toBe(true);
    expect(
      (
        await anonymous.get(publicCommentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(200);
    const publicParentEdit = await authorContext.request.put(
      origin + `/api/social/post/update/${publicPost.id}`,
      {
        headers: { ...headers, 'x-ot-appscope': 'social' },
        data: { title: `${publicMarker} edited`, content: publicMarker },
      }
    );
    expect(publicParentEdit.status()).toBe(200);
    expect(
      (
        await anonymous.get(publicCommentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(200);
    const spoofedPublicShare = await outsider.post(
      origin + `/api/posts/${publicPost.id}/share`,
      {
        data: { sharedById: author.userId },
      }
    );
    expect(spoofedPublicShare.status()).toBe(400);
    expect(
      await (
        await outsider.get(origin + `/api/posts/${publicPost.id}/shares`)
      ).json()
    ).toEqual([]);
    const persistedShare = await outsider.post(
      origin + `/api/posts/${publicPost.id}/share`,
      { data: {} }
    );
    expect(persistedShare.status()).toBe(201);
    const persistedShareBody = await persistedShare.json();
    createdShareId = persistedShareBody.id;
    expect(persistedShareBody.sharedById).toBe(reader.profileId);
    const stopFollowing = await outsider.post(
      origin + '/api/social/follow/unfollow',
      {
        data: { followerId: reader.profileId, followeeId: author.profileId },
      }
    );
    expect(stopFollowing.status()).toBe(201);
    const narrowSource = await authorContext.request.put(
      origin + `/api/social/post/update/${publicPost.id}`,
      {
        headers: { ...headers, 'x-ot-appscope': 'social' },
        data: { visibility: 'followers' },
      }
    );
    expect(narrowSource.status()).toBe(200);
    expect(
      await (
        await outsider.get(origin + `/api/social/post/${publicPost.id}/shared`)
      ).text()
    ).not.toContain(publicMarker);
    expect(
      await (
        await outsider.get(origin + `/api/posts/${publicPost.id}/shares`)
      ).json()
    ).toEqual([]);
    expect(
      (
        await anonymous.get(publicCommentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(404);
    expect(
      (
        await readerContext.request.get(publicCommentImageUrl, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).status()
    ).toBe(404);
    expect(
      (
        await outsider.delete(origin + `/api/posts/shares/${createdShareId}`)
      ).status()
    ).toBe(200);
    createdShareId = undefined;
    const deletedSource = await authorContext.request.delete(
      origin + `/api/social/post/${publicPost.id}`,
      { headers }
    );
    expect(deletedSource.status()).toBe(200);
    createdPostIds.splice(createdPostIds.indexOf(publicPost.id), 1);
    expect(
      await (
        await outsider.get(origin + `/api/posts/${publicPost.id}/shares`)
      ).json()
    ).toEqual([]);
  } catch (error) {
    primaryError = error;
  }
  const cleanupErrors: unknown[] = [];
  const cleanup = async (action: () => Promise<unknown>) => {
    try {
      await action();
    } catch (error) {
      cleanupErrors.push(error);
    }
  };
  if (createdShareId) {
    await cleanup(async () => {
      const response = await outsider.delete(
        origin + `/api/posts/shares/${createdShareId}`
      );
      expect(response.status(), await response.text()).toBe(200);
    });
  }
  for (const id of createdPostIds) {
    await cleanup(async () => {
      const response = await authorContext.request.delete(
        origin + `/api/social/post/${id}`,
        { headers }
      );
      expect(response.status(), await response.text()).toBe(200);
    });
  }
  for (const asset of createdAssets) {
    await cleanup(async () => {
      const response = await asset.owner.delete(
        origin + `/api/asset/${asset.id}`,
        { headers }
      );
      expect(response.status(), await response.text()).toBe(200);
    });
  }
  await Promise.allSettled([
    authorContext.close(),
    outsider.dispose(),
    commentOutsider.dispose(),
    anonymous.dispose(),
    readerContext?.close(),
  ]);
  if (cleanupErrors.length) {
    const errors = primaryError
      ? [primaryError, ...cleanupErrors]
      : cleanupErrors;
    throw new AggregateError(errors, 'RR04 compose test cleanup failed');
  }
  if (primaryError) throw primaryError;
});

test('RR04 realtime: a non-follower does not receive followers-only updates', async ({
  playwright,
}) => {
  const authorContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  let socket: ReturnType<typeof io> | undefined;
  try {
    const author = await account(authorContext, 'socket-author');
    const outsider = await account(outsiderContext, 'socket-outsider');
    const post = await fixture(author, false);
    const cookies = (await outsiderContext.storageState()).cookies;
    socket = io('http://127.0.0.1:3301/social', {
      transports: ['websocket'],
      extraHeaders: {
        Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
      },
    });
    const client = socket;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Socket connection timeout')),
        10000
      );
      client.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      client.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    // Connection acknowledgement precedes async server-side session validation.
    // Retry subscription until its acknowledgement; do not assume connect means ready.
    await new Promise<void>((resolve, reject) => {
      const retry = setInterval(
        () => client.emit('SUBSCRIBE_POSTS', { profileId: outsider.profileId }),
        200
      );
      const deadline = setTimeout(() => {
        clearInterval(retry);
        reject(new Error('Subscription timeout'));
      }, 10000);
      client.once('subscribed', () => {
        clearInterval(retry);
        clearTimeout(deadline);
        resolve();
      });
    });
    let finishObservation: (payload: unknown) => void = () => undefined;
    const received = new Promise<unknown>((resolve) => {
      finishObservation = resolve;
      client.once('post_updated', resolve);
    });
    const update = await authorContext.put(
      origin + `/api/social/post/update/${post.id}`,
      {
        headers: { 'x-ot-appscope': 'social' },
        data: { content: post.marker },
      }
    );
    expect(update.status()).toBe(200);
    // Start the absence window after the triggering request succeeds, so a
    // slow HTTP response cannot make this privacy assertion pass prematurely.
    const deadline = setTimeout(() => finishObservation(null), 1500);
    const payload = await received;
    clearTimeout(deadline);
    expect(JSON.stringify(payload)).not.toContain(post.marker);
  } finally {
    socket?.disconnect();
    await authorContext.dispose();
    await outsiderContext.dispose();
  }
});

// Owned service fixtures establish membership states without depending on
// invitation delivery or workspace administration acceptance (RR-05/RR-08).
async function socialFixtureCommand(command: string, payload: unknown) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  await client.connect();
  try {
    return await firstValueFrom(client.send({ cmd: command }, payload));
  } finally {
    client.close();
  }
}
async function joinFixture(
  communityId: string,
  user: { userId: string; profileId: string },
  ownerId?: string
) {
  const member = await socialFixtureCommand('JOIN_COMMUNITY', {
    dto: { communityId },
    userId: user.userId,
    profileId: user.profileId,
  });
  expect(member.status).toBe('pending');
  if (ownerId)
    await socialFixtureCommand('APPROVE_COMMUNITY_MEMBER', {
      memberId: member.id,
      approverId: ownerId,
    });
  return member;
}

test('RR04 I01 API: membership, alternate profiles, comments and search use the same private-community policy', async ({
  playwright,
}) => {
  test.setTimeout(90_000);
  const ownerContext = await playwright.request.newContext();
  const memberContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  let alternateContext: APIRequestContext | undefined;
  try {
    const owner = await test.step('initialize owner account', () =>
      account(ownerContext, 'matrix-owner'));
    const member = await test.step('initialize member account', () =>
      account(memberContext, 'matrix-member'));
    const outsider = await test.step('initialize outsider account', () =>
      account(outsiderContext, 'matrix-outsider'));
    const post = await fixture(owner, true);
    expect(post.communityId).toBeTruthy();
    const membership = await joinFixture(post.communityId!, member);
    const url = origin + `/api/social/post/${post.id}/shared`;
    // A pending row is not an approved membership grant.
    expect(await (await memberContext.get(url)).text()).not.toContain(
      post.marker
    );
    await socialFixtureCommand('APPROVE_COMMUNITY_MEMBER', {
      memberId: membership.id,
      approverId: owner.userId,
    });
    expect((await (await memberContext.get(url)).json()).content).toBe(
      post.marker
    );
    const commentMarker = post.marker + ' private comment';
    const cast = await ownerContext.post(origin + '/api/social/vote', {
      headers: { 'x-ot-appscope': 'social' },
      data: {
        postId: post.id,
        profileId: owner.profileId,
        userId: owner.userId,
        value: 1,
      },
    });
    expect(cast.status()).toBe(201);
    const vote = await cast.json();
    const voteUrl = origin + `/api/social/vote/${vote.id}`;
    const visibleVote = await memberContext.get(voteUrl);
    expect(visibleVote.status()).toBe(200);
    expect((await visibleVote.json()).id).toBe(vote.id);
    const deniedVote = await outsiderContext.get(voteUrl);
    expect(deniedVote.status()).toBe(404);
    expect(await deniedVote.text()).not.toContain(post.marker);
    for (const [path, data] of [
      [
        '/api/social/vote',
        { postId: post.id, profileId: outsider.profileId, value: -1 },
      ],
      [
        '/api/social/comment',
        {
          postId: post.id,
          profileId: outsider.profileId,
          content: commentMarker,
        },
      ],
    ] as const) {
      const denied = await outsiderContext.post(origin + path, {
        headers: { 'x-ot-appscope': 'social' },
        data,
      });
      expect(denied.status()).toBe(404);
      expect(await denied.text()).not.toContain(post.marker);
    }
    const comment = await socialFixtureCommand('CREATE_COMMENT', {
      postId: post.id,
      profileId: owner.profileId,
      userId: owner.userId,
      content: commentMarker,
    });
    const componentMarker = post.marker + ' private component';
    const component = await socialFixtureCommand('CREATE_SOCIAL_COMPONENT', {
      postId: post.id,
      instanceId: `rr04-${Date.now()}`,
      componentType: 'text',
      componentData: { text: componentMarker },
      position: 0,
    });
    const attachmentMarker = post.marker + ' private attachment';
    const attachment = await socialFixtureCommand('CREATE_ATTACHMENT', {
      postId: post.id,
      attachment: {
        name: attachmentMarker,
        url: `https://example.test/rr04/${post.id}`,
        type: 'IMAGE',
        size: 1,
      },
    });
    const attachmentUrl = origin + `/api/social/attachment/${attachment.id}`;
    expect(await privacyText(memberContext, attachmentUrl)).toContain(
      attachmentMarker
    );
    expect(await privacyText(outsiderContext, attachmentUrl)).not.toContain(
      attachmentMarker
    );
    for (const [reader, allowed] of [
      [memberContext, true],
      [outsiderContext, false],
    ] as const) {
      const found = await reader.post(origin + '/api/social/attachments/find', {
        headers: { 'x-ot-appscope': 'social' },
        data: { name: attachmentMarker },
      });
      expect(found.status()).toBe(201);
      if (allowed) expect(await found.text()).toContain(attachmentMarker);
      else expect(await found.text()).not.toContain(attachmentMarker);
    }
    const componentUrls = [
      origin + `/api/social-components/${component.id}`,
      origin + `/api/social-components/post/${post.id}`,
    ];
    for (const componentUrl of componentUrls) {
      expect(await (await memberContext.get(componentUrl)).text()).toContain(
        componentMarker
      );
      expect(await privacyText(outsiderContext, componentUrl)).not.toContain(
        componentMarker
      );
    }
    expect(
      (
        await (
          await memberContext.get(origin + `/api/social/comment/${comment.id}`)
        ).json()
      ).content
    ).toBe(commentMarker);
    const search =
      origin + `/api/search?q=${encodeURIComponent(post.marker)}&type=posts`;
    const personalizedFeed =
      origin +
      '/api/social/feed?includePublic=true&includeCommunities=true&limit=100';
    const memberFeed = await memberContext.get(personalizedFeed, {
      headers: { 'x-ot-appscope': 'client-interface' },
    });
    expect(memberFeed.status()).toBe(200);
    expect(await memberFeed.text()).toContain(post.marker);
    const outsiderFeed = await outsiderContext.get(personalizedFeed, {
      headers: { 'x-ot-appscope': 'client-interface' },
    });
    expect(outsiderFeed.status()).toBe(200);
    expect(await outsiderFeed.text()).not.toContain(post.marker);
    expect(
      await privacyText(
        outsiderContext,
        origin + '/api/search/trending?limit=1000'
      )
    ).not.toContain(post.marker);
    const hiddenMarker = post.marker + ' hidden public';
    await socialFixtureCommand('CREATE_POST', {
      title: hiddenMarker,
      content: hiddenMarker,
      userId: owner.userId,
      profileId: owner.profileId,
      appScope: 'social',
      moderationStatus: 'hidden',
    });
    const hiddenMemberFeed = await memberContext.get(personalizedFeed, {
      headers: { 'x-ot-appscope': 'client-interface' },
    });
    expect(hiddenMemberFeed.status()).toBe(200);
    expect(await hiddenMemberFeed.text()).not.toContain(hiddenMarker);
    expect(await (await memberContext.get(search)).text()).toContain(
      post.marker
    );
    expect(await privacyText(outsiderContext, search)).not.toContain(
      post.marker
    );
    expect(
      await privacyText(
        outsiderContext,
        origin + `/api/social/comment/${comment.id}`
      )
    ).not.toContain(commentMarker);
    // The API issues an owned alternate-profile credential; use an isolated
    // bearer context so the original host cookie cannot override its identity.
    const created = await memberContext.post(origin + '/api/profile', {
      headers,
      data: {
        name: `RR04 alternate ${Date.now()}`,
        description: 'Owned alternate profile',
        userId: member.userId,
        profilePic: '',
        coverPic: '',
        bio: 'Owned alternate profile',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
      },
    });
    expect(created.status()).toBe(201);
    const createdBody = await created.json();
    expect(typeof createdBody.newToken).toBe('string');
    alternateContext = await playwright.request.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${createdBody.newToken}`,
        'x-ot-appscope': 'social',
      },
    });
    expect((await (await alternateContext.get(url)).json()).content).toBe(
      post.marker
    );
    await socialFixtureCommand('SUSPEND_COMMUNITY_MEMBER', {
      memberId: membership.id,
      suspenderId: owner.userId,
    });
    for (const reader of [memberContext, alternateContext])
      expect(await privacyText(reader, url)).not.toContain(post.marker);
    await socialFixtureCommand('REACTIVATE_COMMUNITY_MEMBER', {
      memberId: membership.id,
      reactivatorId: owner.userId,
    });
    expect((await (await alternateContext.get(url)).json()).content).toBe(
      post.marker
    );
    // A former author must not bypass membership just because they own a post.
    const ownPost = await socialFixtureCommand('CREATE_POST', {
      title: post.marker + ' member-owned',
      content: post.marker + ' member-owned',
      userId: member.userId,
      profileId: member.profileId,
      appScope: 'social',
      communityId: post.communityId,
    });
    const leave = await memberContext.post(
      origin + `/api/social/community/${post.communityId}/leave`,
      { headers: { 'x-ot-appscope': 'social' } }
    );
    expect(leave.status()).toBe(201);
    for (const reader of [memberContext, alternateContext]) {
      expect(await privacyText(reader, attachmentUrl)).not.toContain(
        attachmentMarker
      );
      const deniedVote = await reader.get(voteUrl);
      expect(deniedVote.status()).toBe(404);
      expect(await privacyText(reader, url)).not.toContain(post.marker);
      expect(
        await privacyText(
          reader,
          origin + `/api/social/post/${ownPost.id}/shared`
        )
      ).not.toContain(post.marker);
      expect(
        await privacyText(reader, origin + `/api/social/comment/${comment.id}`)
      ).not.toContain(commentMarker);
      expect(await privacyText(reader, search)).not.toContain(post.marker);
      expect(
        await privacyText(reader, personalizedFeed, {
          'x-ot-appscope': 'client-interface',
        })
      ).not.toContain(post.marker);
      for (const componentUrl of componentUrls)
        expect(await privacyText(reader, componentUrl)).not.toContain(
          componentMarker
        );
    }
  } finally {
    await ownerContext.dispose();
    await memberContext.dispose();
    await outsiderContext.dispose();
    await alternateContext?.dispose();
  }
});

test('RR04 I01 browser: leaving a private community removes content from an open direct-post view', async ({
  browser,
}) => {
  test.setTimeout(45000);
  const ownerContext = await browser.newContext();
  const memberContext = await browser.newContext();
  try {
    const owner = await account(ownerContext.request, 'cache-owner');
    const member = await account(memberContext.request, 'cache-member');
    const post = await fixture(owner, true, 'social');
    await joinFixture(post.communityId!, member, owner.userId);
    await memberContext.clearCookies();
    const page = await memberContext.newPage();
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email', { exact: true }).fill(member.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/);
    await page.goto(origin + `/feed/post/${post.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByText(post.marker, { exact: true }).first()
    ).toBeVisible();
    // Establish a working content-free channel before the mutation. A probe
    // follow triggers the same cache invalidation without changing membership.
    type DirectPostRefreshDiagnostic = {
      requestCount: number;
      status: number;
      postIdMatches: boolean;
      visibility: string | null;
      markerPresent: boolean;
    };
    const directPostRefreshes: Promise<DirectPostRefreshDiagnostic>[] = [];
    page.on('response', (response) => {
      if (
        response.request().method() !== 'GET' ||
        new URL(response.url()).pathname !== `/api/social/post/${post.id}`
      ) {
        return;
      }
      const requestCount = directPostRefreshes.length + 1;
      directPostRefreshes.push(
        (async () => {
          let postIdMatches = false;
          let visibility: string | null = null;
          let markerPresent = false;
          try {
            const body = await response.json();
            if (body && typeof body === 'object' && !Array.isArray(body)) {
              const postBody = body as Record<string, unknown>;
              postIdMatches = postBody.id === post.id;
              visibility =
                typeof postBody.visibility === 'string'
                  ? postBody.visibility
                  : null;
              markerPresent =
                typeof postBody.content === 'string' &&
                postBody.content.includes(post.marker);
            }
          } catch {
            // A non-JSON error response still contributes status and count.
          }
          return {
            requestCount,
            status: response.status(),
            postIdMatches,
            visibility,
            markerPresent,
          };
        })()
      );
    });
    const refresh = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === `/api/social/post/${post.id}`,
      { timeout: 10000 }
    );
    const follow = await page.request.post(origin + '/api/social/follow', {
      data: { followerId: member.profileId, followeeId: owner.profileId },
    });
    expect(follow.status()).toBe(201);
    await refresh;
    console.log(
      'RR04_DIRECT_POST_REFRESH',
      JSON.stringify(await Promise.all(directPostRefreshes))
    );
    await expect(
      page.getByText(post.marker, { exact: true }).first()
    ).toBeVisible();
    const feedPage = await memberContext.newPage();
    await feedPage.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });
    await feedPage
      .getByRole('button', { name: 'My Communities', exact: true })
      .click();
    await expect(
      feedPage.getByText(post.marker, { exact: true }).first()
    ).toBeVisible();
    const leave = await page.request.post(
      origin + `/api/social/community/${post.communityId}/leave`,
      { headers: { 'x-ot-appscope': 'social' } }
    );
    expect(leave.status()).toBe(201);
    await expect(page.getByText(post.marker, { exact: true })).toHaveCount(0);
    await expect(feedPage.getByText(post.marker, { exact: true })).toHaveCount(
      0
    );
    expect(
      await (
        await page.request.get(origin + `/api/social/post/${post.id}/shared`)
      ).text()
    ).not.toContain(post.marker);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByText(post.marker, { exact: true })).toHaveCount(0);
    const deletionMarker = post.marker + ' deletion';
    const deletable = await socialFixtureCommand('CREATE_POST', {
      title: deletionMarker,
      content: deletionMarker,
      userId: owner.userId,
      profileId: owner.profileId,
      appScope: 'social',
    });
    await page.goto(origin + `/feed/post/${deletable.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await feedPage.reload({ waitUntil: 'domcontentloaded' });
    for (const view of [page, feedPage])
      await expect(
        view.getByText(deletionMarker, { exact: true }).first()
      ).toBeVisible();
    const deleted = await ownerContext.request.delete(
      origin + `/api/social/post/${deletable.id}`,
      {
        headers: { 'x-ot-appscope': 'social' },
      }
    );
    expect(deleted.status()).toBe(200);
    for (const view of [page, feedPage])
      await expect(view.getByText(deletionMarker, { exact: true })).toHaveCount(
        0
      );
    expect(
      await privacyText(
        page.request,
        origin + `/api/social/post/${deletable.id}/shared`
      )
    ).not.toContain(deletionMarker);
    expect(
      await privacyText(
        page.request,
        origin +
          `/api/search?q=${encodeURIComponent(deletionMarker)}&type=posts`
      )
    ).not.toContain(deletionMarker);
  } finally {
    await Promise.allSettled([ownerContext.close(), memberContext.close()]);
  }
});

async function subscribedSocket(
  request: APIRequestContext,
  profileId: string,
  postIds?: string[]
) {
  const cookies = (await request.storageState()).cookies;
  const socket = io('http://127.0.0.1:3301/social', {
    transports: ['websocket'],
    extraHeaders: {
      Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('Connection timeout')),
        10000
      );
      socket.once('connect', () => {
        clearTimeout(deadline);
        resolve();
      });
      socket.once('connect_error', (error) => {
        clearTimeout(deadline);
        reject(error);
      });
    });
    const acknowledgement = await new Promise<{ postIds: string[] }>(
      (resolve, reject) => {
        const retry = setInterval(
          () => socket.emit('SUBSCRIBE_POSTS', { profileId, postIds }),
          200
        );
        const deadline = setTimeout(() => {
          clearInterval(retry);
          reject(new Error('Subscription timeout'));
        }, 10000);
        socket.once('subscribed', (payload) => {
          clearInterval(retry);
          clearTimeout(deadline);
          resolve(payload);
        });
      }
    );
    return { socket, acknowledgement };
  } catch (error) {
    socket.disconnect();
    throw error;
  }
}

test('RR04 I01 realtime: specific subscriptions preserve follower delivery and revoke it after unfollow', async ({
  playwright,
}) => {
  const ownerContext = await playwright.request.newContext();
  const followerContext = await playwright.request.newContext();
  let socket: ReturnType<typeof io> | undefined;
  try {
    const owner = await account(ownerContext, 'positive-socket-owner');
    const follower = await account(followerContext, 'positive-socket-follower');
    const post = await fixture(owner, false);
    const deniedSubscription = await subscribedSocket(
      followerContext,
      follower.profileId,
      [post.id]
    );
    try {
      expect(deniedSubscription.acknowledgement.postIds).not.toContain(post.id);
    } finally {
      deniedSubscription.socket.disconnect();
    }
    const follow = {
      followerId: follower.profileId,
      followeeId: owner.profileId,
    };
    expect(
      (
        await followerContext.post(origin + '/api/social/follow', {
          data: follow,
        })
      ).status()
    ).toBe(201);
    const subscription = await subscribedSocket(
      followerContext,
      follower.profileId,
      [post.id]
    );
    socket = subscription.socket;
    expect(subscription.acknowledgement.postIds).toContain(post.id);
    const received = new Promise<{ content: string }>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('Authorized update not delivered')),
        5000
      );
      socket!.once('post_updated', (payload) => {
        clearTimeout(deadline);
        resolve(payload);
      });
    });
    const update = await ownerContext.put(
      origin + `/api/social/post/update/${post.id}`,
      { headers: { 'x-ot-appscope': 'social' }, data: { content: post.marker } }
    );
    expect(update.status()).toBe(200);
    expect((await received).content).toBe(post.marker);
    const receivedComment = new Promise<{ content: string }>(
      (resolve, reject) => {
        const deadline = setTimeout(
          () => reject(new Error('Authorized comment not delivered')),
          5000
        );
        socket!.once('comment_created', (payload) => {
          clearTimeout(deadline);
          resolve(payload);
        });
      }
    );
    const commentMarker = post.marker + ' realtime comment';
    const postedComment = await ownerContext.post(
      origin + '/api/social/comment',
      {
        headers: { 'x-ot-appscope': 'social' },
        data: {
          postId: post.id,
          profileId: owner.profileId,
          content: commentMarker,
        },
      }
    );
    expect(postedComment.status()).toBe(201);
    const liveComment = await receivedComment;
    expect(liveComment.content).toBe(commentMarker);
    const editInvalidated = new Promise<unknown>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('Comment edit did not invalidate content')),
        5000
      );
      socket!.once('social_content_invalidated', (payload) => {
        clearTimeout(deadline);
        resolve(payload);
      });
    });
    const commentId = (await postedComment.json()).id;
    const edited = await ownerContext.put(
      origin + `/api/social/comment/update/${commentId}`,
      {
        headers: { 'x-ot-appscope': 'social' },
        data: { content: commentMarker + ' edited' },
      }
    );
    expect(edited.status()).toBe(200);
    expect(await editInvalidated).toEqual({});
    expect(
      (
        await (
          await followerContext.get(origin + `/api/social/comment/${commentId}`)
        ).json()
      ).content
    ).toBe(commentMarker + ' edited');
    const invalidated = new Promise<unknown>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('Unfollow did not invalidate socket content')),
        5000
      );
      socket!.once('social_content_invalidated', (payload) => {
        clearTimeout(deadline);
        resolve(payload);
      });
    });
    expect(
      (
        await followerContext.post(origin + '/api/social/follow/unfollow', {
          data: follow,
        })
      ).status()
    ).toBe(201);
    expect(await invalidated).toEqual({});
    let finishObservation: (payload: unknown) => void = () => undefined;
    const forbidden = new Promise<unknown>((resolve) => {
      finishObservation = resolve;
      socket!.once('post_updated', resolve);
      socket!.once('comment_created', resolve);
    });
    expect(
      (
        await ownerContext.put(origin + `/api/social/post/update/${post.id}`, {
          headers: { 'x-ot-appscope': 'social' },
          data: { content: post.marker },
        })
      ).status()
    ).toBe(200);
    expect(
      (
        await ownerContext.post(origin + '/api/social/comment', {
          headers: { 'x-ot-appscope': 'social' },
          data: {
            postId: post.id,
            profileId: owner.profileId,
            content: commentMarker,
          },
        })
      ).status()
    ).toBe(201);
    const deadline = setTimeout(() => finishObservation(null), 1500);
    const forbiddenPayload = await forbidden;
    clearTimeout(deadline);
    expect(JSON.stringify(forbiddenPayload)).not.toContain(post.marker);
    expect(
      await (
        await followerContext.get(origin + `/api/social/post/${post.id}/shared`)
      ).text()
    ).not.toContain(post.marker);
    socket.disconnect();
    const reconnected = await subscribedSocket(
      followerContext,
      follower.profileId,
      [post.id]
    );
    socket = reconnected.socket;
    expect(reconnected.acknowledgement.postIds).not.toContain(post.id);
  } finally {
    socket?.disconnect();
    await ownerContext.dispose();
    await followerContext.dispose();
  }
});
