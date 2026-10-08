import { APIRequestContext, expect, test } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

const RoleCommands = {
  GetByName: 'GetByName:Role',
  Assign: 'Assign:Role',
  Unassign: 'Unassign:Role',
} as const;

test.skip(
  process.env['RR08_SAFETY_LIVE'] !== 'true',
  'Requires the existing Optimistic Tanuki service stack'
);

const origin = 'http://127.0.0.1:8080';
const headers = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};
const password = 'RR08-local-test-password!';

async function account(
  request: APIRequestContext,
  role: string,
  appScope = 'client-interface'
) {
  const scopedHeaders = {
    ...headers,
    'x-ot-app-id': appScope,
    'x-ot-appscope': appScope,
  };
  const email = `rr08-safety-${role}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}@example.test`;
  const registration = await request.post(
    `${origin}/api/authentication/register`,
    {
      headers: scopedHeaders,
      data: {
        fn: 'RR08 safety',
        ln: role,
        email,
        password,
        confirm: password,
        bio: 'RR08 privacy acceptance fixture',
      },
    }
  );
  expect(registration.status(), await registration.text()).toBe(201);
  const login = await request.post(`${origin}/api/authentication/login`, {
    headers: { ...scopedHeaders, 'x-ot-session-mode': 'cookie' },
    data: { email, password },
  });
  expect(login.status(), await login.text()).toBe(201);
  const session = await request.get(`${origin}/api/authentication/session`, {
    headers: scopedHeaders,
  });
  expect(session.status(), await session.text()).toBe(200);
  return { email, ...(await session.json()).data } as {
    email: string;
    profileId: string;
    userId: string;
  };
}

async function grantFixtureRole(
  profileId: string,
  roleName: string,
  appScope: string
) {
  const permissions = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3012 },
  });
  await permissions.connect();
  try {
    const role = await firstValueFrom(
      permissions.send(
        { cmd: RoleCommands.GetByName },
        { name: roleName, appScope }
      )
    );
    expect(
      role?.id,
      `missing fixture role ${roleName} in ${appScope}`
    ).toBeTruthy();
    const assignment = await firstValueFrom(
      permissions.send(
        { cmd: RoleCommands.Assign },
        { roleId: role.id, profileId, appScopeId: role.appScope?.id }
      )
    );
    expect(
      assignment?.id,
      `failed to assign fixture role ${roleName}`
    ).toBeTruthy();
    return assignment.id as string;
  } finally {
    permissions.close();
  }
}

async function createPublicPost(author: { profileId: string; userId: string }) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3003 },
  });
  await client.connect();
  try {
    const marker = `RR08 safety ${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const post = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_POST' },
        {
          title: marker,
          content: marker,
          userId: author.userId,
          profileId: author.profileId,
          appScope: 'client-interface',
          visibility: 'public',
        }
      )
    );
    return { id: post.id as string, marker };
  } finally {
    client.close();
  }
}

async function createForumThread(author: {
  profileId: string;
  userId: string;
}) {
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port: 3015 },
  });
  await client.connect();
  try {
    const marker = `RR08 forum ${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;
    const topic = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_TOPIC' },
        {
          title: marker,
          description: marker,
          ...author,
          visibility: 'public',
          appScope: 'client-interface',
        }
      )
    );
    const thread = await firstValueFrom(
      client.send(
        { cmd: 'CREATE_THREAD' },
        {
          title: marker,
          description: marker,
          content: marker,
          ...author,
          topicId: topic.id,
          visibility: 'public',
          appScope: 'client-interface',
        }
      )
    );
    return {
      marker,
      topicId: topic.id as string,
      threadId: thread.id as string,
    };
  } finally {
    client.close();
  }
}

