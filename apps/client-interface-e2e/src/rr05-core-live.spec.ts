import { APIRequestContext, Page, expect, test } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';

test.skip(
  process.env['RR05_LIVE_STACK'] !== 'true',
  'Requires the development stack'
);
const origin = 'http://127.0.0.1:8080';
const headers = {
  'x-ot-appscope': 'client-interface',
  'x-ot-app-id': 'client-interface',
};
const password = 'RR05-local-test-password!';
const marker = (label: string) =>
  `RR05 ${label} ${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function account(request: APIRequestContext, role: string) {
  const email = `rr05-${role}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.test`;
  const registration = await request.post(
    origin + '/api/authentication/register',
    {
      headers,
      data: {
        fn: 'RR05',
        ln: role,
        email,
        password,
        confirm: password,
        bio: 'Local release gate',
      },
    }
  );
  expect(registration.status()).toBe(201);
  expect(
    (
      await request.post(origin + '/api/authentication/login', {
        headers: { ...headers, 'x-ot-session-mode': 'cookie' },
        data: { email, password },
      })
    ).status()
  ).toBe(201);
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

async function forumFixture(
  author: { userId: string; profileId: string },
  visibility: 'public' | 'private',
  appScope = 'client-interface'
) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3015 },
  });
  await client.connect();
  try {
    const title = marker(visibility + ' forum');
    const topic = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_TOPIC' },
        { title, description: title, ...author, visibility, appScope }
      )
    );
    const thread = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_THREAD' },
        {
          title,
          description: title,
          content: title,
          ...author,
          topicId: topic.id,
          visibility,
          appScope,
        }
      )
    );
    const post = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_FORUM_POST' },
        { content: title, ...author, threadId: thread.id, appScope }
      )
    );
    return { title, topic, thread, post };
  } finally {
    client.close();
  }
}

test('RR05 forum privacy: anonymous and outsiders cannot read private topic, thread or replies', async ({
  playwright,
}) => {
  const authorContext = await playwright.request.newContext();
  const outsider = await playwright.request.newContext();
  const anonymous = await playwright.request.newContext();
  try {
    const author = await account(authorContext, 'forum-author');
    await account(outsider, 'forum-outsider');
    const fixture = await forumFixture(author, 'private');
    const paths = [
      `topic/${fixture.topic.id}`,
      `thread/${fixture.thread.id}`,
      `post/${fixture.post.id}`,
      `topic/${fixture.topic.id}/threads`,
      `thread/${fixture.thread.id}/posts`,
      'topics',
      'threads',
      'posts',
    ];
    for (const path of paths) {
      const positive = await authorContext.get(origin + '/api/forum/' + path, {
        headers,
      });
      expect(positive.status(), `author ${path}`).toBe(200);
      expect(await positive.text(), `author ${path}`).toContain(fixture.title);
      for (const reader of [anonymous, outsider]) {
        const denied = await reader.get(origin + '/api/forum/' + path, {
          headers,
        });
        expect.soft([200, 403, 404], path).toContain(denied.status());
        expect.soft(await denied.text(), path).not.toContain(fixture.title);
      }
    }
  } finally {
    await Promise.all([
      authorContext.dispose(),
      outsider.dispose(),
      anonymous.dispose(),
    ]);
  }
});

test('RR05 forum scope and writes: public durable discussion stays in its app and rejects unauthorized mutations', async ({
  playwright,
  page,
}) => {
  const authorContext = await playwright.request.newContext();
  const outsider = await playwright.request.newContext();
  const anonymous = await playwright.request.newContext();
  try {
    const author = await account(authorContext, 'public-author');
    const other = await account(outsider, 'public-outsider');
    const fixture = await forumFixture(author, 'public');
    const sibling = await forumFixture(author, 'public', 'forgeofwill');
    const threadData = {
      title: marker('HTTP thread'),
      description: 'Durable discussion',
      content: 'A real authenticated thread',
      profileId: other.profileId,
      topicId: fixture.topic.id,
    };
    const allowedThread = await authorContext.post(
      origin + '/api/forum/thread',
      { headers, data: threadData }
    );
    expect(allowedThread.status(), await allowedThread.text()).toBe(201);
    expect((await allowedThread.json()).profileId).toBe(author.profileId);
    const wrongParent = await authorContext.post(origin + '/api/forum/thread', {
      headers,
      data: { ...threadData, topicId: sibling.topic.id },
    });
    expect
      .soft([400, 403, 404], 'cross-app parent')
      .toContain(wrongParent.status());
    for (const path of ['topics', 'threads', 'posts']) {
      const response = await anonymous.get(origin + '/api/forum/' + path, {
        headers,
      });
      expect(response.status()).toBe(200);
      const text = await response.text();
      expect(text).toContain(fixture.title);
      expect.soft(text, path).not.toContain(sibling.title);
    }
    for (const path of [
      `topic/${sibling.topic.id}`,
      `thread/${sibling.thread.id}`,
      `post/${sibling.post.id}`,
    ]) {
      const response = await anonymous.get(origin + '/api/forum/' + path, {
        headers,
      });
      expect
        .soft([403, 404], 'sibling detail ' + path)
        .toContain(response.status());
      expect
        .soft(await response.text(), 'sibling detail ' + path)
        .not.toContain(sibling.title);
    }
    for (const reader of [anonymous, outsider]) {
      const update = await reader.put(
        origin + `/api/forum/thread/${fixture.thread.id}`,
        { headers, data: { title: 'unauthorized change' } }
      );
      expect.soft([401, 403]).toContain(update.status());
    }
    const reply = await outsider.post(origin + '/api/forum/post', {
      headers,
      data: {
        threadId: fixture.thread.id,
        profileId: other.profileId,
        content: marker('reply'),
      },
    });
    expect.soft(reply.status(), await reply.text()).toBe(201);
    const authorEdit = await authorContext.put(
      origin + `/api/forum/thread/${fixture.thread.id}`,
      { headers, data: { title: fixture.title } }
    );
    expect.soft(authorEdit.status(), await authorEdit.text()).toBe(200);
    await page.goto('/forum/thread/' + fixture.thread.id);
    await expect(page.locator('.forum-shell')).toContainText(fixture.title);
    await page.reload();
    await expect(page.locator('.forum-shell')).toContainText(fixture.title);
  } finally {
    await Promise.all([
      authorContext.dispose(),
      outsider.dispose(),
      anonymous.dispose(),
    ]);
  }
});

async function browserLogin(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto(origin + '/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test('RR05 community browser: approved members exchange live messages and retain history on refresh', async ({
  browser,
  page,
}) => {
  test.setTimeout(60000);
  const memberContext = await browser.newContext();
  try {
    const owner = await account(page.request, 'browser-owner');
    const member = await account(memberContext.request, 'browser-member');
    const name = marker('browser community');
    const created = await page.request.post(origin + '/api/social/community', {
      headers,
      data: {
        name,
        description: name,
        isPrivate: true,
        joinPolicy: 'approval_required',
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const community = await created.json();
    const joined = await memberContext.request.post(
      origin + `/api/social/community/${community.id}/join`,
      { headers }
    );
    expect(joined.status()).toBe(201);
    const membership = await joined.json();
    expect(
      (
        await page.request.post(
          origin + `/api/social/community/members/${membership.id}/approve`,
          { headers }
        )
      ).status()
    ).toBe(201);
    const memberPage = await memberContext.newPage();
    await browserLogin(page, owner.email);
    await browserLogin(memberPage, member.email);
    const path = origin + `/communities/${community.slug}/chat`;
    await page.goto(path);
    await memberPage.goto(path);
    await expect(
      page.locator('.community-chat textarea.compose-textarea')
    ).toBeVisible();
    await expect(
      memberPage.locator('.community-chat textarea.compose-textarea')
    ).toBeVisible();
    const content = marker('browser community message');
    await page.locator('textarea.compose-textarea').fill(content);
    await page.locator('otui-button.send-button button').click();
    await expect
      .soft(page.locator('.message-text').filter({ hasText: content }).first())
      .toBeVisible({ timeout: 15000 });
    await expect
      .soft(
        memberPage
          .locator('.message-text')
          .filter({ hasText: content })
          .first(),
        'live peer delivery'
      )
      .toBeVisible({ timeout: 15000 });
    await memberPage.reload();
    await expect(
      memberPage.locator('.message-text').filter({ hasText: content }).first(),
      'stored history after refresh'
    ).toBeVisible({ timeout: 15000 });
    expect(
      (
        await memberPage.request.post(
          origin + `/api/social/community/${community.id}/leave`,
          { headers }
        )
      ).status()
    ).toBe(201);
    await expect(memberPage.locator('.community-chat')).not.toContainText(
      content
    );
    await expect(
      memberPage.locator('.community-chat textarea.compose-textarea')
    ).toHaveCount(0);
  } finally {
    await memberContext.close();
  }
});

test('RR05 block policy: a blocked profile cannot send new direct messages', async ({
  playwright,
}) => {
  const aliceContext = await playwright.request.newContext();
  const bobContext = await playwright.request.newContext();
  try {
    const alice = await account(aliceContext, 'block-alice');
    const bob = await account(bobContext, 'block-bob');
    const created = await aliceContext.post(
      origin + '/api/chat/conversations/direct/get-or-create',
      { headers, data: { recipientProfileId: bob.profileId } }
    );
    expect(created.status()).toBe(201);
    const conversation = await created.json();
    expect(
      (
        await bobContext.post(origin + '/api/privacy/block', {
          headers: { ...headers, 'x-ot-appscope': 'social' },
          data: { blockedId: alice.profileId },
        })
      ).status()
    ).toBe(201);
    const blocked = await bobContext.get(
      origin + `/api/privacy/blocked/${alice.profileId}`,
      { headers }
    );
    expect(blocked.status()).toBe(200);
    expect((await blocked.json()).blocked).toBe(true);
    const sent = await aliceContext.post(origin + '/api/chat/messages', {
      headers,
      data: {
        conversationId: conversation.id,
        content: marker('blocked message'),
        recipientIds: [bob.profileId],
      },
    });
    expect([403, 404], 'blocked sender').toContain(sent.status());
  } finally {
    await Promise.all([aliceContext.dispose(), bobContext.dispose()]);
  }
});

test('RR05 invitation claim: addressed account joins through a token, while other accounts and replay are denied', async ({
  playwright,
}) => {
  const ownerContext = await playwright.request.newContext();
  const invitedContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  try {
    const owner = await account(ownerContext, 'invite-owner');
    const invited = await account(invitedContext, 'invite-member');
    await account(outsiderContext, 'invite-outsider');
    const name = marker('invite community');
    const created = await ownerContext.post(origin + '/api/social/community', {
      headers,
      data: {
        name,
        description: name,
        isPrivate: true,
        joinPolicy: 'invite_only',
      },
    });
    expect(created.status()).toBe(201);
    const community = await created.json();
    await client.connect();
    // Owning-service fixture deliberately bypasses email transport. This is
    // token consumption evidence, never proof of invitation receipt.
    const invite = await firstValueFrom(
      client.send(
        { cmd: 'INVITE_TO_COMMUNITY_BY_EMAIL' },
        {
          dto: {
            communityId: community.id,
            email: invited.email,
            inviteeUserId: invited.userId,
          },
          inviterId: owner.userId,
        }
      )
    );
    const url = origin + '/api/social/community/invites/claim';
    const wrong = await outsiderContext.post(url, {
      headers,
      data: { token: invite.token },
    });
    expect
      .soft([403, 404], 'wrong addressed account')
      .toContain(wrong.status());
    const notJoined = await outsiderContext.get(
      origin + `/api/social/community/${community.id}/membership`,
      { headers }
    );
    expect(notJoined.status()).toBe(200);
    expect(await notJoined.json()).toBe(false);
    const claimed = await invitedContext.post(url, {
      headers,
      data: { token: invite.token },
    });
    expect(claimed.status(), 'addressed claim').toBe(201);
    expect((await claimed.json()).id).toBe(community.id);
    const membership = await invitedContext.get(
      origin + `/api/social/community/${community.id}/membership`,
      { headers }
    );
    expect(membership.status()).toBe(200);
    expect(await membership.json()).toBe(true);
    const memberPost = await invitedContext.post(origin + '/api/social/post', {
      headers: { ...headers, 'x-ot-appscope': 'social' },
      data: {
        communityId: community.id,
        profileId: invited.profileId,
        title: marker('invite post'),
        content: 'New invited member posting',
      },
    });
    expect.soft(memberPost.status(), await memberPost.text()).toBe(201);
    const replay = await invitedContext.post(url, {
      headers,
      data: { token: invite.token },
    });
    expect.soft([403, 404], 'token replay').toContain(replay.status());
  } finally {
    client.close();
    await Promise.all([
      ownerContext.dispose(),
      invitedContext.dispose(),
      outsiderContext.dispose(),
    ]);
  }
});

test('RR05 DM authorization: third parties cannot list, read or send another conversation', async ({
  playwright,
}) => {
  const aliceContext = await playwright.request.newContext();
  const bobContext = await playwright.request.newContext();
  const outsider = await playwright.request.newContext();
  try {
    const alice = await account(aliceContext, 'alice');
    const bob = await account(bobContext, 'bob');
    await account(outsider, 'outsider');
    const created = await aliceContext.post(
      origin + '/api/chat/conversations/direct/get-or-create',
      { headers, data: { recipientProfileId: bob.profileId } }
    );
    expect(created.status()).toBe(201);
    const conversation = await created.json();
    expect(conversation.participants).toEqual(
      expect.arrayContaining([alice.profileId, bob.profileId])
    );
    const content = marker('private DM');
    const sent = await aliceContext.post(origin + '/api/chat/messages', {
      headers,
      data: {
        conversationId: conversation.id,
        content,
        recipientIds: [bob.profileId],
      },
    });
    expect(sent.status(), await sent.text()).toBe(201);
    const positive = await bobContext.get(
      origin + '/api/chat/messages/' + conversation.id,
      { headers }
    );
    expect(positive.status()).toBe(200);
    expect(await positive.text()).toContain(content);
    const list = await outsider.get(origin + '/api/chat/conversations/find', {
      headers,
    });
    expect(list.status()).toBe(200);
    expect(await list.text()).not.toContain(conversation.id);
    for (const path of [
      `conversations/id/${conversation.id}`,
      `messages/${conversation.id}`,
    ]) {
      const denied = await outsider.get(origin + '/api/chat/' + path, {
        headers,
      });
      expect.soft([403, 404], path).toContain(denied.status());
      expect.soft(await denied.text(), path).not.toContain(content);
    }
    const deniedSend = await outsider.post(origin + '/api/chat/messages', {
      headers,
      data: {
        conversationId: conversation.id,
        content: marker('forbidden'),
        recipientIds: [bob.profileId],
      },
    });
    expect.soft([403, 404]).toContain(deniedSend.status());
  } finally {
    await Promise.all([
      aliceContext.dispose(),
      bobContext.dispose(),
      outsider.dispose(),
    ]);
  }
});

test('RR05 community permissions: private room access requires current membership and management stays with its owner', async ({
  playwright,
}) => {
  const ownerContext = await playwright.request.newContext();
  const memberContext = await playwright.request.newContext();
  const outsider = await playwright.request.newContext();
  try {
    const owner = await account(ownerContext, 'community-owner');
    const member = await account(memberContext, 'community-member');
    const other = await account(outsider, 'community-outsider');
    const name = marker('private community');
    const created = await ownerContext.post(origin + '/api/social/community', {
      headers,
      data: {
        name,
        description: name,
        isPrivate: true,
        joinPolicy: 'approval_required',
      },
    });
    expect(created.status(), await created.text()).toBe(201);
    const community = await created.json();
    const joined = await memberContext.post(
      origin + `/api/social/community/${community.id}/join`,
      { headers }
    );
    expect(joined.status(), await joined.text()).toBe(201);
    const membership = await joined.json();
    expect(membership.status).toBe('pending');
    const badApproval = await outsider.post(
      origin + `/api/social/community/members/${membership.id}/approve`,
      { headers }
    );
    expect.soft([401, 403]).toContain(badApproval.status());
    const approved = await ownerContext.post(
      origin + `/api/social/community/members/${membership.id}/approve`,
      { headers }
    );
    expect(approved.status(), await approved.text()).toBe(201);
    const roomResponse = await ownerContext.get(
      origin + `/api/social/community/${community.id}/chat-room`,
      { headers }
    );
    expect(roomResponse.status()).toBe(200);
    const room = await roomResponse.json();
    expect(room.id).toEqual(expect.any(String));
    const content = marker('private community message');
    const sent = await ownerContext.post(origin + '/api/chat/messages', {
      headers,
      data: {
        conversationId: room.id,
        content,
        recipientIds: [member.profileId],
      },
    });
    expect(sent.status(), await sent.text()).toBe(201);
    const positive = await memberContext.get(
      origin + '/api/chat/messages/' + room.id,
      { headers }
    );
    expect(positive.status()).toBe(200);
    expect(await positive.text()).toContain(content);
    const discovery = await outsider.get(
      origin + `/api/social/community/${community.id}/chat-room`,
      { headers }
    );
    expect
      .soft([403, 404], 'outsider room discovery')
      .toContain(discovery.status());
    const roster = await outsider.get(
      origin + `/api/social/community/${community.id}/members`,
      { headers }
    );
    expect.soft([403, 404], 'private member roster').toContain(roster.status());
    expect
      .soft(await roster.text(), 'private member roster')
      .not.toContain(member.profileId);
    for (const path of [
      `/api/social/community/${community.id}`,
      `/api/social/community/slug/${community.slug}`,
      '/api/social/community',
      '/api/social/community/top-active?appScope=client-interface&limit=50',
    ]) {
      const metadata = await outsider.get(origin + path, { headers });
      expect.soft(metadata.status(), 'community metadata ' + path).toBe(200);
      expect
        .soft(await metadata.text(), 'roster hidden in metadata ' + path)
        .not.toContain(member.profileId);
    }
    const outsiderRead = await outsider.get(
      origin + '/api/chat/messages/' + room.id,
      { headers }
    );
    expect
      .soft([403, 404], 'outsider room read')
      .toContain(outsiderRead.status());
    expect
      .soft(await outsiderRead.text(), 'outsider room read')
      .not.toContain(content);
    const unauthorizedWrite = await outsider.post(
      origin + '/api/chat/messages',
      {
        headers,
        data: {
          conversationId: room.id,
          content: marker('outsider room write'),
          recipientIds: [owner.profileId],
        },
      }
    );
    expect
      .soft([403, 404], 'outsider room write')
      .toContain(unauthorizedWrite.status());
    const forgedRoom = await outsider.post(
      origin + '/api/chat/conversations/community',
      {
        headers,
        data: { communityId: community.id, ownerId: other.profileId, name },
      }
    );
    expect
      .soft([403, 404], 'unauthorized room provisioning')
      .toContain(forgedRoom.status());
    const leave = await memberContext.post(
      origin + `/api/social/community/${community.id}/leave`,
      { headers }
    );
    expect(leave.status()).toBe(201);
    const revoked = await memberContext.get(
      origin + '/api/chat/messages/' + room.id,
      { headers }
    );
    expect.soft([403, 404], 'revoked room read').toContain(revoked.status());
    expect
      .soft(await revoked.text(), 'revoked room read')
      .not.toContain(content);
  } finally {
    await Promise.all([
      ownerContext.dispose(),
      memberContext.dispose(),
      outsider.dispose(),
    ]);
  }
});

async function chatSocket(request: APIRequestContext, profileId: string) {
  const cookie = (await request.storageState()).cookies
    .map((item) => `${item.name}=${item.value}`)
    .join('; ');
  const socket = io('http://127.0.0.1:3300/chat', {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
    autoConnect: false,
  });
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(
      () => finish(new Error('Chat socket did not authorize')),
      10000
    );
    const retry = setInterval(() => {
      if (socket.connected) socket.emit('get_conversations', { profileId });
    }, 100);
    const finish = (error?: Error) => {
      clearTimeout(deadline);
      clearInterval(retry);
      socket.off('conversations', ready);
      if (error) {
        socket.disconnect();
        reject(error);
      } else resolve();
    };
    const ready = () => finish();
    socket.once('conversations', ready);
    socket.once('connect_error', (error) => finish(error));
    socket.connect();
  });
  return socket;
}

test('RR05 socket authorization: a nonparticipant cannot persist or deliver a forged direct message', async ({
  playwright,
}) => {
  const aliceContext = await playwright.request.newContext();
  const bobContext = await playwright.request.newContext();
  const outsiderContext = await playwright.request.newContext();
  const sockets: Socket[] = [];
  try {
    const alice = await account(aliceContext, 'socket-alice');
    const bob = await account(bobContext, 'socket-bob');
    const outsider = await account(outsiderContext, 'socket-outsider');
    const created = await aliceContext.post(
      origin + '/api/chat/conversations/direct/get-or-create',
      { headers, data: { recipientProfileId: bob.profileId } }
    );
    expect(created.status()).toBe(201);
    const conversation = await created.json();
    const aliceSocket = await chatSocket(aliceContext, alice.profileId);
    sockets.push(aliceSocket);
    const bobSocket = await chatSocket(bobContext, bob.profileId);
    sockets.push(bobSocket);
    const outsiderSocket = await chatSocket(
      outsiderContext,
      outsider.profileId
    );
    sockets.push(outsiderSocket);
    const legitimate = marker('authorized socket message');
    const messageId = randomUUID();
    const received = new Promise<unknown>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('Authorized socket message not delivered')),
        10000
      );
      bobSocket.once('message', (payload) => {
        clearTimeout(deadline);
        resolve(payload);
      });
    });
    aliceSocket.emit('message', {
      id: messageId,
      conversationId: conversation.id,
      senderId: alice.profileId,
      recipientIds: [bob.profileId],
      content: legitimate,
      type: 'chat',
    });
    expect(JSON.stringify(await received)).toContain(legitimate);
    aliceSocket.disconnect();
    const restored = await chatSocket(aliceContext, alice.profileId);
    sockets.push(restored);
    const resent = new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('Reconnect resend not acknowledged')),
        10000
      );
      bobSocket.once('message', (payload) => {
        clearTimeout(deadline);
        expect(JSON.stringify(payload)).toContain(legitimate);
        resolve();
      });
    });
    restored.emit('message', {
      id: messageId,
      conversationId: conversation.id,
      senderId: alice.profileId,
      recipientIds: [bob.profileId],
      content: legitimate,
      type: 'chat',
    });
    await resent;
    const history = await bobContext.get(
      origin + '/api/chat/messages/' + conversation.id,
      { headers }
    );
    expect(history.status()).toBe(200);
    expect(
      (await history.json()).filter((message) => message.id === messageId)
    ).toHaveLength(1);

    const forged = marker('forged socket message');
    const messages: unknown[] = [];
    bobSocket.on('message', (payload) => messages.push(payload));
    const settled = new Promise<void>((resolve) => {
      const deadline = setTimeout(resolve, 10000);
      bobSocket.once('message', () => {
        clearTimeout(deadline);
        resolve();
      });
      outsiderSocket.once('exception', () => {
        clearTimeout(deadline);
        resolve();
      });
    });
    outsiderSocket.emit('message', {
      conversationId: conversation.id,
      senderId: outsider.profileId,
      recipientIds: [alice.profileId, bob.profileId],
      content: forged,
      type: 'chat',
    });
    await settled;
    expect
      .soft(JSON.stringify(messages), 'forged realtime delivery')
      .not.toContain(forged);
    const stored = await bobContext.get(
      origin + '/api/chat/messages/' + conversation.id,
      { headers }
    );
    expect(stored.status()).toBe(200);
    const body = await stored.text();
    expect(body).toContain(legitimate);
    expect.soft(body, 'forged persistence').not.toContain(forged);
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await Promise.all([
      aliceContext.dispose(),
      bobContext.dispose(),
      outsiderContext.dispose(),
    ]);
  }
});

test('RR05 forum browser authoring: create a durable thread and long-form reply through the real UI', async ({
  playwright,
  page,
}) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.text().startsWith('Global error:'))
      browserErrors.push(message.text());
  });
  const request = await playwright.request.newContext();
  try {
    const author = await account(request, 'browser-author');
    const fixture = await forumFixture(author, 'public');
    await browserLogin(page, author.email);
    await page.goto('/forum/topic/' + fixture.topic.id);
    await page
      .getByRole('button', { name: 'Create New Thread', exact: true })
      .click();
    const form = page.locator('lib-create-thread');
    await expect(form).toBeVisible();
    await form.locator('select').first().selectOption(fixture.topic.id);
    const title = marker('browser durable thread');
    const description =
      'A discussion that remains understandable after refresh';
    await form.locator('input[placeholder="Thread Title"]').fill(title);
    await form.locator('input[placeholder="Description"]').fill(description);
    await form
      .locator('textarea[placeholder="Thread Content"]')
      .fill('Initial long-form context');
    const createResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/forum/thread') && r.request().method() === 'POST'
    );
    await form
      .getByRole('button', { name: 'Create Thread', exact: true })
      .click();
    const created = await createResponse;
    expect(created.status(), await created.text()).toBe(201);
    const thread = await created.json();
    expect(thread.userId).toBe(author.userId);
    expect(thread.profileId).toBe(author.profileId);
    await expect(page).toHaveURL('/forum/thread/' + thread.id);
    await expect(page.locator('.thread-detail')).toContainText(description);
    await page.getByRole('button', { name: 'New Post', exact: true }).click();
    const composer = page.locator('lib-compose-forum-post');
    const reply =
      marker('Long-form browser reply') +
      ' — durable discussion with context, a proposal, and an explicit decision.';
    await composer.locator('[contenteditable="true"]').fill(reply);
    const postResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/forum/post') && r.request().method() === 'POST'
    );
    await composer
      .getByRole('button', { name: 'Post to Forum', exact: true })
      .click();
    const posted = await postResponse;
    expect(posted.status(), await posted.text()).toBe(201);
    expect((await posted.json()).profileId).toBe(author.profileId);
    await expect(page.locator('.posts-list')).toContainText(reply);
    await page.reload();
    await expect(page.locator('.thread-detail')).toContainText(title);
    await expect(page.locator('.posts-list')).toContainText(reply);
    expect(browserErrors).toEqual([]);
  } finally {
    await request.dispose();
  }
});

test('RR05 socket direct creation: verified app scope applies to recipient eligibility', async ({
  playwright,
}) => {
  const aliceContext = await playwright.request.newContext();
  const bobContext = await playwright.request.newContext();
  const profileClient = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3002 },
  });
  let socket: Socket | undefined;
  try {
    const alice = await account(aliceContext, 'socket-scope-alice');
    const bob = await account(bobContext, 'socket-scope-bob');
    await profileClient.connect();
    const sibling = await firstValueFrom(
      profileClient.send(
        { cmd: 'Create:Profile' },
        {
          userId: bob.userId,
          name: marker('sibling profile'),
          description: '',
          profilePic: '',
          coverPic: '',
          bio: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          appScope: 'forgeofwill',
        }
      )
    );
    expect(sibling.appScope).toBe('forgeofwill');
    expect(sibling.id).not.toBe(bob.profileId);
    const restDenied = await aliceContext.post(
      origin + '/api/chat/conversations/direct/get-or-create',
      { headers, data: { recipientProfileId: sibling.id } }
    );
    expect([403, 404]).toContain(restDenied.status());
    socket = await chatSocket(aliceContext, alice.profileId);
    const command = async (participantIds: string[]) =>
      new Promise<{ event: string; payload: unknown }>((resolve, reject) => {
        const deadline = setTimeout(() => {
          cleanup();
          reject(
            new Error(
              'Direct creation did not acknowledge acceptance or denial'
            )
          );
        }, 10000);
        const cleanup = () => {
          clearTimeout(deadline);
          socket?.off('conversation', accepted);
          socket?.off('exception', denied);
        };
        const accepted = (payload: unknown) => {
          cleanup();
          resolve({ event: 'conversation', payload });
        };
        const denied = (payload: unknown) => {
          cleanup();
          resolve({ event: 'exception', payload });
        };
        socket!.once('conversation', accepted);
        socket!.once('exception', denied);
        socket!.emit('get_or_create_direct_chat', { participantIds });
      });
    const allowed = await command([alice.profileId, bob.profileId]);
    expect(allowed.event, JSON.stringify(allowed.payload)).toBe('conversation');
    expect(allowed.payload).toEqual(
      expect.objectContaining({
        participants: expect.arrayContaining([alice.profileId, bob.profileId]),
      })
    );
    const denied = await command([alice.profileId, sibling.id]);
    expect(denied.event, JSON.stringify(denied.payload)).toBe('exception');
    const list = await aliceContext.get(
      origin + '/api/chat/conversations/find',
      { headers }
    );
    expect(list.status()).toBe(200);
    expect(await list.text()).not.toContain(sibling.id);
  } finally {
    socket?.disconnect();
    profileClient.close();
    await Promise.all([aliceContext.dispose(), bobContext.dispose()]);
  }
});

test('RR05 community browser journey: create, find, request membership and approve through the real UI', async ({
  browser,
  page,
}) => {
  test.setTimeout(90000);
  const memberContext = await browser.newContext();
  try {
    const owner = await account(page.request, 'journey-owner');
    const member = await account(memberContext.request, 'journey-member');
    await browserLogin(page, owner.email);
    await page.goto('/communities/create');
    const form = page.locator('lib-create-community');
    const name = marker('browser membership');
    await form.getByLabel('Community Name', { exact: true }).fill(name);
    await form
      .getByLabel('Description', { exact: true })
      .fill('A community with an explicit approval policy');
    await form.locator('select').selectOption('approval_required');
    const created = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/social/community') &&
        r.request().method() === 'POST'
    );
    await form
      .getByRole('button', { name: 'Create Community', exact: true })
      .click();
    const response = await created;
    expect(response.status(), await response.text()).toBe(201);
    const community = await response.json();
    expect(community.isPrivate).toBe(false);
    expect(community.joinPolicy).toBe('approval_required');
    await expect(page).toHaveURL(
      `/communities/manage/${community.slug}/members`
    );
    const memberPage = await memberContext.newPage();
    await browserLogin(memberPage, member.email);
    await memberPage.goto('/communities');
    await memberPage
      .locator('input[placeholder="Search by name or description..."]')
      .fill(name);
    const card = memberPage
      .locator('.communities-grid .community-card')
      .filter({ hasText: name });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText('approval_required');
    const joinResponse = memberPage.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/social/community/${community.id}/join`) &&
        r.request().method() === 'POST'
    );
    await card.getByRole('button', { name: 'Join', exact: true }).click();
    const joined = await joinResponse;
    expect(joined.status(), await joined.text()).toBe(201);
    expect((await joined.json()).status).toBe('pending');
    await expect(
      card.getByRole('button', { name: 'Pending', exact: true })
    ).toBeVisible();
    const management = await memberPage.request.post(
      origin + `/api/social/community/${community.id}/chat-room`,
      { headers, data: { ownerId: member.profileId } }
    );
    expect([403, 404]).toContain(management.status());
    await page.reload();
    await page.getByRole('button', { name: /Pending Requests/ }).click();
    const approval = page.waitForResponse(
      (r) => r.url().endsWith('/approve') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    expect((await approval).status()).toBe(201);
    await memberPage.reload();
    await memberPage
      .locator('input[placeholder="Search by name or description..."]')
      .fill(name);
    await expect(
      card.getByRole('button', { name: 'View Posts', exact: true })
    ).toBeVisible();
    await card.getByRole('button', { name: 'View Posts', exact: true }).click();
    await expect(memberPage).toHaveURL(`/communities/${community.slug}/posts`);
  } finally {
    await memberContext.close();
  }
});

