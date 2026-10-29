import { test, expect, APIRequestContext } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { io } from 'socket.io-client';

test.skip(
  process.env['RR04_LIVE_STACK'] !== 'true',
  'Requires the existing development stack'
);

const origin = 'http://127.0.0.1:8080';
const password = 'RR04-local-test-password!';
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
  const headers = {
    'x-ot-app-id': 'client-interface',
    'x-ot-appscope': 'client-interface',
  };
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
        bio: 'Local RR04 I03 socket block fixture',
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

async function createPost(
  author: { userId: string; profileId: string },
  marker: string,
  communityId: string
) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  await client.connect();
  try {
    const post = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_POST' },
        {
          title: marker,
          content: marker,
          visibility: 'public',
          communityId,
          userId: author.userId,
          profileId: author.profileId,
          appScope: 'social',
        }
      )
    );
    recordFixture({
      type: 'post',
      id: post.id,
      ownerProfileId: author.profileId,
      ownerUserId: author.userId,
      name: marker,
    });
    return post as { id: string };
  } finally {
    client.close();
  }
}

async function subscribedSocket(
  request: APIRequestContext,
  profileId: string,
  postIds: string[]
) {
  const cookies = (await request.storageState()).cookies;
  const socket = io('http://127.0.0.1:3301/social', {
    transports: ['websocket'],
    extraHeaders: {
      Cookie: cookies
        .map((cookie) => `${cookie.name}=${cookie.value}`)
        .join('; '),
    },
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(
        () => reject(new Error('Socket connect timeout')),
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
          reject(new Error('Socket subscribe timeout'));
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

function waitForPostUpdated(
  socket: ReturnType<typeof io>,
  postId: string,
  description: string
) {
  return new Promise<{ id?: string; content?: string }>((resolve, reject) => {
    const listener = (event: { id?: string; content?: string }) => {
      if (event.id === postId) {
        clearTimeout(deadline);
        socket.off('post_updated', listener);
        resolve(event);
      }
    };
    const deadline = setTimeout(() => {
      socket.off('post_updated', listener);
      reject(new Error(description));
    }, 5000);
    socket.on('post_updated', listener);
  });
}

async function observeUpdate(
  observer: ReturnType<typeof io>,
  writer: APIRequestContext,
  postId: string,
  content: string
) {
  const events: Array<{ id?: string; content?: string }> = [];
  const listener = (event: { id?: string; content?: string }) =>
    events.push(event);
  observer.on('post_updated', listener);
  try {
    const response = await writer.put(
      origin + `/api/social/post/update/${postId}`,
      { headers: socialHeaders, data: { content } }
    );
    expect(response.status(), await response.text()).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return events;
  } finally {
    observer.off('post_updated', listener);
  }
}

test('RR04 I03 socket: community block denies live delivery and reconnect subscription in both directions', async ({
  playwright,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'chromium-desktop',
    'Socket gate runs once'
  );
  test.setTimeout(150000);
  const ownerContext = await playwright.request.newContext();
  const memberContext = await playwright.request.newContext();
  let communityId: string | undefined;
  let ownerPostId: string | undefined;
  let memberPostId: string | undefined;
  let ownerBlockedMember = false;
  let memberBlockedOwner = false;
  let ownerProfileId: string | undefined;
  let memberProfileId: string | undefined;
  let ownerSocket: ReturnType<typeof io> | undefined;
  let memberSocket: ReturnType<typeof io> | undefined;

  try {
    const owner = await test.step('register community owner', () =>
      account(ownerContext, 'socket-block-owner'));
    const member = await test.step('register approved community member', () =>
      account(memberContext, 'socket-block-member'));
    ownerProfileId = owner.profileId;
    memberProfileId = member.profileId;
    const communityName = `RR04 I03 socket block ${Date.now()}`;
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
    communityId = (await communityResponse.json()).id;
    recordFixture({
      type: 'community',
      id: communityId,
      ownerProfileId: owner.profileId,
      ownerUserId: owner.userId,
      name: communityName,
    });
    const join = await memberContext.post(
      origin + `/api/social/community/${communityId}/join`,
      { headers: socialHeaders }
    );
    expect(join.status(), await join.text()).toBe(201);
    const membership = await join.json();
    recordFixture({
      type: 'community-membership',
      id: membership.id,
      ownerProfileId: member.profileId,
      ownerUserId: member.userId,
      name: 'approved socket block member',
    });

    const ownerMarker = `RR04-I03 socket owner post ${Date.now()}`;
    const memberMarker = `RR04-I03 socket member post ${Date.now()}`;
    const ownerPost = await createPost(owner, ownerMarker, communityId);
    ownerPostId = ownerPost.id;
    const memberPost = await createPost(member, memberMarker, communityId);
    memberPostId = memberPost.id;

    const ownerInitial = await subscribedSocket(ownerContext, owner.profileId, [
      ownerPost.id,
      memberPost.id,
    ]);
    ownerSocket = ownerInitial.socket;
    expect(ownerInitial.acknowledgement.postIds).toEqual(
      expect.arrayContaining([ownerPost.id, memberPost.id])
    );
    const memberInitial = await subscribedSocket(
      memberContext,
      member.profileId,
      [ownerPost.id, memberPost.id]
    );
    memberSocket = memberInitial.socket;
    expect(memberInitial.acknowledgement.postIds).toEqual(
      expect.arrayContaining([ownerPost.id, memberPost.id])
    );

    const ownerPositiveDelivery = waitForPostUpdated(
      ownerSocket,
      ownerPost.id,
      'Authorized owner update was not delivered to the owner'
    );
    const memberPositiveDelivery = waitForPostUpdated(
      memberSocket,
      ownerPost.id,
      'Authorized owner update was not delivered to the member'
    );
    const authorizedUpdate = await ownerContext.put(
      origin + `/api/social/post/update/${ownerPost.id}`,
      {
        headers: socialHeaders,
        data: { content: `${ownerMarker} authorized positive` },
      }
    );
    expect(authorizedUpdate.status(), await authorizedUpdate.text()).toBe(200);
    const [ownerPositive, memberPositive] = await Promise.all([
      ownerPositiveDelivery,
      memberPositiveDelivery,
    ]);
    expect(ownerPositive.content).toContain('authorized positive');
    expect(memberPositive.content).toContain('authorized positive');

    const ownerToMemberPositive = waitForPostUpdated(
      ownerSocket,
      memberPost.id,
      'Authorized member update was not delivered to the owner'
    );
    const memberSelfPositive = waitForPostUpdated(
      memberSocket,
      memberPost.id,
      'Authorized member update was not delivered to the member'
    );
    const memberAuthorizedUpdate = await memberContext.put(
      origin + `/api/social/post/update/${memberPost.id}`,
      {
        headers: socialHeaders,
        data: { content: `${memberMarker} authorized positive` },
      }
    );
    expect(
      memberAuthorizedUpdate.status(),
      await memberAuthorizedUpdate.text()
    ).toBe(200);
    const [ownerSawMember, memberSawSelf] = await Promise.all([
      ownerToMemberPositive,
      memberSelfPositive,
    ]);
    expect(ownerSawMember.content).toContain('authorized positive');
    expect(memberSawSelf.content).toContain('authorized positive');

    const ownerBlock = await ownerContext.post(origin + '/api/privacy/block', {
      headers: socialHeaders,
      data: { blockedId: member.profileId },
    });
    expect(ownerBlock.status(), await ownerBlock.text()).toBe(201);
    ownerBlockedMember = true;
    const ownerDenied = await observeUpdate(
      ownerSocket,
      memberContext,
      memberPost.id,
      `${memberMarker} owner must not receive`
    );
    expect(ownerDenied.filter((event) => event.id === memberPost.id)).toEqual(
      []
    );
    expect(JSON.stringify(ownerDenied)).not.toContain(memberMarker);

    const memberBlock = await memberContext.post(
      origin + '/api/privacy/block',
      {
        headers: socialHeaders,
        data: { blockedId: owner.profileId },
      }
    );
    expect(memberBlock.status(), await memberBlock.text()).toBe(201);
    memberBlockedOwner = true;
    const memberDenied = await observeUpdate(
      memberSocket,
      ownerContext,
      ownerPost.id,
      `${ownerMarker} member must not receive`
    );
    expect(memberDenied.filter((event) => event.id === ownerPost.id)).toEqual(
      []
    );
    expect(JSON.stringify(memberDenied)).not.toContain(ownerMarker);

    ownerSocket.disconnect();
    memberSocket.disconnect();
    ownerSocket = undefined;
    memberSocket = undefined;
    const ownerReconnect = await subscribedSocket(
      ownerContext,
      owner.profileId,
      [ownerPost.id, memberPost.id]
    );
    ownerSocket = ownerReconnect.socket;
    expect(ownerReconnect.acknowledgement.postIds).toContain(ownerPost.id);
    expect(ownerReconnect.acknowledgement.postIds).not.toContain(memberPost.id);
    const memberReconnect = await subscribedSocket(
      memberContext,
      member.profileId,
      [ownerPost.id, memberPost.id]
    );
    memberSocket = memberReconnect.socket;
    expect(memberReconnect.acknowledgement.postIds).toContain(memberPost.id);
    expect(memberReconnect.acknowledgement.postIds).not.toContain(ownerPost.id);
  } finally {
    ownerSocket?.disconnect();
    memberSocket?.disconnect();
    if (ownerBlockedMember && memberProfileId) {
      const response = await ownerContext.delete(
        origin + `/api/privacy/block/${memberProfileId}`,
        { headers: socialHeaders }
      );
      expect([200, 204]).toContain(response.status());
    }
    if (memberBlockedOwner && ownerProfileId) {
      const response = await memberContext.delete(
        origin + `/api/privacy/block/${ownerProfileId}`,
        { headers: socialHeaders }
      );
      expect([200, 204]).toContain(response.status());
    }
    if (ownerPostId) {
      const response = await ownerContext.delete(
        origin + `/api/social/post/${ownerPostId}`,
        { headers: socialHeaders }
      );
      expect(response.status(), await response.text()).toBe(200);
    }
    if (memberPostId) {
      const response = await memberContext.delete(
        origin + `/api/social/post/${memberPostId}`,
        { headers: socialHeaders }
      );
      expect(response.status(), await response.text()).toBe(200);
    }
    if (communityId) {
      const response = await ownerContext.delete(
        origin + `/api/social/community/${communityId}`,
        { headers: socialHeaders }
      );
      expect(response.status(), await response.text()).toBe(200);
    }
    await Promise.all([ownerContext.dispose(), memberContext.dispose()]);
  }
});
