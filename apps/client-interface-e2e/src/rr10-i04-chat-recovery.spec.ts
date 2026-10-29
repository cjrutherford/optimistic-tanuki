import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { firstValueFrom } from 'rxjs';
import { io, type Socket } from 'socket.io-client';

const enabled = process.env['RR10_I04_LIVE_STACK'] === 'true';
const origin = new URL(process.env['BASE_URL'] ?? 'http://127.0.0.1:8080')
  .origin;
const fixturePath =
  process.env['RR10_I04_FIXTURE_MANIFEST'] ??
  '/home/cjrutherford/workspace/optimistic-tanuki/.runtime-artifacts/rr10/i04/fixture-manifest.json';
const ownerCredentialsPath =
  process.env['RR10_I04_OWNER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json';
const memberCredentialsPath =
  process.env['RR10_I04_MEMBER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i04-nonowner-credentials.json';
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDirectory = resolve(workspaceRoot, '.runtime-artifacts/rr10/i04');
const appHeaders = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};
const roleGetUserRolesCommand = 'GetUserRoles:Role';
const roleUnassignCommand = 'Unassign:Role';
const behaviorSourceFiles = [
  'apps/chat-collector/src/app/app.controller.ts',
  'apps/chat-collector/src/app/app.service.ts',
  'apps/gateway/src/app/chat-gateway/chat.gateway.ts',
  'apps/client-interface/src/app/components/messages.component.ts',
  'libs/chat-ui/src/lib/socket-chat.service.ts',
  'libs/chat-ui/src/lib/chat-ui/chat-ui.component.ts',
  'libs/chat-ui/src/lib/chat-ui/chat-ui.component.html',
  'libs/chat-ui/src/lib/chat-ui/chat-window/chat-window.component.ts',
  'libs/chat-ui/src/lib/chat-ui/chat-window/chat-window.component.html',
  'libs/chat-ui/src/lib/chat-ui/compose-chat/compose-chat.component.ts',
  'libs/chat-ui/src/lib/chat-ui/compose-chat/compose-chat.component.html',
  'libs/chat/contracts/src/lib/chat-commands.ts',
  'libs/chat/contracts/src/lib/conversation.ts',
  'libs/community-ui/src/lib/community-ui/community-chat/community-chat.component.ts',
];

interface FixtureManifest {
  appScope: string;
  community: { id: string; ownerProfileId: string };
  owner: { profileId: string };
  approvedMember: { profileId: string; membershipId: string };
  conversation: { id: string };
  originalConversationTombstone: {
    id: string;
    messageCount: number;
    messageDigest: string;
  };
  resumeExistingMessages: Array<{
    id: string;
    senderId: string;
    content: string;
  }>;
  workspace: { id: string };
}

interface SessionUser {
  profileId: string;
  userId: string;
}

interface ChatPayload {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  recipientId: string[];
  type: 'chat';
}

interface Ack {
  success: boolean;
  messageId?: string;
  statusCode?: number;
  message?: string;
}

function workspaceClient(port: number) {
  return ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port },
  });
}

async function connectSocket(
  context: BrowserContext,
  profileId: string
): Promise<Socket> {
  const cookie = (await context.cookies(origin))
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  const socket = io('http://127.0.0.1:3300/chat', {
    transports: ['websocket'],
    extraHeaders: { Cookie: cookie },
    autoConnect: false,
  });

  await new Promise<void>((resolveConnect, rejectConnect) => {
    const timeout = setTimeout(
      () => finish(new Error('Socket authorization timed out')),
      10_000
    );
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      if (error) rejectConnect(error);
      else resolveConnect();
    };
    const onConnect = () => {
      socket.emit('get_conversations', { profileId });
      finish();
    };
    const onError = (error: Error) => finish(error);
    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  });
  return socket;
}

function sendWithAck(socket: Socket, payload: ChatPayload): Promise<Ack> {
  return new Promise((resolveAck, rejectAck) => {
    const timeout = setTimeout(
      () => rejectAck(new Error('Message acknowledgement timed out')),
      20_000
    );
    socket.emit('message', payload, (response: Ack) => {
      clearTimeout(timeout);
      resolveAck(response);
    });
  });
}