test('RR08 safety API: report history, blocking, and feed-only mute survive live reads', async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const reporterContext = await browser.newContext({ baseURL: origin });
  const authorContext = await browser.newContext({ baseURL: origin });
  const blockTargetContext = await browser.newContext({ baseURL: origin });
  const muteTargetContext = await browser.newContext({ baseURL: origin });
  try {
    const reporter = await account(reporterContext.request, 'reporter');
    const author = await account(authorContext.request, 'author');
    const directConversationResponse = await reporterContext.request.post(
      `${origin}/api/chat/conversations/direct/get-or-create`,
      { headers, data: { recipientProfileId: author.profileId } }
    );
    expect(
      directConversationResponse.status(),
      await directConversationResponse.text()
    ).toBe(201);
    const directConversation = await directConversationResponse.json();
    const baselineMessage = await reporterContext.request.post(
      `${origin}/api/chat/messages`,
      {
        headers,
        data: {
          conversationId: directConversation.id,
          content: 'RR08 pre-block direct-message positive',
          recipientIds: [author.profileId],
        },
      }
    );
    expect(baselineMessage.status(), await baselineMessage.text()).toBe(201);
    const post = await createPublicPost(author);
    const blockTarget = await account(
      blockTargetContext.request,
      'ui-block-target'
    );
    const muteTarget = await account(
      muteTargetContext.request,
      'ui-mute-target'
    );
    const blockTargetPost = await createPublicPost(blockTarget);
    const muteTargetPost = await createPublicPost(muteTarget);

    const targetBefore = await reporterContext.request.get(
      `${origin}/api/social/post/${post.id}/shared`,
      { headers }
    );
    expect(targetBefore.status(), await targetBefore.text()).toBe(200);
    expect(await targetBefore.text()).toContain(post.marker);
    const initialPublicFeed = await reporterContext.request.get(
      `${origin}/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false`,
      { headers }
    );
    expect(initialPublicFeed.status(), await initialPublicFeed.text()).toBe(
      200
    );
    const initialPublicFeedBody = await initialPublicFeed.text();
    expect(initialPublicFeedBody).toContain(blockTargetPost.marker);
    expect(initialPublicFeedBody).toContain(muteTargetPost.marker);

    const reporterPage = await reporterContext.newPage();
    await reporterPage.goto(`${origin}/feed`);
    const postCard = reporterPage
      .locator('lib-post')
      .filter({ hasText: post.marker });
    await expect(postCard).toBeVisible({ timeout: 20_000 });
    await postCard.getByRole('button', { name: '...' }).click();
    await postCard.getByRole('button', { name: 'Report post' }).click();
    await expect(
      reporterPage.getByRole('heading', { name: 'Report Post' })
    ).toBeVisible();
    await reporterPage.getByText('Spam', { exact: true }).click();
    await reporterPage
      .getByPlaceholder('Provide more context...')
      .fill('RR08 browser UI report');
    await reporterPage.getByRole('button', { name: 'Submit Report' }).click();
    await expect(
      reporterPage.getByRole('heading', { name: 'Report Post' })
    ).toBeHidden();

    const blockTargetCard = reporterPage
      .locator('lib-post')
      .filter({ hasText: blockTargetPost.marker });
    await expect(blockTargetCard).toBeVisible({ timeout: 20_000 });
    await blockTargetCard.getByRole('button', { name: '...' }).click();
    await blockTargetCard.getByRole('button', { name: 'Block' }).click();
    await expect(blockTargetCard).toBeHidden();
    await reporterPage.goto(`${origin}/settings/privacy`);
    await expect(
      reporterPage.getByRole('heading', { name: 'Blocked Users' })
    ).toBeVisible();
    await expect(
      reporterPage.getByRole('button', { name: 'Unblock' })
    ).toHaveCount(1);
    await reporterPage.getByRole('button', { name: 'Unblock' }).click();
    await expect(
      reporterPage.getByRole('button', { name: 'Unblock' })
    ).toHaveCount(0);

    await reporterPage.goto(`${origin}/feed`);
    const muteTargetCard = reporterPage
      .locator('lib-post')
      .filter({ hasText: muteTargetPost.marker });
    await expect(muteTargetCard).toBeVisible({ timeout: 20_000 });
    await muteTargetCard.getByRole('button', { name: '...' }).click();
    await muteTargetCard
      .getByRole('button', { name: 'Mute from feed' })
      .click();
    await expect(muteTargetCard).toBeHidden();
    await reporterPage.goto(`${origin}/settings/privacy`);
    await expect(
      reporterPage.getByRole('heading', { name: 'Muted Users' })
    ).toBeVisible();
    await expect(
      reporterPage.getByRole('button', { name: 'Unmute' })
    ).toHaveCount(1);
    await reporterPage.getByRole('button', { name: 'Unmute' }).click();
    await expect(
      reporterPage.getByRole('button', { name: 'Unmute' })
    ).toHaveCount(0);

    const historyBeforeInvalidTarget = await reporterContext.request.get(
      `${origin}/api/privacy/reports`,
      { headers }
    );
    expect(historyBeforeInvalidTarget.status()).toBe(200);
    const beforeInvalidReports = await historyBeforeInvalidTarget.json();
    const inaccessibleTarget = await reporterContext.request.post(
      `${origin}/api/privacy/report`,
      {
        headers,
        data: {
          contentType: 'post',
          contentId: '00000000-0000-4000-8000-000000000000',
          reason: 'spam',
          description: 'RR08 inaccessible target must not persist',
        },
      }
    );
    expect([400, 403, 404]).toContain(inaccessibleTarget.status());
    const historyAfterInvalidTarget = await reporterContext.request.get(
      `${origin}/api/privacy/reports`,
      { headers }
    );
    expect(historyAfterInvalidTarget.status()).toBe(200);
    expect(await historyAfterInvalidTarget.json()).toHaveLength(
      beforeInvalidReports.length
    );

    const reportResponse = await reporterContext.request.post(
      `${origin}/api/privacy/report`,
      {
        headers,
        data: {
          contentType: 'post',
          contentId: post.id,
          reason: 'spam',
          description: 'RR08 API report review check',
        },
      }
    );
    expect(reportResponse.status(), await reportResponse.text()).toBe(201);
    const report = await reportResponse.json();
    const otherAccountReports = await authorContext.request.get(
      `${origin}/api/privacy/reports`,
      { headers }
    );
    expect(otherAccountReports.status()).toBe(200);
    expect(JSON.stringify(await otherAccountReports.json())).not.toContain(
      report.id
    );
    const myReports = await reporterContext.request.get(
      `${origin}/api/privacy/reports`,
      { headers }
    );
    expect(myReports.status(), await myReports.text()).toBe(200);
    expect(await myReports.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: report.id,
          contentId: post.id,
          status: 'pending',
        }),
      ])
    );

    await reporterPage.goto(`${origin}/feed`);
    const authorCard = reporterPage
      .locator('lib-post')
      .filter({ hasText: post.marker });
    await expect(authorCard).toBeVisible({ timeout: 20_000 });

    const block = await reporterContext.request.post(
      `${origin}/api/privacy/block`,
      { headers, data: { blockedId: author.profileId } }
    );
    expect(block.status(), await block.text()).toBe(201);
    const blocked = await reporterContext.request.get(
      `${origin}/api/privacy/blocked`,
      { headers }
    );
    expect(blocked.status(), await blocked.text()).toBe(200);
    expect(await blocked.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ blockedId: author.profileId }),
      ])
    );
    await expect(authorCard).toBeHidden({ timeout: 20_000 });
    const blockedDirectCreation = await reporterContext.request.post(
      `${origin}/api/chat/conversations/direct/get-or-create`,
      { headers, data: { recipientProfileId: author.profileId } }
    );
    expect(blockedDirectCreation.status()).toBe(403);
    const blockedExistingConversationMessage =
      await reporterContext.request.post(`${origin}/api/chat/messages`, {
        headers,
        data: {
          conversationId: directConversation.id,
          content: 'RR08 blocked direct-message must not persist',
          recipientIds: [author.profileId],
        },
      });
    expect(blockedExistingConversationMessage.status()).toBe(403);
    const existingMessages = await reporterContext.request.get(
      `${origin}/api/chat/messages/${directConversation.id}`,
      { headers }
    );
    expect(existingMessages.status(), await existingMessages.text()).toBe(200);
    expect(await existingMessages.text()).not.toContain(
      'RR08 blocked direct-message must not persist'
    );
    const blockedFeed = await reporterContext.request.get(
      `${origin}/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false`,
      { headers }
    );
    expect(blockedFeed.status(), await blockedFeed.text()).toBe(200);
    expect(await blockedFeed.text()).not.toContain(post.marker);

    const unblock = await reporterContext.request.delete(
      `${origin}/api/privacy/block/${author.profileId}`,
      { headers }
    );
    expect([200, 204]).toContain(unblock.status());
    await expect(authorCard).toBeVisible({ timeout: 20_000 });
    const mute = await reporterContext.request.post(
      `${origin}/api/privacy/mute`,
      { headers, data: { mutedId: author.profileId, duration: 3600 } }
    );
    expect(mute.status(), await mute.text()).toBe(201);
    await expect(authorCard).toBeHidden({ timeout: 20_000 });
    const muted = await reporterContext.request.get(
      `${origin}/api/privacy/muted`,
      { headers }
    );
    expect(muted.status(), await muted.text()).toBe(200);
    expect(await muted.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mutedId: author.profileId }),
      ])
    );
    const unmute = await reporterContext.request.delete(
      `${origin}/api/privacy/mute/${author.profileId}`,
      { headers }
    );
    expect([200, 204]).toContain(unmute.status());
    const unmutedPreferences = await reporterContext.request.get(
      `${origin}/api/privacy/muted`,
      { headers }
    );
    expect(unmutedPreferences.status(), await unmutedPreferences.text()).toBe(
      200
    );
    expect(JSON.stringify(await unmutedPreferences.json())).not.toContain(
      author.profileId
    );
    const unmutedFeed = await reporterContext.request.get(
      `${origin}/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false`,
      { headers }
    );
    expect(unmutedFeed.status(), await unmutedFeed.text()).toBe(200);
    expect(await unmutedFeed.text()).toContain(post.marker);
    await expect(authorCard).toBeVisible({ timeout: 20_000 });
    const expiryMute = await reporterContext.request.post(
      `${origin}/api/privacy/mute`,
      { headers, data: { mutedId: author.profileId, duration: 1 } }
    );
    expect(expiryMute.status(), await expiryMute.text()).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const afterMuteExpiry = await reporterContext.request.get(
      `${origin}/api/privacy/muted`,
      { headers }
    );
    expect(afterMuteExpiry.status(), await afterMuteExpiry.text()).toBe(200);
    expect(await afterMuteExpiry.json()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mutedId: author.profileId }),
      ])
    );
    const remute = await reporterContext.request.post(
      `${origin}/api/privacy/mute`,
      { headers, data: { mutedId: author.profileId, duration: 3600 } }
    );
    expect(remute.status(), await remute.text()).toBe(201);
    const activeRemute = await reporterContext.request.get(
      `${origin}/api/privacy/muted`,
      { headers }
    );
    expect(activeRemute.status(), await activeRemute.text()).toBe(200);
    expect(await activeRemute.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mutedId: author.profileId }),
      ])
    );
    const mutedFeed = await reporterContext.request.get(
      `${origin}/api/social/feed?includePublic=true&includeFollowing=false&includeCommunities=false`,
      { headers }
    );
    expect(mutedFeed.status(), await mutedFeed.text()).toBe(200);
    expect(await mutedFeed.text()).not.toContain(post.marker);

    const directPost = await reporterContext.request.get(
      `${origin}/api/social/post/${post.id}/shared`,
      { headers }
    );
    expect(directPost.status(), await directPost.text()).toBe(200);
    expect(await directPost.text()).toContain(post.marker);

    console.info(
      `[RR08 B02 fixture] reporterProfileId=${reporter.profileId} authorProfileId=${author.profileId} postId=${post.id} blockTargetProfileId=${blockTarget.profileId} blockTargetPostId=${blockTargetPost.id} muteTargetProfileId=${muteTarget.profileId} muteTargetPostId=${muteTargetPost.id}`
    );
  } finally {
    await Promise.allSettled([
      reporterContext.close(),
      authorContext.close(),
      blockTargetContext.close(),
      muteTargetContext.close(),
    ]);
  }
});