test('RR05 project membership: revocation immediately removes chat access without a remaining-member refresh', async ({
  playwright,
}) => {
  const ownerContext = await playwright.request.newContext();
  const memberContext = await playwright.request.newContext();
  const projects = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3006 },
  });
  const chats = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3007 },
  });
  try {
    const owner = await account(ownerContext, 'project-owner');
    const member = await account(memberContext, 'project-member');
    await Promise.all([projects.connect(), chats.connect()]);
    const project = await firstValueFrom(
      projects.send(
        { cmd: 'project.create' },
        {
          owner: owner.profileId,
          createdBy: owner.profileId,
          members: [member.profileId],
          name: marker('project'),
          description: 'Local discussion gate',
          status: 'PLANNING',
          startDate: new Date().toISOString(),
        }
      )
    );
    const conversation = await firstValueFrom(
      chats.send(
        { cmd: 'GET_OR_CREATE_PROJECT_CHAT' },
        {
          projectId: project.id,
          ownerId: owner.profileId,
          participants: [member.profileId],
          title: project.name,
        }
      )
    );
    const sent = await ownerContext.post(origin + '/api/chat/messages', {
      headers,
      data: {
        conversationId: conversation.id,
        content: marker('project context'),
        recipientIds: [member.profileId],
      },
    });
    expect(sent.status(), await sent.text()).toBe(201);
    expect(
      (
        await memberContext.get(
          origin + '/api/chat/messages/' + conversation.id,
          { headers }
        )
      ).status()
    ).toBe(200);
    await firstValueFrom(
      projects.send(
        { cmd: 'projectMember.leave' },
        { projectId: project.id, requestingUserId: member.profileId }
      )
    );
    for (const path of ['/api/chat/messages/', '/api/chat/conversations/id/']) {
      const denied = await memberContext.get(origin + path + conversation.id, {
        headers,
      });
      expect([403, 404], path).toContain(denied.status());
    }
    const list = await memberContext.get(
      origin + '/api/chat/conversations/find',
      { headers }
    );
    expect(list.status()).toBe(200);
    expect(await list.text()).not.toContain(conversation.id);
    const denied = await memberContext.post(origin + '/api/chat/messages', {
      headers,
      data: {
        conversationId: conversation.id,
        content: 'revoked',
        recipientIds: [owner.profileId],
      },
    });
    expect([403, 404]).toContain(denied.status());
  } finally {
    projects.close();
    chats.close();
    await Promise.all([ownerContext.dispose(), memberContext.dispose()]);
  }
});
