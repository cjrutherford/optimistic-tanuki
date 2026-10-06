import { test, expect, APIRequestContext } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
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
  community: boolean
) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  await client.connect();
  try {
    const communityId = community
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
                appScope: 'social',
              }
            )
          )
        ).id
      : undefined;
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
    return { id: post.id, marker, communityId };
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

test('RR04 browser: private-community direct post is visible to its author and hidden from a non-member', async ({
  browser,
}) => {
  const authorContext = await browser.newContext();
  const outsiderContext = await browser.newContext();
  try {
    const author = await account(authorContext.request, 'community-author');
    const outsider = await account(
      outsiderContext.request,
      'community-outsider'
    );
    const post = await fixture(author, true);
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
  } finally {
    await Promise.allSettled([authorContext.close(), outsiderContext.close()]);
  }
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
  const ownerContext = await playwright.request.newContext();
  const memberContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  let alternateContext: APIRequestContext | undefined;
  try {
    const owner = await account(ownerContext, 'matrix-owner');
    const member = await account(memberContext, 'matrix-member');
    const outsider = await account(outsiderContext, 'matrix-outsider');
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
    expect(
      await (
        await memberContext.get(personalizedFeed, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).text()
    ).toContain(post.marker);
    expect(
      await privacyText(outsiderContext, personalizedFeed, {
        'x-ot-appscope': 'social',
      })
    ).not.toContain(post.marker);
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
    expect(
      await (
        await memberContext.get(personalizedFeed, {
          headers: { 'x-ot-appscope': 'social' },
        })
      ).text()
    ).not.toContain(hiddenMarker);
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
          'x-ot-appscope': 'social',
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
    const post = await fixture(owner, true);
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
    const refresh = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/social/post/${post.id}`,
      { timeout: 10000 }
    );
    const follow = await page.request.post(origin + '/api/social/follow', {
      data: { followerId: member.profileId, followeeId: owner.profileId },
    });
    expect(follow.status()).toBe(201);
    await refresh;
    await expect(
      page.getByText(post.marker, { exact: true }).first()
    ).toBeVisible();
    const feedPage = await memberContext.newPage();
    await feedPage.goto(origin + '/feed', { waitUntil: 'domcontentloaded' });
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