test('RR08 B01: app-scoped review authority rejects other scopes and writes an accountable audit action', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const reporterContext = await browser.newContext({ baseURL: origin });
  const reviewerContext = await browser.newContext({ baseURL: origin });
  const ordinaryContext = await browser.newContext({ baseURL: origin });
  const authorContext = await browser.newContext({ baseURL: origin });
  let assignmentId: string | undefined;
  try {
    const reporter = await account(
      reporterContext.request,
      'app-review-reporter'
    );
    const reviewer = await account(
      reviewerContext.request,
      'app-review-operator'
    );
    await account(ordinaryContext.request, 'app-review-ordinary');
    const author = await account(authorContext.request, 'app-review-author');
    assignmentId = await grantFixtureRole(
      reviewer.profileId,
      'client_interface_operator',
      'client-interface'
    );
    const post = await createPublicPost(author);

    const invalidReport = await reporterContext.request.post(
      `${origin}/api/privacy/report`,
      {
        headers,
        data: {
          contentType: 'unknown',
          contentId: post.id,
          reason: 'spam',
        },
      }
    );
    expect(invalidReport.status()).toBe(400);
    const invalidMessageReport = await reporterContext.request.post(
      `${origin}/api/privacy/report`,
      {
        headers,
        data: {
          contentType: 'message',
          contentId: 'forged-message-id',
          reason: 'harassment',
        },
      }
    );
    expect(invalidMessageReport.status()).toBe(400);

    const reportResponse = await reporterContext.request.post(
      `${origin}/api/privacy/report`,
      {
        headers,
        data: {
          contentType: 'post',
          contentId: post.id,
          reason: 'spam',
          description: 'RR08 app-scoped audit fixture',
        },
      }
    );
    expect(reportResponse.status(), await reportResponse.text()).toBe(201);
    const report = await reportResponse.json();

    const ordinaryRead = await ordinaryContext.request.get(
      `${origin}/api/privacy/operator/reports`,
      { headers }
    );
    expect(ordinaryRead.status()).toBe(403);
    const wrongAppRead = await reviewerContext.request.get(
      `${origin}/api/privacy/operator/reports`,
      { headers: { ...headers, 'x-ot-appscope': 'local-hub' } }
    );
    expect(wrongAppRead.status()).toBe(403);

    const reviewerRead = await reviewerContext.request.get(
      `${origin}/api/privacy/operator/reports`,
      { headers }
    );
    expect(reviewerRead.status(), await reviewerRead.text()).toBe(200);
    expect(await reviewerRead.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: report.id, contentId: post.id }),
      ])
    );
    const invalidStatus = await reviewerContext.request.put(
      `${origin}/api/privacy/operator/reports/${report.id}`,
      {
        headers,
        data: { status: 'removed' },
      }
    );
    expect(invalidStatus.status()).toBe(400);

    const statusUpdate = await reviewerContext.request.put(
      `${origin}/api/privacy/operator/reports/${report.id}`,
      {
        headers,
        data: { status: 'reviewed', adminNotes: 'RR08 app audit verification' },
      }
    );
    expect(statusUpdate.status(), await statusUpdate.text()).toBe(200);
    expect(await statusUpdate.json()).toMatchObject({
      id: report.id,
      status: 'reviewed',
    });

    console.info(
      `[RR08 B01 fixture] appScope=client-interface reporterProfileId=${reporter.profileId} reviewerProfileId=${reviewer.profileId} postId=${post.id} reportId=${report.id}`
    );
  } finally {
    if (assignmentId) {
      const permissions = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: 3012 },
      });
      await permissions.connect();
      await firstValueFrom(
        permissions.send({ cmd: RoleCommands.Unassign }, { assignmentId })
      ).catch(() => undefined);
      permissions.close();
    }
    await Promise.allSettled([
      reporterContext.close(),
      reviewerContext.close(),
      ordinaryContext.close(),
      authorContext.close(),
    ]);
  }
});