async function login(
  page: Page,
  credentialsPath: string,
  cookiePath: string,
  expectedProfileId: string
): Promise<SessionUser> {
  if (process.env['RR10_I04_FORCE_LOGIN'] !== 'true') {
    const netscapeCookies = readFileSync(cookiePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('\t'))
      .map((line) => {
        const fields = line.split('\t');
        const httpOnly = fields[0].startsWith('#HttpOnly_');
        const domain = fields[0].replace(/^#HttpOnly_/, '');
        const expiration = Number(fields[4]);
        return {
          name: fields[5],
          value: fields[6],
          domain,
          path: fields[2],
          secure: fields[3] === 'TRUE',
          httpOnly,
          ...(Number.isFinite(expiration) && expiration > 0
            ? { expires: expiration }
            : {}),
        };
      });
    await page.context().addCookies(netscapeCookies);
    const restoredSession = await page.request.get(
      `${origin}/api/authentication/session`,
      { headers: appHeaders }
    );
    if (restoredSession.status() === 200) {
      const restoredUser = (await restoredSession.json()).data as SessionUser;
      if (restoredUser.profileId === expectedProfileId) {
        await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
        return restoredUser;
      }
    }
  }

  await page.context().clearCookies();
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  const response = await page.request.get(
    `${origin}/api/authentication/session`,
    {
      headers: appHeaders,
    }
  );
  expect(response.status()).toBe(200);
  let session = (await response.json()).data as SessionUser;
  if (session.profileId !== expectedProfileId) {
    // The known accounts can have more than one owned profile. Match the
    // application's verified profile-switch flow: confirm ownership under
    // the authenticated user, issue a scoped session for that profile, then
    // restore and verify the new cookie before using it.
    const profilesResponse = await page.request.get(`${origin}/api/profile`, {
      headers: appHeaders,
    });
    expect(profilesResponse.status()).toBe(200);
    const profiles = (await profilesResponse.json()) as Array<{
      id: string;
      userId: string;
      appScope?: string | null;
    }>;
    const ownedProfile = profiles.find(
      (profile) =>
        profile.id === expectedProfileId &&
        profile.userId === session.userId &&
        (profile.appScope === 'client-interface' ||
          profile.appScope === 'global' ||
          profile.appScope == null)
    );
    expect(
      ownedProfile,
      'fixture profile must be owned by the signed-in user'
    ).toBeTruthy();
    const issueResponse = await page.request.post(
      `${origin}/api/authentication/issue`,
      {
        headers: {
          ...appHeaders,
          'x-ot-session-mode': 'cookie',
        },
        data: { profileId: expectedProfileId },
      }
    );
    expect(issueResponse.status()).toBe(201);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const switchedSession = await page.request.get(
      `${origin}/api/authentication/session`,
      { headers: appHeaders }
    );
    expect(switchedSession.status()).toBe(200);
    session = (await switchedSession.json()).data as SessionUser;
  }
  expect(session.profileId).toBe(expectedProfileId);
  return session;
}

async function readMessages(page: Page, conversationId: string) {
  return page.request.get(`${origin}/api/chat/messages/${conversationId}`, {
    headers: appHeaders,
  });
}

function historyDigest(messages: Array<Record<string, unknown>>): string {
  const stable = messages
    .map((message) => ({
      id: message['id'],
      conversationId: message['conversationId'],
      senderId: message['senderId'],
      content: message['content'],
      recipients: message['recipients'],
      type: message['type'],
      createdAt: message['createdAt'],
    }))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

function assignmentDigest(assignments: Array<Record<string, unknown>>): string {
  return createHash('sha256')
    .update(
      JSON.stringify(
        assignments
          .map((assignment) => ({
            assignmentId: assignment['assignmentId'],
            roleId: assignment['roleId'],
            appScopeId: assignment['appScopeId'],
            targetId: assignment['targetId'],
          }))
          .sort((left, right) =>
            `${left.appScopeId}:${left.roleId}:${left.targetId}:${left.assignmentId}`.localeCompare(
              `${right.appScopeId}:${right.roleId}:${right.targetId}:${right.assignmentId}`
            )
          )
      )
    )
    .digest('hex');
}

async function exactScopeAssignmentsForProfile(
  profileId: string,
  workspaceScopeId: string,
  workspaceScopeName: string
): Promise<Array<Record<string, any>>> {
  const client = workspaceClient(3012);
  await client.connect();
  try {
    const assignments = await firstValueFrom(
      client.send(
        { cmd: roleGetUserRolesCommand },
        { profileId, appScope: workspaceScopeName }
      )
    );
    return (assignments as Array<Record<string, any>>)
      .filter((assignment) => assignment.appScope?.id === workspaceScopeId)
      .map((assignment) => ({
        assignmentId: assignment.id,
        profileId: assignment.profileId,
        appScopeId: assignment.appScope?.id,
        targetId: assignment.targetId,
        roleId: assignment.role?.id,
        roleName: assignment.role?.name,
      }))
      .sort((left, right) =>
        `${left.profileId}:${left.roleName}:${left.targetId}`.localeCompare(
          `${right.profileId}:${right.roleName}:${right.targetId}`
        )
      );
  } finally {
    client.close();
  }
}

async function appAssignmentsForProfile(
  profileId: string,
  appScope: string
): Promise<Array<Record<string, unknown>>> {
  const client = workspaceClient(3012);
  await client.connect();
  try {
    const assignments = await firstValueFrom(
      client.send({ cmd: roleGetUserRolesCommand }, { profileId, appScope })
    );
    return (assignments as Array<Record<string, any>>)
      .map((assignment) => ({
        assignmentId: assignment.id,
        roleId: assignment.role?.id,
        appScopeId: assignment.appScope?.id,
        targetId: assignment.targetId,
      }))
      .sort((left, right) =>
        `${left.appScopeId}:${left.roleId}:${left.targetId}:${left.assignmentId}`.localeCompare(
          `${right.appScopeId}:${right.roleId}:${right.targetId}:${right.assignmentId}`
        )
      );
  } finally {
    client.close();
  }
}

async function collectorRequest<T>(
  command: string,
  payload: unknown
): Promise<T> {
  const client = workspaceClient(3007);
  await client.connect();
  try {
    return await firstValueFrom(client.send({ cmd: command }, payload));
  } finally {
    client.close();
  }
}

function socketMessageFromFrame(frame: unknown): ChatPayload | undefined {
  if (typeof frame !== 'string' && !Buffer.isBuffer(frame)) return undefined;
  const serialized = typeof frame === 'string' ? frame : frame.toString();
  const start = serialized.indexOf('["message",');
  if (start < 0) return undefined;
  try {
    const packet = JSON.parse(serialized.slice(start)) as [string, ChatPayload];
    return packet[0] === 'message' ? packet[1] : undefined;
  } catch {
    return undefined;
  }
}

function socketAckIdForMessageFrame(frame: unknown): string | undefined {
  if (typeof frame !== 'string' && !Buffer.isBuffer(frame)) return undefined;
  const serialized = typeof frame === 'string' ? frame : frame.toString();
  const start = serialized.indexOf('["message",');
  if (start < 0) return undefined;
  return serialized.slice(0, start).match(/(\d+)$/)?.[1];
}

function isClientChatSocket(url: string): boolean {
  const socketUrl = new URL(url);
  return (
    socketUrl.host === new URL(origin).host &&
    socketUrl.pathname.startsWith('/socket.io')
  );
}

function socketAckForMessageFrame(
  frame: unknown,
  content: string
): { messageId: string; acknowledgement: string } | undefined {
  if (typeof frame !== 'string' && !Buffer.isBuffer(frame)) return undefined;
  const serialized = typeof frame === 'string' ? frame : frame.toString();
  const packetStart = serialized.indexOf('["message",');
  if (packetStart < 0) return undefined;
  const prefix = serialized.slice(0, packetStart);
  const packetId = prefix.match(/(\d+)$/)?.[1];
  if (!packetId) return undefined;
  try {
    const [eventName, payload] = JSON.parse(serialized.slice(packetStart)) as [
      string,
      ChatPayload
    ];
    if (eventName !== 'message' || payload.content !== content) {
      return undefined;
    }
    return {
      messageId: payload.id,
      acknowledgement: `43/chat,${packetId}${JSON.stringify([
        {
          success: false,
          statusCode: 503,
          message: 'Controlled RR10 I04 test rejection',
        },
      ])}`,
    };
  } catch {
    return undefined;
  }
}

test.use({
  screenshot: 'only-on-failure',
  trace: 'on',
  video: 'retain-on-failure',
});

test.describe('RR10 I04 community chat recovery', () => {
  test.describe.configure({ retries: 0 });

  test('acknowledges durable idempotent sends, recovers missed history, preserves rejected drafts, and cleans the exact fixture', async ({
    browser,
  }, testInfo) => {
    test.skip(
      !enabled,
      'Requires the explicitly approved existing local fixture'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'The controlled live chat flow is recorded once in desktop Chrome'
    );
    test.setTimeout(240_000);
    expect(new URL(origin).port).toBe('8080');

    const fixture = JSON.parse(
      readFileSync(fixturePath, 'utf8')
    ) as FixtureManifest;
    const workspaceRecovery = JSON.parse(
      readFileSync(
        resolve(evidenceDirectory, 'workspace-recovery.json'),
        'utf8'
      )
    ) as { workspaceScopeId: string; workspaceScopeName: string };
    const workspaceScopeId = workspaceRecovery.workspaceScopeId;
    const workspaceScopeName = workspaceRecovery.workspaceScopeName;
    const oldConversationId = fixture.originalConversationTombstone.id;
    const activeConversationId = fixture.conversation.id;
    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const evidencePath = resolve(
      evidenceDirectory,
      `i04-chat-recovery-${runId}.json`
    );
    mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
    chmodSync(evidenceDirectory, 0o700);

    const evidence: Record<string, unknown> = {
      runId,
      startedAt: new Date().toISOString(),
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim(),
      buildCommand: process.env['RR10_I04_BUILD_COMMAND'] ?? null,
      buildCompletedAt: process.env['RR10_I04_BUILD_COMPLETED_AT'] ?? null,
      nxCloudRunId: process.env['RR10_I04_NX_RUN_ID'] ?? null,
      project: testInfo.project.name,
      fixture: {
        communityId: fixture.community.id,
        originalConversationId: oldConversationId,
        conversationId: activeConversationId,
        ownerProfileId: fixture.owner.profileId,
        memberProfileId: fixture.approvedMember.profileId,
        appScope: fixture.appScope,
      },
      checks: [],
    };
    const checks = evidence['checks'] as Array<Record<string, unknown>>;
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    let rejectedDraftContent: string | undefined;
    let controlledRejectedDraftId: string | undefined;
    let controlledRejectRouteError: string | undefined;
    await memberContext.routeWebSocket(
      (url) => isClientChatSocket(url.toString()),
      (webSocket) => {
        const upstream = webSocket.connectToServer();
        webSocket.onMessage((frame) => {
          if (rejectedDraftContent) {
            const controlledAck = socketAckForMessageFrame(
              frame,
              rejectedDraftContent
            );
            if (controlledAck) {
              controlledRejectedDraftId = controlledAck.messageId;
              webSocket.send(controlledAck.acknowledgement);
              rejectedDraftContent = undefined;
              return;
            }
            if (
              socketMessageFromFrame(frame)?.content === rejectedDraftContent
            ) {
              controlledRejectRouteError =
                'Unable to parse the Socket.IO message acknowledgement id';
              return;
            }
          }
          upstream.send(frame);
        });
        upstream.onMessage((frame) => webSocket.send(frame));
      }
    );
    const memberPage = await memberContext.newPage();
    const sockets: Socket[] = [];
    const ownerWebSockets: Array<{ url: string; closed: boolean }> = [];
    const observedSocketMessages: ChatPayload[] = [];
    let ownerUser: SessionUser | undefined;
    let memberUser: SessionUser | undefined;
    let removedMember = false;
    let membershipRestoreError: string | null = null;
    let softDeleted = false;
    let communityDeleted = false;
    let ownerOffline = false;
    let finalHistory: Array<Record<string, unknown>> = [];
    let ownerAppAssignmentsBefore: Array<Record<string, unknown>> = [];
    let memberAppAssignmentsBefore: Array<Record<string, unknown>> = [];
    let ownerScopeAssignmentsBefore: Array<Record<string, any>> = [];
    let memberScopeAssignmentsBefore: Array<Record<string, any>> = [];
    let flowFailed = false;
    let flowError: string | null = null;

    ownerPage.on('websocket', (webSocket) => {
      if (!isClientChatSocket(webSocket.url())) return;
      const entry = { url: webSocket.url(), closed: false };
      ownerWebSockets.push(entry);
      webSocket.on('close', (closedSocket) => {
        entry.closed = closedSocket.isClosed();
      });
      webSocket.on('framesent', ({ payload }) => {
        const message = socketMessageFromFrame(payload);
        if (message?.id) observedSocketMessages.push(message);
      });
    });
    memberPage.on('websocket', (webSocket) => {
      if (!isClientChatSocket(webSocket.url())) return;
      webSocket.on('framesent', ({ payload }) => {
        const message = socketMessageFromFrame(payload);
        if (message?.id) observedSocketMessages.push(message);
      });
    });

    const exactScopeAssignments = async (profileId: string) => {
      const client = workspaceClient(3012);
      await client.connect();
      try {
        const assignments = await firstValueFrom(
          client.send(
            { cmd: roleGetUserRolesCommand },
            { profileId, appScope: workspaceScopeName }
          )
        );
        return (assignments as Array<Record<string, any>>)
          .filter((assignment) => assignment.appScope?.id === workspaceScopeId)
          .map((assignment) => ({
            assignmentId: assignment.id,
            profileId: assignment.profileId,
            appScopeId: assignment.appScope?.id,
            targetId: assignment.targetId,
            roleId: assignment.role?.id,
            roleName: assignment.role?.name,
          }))
          .sort((left, right) =>
            `${left.profileId}:${left.roleName}:${left.targetId}`.localeCompare(
              `${right.profileId}:${right.roleName}:${right.targetId}`
            )
          );
      } finally {
        client.close();
      }
    };

    const appAssignments = async (profileId: string) => {
      const client = workspaceClient(3012);
      await client.connect();
      try {
        const assignments = await firstValueFrom(
          client.send(
            { cmd: roleGetUserRolesCommand },
            { profileId, appScope: fixture.appScope }
          )
        );
        return (assignments as Array<Record<string, any>>)
          .map((assignment) => ({
            assignmentId: assignment.id,
            roleId: assignment.role?.id,
            appScopeId: assignment.appScope?.id,
            targetId: assignment.targetId,
          }))
          .sort((left, right) =>
            `${left.appScopeId}:${left.roleId}:${left.targetId}:${left.assignmentId}`.localeCompare(
              `${right.appScopeId}:${right.roleId}:${right.targetId}:${right.assignmentId}`
            )
          );
      } finally {
        client.close();
      }
    };

    const collectorRequest = async <T>(
      command: string,
      payload: unknown
    ): Promise<T> => {
      const client = workspaceClient(3007);
      await client.connect();
      try {
        return await firstValueFrom(client.send({ cmd: command }, payload));
      } finally {
        client.close();
      }
    };

    const ownerApi = (
      method: 'get' | 'post' | 'delete',
      path: string,
      data?: unknown
    ) =>
      ownerPage.request[method](`${origin}${path}`, {
        headers: appHeaders,
        ...(data === undefined ? {} : { data }),
      });

    const memberApi = (
      method: 'get' | 'post' | 'delete',
      path: string,
      data?: unknown
    ) =>
      memberPage.request[method](`${origin}${path}`, {
        headers: appHeaders,
        ...(data === undefined ? {} : { data }),
      });

    try {
      ownerUser = await login(
        ownerPage,
        ownerCredentialsPath,
        resolve(evidenceDirectory, 'owner-cookies.txt'),
        fixture.owner.profileId
      );
      memberUser = await login(
        memberPage,
        memberCredentialsPath,
        resolve(evidenceDirectory, 'member-cookies.txt'),
        fixture.approvedMember.profileId
      );
      expect(ownerUser.profileId).toBe(fixture.owner.profileId);
      expect(memberUser.profileId).toBe(fixture.approvedMember.profileId);
      const currentMembersResponse = await ownerApi(
        'get',
        `/api/social/community/${fixture.community.id}/members`
      );
      expect(currentMembersResponse.status()).toBe(200);
      const currentMembers = (await currentMembersResponse.json()) as Array<{
        id: string;
        profileId: string;
        status: string;
      }>;
      let currentMember = currentMembers.find(
        (member) => member.profileId === memberUser.profileId
      );
      if (!currentMember || currentMember.status !== 'approved') {
        const join = await memberApi(
          'post',
          `/api/social/community/${fixture.community.id}/join`
        );
        expect(join.status()).toBe(201);
        const joined = (await join.json()) as {
          id: string;
          status: string;
        };
        expect(joined.status).toBe('pending');
        const approval = await ownerApi(
          'post',
          `/api/social/community/members/${joined.id}/approve`
        );
        expect([200, 201]).toContain(approval.status());
        expect((await approval.json()).status).toBe('approved');
        currentMember = {
          id: joined.id,
          profileId: memberUser.profileId,
          status: 'approved',
        };
        fixture.approvedMember.membershipId = joined.id;
        writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, {
          mode: 0o600,
        });
        chmodSync(fixturePath, 0o600);
        checks.push({
          name: 'restored the exact existing fixture member after the prior preserved run',
          membershipStatus: currentMember.status,
          newMembershipId: currentMember.id,
        });
      } else {
        fixture.approvedMember.membershipId = currentMember.id;
      }
      expect(currentMember.status).toBe('approved');
      evidence['authenticatedIdentity'] = {
        ownerCredentialsFile: basename(ownerCredentialsPath),
        memberCredentialsFile: basename(memberCredentialsPath),
        ownerProfileIdSha256: createHash('sha256')
          .update(ownerUser.profileId)
          .digest('hex'),
        memberProfileIdSha256: createHash('sha256')
          .update(memberUser.profileId)
          .digest('hex'),
        bothSessionsValidatedBeforeFlow: true,
      };
      expect(evidence['buildCommand']).toBeTruthy();
      expect(evidence['buildCompletedAt']).toBeTruthy();
      expect(evidence['nxCloudRunId']).toBeTruthy();
      const servedMain = await ownerPage.request.get(`${origin}/main.js`);
      const servedMainHash = createHash('sha256')
        .update(await servedMain.body())
        .digest('hex');
      const builtMainHash = createHash('sha256')
        .update(
          readFileSync(
            resolve(workspaceRoot, 'dist/apps/client-interface/browser/main.js')
          )
        )
        .digest('hex');
      const sourceSha256 = Object.fromEntries(
        [
          ...behaviorSourceFiles,
          'apps/client-interface-e2e/src/rr10-i04-chat-recovery.spec.ts',
        ].map((path) => [
          path,
          createHash('sha256')
            .update(readFileSync(resolve(workspaceRoot, path)))
            .digest('hex'),
        ])
      );
      expect(servedMain.status()).toBe(200);
      expect(servedMainHash).toBe(builtMainHash);
      evidence['sourceSha256'] = sourceSha256;
      evidence['servedMainSha256'] = servedMainHash;
      evidence['distMainSha256'] = builtMainHash;
      checks.push({
        name: 'frozen source and served client bundle provenance',
        sourceFileCount: Object.keys(sourceSha256).length,
        servedMainSha256: servedMainHash,
        distMainSha256: builtMainHash,
      });

      const ownerAssignmentsBefore = await exactScopeAssignments(
        ownerUser.profileId
      );
      const memberAssignmentsBefore = await exactScopeAssignments(
        memberUser.profileId
      );
      ownerScopeAssignmentsBefore = ownerAssignmentsBefore;
      memberScopeAssignmentsBefore = memberAssignmentsBefore;
      ownerAppAssignmentsBefore = await appAssignments(ownerUser.profileId);
      memberAppAssignmentsBefore = await appAssignments(memberUser.profileId);
      checks.push({
        name: 'baseline exact-scope role assignments',
        ownerAssignmentCount: ownerAssignmentsBefore.length,
        memberAssignmentCount: memberAssignmentsBefore.length,
        ownerAppAssignmentDigest: assignmentDigest(ownerAppAssignmentsBefore),
        memberAppAssignmentDigest: assignmentDigest(memberAppAssignmentsBefore),
      });

      const manifestCommunity = JSON.parse(
        readFileSync(
          resolve(evidenceDirectory, 'community-manifest.json'),
          'utf8'
        )
      ) as { slug: string; name: string };
      const oldMessages = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId: oldConversationId });
      expect(oldMessages).toHaveLength(0);
      const linkedRoom = await ownerApi(
        'get',
        `/api/social/community/${fixture.community.id}/chat-room`
      );
      expect(linkedRoom.status()).toBe(200);
      const initialLinkedRoom = (await linkedRoom.json()) as { id: string };
      expect(initialLinkedRoom.id).toBe(activeConversationId);
      expect(activeConversationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(activeConversationId).not.toBe(oldConversationId);
      const replacement = await collectorRequest<Record<string, unknown>>(
        'GET_CONVERSATION',
        { conversationId: activeConversationId }
      );
      expect(replacement).toMatchObject({
        id: activeConversationId,
        type: 'community',
        communityId: fixture.community.id,
        ownerId: ownerUser.profileId,
        isDeleted: false,
      });
      const oldHistoryAfterRepair = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId: oldConversationId });
      expect(oldHistoryAfterRepair).toHaveLength(0);
      expect(historyDigest(oldHistoryAfterRepair)).toBe(
        fixture.originalConversationTombstone.messageDigest
      );
      const currentRoom = await ownerApi(
        'get',
        `/api/social/community/${fixture.community.id}/chat-room`
      );
      expect(currentRoom.status()).toBe(200);
      expect((await currentRoom.json()).id).toBe(activeConversationId);
      evidence['fixture'] = {
        ...(evidence['fixture'] as Record<string, unknown>),
        originalConversationId: oldConversationId,
        conversationId: activeConversationId,
        originalConversationRetainedCount: oldHistoryAfterRepair.length,
        originalConversationRetainedDigest: historyDigest(
          oldHistoryAfterRepair
        ),
      };
      checks.push({
        name: 'owner repaired the exact stale chat-room link using the existing scoped API',
        originalConversationRetainedCount: oldHistoryAfterRepair.length,
        originalConversationRetainedDigest: historyDigest(
          oldHistoryAfterRepair
        ),
        replacementType: replacement['type'],
        replacementOwnerMatches: replacement['ownerId'] === ownerUser.profileId,
        replacementCommunityMatches:
          replacement['communityId'] === fixture.community.id,
        linkedRoomMatchesReplacement:
          (await currentRoom.json()).id === activeConversationId,
      });
      const route = `/communities/${encodeURIComponent(
        manifestCommunity.slug
      )}/chat`;
      await Promise.all([
        ownerPage.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' }),
        memberPage.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([
        expect(ownerPage.locator('textarea.compose-textarea')).toBeVisible({
          timeout: 30_000,
        }),
        expect(memberPage.locator('textarea.compose-textarea')).toBeVisible({
          timeout: 30_000,
        }),
      ]);
      await expect(
        ownerPage.locator('textarea.compose-textarea')
      ).toBeEnabled();
      await expect(
        memberPage.locator('textarea.compose-textarea')
      ).toBeEnabled();

      const initialRead = await readMessages(ownerPage, activeConversationId);
      expect(initialRead.status()).toBe(200);
      const idempotentMessagesAtStart = (await initialRead.json()) as Array<
        Record<string, any>
      >;
      expect(idempotentMessagesAtStart).toHaveLength(
        fixture.resumeExistingMessages.length
      );
      for (const baselineMessage of fixture.resumeExistingMessages) {
        expect(
          idempotentMessagesAtStart.filter(
            (message) =>
              message.id === baselineMessage.id &&
              message.senderId === baselineMessage.senderId &&
              message.content === baselineMessage.content
          )
        ).toHaveLength(1);
      }
      const baselineHistoryDigest = historyDigest(idempotentMessagesAtStart);
      checks.push({
        name: 'resume the preserved synthetic send as a one-row idempotency baseline',
        baselineCount: idempotentMessagesAtStart.length,
        baselineMessageIds: fixture.resumeExistingMessages.map(
          (message) => message.id
        ),
        baselineDigest: baselineHistoryDigest,
      });

      const memberSocket = await connectSocket(
        memberContext,
        memberUser.profileId
      );
      const ownerSocket = await connectSocket(
        ownerContext,
        ownerUser.profileId
      );
      sockets.push(memberSocket, ownerSocket);
      let idempotentMessages = idempotentMessagesAtStart;
      if (process.env['RR10_I04_REUSE_CORE_EVIDENCE'] === 'true') {
        const priorProofs = [
          {
            file: 'i04-chat-recovery-2026-10-12T19-01-54-909Z.json',
            expectedChecks: [
              'sequential same-ID deduplication and mismatched-content conflict',
              'concurrent same-ID delivery',
              'durable and visible deduplication',
            ],
          },
          {
            file: 'i04-chat-recovery-2026-10-12T19-12-21-658Z.json',
            expectedChecks: [
              'missed-message history after real socket disconnect and reconnect',
            ],
          },
        ];
        const currentSourceHashes = evidence['sourceSha256'] as Record<
          string,
          string
        >;
        const verifiedPriorProofs = priorProofs.map((proof) => {
          const path = resolve(evidenceDirectory, proof.file);
          const bytes = readFileSync(path);
          const artifact = JSON.parse(bytes.toString()) as {
            sourceSha256: Record<string, string>;
            checks: Array<Record<string, any>>;
          };
          for (const sourcePath of behaviorSourceFiles) {
            expect(artifact.sourceSha256[sourcePath]).toBe(
              currentSourceHashes[sourcePath]
            );
          }
          for (const checkName of proof.expectedChecks) {
            expect(
              artifact.checks.some((check) => check.name === checkName)
            ).toBe(true);
          }
          if (proof.file.includes('19-01-')) {
            const baseline = artifact.checks.find(
              (check) =>
                check.name ===
                'resume the preserved synthetic send as a one-row idempotency baseline'
            );
            expect(baseline?.baselineCount).toBe(1);
          }
          return {
            file: proof.file,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            verifiedProductionSourceCount: behaviorSourceFiles.length,
            checks: proof.expectedChecks,
          };
        });
        evidence['reusedPriorRuntimeEvidence'] = verifiedPriorProofs;
        checks.push({
          name: 'reused independently captured idempotency and reconnect evidence for unchanged production source',
          proofFiles: verifiedPriorProofs.map((proof) => ({
            file: proof.file,
            sha256: proof.sha256,
          })),
        });
      } else {
        const sequentialBaseline = fixture.resumeExistingMessages[0];
        expect(sequentialBaseline).toBeTruthy();
        const sequentialId = sequentialBaseline.id;
        const sequentialContent = sequentialBaseline.content;
        expect(sequentialBaseline.senderId).toBe(ownerUser.profileId);
        expect(
          idempotentMessagesAtStart.filter(
            (message) => message.id === sequentialId
          )
        ).toHaveLength(1);
        const sequentialPayload: ChatPayload = {
          id: sequentialId,
          conversationId: activeConversationId,
          senderId: ownerUser.profileId,
          content: sequentialContent,
          recipientId: [memberUser.profileId],
          type: 'chat',
        };
        const firstSequentialAck = await sendWithAck(
          ownerSocket,
          sequentialPayload
        );
        expect(firstSequentialAck).toMatchObject({
          success: true,
          messageId: sequentialId,
        });
        const retrySequentialAck = await sendWithAck(
          ownerSocket,
          sequentialPayload
        );
        expect(retrySequentialAck).toMatchObject({
          success: true,
          messageId: sequentialId,
        });
        const repeatedHistoryResponse = await readMessages(
          ownerPage,
          activeConversationId
        );
        expect(repeatedHistoryResponse.status()).toBe(200);
        const repeatedHistory = (await repeatedHistoryResponse.json()) as Array<
          Record<string, any>
        >;
        expect(
          repeatedHistory.filter((message) => message.id === sequentialId)
        ).toHaveLength(1);
        expect(historyDigest(repeatedHistory)).toBe(baselineHistoryDigest);
        const duplicateConflict = await sendWithAck(ownerSocket, {
          ...sequentialPayload,
          content: `${sequentialContent} changed`,
        });
        expect(duplicateConflict).toMatchObject({
          success: false,
          statusCode: 409,
        });
        checks.push({
          name: 'sequential same-ID deduplication and mismatched-content conflict',
          firstAck: firstSequentialAck,
          retryAck: retrySequentialAck,
          conflictStatus: duplicateConflict.statusCode,
        });

        const concurrentBaseline = fixture.resumeExistingMessages[1];
        expect(concurrentBaseline).toBeTruthy();
        const concurrentId = concurrentBaseline.id;
        const concurrentContent = concurrentBaseline.content;
        expect(concurrentBaseline.senderId).toBe(ownerUser.profileId);
        const concurrentPayload: ChatPayload = {
          id: concurrentId,
          conversationId: activeConversationId,
          senderId: ownerUser.profileId,
          content: concurrentContent,
          recipientId: [memberUser.profileId],
          type: 'chat',
        };
        const concurrentAcks = await Promise.all([
          sendWithAck(ownerSocket, concurrentPayload),
          sendWithAck(ownerSocket, concurrentPayload),
        ]);
        expect(concurrentAcks).toEqual([
          expect.objectContaining({ success: true, messageId: concurrentId }),
          expect.objectContaining({ success: true, messageId: concurrentId }),
        ]);
        checks.push({
          name: 'concurrent same-ID delivery',
          acknowledgements: concurrentAcks,
        });

        const idempotentHistory = await readMessages(
          ownerPage,
          activeConversationId
        );
        expect(idempotentHistory.status()).toBe(200);
        idempotentMessages = (await idempotentHistory.json()) as Array<
          Record<string, any>
        >;
        expect(
          idempotentMessages.filter((message) => message.id === sequentialId)
        ).toHaveLength(1);
        expect(
          idempotentMessages.filter((message) => message.id === concurrentId)
        ).toHaveLength(1);
        await expect(
          ownerPage
            .locator('.message-text')
            .filter({ hasText: sequentialContent })
        ).toHaveCount(1, { timeout: 20_000 });
        await expect(
          ownerPage
            .locator('.message-text')
            .filter({ hasText: concurrentContent })
        ).toHaveCount(1, { timeout: 20_000 });
        checks.push({
          name: 'durable and visible deduplication',
          durableSequentialCount: idempotentMessages.filter(
            (message) => message.id === sequentialId
          ).length,
          durableConcurrentCount: idempotentMessages.filter(
            (message) => message.id === concurrentId
          ).length,
          visibleSequentialCount: await ownerPage
            .locator('.message-text')
            .filter({ hasText: sequentialContent })
            .count(),
          visibleConcurrentCount: await ownerPage
            .locator('.message-text')
            .filter({ hasText: concurrentContent })
            .count(),
        });

        await expect
          .poll(() => ownerWebSockets.length, { timeout: 20_000 })
          .toBeGreaterThan(0);
        const initialSocketCount = ownerWebSockets.length;
        expect(initialSocketCount).toBeGreaterThan(0);
        await ownerContext.setOffline(true);
        ownerOffline = true;
        await expect(
          ownerPage.getByRole('status').filter({ hasText: 'Reconnecting' })
        ).toBeVisible({ timeout: 15_000 });
        await expect
          .poll(() => ownerWebSockets.at(-1)!.closed, { timeout: 20_000 })
          .toBe(true);

        const missedId = randomUUID();
        const missedContent = `RR10 I04 missed during reconnect ${randomUUID()}`;
        const missedAck = await sendWithAck(memberSocket, {
          id: missedId,
          conversationId: activeConversationId,
          senderId: memberUser.profileId,
          content: missedContent,
          recipientId: [ownerUser.profileId],
          type: 'chat',
        });
        expect(missedAck).toMatchObject({ success: true, messageId: missedId });
        await ownerContext.setOffline(false);
        ownerOffline = false;
        await expect
          .poll(() => ownerWebSockets.length, { timeout: 20_000 })
          .toBeGreaterThan(initialSocketCount);
        await expect(
          ownerPage.getByRole('status').filter({ hasText: 'Reconnecting' })
        ).toBeHidden({ timeout: 20_000 });
        const ownerSessionAfterReconnect = await ownerPage.request.get(
          `${origin}/api/authentication/session`,
          { headers: appHeaders }
        );
        expect(ownerSessionAfterReconnect.status()).toBe(200);
        expect((await ownerSessionAfterReconnect.json()).data.profileId).toBe(
          ownerUser.profileId
        );
        await expect(
          ownerPage.locator('.message-text').filter({ hasText: missedContent })
        ).toHaveCount(1, { timeout: 25_000 });
        checks.push({
          name: 'missed-message history after real socket disconnect and reconnect',
          closeObserved: true,
          reconnectObserved: ownerWebSockets.length > initialSocketCount,
          missedMessageId: missedId,
          acknowledgement: missedAck,
        });
      }

      const draftContent = `RR10 I04 rejected draft ${randomUUID()}`;
      await memberPage.locator('textarea.compose-textarea').fill(draftContent);
      rejectedDraftContent = draftContent;
      await memberPage.locator('otui-button.send-button button').click();
      await expect(
        memberPage
          .getByRole('alert')
          .filter({ hasText: 'Message could not be sent' })
      ).toBeVisible({ timeout: 20_000 });
      await expect(memberPage.locator('textarea.compose-textarea')).toHaveValue(
        draftContent
      );
      expect(controlledRejectRouteError).toBeUndefined();
      const failedDraftId = controlledRejectedDraftId;
      expect(failedDraftId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      checks.push({
        name: 'controlled browser acknowledgement failure keeps the typed draft visible',
        statusCode: 503,
        sendMessageId: failedDraftId,
        draftRetained: await memberPage
          .locator('textarea.compose-textarea')
          .inputValue(),
      });

      const joinedMemberId = fixture.approvedMember.membershipId;
      const memberAssignmentsAfterRestore = await exactScopeAssignments(
        memberUser.profileId
      );
      expect(
        memberAssignmentsAfterRestore.map(({ roleName, targetId }) => ({
          roleName,
          targetId,
        }))
      ).toEqual(
        memberAssignmentsBefore.map(({ roleName, targetId }) => ({
          roleName,
          targetId,
        }))
      );

      await expect(memberPage.locator('textarea.compose-textarea')).toBeVisible(
        { timeout: 20_000 }
      );
      await expect(memberPage.locator('textarea.compose-textarea')).toHaveValue(
        draftContent
      );
      const beforeRetry = idempotentMessages.length + 1;
      await memberPage.locator('otui-button.send-button button').click();
      await expect(memberPage.locator('textarea.compose-textarea')).toHaveValue(
        '',
        { timeout: 20_000 }
      );
      await expect(
        memberPage.locator('.message-text').filter({ hasText: draftContent })
      ).toHaveCount(1, { timeout: 20_000 });
      const restoredHistoryResponse = await readMessages(
        ownerPage,
        activeConversationId
      );
      expect(restoredHistoryResponse.status()).toBe(200);
      const restoredHistory = (await restoredHistoryResponse.json()) as Array<
        Record<string, any>
      >;
      expect(
        restoredHistory.filter((message) => message.content === draftContent)
      ).toHaveLength(1);
      const retryMessage = restoredHistory.find(
        (message) => message.content === draftContent
      )!;
      expect(retryMessage.id).toBe(failedDraftId);
      checks.push({
        name: 'one deliberate retry after the controlled acknowledgement rejection persists and renders once',
        restoredMembershipStatus: currentMember.status,
        retainedDraftId: failedDraftId,
        durableRetryCount: restoredHistory.filter(
          (message) => message.content === draftContent
        ).length,
        visibleRetryCount: await memberPage
          .locator('.message-text')
          .filter({ hasText: draftContent })
          .count(),
        existingMessageCountBeforeRetry: beforeRetry,
        messageId: retryMessage.id,
      });

      const removed = await ownerApi(
        'delete',
        `/api/social/community/members/${joinedMemberId}`,
        {
          profileId: memberUser.profileId,
          communityId: fixture.community.id,
        }
      );
      expect(removed.status()).toBe(200);
      removedMember = true;
      const rejectedStatus = await memberApi(
        'get',
        `/api/chat/messages/${activeConversationId}`
      );
      expect([403, 404]).toContain(rejectedStatus.status());
      const deniedSocketSend = await sendWithAck(memberSocket, {
        id: randomUUID(),
        conversationId: activeConversationId,
        senderId: memberUser.profileId,
        content: `RR10 I04 revoked member denial ${randomUUID()}`,
        recipientId: [ownerUser.profileId],
        type: 'chat',
      });
      expect(deniedSocketSend.success).toBe(false);
      expect([401, 403]).toContain(deniedSocketSend.statusCode);
      checks.push({
        name: 'real server denied revoked member history and socket send',
        historyStatus: rejectedStatus.status(),
        socketStatus: deniedSocketSend.statusCode,
      });

      const leave = await memberApi(
        'post',
        `/api/social/community/${fixture.community.id}/leave`
      );
      expect([200, 201, 204]).toContain(leave.status());

      const joined = await memberApi(
        'post',
        `/api/social/community/${fixture.community.id}/join`
      );
      expect(joined.status()).toBe(201);
      const restoredMember = (await joined.json()) as {
        id: string;
        status: string;
      };
      expect(restoredMember.status).toBe('pending');
      const approved = await ownerApi(
        'post',
        `/api/social/community/members/${restoredMember.id}/approve`
      );
      expect([200, 201]).toContain(approved.status());
      expect((await approved.json()).status).toBe('approved');
      removedMember = false;
      const memberReadback = await ownerApi(
        'get',
        `/api/social/community/${fixture.community.id}/members`
      );
      expect(memberReadback.status()).toBe(200);
      const approvedReadback = (
        (await memberReadback.json()) as Array<{
          profileId: string;
          status: string;
        }>
      ).find((member) => member.profileId === memberUser.profileId);
      expect(approvedReadback?.status).toBe('approved');
      fixture.approvedMember.membershipId = restoredMember.id;
      writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, {
        mode: 0o600,
      });
      chmodSync(fixturePath, 0o600);

      const nonownerCleanup = await collectorRequest<Ack>(
        'DELETE_OWNED_COMMUNITY_CONVERSATION',
        {
          conversationId: activeConversationId,
          communityId: fixture.community.id,
          actorProfileId: memberUser.profileId,
          appScope: fixture.appScope,
        }
      ).then(
        (result) => ({ success: true, result }),
        (error: unknown) => ({ success: false, error: String(error) })
      );
      expect(nonownerCleanup.success).toBe(false);
      checks.push({ name: 'nonowner internal cleanup denial', denied: true });

      const preDeleteResponse = await readMessages(
        ownerPage,
        activeConversationId
      );
      expect(preDeleteResponse.status()).toBe(200);
      finalHistory = (await preDeleteResponse.json()) as Array<
        Record<string, unknown>
      >;
      const retainedBeforeDelete = {
        count: finalHistory.length,
        digest: historyDigest(finalHistory),
      };
      const ownerSession = await ownerPage.request.get(
        `${origin}/api/authentication/session`,
        { headers: appHeaders }
      );
      expect(ownerSession.status()).toBe(200);
      const ownerIdentity = (await ownerSession.json()).data as SessionUser;
      expect(ownerIdentity.profileId).toBe(fixture.community.ownerProfileId);
      const deletedConversation = await collectorRequest<Ack>(
        'DELETE_OWNED_COMMUNITY_CONVERSATION',
        {
          conversationId: activeConversationId,
          communityId: fixture.community.id,
          actorProfileId: ownerIdentity.profileId,
          appScope: fixture.appScope,
        }
      );
      expect(deletedConversation).toMatchObject({ success: true });
      softDeleted = true;

      const [ownerReadAfterDelete, memberReadAfterDelete] = await Promise.all([
        readMessages(ownerPage, activeConversationId),
        readMessages(memberPage, activeConversationId),
      ]);
      expect([403, 404]).toContain(ownerReadAfterDelete.status());
      expect([403, 404]).toContain(memberReadAfterDelete.status());
      const [ownerConversationAfterDelete, memberConversationAfterDelete] =
        await Promise.all([
          ownerApi('get', `/api/chat/conversations/id/${activeConversationId}`),
          memberApi(
            'get',
            `/api/chat/conversations/id/${activeConversationId}`
          ),
        ]);
      expect([403, 404]).toContain(ownerConversationAfterDelete.status());
      expect([403, 404]).toContain(memberConversationAfterDelete.status());
      const [ownerConversationList, memberConversationList] = await Promise.all(
        [
          ownerApi('get', '/api/chat/conversations/find'),
          memberApi('get', '/api/chat/conversations/find'),
        ]
      );
      expect(ownerConversationList.status()).toBe(200);
      expect(memberConversationList.status()).toBe(200);
      expect(
        (await ownerConversationList.json()).some(
          (item: any) => item.id === activeConversationId
        )
      ).toBe(false);
      expect(
        (await memberConversationList.json()).some(
          (item: any) => item.id === activeConversationId
        )
      ).toBe(false);
      const [ownerSocketAfterDelete, memberSocketAfterDelete] =
        await Promise.all([
          sendWithAck(ownerSocket, {
            id: randomUUID(),
            conversationId: activeConversationId,
            senderId: ownerUser.profileId,
            content: `RR10 I04 deleted socket denial ${randomUUID()}`,
            recipientId: [],
            type: 'chat',
          }),
          sendWithAck(memberSocket, {
            id: randomUUID(),
            conversationId: activeConversationId,
            senderId: memberUser.profileId,
            content: `RR10 I04 deleted socket denial ${randomUUID()}`,
            recipientId: [],
            type: 'chat',
          }),
        ]);
      expect(ownerSocketAfterDelete.success).toBe(false);
      expect(memberSocketAfterDelete.success).toBe(false);
      expect([403, 404]).toContain(ownerSocketAfterDelete.statusCode);
      expect([403, 404]).toContain(memberSocketAfterDelete.statusCode);
      const retainedAfterDelete = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId: activeConversationId });
      expect(retainedAfterDelete).toHaveLength(retainedBeforeDelete.count);
      expect(historyDigest(retainedAfterDelete)).toBe(
        retainedBeforeDelete.digest
      );
      checks.push({
        name: 'soft-delete hides conversation from users while retaining message rows',
        ownerReadStatus: ownerReadAfterDelete.status(),
        memberReadStatus: memberReadAfterDelete.status(),
        ownerConversationStatus: ownerConversationAfterDelete.status(),
        memberConversationStatus: memberConversationAfterDelete.status(),
        ownerSocketStatus: ownerSocketAfterDelete.statusCode,
        memberSocketStatus: memberSocketAfterDelete.statusCode,
        retainedCount: retainedAfterDelete.length,
        retainedDigest: historyDigest(retainedAfterDelete),
      });

      const communityDelete = await ownerApi(
        'delete',
        `/api/social/community/${fixture.community.id}`
      );
      expect([200, 204, 404]).toContain(communityDelete.status());
      communityDeleted = true;
      const deletedCommunityRead = await ownerApi(
        'get',
        `/api/social/community/${fixture.community.id}`
      );
      expect(deletedCommunityRead.status()).toBe(200);
      const deletedCommunityBody = await deletedCommunityRead.text();
      expect(
        deletedCommunityBody === '' || JSON.parse(deletedCommunityBody) === null
      ).toBe(true);
      checks.push({
        name: 'normal owner API deleted the exact private community',
        status: communityDelete.status(),
      });
    } catch (error) {
      flowFailed = true;
      flowError = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      if (ownerOffline) {
        await ownerContext.setOffline(false).catch(() => undefined);
        ownerOffline = false;
      }
      for (const socket of sockets) socket.disconnect();

      const preserveFixtureOnFailure =
        process.env['RR10_I04_PRESERVE_FIXTURE_ON_FAILURE'] === 'true' &&
        flowFailed;
      if (removedMember && ownerUser && memberUser) {
        try {
          const leave = await memberPage.request.post(
            `${origin}/api/social/community/${fixture.community.id}/leave`,
            { headers: appHeaders }
          );
          expect([200, 201, 204]).toContain(leave.status());
          const join = await memberPage.request.post(
            `${origin}/api/social/community/${fixture.community.id}/join`,
            { headers: appHeaders }
          );
          expect(join.status()).toBe(201);
          const joined = await join.json();
          expect(joined.status).toBe('pending');
          const approval = await ownerPage.request.post(
            `${origin}/api/social/community/members/${joined.id}/approve`,
            { headers: appHeaders }
          );
          expect([200, 201]).toContain(approval.status());
          expect((await approval.json()).status).toBe('approved');
          const memberReadback = await ownerPage.request.get(
            `${origin}/api/social/community/${fixture.community.id}/members`,
            { headers: appHeaders }
          );
          expect(memberReadback.status()).toBe(200);
          const restoredMember = (
            (await memberReadback.json()) as Array<{
              profileId: string;
              status: string;
            }>
          ).find((member) => member.profileId === memberUser.profileId);
          expect(restoredMember?.status).toBe('approved');
          removedMember = false;
          checks.push({
            name: 'restored exact member after a failed flow through normal join and owner approval',
            memberId: joined.id,
            membershipStatus: restoredMember.status,
          });
        } catch (error) {
          membershipRestoreError =
            error instanceof Error ? error.message : String(error);
        }
      }

      if (!preserveFixtureOnFailure && !softDeleted && ownerUser) {
        try {
          const client = workspaceClient(3007);
          await client.connect();
          await firstValueFrom(
            client.send(
              { cmd: 'DELETE_OWNED_COMMUNITY_CONVERSATION' },
              {
                conversationId: activeConversationId,
                communityId: fixture.community.id,
                actorProfileId: ownerUser.profileId,
                appScope: fixture.appScope,
              }
            )
          );
          client.close();
          softDeleted = true;
        } catch {
          // Preserve failure evidence; do not run broad cleanup.
        }
      }

      if (
        !preserveFixtureOnFailure &&
        !communityDeleted &&
        softDeleted &&
        ownerUser
      ) {
        try {
          const response = await ownerPage.request.delete(
            `${origin}/api/social/community/${fixture.community.id}`,
            { headers: appHeaders }
          );
          communityDeleted = response.ok();
        } catch {
          // The exact fixture remains identifiable in the private manifest.
        }
      }

      if (
        !preserveFixtureOnFailure &&
        communityDeleted &&
        ownerUser &&
        memberUser
      ) {
        try {
          const client = workspaceClient(3012);
          await client.connect();
          const assignments = [
            ...(await exactScopeAssignments(ownerUser.profileId)),
            ...(await exactScopeAssignments(memberUser.profileId)),
          ].filter(
            (assignment) => assignment.targetId === fixture.community.id
          );
          for (const assignment of assignments) {
            if (!assignment.assignmentId) continue;
            await firstValueFrom(
              client.send(
                { cmd: roleUnassignCommand },
                { assignmentId: assignment.assignmentId }
              )
            );
          }
          client.close();
          const [ownerAfterCleanup, memberAfterCleanup] = await Promise.all([
            exactScopeAssignments(ownerUser.profileId),
            exactScopeAssignments(memberUser.profileId),
          ]);
          const [ownerAppAfterCleanup, memberAppAfterCleanup] =
            await Promise.all([
              appAssignments(ownerUser.profileId),
              appAssignments(memberUser.profileId),
            ]);
          expect(assignmentDigest(ownerAppAfterCleanup)).toBe(
            assignmentDigest(ownerAppAssignmentsBefore)
          );
          expect(assignmentDigest(memberAppAfterCleanup)).toBe(
            assignmentDigest(memberAppAssignmentsBefore)
          );
          expect(assignmentDigest(ownerAfterCleanup)).toBe(
            assignmentDigest(ownerScopeAssignmentsBefore)
          );
          expect(assignmentDigest(memberAfterCleanup)).toBe(
            assignmentDigest(memberScopeAssignmentsBefore)
          );
          checks.push({
            name: 'removed only exact fixture-target workspace assignments and preserved baseline assignments',
            ownerAssignmentsRemaining: ownerAfterCleanup.length,
            memberAssignmentsRemaining: memberAfterCleanup.length,
            ownerAppAssignmentDigestUnchanged:
              assignmentDigest(ownerAppAfterCleanup) ===
              assignmentDigest(ownerAppAssignmentsBefore),
            memberAppAssignmentDigestUnchanged:
              assignmentDigest(memberAppAfterCleanup) ===
              assignmentDigest(memberAppAssignmentsBefore),
          });
        } catch {
          checks.push({
            name: 'exact workspace assignment cleanup',
            success: false,
          });
        }
      }

      try {
        const outcome = {
          ...evidence,
          finishedAt: new Date().toISOString(),
          ownerProfileId: ownerUser?.profileId ?? null,
          memberProfileId: memberUser?.profileId ?? null,
          fixtureConversationSoftDeleted: softDeleted,
          fixtureCommunityDeleted: communityDeleted,
          fixturePreservedForRerun: preserveFixtureOnFailure,
          membershipRestoreError,
          completedChecks: checks,
          error: [
            ...(flowError ? [flowError] : []),
            ...testInfo.errors.map((error) => error.message),
          ].map((error) => error.slice(0, 500)),
          remainingMessageCount: finalHistory.length,
          remainingMessageDigest: finalHistory.length
            ? historyDigest(finalHistory)
            : null,
        };
        writeFileSync(evidencePath, JSON.stringify(outcome, null, 2), {
          mode: 0o600,
        });
        chmodSync(evidencePath, 0o600);
        await Promise.all([
          ownerPage
            .screenshot({
              path: resolve(evidenceDirectory, `i04-owner-${runId}.png`),
              fullPage: true,
            })
            .catch(() => undefined),
          memberPage
            .screenshot({
              path: resolve(evidenceDirectory, `i04-member-${runId}.png`),
              fullPage: true,
            })
            .catch(() => undefined),
        ]);
        for (const path of [
          `i04-owner-${runId}.png`,
          `i04-member-${runId}.png`,
        ]) {
          try {
            chmodSync(resolve(evidenceDirectory, path), 0o600);
          } catch {
            /* no screenshot on failed setup */
          }
        }
      } finally {
        await Promise.all([ownerContext.close(), memberContext.close()]);
      }
    }
  });

  test('verifies deleted conversation denial and finalizes only the exact community fixture', async ({
    browser,
  }, testInfo) => {
    test.skip(
      process.env['RR10_I04_FINALIZE_FIXTURE'] !== 'true',
      'Only run after the approved fixture conversation is already soft-deleted'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'Final fixture cleanup is recorded once in desktop Chrome'
    );
    test.setTimeout(90_000);

    const fixture = JSON.parse(
      readFileSync(fixturePath, 'utf8')
    ) as FixtureManifest;
    const workspaceRecovery = JSON.parse(
      readFileSync(
        resolve(evidenceDirectory, 'workspace-recovery.json'),
        'utf8'
      )
    ) as { workspaceScopeId: string; workspaceScopeName: string };
    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const evidencePath = resolve(
      evidenceDirectory,
      `i04-final-cleanup-${runId}.json`
    );
    const ownerContext = await browser.newContext();
    const memberContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();
    let ownerSocket: Socket | undefined;
    let memberSocket: Socket | undefined;
    let communityDeleted = false;
    const results: Record<string, unknown> = {
      startedAt: new Date().toISOString(),
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim(),
      fixture: {
        communityId: fixture.community.id,
        conversationId: fixture.conversation.id,
        originalConversationId: fixture.originalConversationTombstone.id,
        appScope: fixture.appScope,
      },
    };
    try {
      const ownerUser = await login(
        ownerPage,
        ownerCredentialsPath,
        resolve(evidenceDirectory, 'owner-cookies.txt'),
        fixture.owner.profileId
      );
      const memberUser = await login(
        memberPage,
        memberCredentialsPath,
        resolve(evidenceDirectory, 'member-cookies.txt'),
        fixture.approvedMember.profileId
      );
      expect(ownerUser.profileId).toBe(fixture.community.ownerProfileId);
      expect(memberUser.profileId).toBe(fixture.approvedMember.profileId);
      ownerSocket = await connectSocket(ownerContext, ownerUser.profileId);
      memberSocket = await connectSocket(memberContext, memberUser.profileId);

      const collectorHistory = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId: fixture.conversation.id });
      const retainedCountBefore = collectorHistory.length;
      const retainedDigestBefore = historyDigest(collectorHistory);
      expect(retainedCountBefore).toBe(4);

      const ownerRead = await readMessages(ownerPage, fixture.conversation.id);
      const memberRead = await readMessages(
        memberPage,
        fixture.conversation.id
      );
      expect([403, 404]).toContain(ownerRead.status());
      expect([403, 404]).toContain(memberRead.status());
      const ownerSend = await sendWithAck(ownerSocket, {
        id: randomUUID(),
        conversationId: fixture.conversation.id,
        senderId: ownerUser.profileId,
        content: `RR10 I04 post-delete owner denial ${randomUUID()}`,
        recipientId: [],
        type: 'chat',
      });
      const memberSend = await sendWithAck(memberSocket, {
        id: randomUUID(),
        conversationId: fixture.conversation.id,
        senderId: memberUser.profileId,
        content: `RR10 I04 post-delete member denial ${randomUUID()}`,
        recipientId: [],
        type: 'chat',
      });
      expect(ownerSend.success).toBe(false);
      expect(memberSend.success).toBe(false);
      expect([403, 404]).toContain(ownerSend.statusCode);
      expect([403, 404]).toContain(memberSend.statusCode);
      const retainedAfterDeniedSends = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId: fixture.conversation.id });
      expect(retainedAfterDeniedSends).toHaveLength(retainedCountBefore);
      expect(historyDigest(retainedAfterDeniedSends)).toBe(
        retainedDigestBefore
      );

      const rolesBefore = await Promise.all([
        exactScopeAssignmentsForProfile(
          ownerUser.profileId,
          workspaceRecovery.workspaceScopeId,
          workspaceRecovery.workspaceScopeName
        ),
        exactScopeAssignmentsForProfile(
          memberUser.profileId,
          workspaceRecovery.workspaceScopeId,
          workspaceRecovery.workspaceScopeName
        ),
      ]);
      const appRolesBefore = await Promise.all([
        appAssignmentsForProfile(ownerUser.profileId, fixture.appScope),
        appAssignmentsForProfile(memberUser.profileId, fixture.appScope),
      ]);
      const communityReadBeforeDelete = await ownerPage.request.get(
        `${origin}/api/social/community/${fixture.community.id}`,
        { headers: appHeaders }
      );
      expect([200, 404]).toContain(communityReadBeforeDelete.status());
      const communityBeforeBody = await communityReadBeforeDelete.text();
      const communityAlreadyAbsent =
        communityReadBeforeDelete.status() === 404 ||
        communityBeforeBody === '' ||
        JSON.parse(communityBeforeBody) === null;
      let communityDeleteStatus: number | null = null;
      if (!communityAlreadyAbsent) {
        const communityDelete = await ownerPage.request.delete(
          `${origin}/api/social/community/${fixture.community.id}`,
          { headers: appHeaders }
        );
        expect([200, 204]).toContain(communityDelete.status());
        communityDeleteStatus = communityDelete.status();
      }
      const communityRead = await ownerPage.request.get(
        `${origin}/api/social/community/${fixture.community.id}`,
        { headers: appHeaders }
      );
      expect([200, 404]).toContain(communityRead.status());
      const communityReadBody = await communityRead.text();
      const communityReadIsNull =
        communityRead.status() === 404 ||
        communityReadBody === '' ||
        JSON.parse(communityReadBody) === null;
      expect(communityReadIsNull).toBe(true);
      communityDeleted = communityReadIsNull;

      const roleClient = workspaceClient(3012);
      await roleClient.connect();
      const exactCommunityAssignments = rolesBefore
        .flat()
        .filter((assignment) => assignment.targetId === fixture.community.id);
      const removedAssignments: string[] = [];
      try {
        for (const assignment of exactCommunityAssignments) {
          if (!assignment.assignmentId) continue;
          await firstValueFrom(
            roleClient.send(
              { cmd: roleUnassignCommand },
              { assignmentId: assignment.assignmentId }
            )
          );
          removedAssignments.push(assignment.assignmentId);
        }
      } finally {
        roleClient.close();
      }
      const rolesAfter = await Promise.all([
        exactScopeAssignmentsForProfile(
          ownerUser.profileId,
          workspaceRecovery.workspaceScopeId,
          workspaceRecovery.workspaceScopeName
        ),
        exactScopeAssignmentsForProfile(
          memberUser.profileId,
          workspaceRecovery.workspaceScopeId,
          workspaceRecovery.workspaceScopeName
        ),
      ]);
      const appRolesAfter = await Promise.all([
        appAssignmentsForProfile(ownerUser.profileId, fixture.appScope),
        appAssignmentsForProfile(memberUser.profileId, fixture.appScope),
      ]);
      expect(assignmentDigest(appRolesAfter[0])).toBe(
        assignmentDigest(appRolesBefore[0])
      );
      expect(assignmentDigest(appRolesAfter[1])).toBe(
        assignmentDigest(appRolesBefore[1])
      );
      expect(assignmentDigest(rolesAfter[0])).toBe(
        assignmentDigest(
          rolesBefore[0].filter(
            (assignment) => assignment.targetId !== fixture.community.id
          )
        )
      );
      expect(assignmentDigest(rolesAfter[1])).toBe(
        assignmentDigest(
          rolesBefore[1].filter(
            (assignment) => assignment.targetId !== fixture.community.id
          )
        )
      );
      const retainedAfterCleanup = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId: fixture.conversation.id });
      expect(retainedAfterCleanup).toHaveLength(retainedCountBefore);
      expect(historyDigest(retainedAfterCleanup)).toBe(retainedDigestBefore);
      const originalTombstone = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', {
        conversationId: fixture.originalConversationTombstone.id,
      });
      expect(originalTombstone).toHaveLength(
        fixture.originalConversationTombstone.messageCount
      );
      expect(historyDigest(originalTombstone)).toBe(
        fixture.originalConversationTombstone.messageDigest
      );
      Object.assign(results, {
        authenticatedProfilesValidated: true,
        ownerConversationReadStatus: ownerRead.status(),
        memberConversationReadStatus: memberRead.status(),
        ownerSocketSendStatus: ownerSend.statusCode,
        memberSocketSendStatus: memberSend.statusCode,
        retainedCountBefore: retainedCountBefore,
        retainedDigestBefore: retainedDigestBefore,
        retainedCountAfterDeniedSends: retainedAfterDeniedSends.length,
        retainedDigestAfterDeniedSends: historyDigest(retainedAfterDeniedSends),
        communityWasAlreadyAbsent: communityAlreadyAbsent,
        communityDeleteStatus,
        communityReadbackStatus: communityRead.status(),
        communityReadbackNull: communityReadIsNull,
        removedExactCommunityAssignments: removedAssignments.length,
        ownerWorkspaceAssignmentsBefore: rolesBefore[0].length,
        ownerWorkspaceAssignmentsAfter: rolesAfter[0].length,
        memberWorkspaceAssignmentsBefore: rolesBefore[1].length,
        memberWorkspaceAssignmentsAfter: rolesAfter[1].length,
        ownerAppAssignmentDigestPreserved:
          assignmentDigest(appRolesAfter[0]) ===
          assignmentDigest(appRolesBefore[0]),
        memberAppAssignmentDigestPreserved:
          assignmentDigest(appRolesAfter[1]) ===
          assignmentDigest(appRolesBefore[1]),
        retainedCountAfterCleanup: retainedAfterCleanup.length,
        retainedDigestAfterCleanup: historyDigest(retainedAfterCleanup),
        originalConversationRetainedCount: originalTombstone.length,
        originalConversationRetainedDigest: historyDigest(originalTombstone),
      });
    } finally {
      ownerSocket?.disconnect();
      memberSocket?.disconnect();
      Object.assign(results, {
        finishedAt: new Date().toISOString(),
        fixtureCommunityDeleted: communityDeleted,
      });
      mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
      chmodSync(evidenceDirectory, 0o700);
      writeFileSync(evidencePath, JSON.stringify(results, null, 2), {
        mode: 0o600,
      });
      chmodSync(evidencePath, 0o600);
      await Promise.all([ownerContext.close(), memberContext.close()]);
    }
  });

  test('sends one message when the owner activates submit twice while pending', async ({
    browser,
  }, testInfo) => {
    test.skip(
      process.env['RR10_I04_DOUBLE_SUBMIT'] !== 'true',
      'Requires the explicitly approved one-run private fixture lifecycle'
    );
    test.skip(
      testInfo.project.name !== 'chromium-desktop',
      'The owner-only live pending interaction is recorded once in desktop Chrome'
    );
    test.setTimeout(180_000);

    const workspaceRecovery = JSON.parse(
      readFileSync(
        resolve(evidenceDirectory, 'workspace-recovery.json'),
        'utf8'
      )
    ) as { workspaceScopeId: string; workspaceScopeName: string };
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    const runId = new Date().toISOString().replace(/[:.]/g, '-');
    const fixturePathForRun = resolve(
      evidenceDirectory,
      `i04-double-submit-fixture-${runId}.json`
    );
    const evidencePath = resolve(
      evidenceDirectory,
      `i04-double-submit-${runId}.json`
    );
    const uniqueToken = randomUUID();
    const slug = `rr10-i04-double-${uniqueToken}`;
    const messageContent = `RR10 I04 double submit ${uniqueToken}`;
    let ownerUser: SessionUser | undefined;
    let fixtureScope = 'client-interface';
    let communityId: string | undefined;
    let conversationId: string | undefined;
    let heldAcknowledgement: string | undefined;
    let releaseHeldAcknowledgement: (() => void) | undefined;
    let acknowledgementWatchdog: ReturnType<typeof setTimeout> | undefined;
    let expectedAcknowledgementId: string | undefined;
    let sentPayload: ChatPayload | undefined;
    let sendStartedAtMs: number | undefined;
    let acknowledgementReleasedAtMs: number | undefined;
    let messageDeliveredAtMs: number | undefined;
    let messageRenderedAtMs: number | undefined;
    const sentFrames: ChatPayload[] = [];
    const conversationSnapshots: Array<{
      receivedAtMs: number;
      conversationIds: string[];
    }> = [];
    const evidence: Record<string, unknown> = {
      startedAt: new Date().toISOString(),
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: workspaceRoot,
        encoding: 'utf8',
      }).trim(),
      fixtureSlug: slug,
      messageContentSha256: createHash('sha256')
        .update(messageContent)
        .digest('hex'),
    };
    let cleanupErrors: string[] = [];
    let communityDeleted = false;
    let conversationSoftDeleted = false;
    const ownerBeforeRoles: Array<Record<string, any>> = [];
    let ownerBeforeAppRoles: Array<Record<string, unknown>> = [];
    let community: Record<string, any> | undefined;

    const closeEvidence = async () => {
      Object.assign(evidence, {
        finishedAt: new Date().toISOString(),
        ownerProfileIdSha256: ownerUser
          ? createHash('sha256').update(ownerUser.profileId).digest('hex')
          : null,
        communityId,
        conversationId,
        outgoingMessageFrameCount: sentFrames.length,
        sentMessageId: sentPayload?.id ?? null,
        messageIdSha256: sentPayload?.id
          ? createHash('sha256').update(sentPayload.id).digest('hex')
          : null,
        sendStartedAtMs,
        acknowledgementReleasedAtMs,
        messageDeliveredAtMs,
        messageRenderedAtMs,
        acknowledgementToMessageDeliveryMs:
          acknowledgementReleasedAtMs !== undefined &&
          messageDeliveredAtMs !== undefined
            ? messageDeliveredAtMs - acknowledgementReleasedAtMs
            : null,
        sendToMessageDeliveryMs:
          sendStartedAtMs !== undefined && messageDeliveredAtMs !== undefined
            ? messageDeliveredAtMs - sendStartedAtMs
            : null,
        sendToMessageRenderMs:
          sendStartedAtMs !== undefined && messageRenderedAtMs !== undefined
            ? messageRenderedAtMs - sendStartedAtMs
            : null,
        acknowledgementHeld: !!heldAcknowledgement,
        conversationSnapshotCount: conversationSnapshots.length,
        conversationSnapshots,
        targetConversationSnapshotCount: conversationSnapshots.filter(
          ({ conversationIds }) =>
            conversationIds.includes(conversationId ?? '')
        ).length,
        cleanupErrors,
        conversationSoftDeleted,
        communityDeleted,
      });
      mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 });
      chmodSync(evidenceDirectory, 0o700);
      writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), {
        mode: 0o600,
      });
      chmodSync(evidencePath, 0o600);
    };

    try {
      ownerUser = await login(
        ownerPage,
        ownerCredentialsPath,
        resolve(evidenceDirectory, 'owner-cookies.txt'),
        JSON.parse(readFileSync(fixturePath, 'utf8')).owner.profileId
      );
      const originalFixture = JSON.parse(
        readFileSync(fixturePath, 'utf8')
      ) as FixtureManifest;
      expect(ownerUser.profileId).toBe(originalFixture.owner.profileId);
      expect(originalFixture.appScope).toBe('client-interface');
      fixtureScope = originalFixture.appScope;
      expect(new URL(origin).port).toBe('8080');

      ownerBeforeRoles.push(
        ...(await exactScopeAssignmentsForProfile(
          ownerUser.profileId,
          workspaceRecovery.workspaceScopeId,
          workspaceRecovery.workspaceScopeName
        ))
      );
      ownerBeforeAppRoles = await appAssignmentsForProfile(
        ownerUser.profileId,
        fixtureScope
      );

      await ownerContext.routeWebSocket(
        (url) => isClientChatSocket(url.toString()),
        (webSocket) => {
          const upstream = webSocket.connectToServer();
          webSocket.onMessage((frame) => {
            const payload = socketMessageFromFrame(frame);
            if (payload && payload.conversationId === conversationId) {
              sentFrames.push(payload);
              sentPayload = payload;
              expectedAcknowledgementId = socketAckIdForMessageFrame(frame);
            }
            upstream.send(frame);
          });
          upstream.onMessage((frame) => {
            if (socketMessageFromFrame(frame)?.id === sentPayload?.id) {
              messageDeliveredAtMs = Date.now();
            }
            const serialized =
              typeof frame === 'string' ? frame : frame.toString();
            if (
              expectedAcknowledgementId &&
              serialized.startsWith(`43/chat,${expectedAcknowledgementId}[`)
            ) {
              heldAcknowledgement = serialized;
              releaseHeldAcknowledgement = () => webSocket.send(frame);
              acknowledgementWatchdog = setTimeout(
                () => releaseHeldAcknowledgement?.(),
                30_000
              );
              return;
            }
            webSocket.send(frame);
          });
        }
      );
      ownerPage.on('websocket', (webSocket) => {
        if (!isClientChatSocket(webSocket.url())) return;
        webSocket.on('framereceived', ({ payload }) => {
          if (typeof payload !== 'string') return;
          const eventFrame = payload.startsWith('42')
            ? payload.slice(payload.indexOf('['))
            : '';
          if (!eventFrame.startsWith('["conversations",')) return;
          try {
            const event = JSON.parse(eventFrame) as [
              string,
              Array<{ id?: string }>
            ];
            conversationSnapshots.push({
              receivedAtMs: Date.now(),
              conversationIds: (event[1] ?? []).flatMap((conversation) =>
                typeof conversation.id === 'string' ? [conversation.id] : []
              ),
            });
          } catch {
            // Ignore malformed frames in fixture diagnostics.
          }
        });
      });

      const createCommunity = await ownerPage.request.post(
        `${origin}/api/social/community`,
        {
          headers: appHeaders,
          data: {
            name: `RR10 I04 private double submit ${uniqueToken}`,
            slug,
            description: 'Private local reliability fixture.',
            isPrivate: true,
            joinPolicy: 'invite_only',
            createChatRoom: true,
          },
        }
      );
      expect(createCommunity.status()).toBe(201);
      const createdPayload = await createCommunity.json();
      community = (createdPayload?.data ?? createdPayload) as Record<
        string,
        any
      >;
      communityId = community.id;
      expect(communityId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(community).toMatchObject({
        slug,
        ownerProfileId: ownerUser.profileId,
        appScope: fixtureScope,
        isPrivate: true,
        joinPolicy: 'invite_only',
      });
      const communityRead = await ownerPage.request.get(
        `${origin}/api/social/community/${communityId}`,
        { headers: appHeaders }
      );
      expect(communityRead.status()).toBe(200);
      expect(await communityRead.json()).toMatchObject({
        id: communityId,
        slug,
        ownerProfileId: ownerUser.profileId,
        appScope: fixtureScope,
        isPrivate: true,
        joinPolicy: 'invite_only',
      });
      const linkedRoomRead = await ownerPage.request.get(
        `${origin}/api/social/community/${communityId}/chat-room`,
        { headers: appHeaders }
      );
      expect(linkedRoomRead.status()).toBe(200);
      const linkedRoom = (await linkedRoomRead.json()) as { id: string };
      conversationId = linkedRoom.id;
      const conversation = await collectorRequest<Record<string, any>>(
        'GET_CONVERSATION',
        { conversationId }
      );
      expect(conversation).toMatchObject({
        id: conversationId,
        type: 'community',
        communityId,
        ownerId: ownerUser.profileId,
        isDeleted: false,
      });
      writeFileSync(
        fixturePathForRun,
        `${JSON.stringify(
          {
            createdAt: new Date().toISOString(),
            community: {
              id: communityId,
              slug,
              ownerProfileId: ownerUser.profileId,
              appScope: fixtureScope,
              isPrivate: true,
              joinPolicy: 'invite_only',
            },
            conversation: {
              id: conversationId,
              communityId,
              ownerProfileId: ownerUser.profileId,
              type: 'community',
            },
          },
          null,
          2
        )}\n`,
        { mode: 0o600 }
      );
      chmodSync(fixturePathForRun, 0o600);

      const ownerMemberships = await ownerPage.request.get(
        `${origin}/api/social/community/${communityId}/members`,
        { headers: appHeaders }
      );
      expect(ownerMemberships.status()).toBe(200);
      expect(
        (await ownerMemberships.json()).find(
          (member: { profileId: string }) =>
            member.profileId === ownerUser?.profileId
        )
      ).toMatchObject({ status: 'approved', role: 'owner' });

      // Login bootstraps the global chat socket. Recreate that in-memory
      // snapshot after fixture creation so it includes the newly linked room.
      await ownerPage.reload({ waitUntil: 'domcontentloaded' });

      const initialMessages = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId });
      expect(initialMessages).toHaveLength(0);
      await ownerPage.goto(
        `${origin}/communities/${encodeURIComponent(slug)}/chat`,
        { waitUntil: 'domcontentloaded' }
      );
      const composer = ownerPage.locator('textarea.compose-textarea');
      const sendButton = ownerPage.locator('otui-button.send-button button');
      await expect(composer).toBeVisible({ timeout: 30_000 });
      await expect(composer).toBeEnabled();
      await composer.fill(messageContent);
      await expect(sendButton).toBeEnabled();
      const buttonBox = await sendButton.boundingBox();
      expect(buttonBox).toBeTruthy();
      sendStartedAtMs = Date.now();
      await ownerPage.mouse.click(
        buttonBox!.x + buttonBox!.width / 2,
        buttonBox!.y + buttonBox!.height / 2
      );
      await expect(composer).toBeDisabled();
      await expect(sendButton).toBeDisabled();
      // This is a second real pointer activation while the first request is
      // pending; the composer and button are disabled until the ACK is released.
      await ownerPage.mouse.click(
        buttonBox!.x + buttonBox!.width / 2,
        buttonBox!.y + buttonBox!.height / 2
      );
      await expect.poll(() => sentFrames.length, { timeout: 10_000 }).toBe(1);
      await expect
        .poll(() => !!heldAcknowledgement, { timeout: 20_000 })
        .toBe(true);
      expect(sentPayload?.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(sentPayload).toMatchObject({
        conversationId,
        senderId: ownerUser.profileId,
        content: messageContent,
        type: 'chat',
      });
      await expect
        .poll(async () => {
          const messages = await collectorRequest<
            Array<Record<string, unknown>>
          >('GET_MESSAGES', { conversationId });
          return messages.filter((message) => message.id === sentPayload?.id)
            .length;
        })
        .toBe(1);
      expect(await composer.inputValue()).toBe(messageContent);
      Object.assign(evidence, {
        secondPointerActivationAttemptedWhilePending: true,
        outgoingMessageFrameCountWhilePending: sentFrames.length,
        stableMessageIdAssigned: !!sentPayload?.id,
      });
      const visibleMessage = ownerPage.locator('.message-text').filter({
        hasText: messageContent,
      });
      expect(expectedAcknowledgementId).toBeTruthy();
      // Release the one real persistence acknowledgement only after the UI
      // has remained pending across the second pointer activation.
      const controlledRouteAck = heldAcknowledgement;
      expect(controlledRouteAck).toBeTruthy();
      expect(releaseHeldAcknowledgement).toBeTruthy();
      if (acknowledgementWatchdog) clearTimeout(acknowledgementWatchdog);
      acknowledgementReleasedAtMs = Date.now();
      releaseHeldAcknowledgement!();
      releaseHeldAcknowledgement = undefined;
      await expect(composer).toBeEnabled({ timeout: 10_000 });
      await expect(composer).toHaveValue('');
      await expect(visibleMessage).toHaveCount(1, { timeout: 15_000 });
      messageRenderedAtMs = Date.now();

      const retainedBeforeDelete = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId });
      expect(retainedBeforeDelete).toHaveLength(1);
      const retainedDigest = historyDigest(retainedBeforeDelete);
      const cleanup = await collectorRequest<Ack>(
        'DELETE_OWNED_COMMUNITY_CONVERSATION',
        {
          conversationId,
          communityId,
          actorProfileId: ownerUser.profileId,
          appScope: fixtureScope,
        }
      );
      expect(cleanup.success).toBe(true);
      conversationSoftDeleted = true;
      const communityDelete = await ownerPage.request.delete(
        `${origin}/api/social/community/${communityId}`,
        { headers: appHeaders }
      );
      expect([200, 204]).toContain(communityDelete.status());
      const communityDeleteReadback = await ownerPage.request.get(
        `${origin}/api/social/community/${communityId}`,
        { headers: appHeaders }
      );
      expect(communityDeleteReadback.status()).toBe(200);
      const communityDeleteBody = await communityDeleteReadback.text();
      expect(
        communityDeleteBody === '' || JSON.parse(communityDeleteBody) === null
      ).toBe(true);
      communityDeleted = true;
      const retainedAfterCleanup = await collectorRequest<
        Array<Record<string, unknown>>
      >('GET_MESSAGES', { conversationId });
      expect(retainedAfterCleanup).toHaveLength(1);
      expect(historyDigest(retainedAfterCleanup)).toBe(retainedDigest);

      const ownerRolesAfter = await exactScopeAssignmentsForProfile(
        ownerUser.profileId,
        workspaceRecovery.workspaceScopeId,
        workspaceRecovery.workspaceScopeName
      );
      const exactCommunityAssignments = ownerRolesAfter.filter(
        (assignment) => assignment.targetId === communityId
      );
      const roleClient = workspaceClient(3012);
      await roleClient.connect();
      try {
        for (const assignment of exactCommunityAssignments) {
          await firstValueFrom(
            roleClient.send(
              { cmd: roleUnassignCommand },
              { assignmentId: assignment.assignmentId }
            )
          );
        }
      } finally {
        roleClient.close();
      }
      const ownerRolesAfterCleanup = await exactScopeAssignmentsForProfile(
        ownerUser.profileId,
        workspaceRecovery.workspaceScopeId,
        workspaceRecovery.workspaceScopeName
      );
      const ownerAppRolesAfterCleanup = await appAssignmentsForProfile(
        ownerUser.profileId,
        fixtureScope
      );
      expect(
        assignmentDigest(
          ownerRolesAfterCleanup.filter(
            (assignment) => assignment.targetId !== communityId
          )
        )
      ).toBe(assignmentDigest(ownerBeforeRoles));
      expect(assignmentDigest(ownerAppRolesAfterCleanup)).toBe(
        assignmentDigest(
          ownerBeforeAppRoles.filter(
            (assignment) => (assignment as any).targetId !== communityId
          )
        )
      );
      Object.assign(evidence, {
        authenticatedProfileValidated: true,
        communityReadbackValid: true,
        linkedConversationReadbackValid: true,
        baselineMessageCount: initialMessages.length,
        outgoingMessageFrameCount: sentFrames.length,
        acknowledgementIdPresent: !!expectedAcknowledgementId,
        durableCountWhileAcknowledgementHeld: 1,
        visibleCountAfterAcknowledgement: await visibleMessage.count(),
        textareaDisabledWhilePending: true,
        sendButtonDisabledWhilePending: true,
        draftPreservedWhilePending: true,
        durableCountAfterCleanup: retainedAfterCleanup.length,
        retainedMessageDigest: retainedDigest,
        ownerWorkspaceAssignmentCountBefore: ownerBeforeRoles.length,
        ownerWorkspaceAssignmentCountAfter: ownerRolesAfterCleanup.length,
        ownerAppRoleDigestPreserved:
          assignmentDigest(ownerAppRolesAfterCleanup) ===
          assignmentDigest(ownerBeforeAppRoles),
      });
    } catch (error) {
      cleanupErrors.push(
        error instanceof Error ? error.message.slice(0, 500) : String(error)
      );
      throw error;
    } finally {
      if (acknowledgementWatchdog) clearTimeout(acknowledgementWatchdog);
      releaseHeldAcknowledgement?.();
      // The exact random slug is also the recovery key if community creation
      // persisted but its HTTP response failed before returning the ID.
      if (ownerUser && !communityId) {
        try {
          const bySlug = await ownerPage.request.get(
            `${origin}/api/social/community/slug/${encodeURIComponent(slug)}`,
            { headers: appHeaders, timeout: 10_000 }
          );
          if (bySlug.status() === 200) {
            const body = await bySlug.json();
            const found = (body?.data ?? body) as Record<string, any>;
            if (
              found?.slug === slug &&
              found?.ownerProfileId === ownerUser.profileId &&
              found?.appScope === 'client-interface'
            ) {
              community = found;
              communityId = found.id;
            }
          }
        } catch (error) {
          cleanupErrors.push(
            `slug recovery: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      if (
        ownerUser &&
        communityId &&
        !conversationId &&
        community?.chatRoomId
      ) {
        conversationId = community.chatRoomId;
      }
      if (ownerUser && communityId && !conversationId) {
        try {
          const linked = await ownerPage.request.get(
            `${origin}/api/social/community/${communityId}/chat-room`,
            { headers: appHeaders, timeout: 10_000 }
          );
          if (linked.status() === 200) {
            conversationId = ((await linked.json()) as { id: string }).id;
          }
        } catch (error) {
          cleanupErrors.push(
            `linked conversation recovery: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      if (
        ownerUser &&
        communityId &&
        conversationId &&
        !conversationSoftDeleted
      ) {
        try {
          const cleanup = await collectorRequest<Ack>(
            'DELETE_OWNED_COMMUNITY_CONVERSATION',
            {
              conversationId,
              communityId,
              actorProfileId: ownerUser.profileId,
              appScope: fixtureScope,
            }
          );
          if (cleanup.success) conversationSoftDeleted = true;
          else
            cleanupErrors.push('conversation cleanup returned success:false');
        } catch (error) {
          cleanupErrors.push(
            `conversation cleanup: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      if (ownerUser && communityId && !communityDeleted) {
        try {
          const deleted = await ownerPage.request.delete(
            `${origin}/api/social/community/${communityId}`,
            { headers: appHeaders, timeout: 10_000 }
          );
          if ([200, 204, 404].includes(deleted.status())) {
            const readback = await ownerPage.request.get(
              `${origin}/api/social/community/${communityId}`,
              { headers: appHeaders, timeout: 10_000 }
            );
            if (readback.status() === 404) communityDeleted = true;
            else if (readback.status() === 200) {
              const body = await readback.text();
              communityDeleted = body === '' || JSON.parse(body) === null;
            }
          }
        } catch (error) {
          cleanupErrors.push(
            `community cleanup: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      if (ownerUser && communityId && communityDeleted) {
        try {
          const roles = await exactScopeAssignmentsForProfile(
            ownerUser.profileId,
            workspaceRecovery.workspaceScopeId,
            workspaceRecovery.workspaceScopeName
          );
          const exactRoles = roles.filter(
            (assignment) => assignment.targetId === communityId
          );
          const roleClient = workspaceClient(3012);
          await roleClient.connect();
          try {
            for (const assignment of exactRoles) {
              await firstValueFrom(
                roleClient.send(
                  { cmd: roleUnassignCommand },
                  { assignmentId: assignment.assignmentId }
                )
              );
            }
          } finally {
            roleClient.close();
          }
        } catch (error) {
          cleanupErrors.push(
            `role cleanup: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      if (communityId && conversationId) {
        try {
          const retained = await collectorRequest<
            Array<Record<string, unknown>>
          >('GET_MESSAGES', { conversationId });
          Object.assign(evidence, {
            cleanupRetainedMessageCount: retained.length,
            cleanupRetainedMessageDigest: historyDigest(retained),
          });
        } catch (error) {
          cleanupErrors.push(
            `message readback: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
      await closeEvidence();
      await ownerContext.close();
    }
  });
});
