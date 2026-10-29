import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const reporterProfileId = 'adee0191-8158-472a-a828-d58473bb0886';
const authorProfileId = '9319acdf-f9de-454b-91fc-899b9e8a150f';
const ownerProfileId = '69dd86ed-eb9a-4e08-98b2-9409a83be77d';
const operatorRoleId = 'd339a532-b53c-4521-b5c8-3df8391027f1';
const clientInterfaceScopeId = '12361967-0230-4f31-bd91-4b3c62d0bca1';
const ownerConsoleHeaders = {
  'x-ot-app-id': 'owner-console',
  'x-ot-appscope': 'owner-console',
  'x-ot-session-mode': 'cookie',
};
const reporterHeaders = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
  'x-ot-session-mode': 'cookie',
};
const otherScopeHeaders = {
  'x-ot-app-id': 'local-hub',
  'x-ot-appscope': 'local-hub',
  'x-ot-session-mode': 'cookie',
};
const reporterCredentialsPath =
  process.env['RR09_I10_REPORTER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i04-nonowner-credentials.json';
const authorCredentialsPath =
  process.env['RR09_I10_AUTHOR_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const ownerCredentialsPath =
  process.env['RR09_I10_OWNER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json';
const baselineRoleNames = [
  'AssetUser',
  'ProfileOwner',
  'client_interface_user',
  'community_owner',
  'forum_user',
].sort();

type Credentials = { email: string; password: string };
type Session = { userId: string; profileId: string };
type RoleAssignment = { id: string; role?: { name?: string } };
type JsonResponse = { status: number; body: unknown };

function readCredentials(path: string, emailPrefix?: string): Credentials {
  const value = JSON.parse(readFileSync(path, 'utf8')) as Credentials;
  expect(value.email).toEqual(expect.any(String));
  expect(value.password).toEqual(expect.any(String));
  if (emailPrefix) expect(value.email.startsWith(emailPrefix)).toBe(true);
  return value;
}

async function login(
  page: Page,
  credentials: Credentials,
  headers = reporterHeaders
): Promise<Session> {
  const response = await page.request.post(
    `${origin}/api/authentication/login`,
    {
      headers,
      data: credentials,
    }
  );
  expect(response.status(), 'normal HTTP login').toBe(201);
  const sessionResponse = await page.request.get(
    `${origin}/api/authentication/session`,
    { headers }
  );
  expect(sessionResponse.status(), 'authenticated session read').toBe(200);
  const payload = (await sessionResponse.json()) as {
    data?: Session;
  } & Session;
  const session = payload.data ?? payload;
  expect(session.userId).toBeTruthy();
  expect(session.profileId).toBeTruthy();
  return session;
}

async function jsonRequest(
  page: Page,
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  data?: unknown,
  headers = reporterHeaders
): Promise<JsonResponse> {
  const response = await page.request.fetch(`${origin}${path}`, {
    method,
    headers: {
      ...headers,
      ...(data === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(data === undefined ? {} : { data }),
  });
  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new Error(
        `${method} ${path} returned non-JSON body, status=${response.status()}, bodyLength=${
          text.length
        }`
      );
    }
  }
  return { status: response.status(), body };
}

function unwrap<T>(value: unknown): T {
  if (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    (value as { data?: unknown }).data !== undefined
  ) {
    return (value as { data: T }).data;
  }
  return value as T;
}

async function readRoles(
  page: Page,
  profileId: string
): Promise<RoleAssignment[]> {
  const response = await jsonRequest(
    page,
    `/api/permissions/user-roles/${profileId}?appScope=client-interface`,
    'GET'
  );
  expect(response.status).toBe(200);
  return unwrap<RoleAssignment[]>(response.body);
}

async function operatorStatus(page: Page, headers = reporterHeaders) {
  return (
    await jsonRequest(
      page,
      '/api/privacy/operator/reports',
      'GET',
      undefined,
      headers
    )
  ).status;
}

async function directPermission(
  page: Page,
  permission: string,
  appScope: string,
  targetId: string
): Promise<boolean> {
  const response = await jsonRequest(
    page,
    '/api/permissions/check-permission',
    'POST',
    { permission, appScope, targetId },
    reporterHeaders
  );
  expect(response.status).toBe(201);
  return unwrap<boolean>(response.body);
}

test('RR09 I10 role grant and revoke invalidate the same gateway permission cache immediately', async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== 'chromium-desktop',
    'One desktop run owns the exact guarded role lifecycle'
  );
  test.skip(
    process.env['RR09_I10_LIVE_STACK'] !== 'true' ||
      process.env['RR09_I10_ROLE_LIFECYCLE'] !== 'true',
    'Requires the explicitly authorized single local synthetic role lifecycle'
  );
  test.setTimeout(90_000);

  const reporterContext = await browser.newContext({ baseURL: origin });
  const authorContext = await browser.newContext({ baseURL: origin });
  const ownerContext = await browser.newContext({ baseURL: origin });
  const reporterPage = await reporterContext.newPage();
  const authorPage = await authorContext.newPage();
  const ownerPage = await ownerContext.newPage();
  const events: Array<{ event: string; elapsedMs: number; status?: number }> =
    [];
  const startedAt = Date.now();
  let assignmentId: string | undefined;
  let reporterReady = false;
  let ownerReady = false;
  let reporterRolesBefore: RoleAssignment[] = [];
  const cleanupErrors: string[] = [];

  try {
    const reporter = await login(
      reporterPage,
      readCredentials(reporterCredentialsPath, 'rr09-i04-nonowner-')
    );
    reporterReady = true;
    const author = await login(
      authorPage,
      readCredentials(authorCredentialsPath, 'rr09-i03-')
    );
    const owner = await login(
      ownerPage,
      readCredentials(ownerCredentialsPath),
      ownerConsoleHeaders
    );
    ownerReady = true;
    expect(reporter.profileId).toBe(reporterProfileId);
    expect(author.profileId).toBe(authorProfileId);
    expect(owner.profileId).toBe(ownerProfileId);

    reporterRolesBefore = await readRoles(reporterPage, reporter.profileId);
    expect(reporterRolesBefore.map((entry) => entry.role?.name).sort()).toEqual(
      baselineRoleNames
    );
    expect(
      reporterRolesBefore.some(
        (entry) => entry.role?.name === 'client_interface_operator'
      )
    ).toBe(false);
    const authorRolesBefore = await readRoles(authorPage, author.profileId);
    expect(
      authorRolesBefore.some(
        (entry) => entry.role?.name === 'client_interface_operator'
      )
    ).toBe(false);
    expect(
      await directPermission(
        ownerPage,
        'users.update',
        'owner-console',
        owner.profileId
      ),
      'configured owner retains actual guarded assignment authority'
    ).toBe(true);

    const initialReporterStatus = await operatorStatus(reporterPage);
    events.push({
      event: 'reporter-client-interface-deny-before-grant',
      status: initialReporterStatus,
      elapsedMs: Date.now() - startedAt,
    });
    expect(initialReporterStatus).toBe(403);
    const initialAuthorStatus = await operatorStatus(authorPage);
    events.push({
      event: 'other-profile-deny-before-grant',
      status: initialAuthorStatus,
      elapsedMs: Date.now() - startedAt,
    });
    expect(initialAuthorStatus).toBe(403);
    const initialOtherScopeStatus = await operatorStatus(
      reporterPage,
      otherScopeHeaders
    );
    events.push({
      event: 'reporter-local-hub-scope-deny-before-grant',
      status: initialOtherScopeStatus,
      elapsedMs: Date.now() - startedAt,
    });
    expect(initialOtherScopeStatus).toBe(403);

    const assignment = await jsonRequest(
      ownerPage,
      '/api/permissions/assignment',
      'POST',
      {
        roleId: operatorRoleId,
        profileId: reporter.profileId,
        appScopeId: clientInterfaceScopeId,
      },
      ownerConsoleHeaders
    );
    expect(assignment.status, 'guarded owner-console role grant').toBe(201);
    const assigned = unwrap<Record<string, unknown>>(assignment.body);
    assignmentId = String(assigned['id'] ?? assigned['assignmentId'] ?? '');
    expect(assignmentId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(assigned['profileId']).toBe(reporter.profileId);
    expect(assigned['roleId']).toBe(operatorRoleId);
    expect(assigned['appScopeId']).toBe(clientInterfaceScopeId);

    const grantAcknowledgedAt = Date.now();
    const grantStatus = await operatorStatus(reporterPage);
    const grantElapsedMs = Date.now() - grantAcknowledgedAt;
    events.push({
      event: 'same-gateway-allow-immediately-after-grant',
      status: grantStatus,
      elapsedMs: grantElapsedMs,
    });
    expect(grantStatus, `grant-to-allow elapsedMs=${grantElapsedMs}`).toBe(200);

    const otherProfileAfterGrant = await operatorStatus(authorPage);
    expect(
      otherProfileAfterGrant,
      'grant for reporter does not change the author profile decision'
    ).toBe(403);
    const otherScopeAfterGrant = await operatorStatus(
      reporterPage,
      otherScopeHeaders
    );
    expect(
      otherScopeAfterGrant,
      'client-interface grant does not leak into local-hub scope'
    ).toBe(403);

    const assignedRoles = await readRoles(reporterPage, reporter.profileId);
    const exactAssignment = assignedRoles.filter(
      (entry) => entry.id === assignmentId
    );
    expect(exactAssignment).toHaveLength(1);
    expect(exactAssignment[0].role?.name).toBe('client_interface_operator');

    const revokeStarted = Date.now();
    const revoked = await jsonRequest(
      ownerPage,
      `/api/permissions/assignment/${assignmentId}`,
      'DELETE',
      undefined,
      ownerConsoleHeaders
    );
    expect(revoked.status, 'guarded exact role revoke').toBe(200);
    const revokeAck = unwrap<Record<string, unknown>>(revoked.body);
    expect(revokeAck).toMatchObject({
      success: true,
      assignmentId,
      profileId: reporter.profileId,
    });

    const revokeAcknowledgedAt = Date.now();
    const revokeStatus = await operatorStatus(reporterPage);
    const revokeElapsedMs = Date.now() - revokeAcknowledgedAt;
    events.push({
      event: 'same-gateway-deny-immediately-after-revoke',
      status: revokeStatus,
      elapsedMs: revokeElapsedMs,
    });
    expect(revokeStatus, `revoke-to-deny elapsedMs=${revokeElapsedMs}`).toBe(
      403
    );
    expect(await operatorStatus(authorPage)).toBe(403);
    expect(await operatorStatus(reporterPage, otherScopeHeaders)).toBe(403);
    expect(
      await directPermission(
        reporterPage,
        'content.report.review',
        'client-interface',
        reporter.profileId
      )
    ).toBe(false);

    const finalRoles = await readRoles(reporterPage, reporter.profileId);
    expect(finalRoles.map((entry) => entry.role?.name).sort()).toEqual(
      baselineRoleNames
    );
    expect(finalRoles.some((entry) => entry.id === assignmentId)).toBe(false);
    expect(
      finalRoles.some(
        (entry) => entry.role?.name === 'client_interface_operator'
      )
    ).toBe(false);
    events.push({
      event: 'exact-role-baseline-restored',
      elapsedMs: Date.now() - startedAt,
    });
    console.info(
      '[RR09-I10 immediate role cache lifecycle]',
      JSON.stringify({
        reporterProfileId: reporter.profileId,
        authorProfileId: author.profileId,
        assignmentId,
        revokeAck,
        events,
        totalElapsedMs: Date.now() - startedAt,
        gatewayRestartedDuringLifecycle: false,
        reportWrites: 0,
      })
    );
  } finally {
    if (reporterReady) {
      try {
        const currentRoles = await readRoles(reporterPage, reporterProfileId);
        const exact = currentRoles.filter(
          (entry) =>
            entry.role?.name === 'client_interface_operator' &&
            !reporterRolesBefore.some((before) => before.id === entry.id)
        );
        if (exact.length > 1) {
          cleanupErrors.push('multiple exact temporary role assignments found');
        } else if (exact.length === 1) {
          if (assignmentId && exact[0].id !== assignmentId) {
            cleanupErrors.push(
              'role assignment ID differs from the guarded grant response'
            );
          }
          assignmentId = exact[0].id;
          if (!ownerReady) {
            cleanupErrors.push(
              'owner session unavailable for exact role cleanup'
            );
          } else {
            const deletion = await jsonRequest(
              ownerPage,
              `/api/permissions/assignment/${assignmentId}`,
              'DELETE',
              undefined,
              ownerConsoleHeaders
            );
            if (deletion.status !== 200) {
              cleanupErrors.push(
                `cleanup DELETE returned HTTP ${deletion.status}`
              );
            }
          }
        }
        const finalRoles = await readRoles(reporterPage, reporterProfileId);
        if (
          finalRoles
            .map((entry) => entry.role?.name)
            .sort()
            .join('|') !== baselineRoleNames.join('|')
        ) {
          cleanupErrors.push('final reporter role baseline was not restored');
        }
        if (
          assignmentId &&
          finalRoles.some((entry) => entry.id === assignmentId)
        ) {
          cleanupErrors.push(
            'exact temporary assignment remains after cleanup'
          );
        }
        const permission = await directPermission(
          reporterPage,
          'content.report.review',
          'client-interface',
          reporterProfileId
        );
        if (permission)
          cleanupErrors.push('final direct permission remained true');
        const status = await operatorStatus(reporterPage);
        if (status !== 403) {
          cleanupErrors.push(`final protected route returned HTTP ${status}`);
        }
        console.info(
          '[RR09-I10 exact assignment cleanup readback]',
          JSON.stringify({
            assignmentId,
            reporterProfileId,
            roleNames: finalRoles.map((entry) => entry.role?.name).sort(),
            directReportReviewPermission: permission,
            operatorRouteStatus: status,
          })
        );
      } catch (error) {
        cleanupErrors.push(
          `cleanup/readback failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`
        );
      }
    }
    await Promise.allSettled([
      reporterContext.close(),
      authorContext.close(),
      ownerContext.close(),
    ]);
  }
  expect(cleanupErrors, 'exact temporary role cleanup and readback').toEqual(
    []
  );
});