test('RR08 B01: Client Interface forum moderators can review their app reports only', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const reporterContext = await browser.newContext({ baseURL: origin });
  const moderatorContext = await browser.newContext({ baseURL: origin });
  const ordinaryContext = await browser.newContext({ baseURL: origin });
  const authorContext = await browser.newContext({ baseURL: origin });
  let assignmentId: string | undefined;
  try {
    const reporter = await account(
      reporterContext.request,
      'forum-report-author'
    );
    const moderator = await account(
      moderatorContext.request,
      'forum-moderator'
    );
    await account(ordinaryContext.request, 'forum-ordinary');
    const author = await account(authorContext.request, 'forum-content-author');
    assignmentId = await grantFixtureRole(
      moderator.profileId,
      'client_interface_forum_moderator',
      'client-interface'
    );
    const fixture = await createForumThread(author);

    const invalidType = await reporterContext.request.post(
      `${origin}/api/forum/report`,
      {
        headers,
        data: {
          contentType: 'topic',
          contentId: fixture.threadId,
          reason: 'spam',
        },
      }
    );
    expect(invalidType.status()).toBe(400);

    const reportResponse = await reporterContext.request.post(
      `${origin}/api/forum/report`,
      {
        headers,
        data: {
          contentType: 'thread',
          contentId: fixture.threadId,
          reason: 'spam',
          description: 'RR08 forum moderator scope and audit fixture',
        },
      }
    );
    expect(reportResponse.status(), await reportResponse.text()).toBe(201);
    const report = await reportResponse.json();

    const ordinaryRead = await ordinaryContext.request.get(
      `${origin}/api/forum/admin/reports`,
      { headers }
    );
    expect(ordinaryRead.status()).toBe(403);
    const wrongScopeRead = await moderatorContext.request.get(
      `${origin}/api/forum/admin/reports`,
      { headers: { ...headers, 'x-ot-appscope': 'local-hub' } }
    );
    expect(wrongScopeRead.status()).toBe(403);

    const moderatorRead = await moderatorContext.request.get(
      `${origin}/api/forum/admin/reports`,
      { headers }
    );
    expect(moderatorRead.status(), await moderatorRead.text()).toBe(200);
    expect(await moderatorRead.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: report.id,
          contentType: 'thread',
          contentId: fixture.threadId,
          appScope: 'client-interface',
        }),
      ])
    );
    const invalidStatus = await moderatorContext.request.put(
      `${origin}/api/forum/admin/reports/${report.id}`,
      { headers, data: { status: 'removed' } }
    );
    expect(invalidStatus.status()).toBe(400);

    const ordinaryModeration = await ordinaryContext.request.put(
      `${origin}/api/forum/admin/thread/${fixture.threadId}/moderation`,
      { headers, data: { moderationStatus: 'hidden' } }
    );
    expect(ordinaryModeration.status()).toBe(403);
    const wrongScopeModeration = await moderatorContext.request.put(
      `${origin}/api/forum/admin/thread/${fixture.threadId}/moderation`,
      {
        headers: { ...headers, 'x-ot-appscope': 'local-hub' },
        data: { moderationStatus: 'hidden' },
      }
    );
    expect(wrongScopeModeration.status()).toBe(403);
    const hideThread = await moderatorContext.request.put(
      `${origin}/api/forum/admin/thread/${fixture.threadId}/moderation`,
      {
        headers,
        data: {
          moderationStatus: 'hidden',
          adminNotes: 'RR08 forum content moderation audit proof',
        },
      }
    );
    expect(hideThread.status(), await hideThread.text()).toBe(200);
    expect(await hideThread.json()).toMatchObject({
      id: fixture.threadId,
      moderationStatus: 'hidden',
      moderatedBy: moderator.profileId,
    });
    const restoreThread = await moderatorContext.request.put(
      `${origin}/api/forum/admin/thread/${fixture.threadId}/moderation`,
      { headers, data: { moderationStatus: 'visible' } }
    );
    expect(restoreThread.status(), await restoreThread.text()).toBe(200);
    expect(await restoreThread.json()).toMatchObject({
      id: fixture.threadId,
      moderationStatus: 'visible',
      moderatedBy: moderator.profileId,
    });

    const reviewed = await moderatorContext.request.put(
      `${origin}/api/forum/admin/reports/${report.id}`,
      {
        headers,
        data: { status: 'reviewed', adminNotes: 'RR08 moderator audit proof' },
      }
    );
    expect(reviewed.status(), await reviewed.text()).toBe(200);
    expect(await reviewed.json()).toMatchObject({
      id: report.id,
      status: 'reviewed',
      appScope: 'client-interface',
    });

    console.info(
      `[RR08 B01 forum fixture] appScope=client-interface reporterProfileId=${reporter.profileId} moderatorProfileId=${moderator.profileId} threadId=${fixture.threadId} reportId=${report.id}`
    );
  } finally {
    if (assignmentId) {
      const permissions = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: 3012 },
      });
      await permissions.connect();
      await firstValueFrom(
        permissions.send({ cmd: RoleCommands.Unassign }, { assignmentId })
      ).catch(() => undefined);
      permissions.close();
    }
    await Promise.allSettled([
      reporterContext.close(),
      moderatorContext.close(),
      ordinaryContext.close(),
      authorContext.close(),
    ]);
  }
});

test('RR08 B03: report writes stop at the per-account limit without blocking another account on the same forwarded IP', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const firstContext = await browser.newContext({ baseURL: origin });
  const secondContext = await browser.newContext({ baseURL: origin });
  const authorContext = await browser.newContext({ baseURL: origin });
  try {
    const first = await account(firstContext.request, 'rate-limited-reporter');
    const second = await account(secondContext.request, 'same-ip-reporter');
    const author = await account(authorContext.request, 'rate-limit-author');
    const post = await createPublicPost(author);
    const forwardedHeaders = {
      ...headers,
      'x-forwarded-for': '198.51.100.41',
    };
    for (let index = 0; index < 10; index++) {
      const report = await firstContext.request.post(
        `${origin}/api/privacy/report`,
        {
          headers: forwardedHeaders,
          data: {
            contentType: 'post',
            contentId: post.id,
            reason: 'spam',
            description: `RR08 bounded report ${index}`,
          },
        }
      );
      expect(report.status(), `report ${index}: ${await report.text()}`).toBe(
        201
      );
    }
    const overLimit = await firstContext.request.post(
      `${origin}/api/privacy/report`,
      {
        headers: forwardedHeaders,
        data: {
          contentType: 'post',
          contentId: post.id,
          reason: 'spam',
          description: 'RR08 over-limit report must not persist',
        },
      }
    );
    expect(overLimit.status()).toBe(429);
    const firstReports = await firstContext.request.get(
      `${origin}/api/privacy/reports`,
      { headers }
    );
    expect(firstReports.status()).toBe(200);
    const ownReports = await firstReports.json();
    expect(
      ownReports.filter(
        (report: { contentId: string }) => report.contentId === post.id
      )
    ).toHaveLength(10);
    expect(JSON.stringify(ownReports)).not.toContain(
      'RR08 over-limit report must not persist'
    );

    const otherAccount = await secondContext.request.post(
      `${origin}/api/privacy/report`,
      {
        headers: forwardedHeaders,
        data: {
          contentType: 'post',
          contentId: post.id,
          reason: 'spam',
          description: 'RR08 separate-account positive',
        },
      }
    );
    expect(otherAccount.status(), await otherAccount.text()).toBe(201);
    const secondReports = await secondContext.request.get(
      `${origin}/api/privacy/reports`,
      { headers }
    );
    expect(secondReports.status()).toBe(200);
    expect(await secondReports.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          contentId: post.id,
          description: 'RR08 separate-account positive',
        }),
      ])
    );
    console.info(
      `[RR08 B03 rate fixture] reporterProfileIds=${first.profileId},${
        second.profileId
      } targetPostId=${post.id} deniedStatus=${overLimit.status()}`
    );
  } finally {
    await Promise.allSettled([
      firstContext.close(),
      secondContext.close(),
      authorContext.close(),
    ]);
  }
});
