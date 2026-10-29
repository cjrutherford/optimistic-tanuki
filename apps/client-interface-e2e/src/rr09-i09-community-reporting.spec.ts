import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const enabled = process.env['RR09_I09_LIVE_STACK'] === 'true';
const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const headers = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};
const reporterCredentialsPath =
  process.env['RR09_I04_NONOWNER_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i04-nonowner-credentials.json';
const authorCredentialsPath =
  process.env['RR09_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const adminCredentialsPath =
  process.env['RR09_I09_ADMIN_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i09-default-owner-credentials.json';
const community = {
  id: '3bd16edb-3a0e-40c1-b382-f014d0f0bbd6',
  slug: 'permission-community-1791286545022',
};
const baselinePostId = '2e2eeab2-7ef7-4b7c-997a-c559cbfd9d2f';
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const artifactDirectory = join(
  workspaceRoot,
  'apps/client-interface-e2e/.runtime-artifacts/rr09/i09'
);
const fixtureStatePath = join(artifactDirectory, 'controlled-fixture.json');

type Credentials = { email: string; password: string };
type Session = { userId: string; profileId: string; name?: string };
type RoleAssignment = {
  id: string;
  role?: { name?: string; permissions?: Array<{ name?: string }> };
  appScope?: { name?: string };
};

function credentials(path: string, prefix?: string): Credentials {
  const result = JSON.parse(readFileSync(path, 'utf8')) as Credentials;
  if (
    typeof result.email !== 'string' ||
    (prefix !== undefined && !result.email.startsWith(prefix)) ||
    typeof result.password !== 'string'
  ) {
    throw new Error(
      prefix
        ? `Expected retained synthetic ${prefix} test credentials`
        : 'Invalid configured local default-owner credentials'
    );
  }
  return result;
}

async function login(page: Page, value: Credentials): Promise<Session> {
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(value.email);
  await page.getByLabel('Password', { exact: true }).fill(value.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  const response = await page.request.get(
    `${origin}/api/authentication/session`,
    {
      headers,
    }
  );
  expect(response.status(), 'authenticated session read').toBe(200);
  const session = (await response.json()).data as Session;
  expect(session.userId).toBeTruthy();
  expect(session.profileId).toBeTruthy();
  return session;
}

async function loginDefaultOwner(
  page: Page,
  value: Credentials,
  scope = 'owner-console'
): Promise<{ loginStatus: number; session?: Session }> {
  const ownerHeaders = {
    'x-ot-app-id': scope,
    'x-ot-appscope': scope,
    'x-ot-session-mode': 'cookie',
  };
  const loginResponse = await page.request.post(
    `${origin}/api/authentication/login`,
    { headers: ownerHeaders, data: value }
  );
  if (loginResponse.status() !== 201) {
    return { loginStatus: loginResponse.status() };
  }
  const sessionResponse = await page.request.get(
    `${origin}/api/authentication/session`,
    { headers: ownerHeaders }
  );
  if (sessionResponse.status() !== 200) {
    return { loginStatus: sessionResponse.status() };
  }
  const session = (await sessionResponse.json()).data as Session;
  expect(session.userId).toBeTruthy();
  expect(session.profileId).toBeTruthy();
  return { loginStatus: loginResponse.status(), session };
}

async function jsonGet<T>(
  page: Page,
  path: string,
  requestHeaders = headers
): Promise<T> {
  const response = await page.request.get(`${origin}${path}`, {
    headers: requestHeaders,
  });
  const body = await response.text();
  expect(response.status(), `GET ${path}; bodyLength=${body.length}`).toBe(200);
  try {
    if (!body) return null as T;
    const parsed = JSON.parse(body) as { data?: T } | T;
    return (
      typeof parsed === 'object' && parsed !== null && 'data' in parsed
        ? parsed.data
        : parsed
    ) as T;
  } catch {
    throw new Error(
      `GET ${path} returned non-JSON response; status=${response.status()}, bodyLength=${
        body.length
      }`
    );
  }
}

async function jsonRequest<T>(
  page: Page,
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  data?: unknown,
  requestHeaders = headers
): Promise<{ status: number; body: T }> {
  const response = await page.request.fetch(`${origin}${path}`, {
    method,
    headers: {
      ...requestHeaders,
      ...(data === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(data === undefined ? {} : { data }),
  });
  const bodyText = await response.text();
  let body = null as T;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText) as T;
    } catch {
      throw new Error(
        `${method} ${path} returned non-JSON response, status=${response.status()}, bodyLength=${
          bodyText.length
        }`
      );
    }
  }
  return { status: response.status(), body };
}

const ownerConsoleHeaders = {
  'x-ot-app-id': 'owner-console',
  'x-ot-appscope': 'owner-console',
  'x-ot-session-mode': 'cookie',
};

test.skip(
  !enabled || process.env['RR09_I09_REAL_GATEWAY_WRITE'] !== 'true',
  'Requires the explicitly approved single synthetic I09 report and dismissal write'
);

test('RR09 I09 submits, reads back, dismisses, and exactly cleans the controlled gateway fixture', async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== 'chromium-desktop',
    'One desktop browser run owns the single durable report fixture'
  );
  test.setTimeout(180_000);
  const fixture = JSON.parse(readFileSync(fixtureStatePath, 'utf8')) as {
    postId: string;
    title: string;
    authorProfileId: string;
    reporterProfileId: string;
    communityId: string;
    baselineMemberCount: number;
    baselineMemberIdsSha256: string;
  };
  expect(fixture.postId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(fixture.authorProfileId).toBe('9319acdf-f9de-454b-91fc-899b9e8a150f');
  expect(fixture.reporterProfileId).toBe(
    'adee0191-8158-472a-a828-d58473bb0886'
  );
  const reporterContext = await browser.newContext({ baseURL: origin });
  const authorContext = await browser.newContext({ baseURL: origin });
  const ownerContext = await browser.newContext({ baseURL: origin });
  const reporterPage = await reporterContext.newPage();
  const authorPage = await authorContext.newPage();
  const ownerPage = await ownerContext.newPage();
  let assignmentId: string | undefined;
  let reportId: string | undefined;
  let reportDispositionConfirmed = false;
  let reporterJoined = true;
  let authorJoined = true;
  let cleanupErrors: string[] = [];
  try {
    const reporter = await login(
      reporterPage,
      credentials(reporterCredentialsPath, 'rr09-i04-nonowner-')
    );
    const author = await login(
      authorPage,
      credentials(authorCredentialsPath, 'rr09-i03-')
    );
    expect(reporter.profileId).toBe(fixture.reporterProfileId);
    expect(author.profileId).toBe(fixture.authorProfileId);
    const ownerLogin = await loginDefaultOwner(
      ownerPage,
      credentials(adminCredentialsPath)
    );
    expect(ownerLogin.loginStatus).toBe(201);
    expect(ownerLogin.session?.profileId).toBe(
      '69dd86ed-eb9a-4e08-98b2-9409a83be77d'
    );

    const roleId = 'd339a532-b53c-4521-b5c8-3df8391027f1';
    const appScopeId = '12361967-0230-4f31-bd91-4b3c62d0bca1';
    const reporterRolesBefore = await jsonGet<RoleAssignment[]>(
      reporterPage,
      `/api/permissions/user-roles/${reporter.profileId}?appScope=client-interface`
    );
    expect(
      reporterRolesBefore.some(
        (entry) => entry.role?.name === 'client_interface_operator'
      ),
      'reporter begins without operator role'
    ).toBe(false);
    const authorRolesBefore = await jsonGet<RoleAssignment[]>(
      authorPage,
      `/api/permissions/user-roles/${author.profileId}?appScope=client-interface`
    );
    expect(
      authorRolesBefore.some(
        (entry) => entry.role?.name === 'client_interface_operator'
      ),
      'post author remains a non-operator'
    ).toBe(false);
    expect(
      await jsonGet<boolean>(
        reporterPage,
        `/api/social/community/${fixture.communityId}/membership`
      )
    ).toBe(true);
    expect(
      await jsonGet<boolean>(
        authorPage,
        `/api/social/community/${fixture.communityId}/membership`
      )
    ).toBe(true);
    const priorReports = await jsonGet<Array<Record<string, unknown>>>(
      reporterPage,
      '/api/privacy/reports'
    );
    expect(
      priorReports.some((entry) => entry['contentId'] === fixture.postId)
    ).toBe(false);

    const assignment = await jsonRequest<unknown>(
      ownerPage,
      '/api/permissions/assignment',
      'POST',
      {
        roleId,
        profileId: reporter.profileId,
        appScopeId,
      },
      ownerConsoleHeaders
    );
    expect(assignment.status, 'owner-console guarded role assignment').toBe(
      201
    );
    const assigned = unwrap<Record<string, unknown>>(assignment.body);
    assignmentId = String(assigned['id'] ?? assigned['assignmentId'] ?? '');
    expect(assignmentId).toMatch(/^[0-9a-f-]{36}$/i);
    const reporterOperatorRead = await reporterPage.request.get(
      `${origin}/api/privacy/operator/reports`,
      { headers }
    );
    expect(
      reporterOperatorRead.status(),
      'temporary reviewer role capability'
    ).toBe(200);
    const authorOperatorRead = await authorPage.request.get(
      `${origin}/api/privacy/operator/reports`,
      { headers }
    );
    expect(
      authorOperatorRead.status(),
      'author has no report review capability'
    ).toBe(403);

    await reporterPage.goto(`${origin}/communities/${community.slug}/posts`, {
      waitUntil: 'domcontentloaded',
    });
    const postCard = reporterPage
      .locator('.post-container')
      .filter({ hasText: fixture.title });
    await expect(postCard).toBeVisible({ timeout: 20_000 });
    await postCard.getByRole('button', { name: '...', exact: true }).click();
    await reporterPage
      .getByRole('button', { name: 'Report post', exact: true })
      .click();
    const dialog = reporterPage.getByRole('dialog', { name: 'Report Post' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Spam', { exact: true }).check();
    await dialog
      .getByLabel('Additional details (optional)', { exact: true })
      .fill('RR09-I09 controlled synthetic verification report.');
    const reportResponsePromise = reporterPage.waitForResponse(
      (response) =>
        response.url().endsWith('/api/privacy/report') &&
        response.request().method() === 'POST'
    );
    await dialog.getByRole('button', { name: 'Submit report' }).click();
    const reportResponse = await reportResponsePromise;
    expect(reportResponse.status(), 'real gateway report POST').toBe(201);
    const reportResponseBody = await reportResponse.json();
    const createdReport = unwrap<Record<string, unknown>>(reportResponseBody);
    reportId = String(createdReport['id'] ?? '');
    expect(reportId).toMatch(/^[0-9a-f-]{36}$/i);
    await expect(dialog.getByRole('status')).toHaveText(
      'Report submitted. Thank you for helping keep our community safe.'
    );
    expect(reportResponse.request().postDataJSON()).toEqual({
      contentType: 'post',
      contentId: fixture.postId,
      reason: 'spam',
      description: 'RR09-I09 controlled synthetic verification report.',
    });
    const myReports = await jsonGet<Array<Record<string, unknown>>>(
      reporterPage,
      '/api/privacy/reports'
    );
    const persisted = myReports.find((entry) => entry['id'] === reportId);
    expect(persisted).toBeTruthy();
    expect(persisted).toMatchObject({
      contentType: 'post',
      contentId: fixture.postId,
      reporterId: reporter.profileId,
      reason: 'spam',
      appScope: 'client-interface',
      status: 'pending',
    });
    const operatorReports = (await reporterOperatorRead.json()).data as Array<
      Record<string, unknown>
    >;
    expect(operatorReports.some((entry) => entry['id'] === reportId)).toBe(
      true
    );

    const dismissed = await jsonRequest<Record<string, unknown>>(
      reporterPage,
      `/api/privacy/operator/reports/${reportId}`,
      'PUT',
      {
        status: 'dismissed',
        adminNotes:
          'RR09-I09 synthetic verification; retained audit disposition.',
      }
    );
    expect(dismissed.status, 'authorized operator dismissal').toBe(200);
    expect(unwrap<Record<string, unknown>>(dismissed.body)['status']).toBe(
      'dismissed'
    );
    const rereadReports = await jsonGet<Array<Record<string, unknown>>>(
      reporterPage,
      '/api/privacy/operator/reports'
    );
    expect(
      rereadReports.find((entry) => entry['id'] === reportId)
    ).toMatchObject({ status: 'dismissed', contentId: fixture.postId });
    reportDispositionConfirmed = true;
    console.info(
      '[RR09-I09 durable report disposition]',
      JSON.stringify({
        reportId,
        postId: fixture.postId,
        authorProfileId: author.profileId,
        reporterProfileId: reporter.profileId,
        status: 'dismissed',
        audit:
          'report_status action is transactionally appended by the existing social privacy service; no public audit-read endpoint exists',
      })
    );
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close report' }).click();
  } finally {
    if (!reportDispositionConfirmed) {
      try {
        const reporterRows = await jsonGet<Array<Record<string, unknown>>>(
          reporterPage,
          '/api/privacy/reports'
        );
        const exactRows = reporterRows.filter(
          (entry) =>
            entry['contentId'] === fixture.postId &&
            entry['reporterId'] === fixture.reporterProfileId &&
            entry['description'] ===
              'RR09-I09 controlled synthetic verification report.'
        );
        if (exactRows.length > 1) {
          cleanupErrors.push('multiple exact RR09-I09 report markers found');
        } else if (exactRows.length === 1) {
          reportId = String(exactRows[0]['id']);
          if (exactRows[0]['status'] !== 'dismissed') {
            const recoveredDismissal = await jsonRequest<unknown>(
              reporterPage,
              `/api/privacy/operator/reports/${reportId}`,
              'PUT',
              {
                status: 'dismissed',
                adminNotes:
                  'RR09-I09 synthetic verification recovery disposition.',
              }
            );
            if (recoveredDismissal.status !== 200) {
              cleanupErrors.push(
                `recovered report dismissal HTTP ${recoveredDismissal.status}`
              );
            }
          }
          const recoveryRead = await jsonGet<Array<Record<string, unknown>>>(
            reporterPage,
            '/api/privacy/operator/reports'
          );
          const recovered = recoveryRead.find(
            (entry) => entry['id'] === reportId
          );
          if (recovered?.['status'] !== 'dismissed') {
            cleanupErrors.push('recovered report did not read back dismissed');
          } else {
            reportDispositionConfirmed = true;
          }
          console.info(
            '[RR09-I09 recovered exact report disposition]',
            JSON.stringify({
              reportId,
              postId: fixture.postId,
              status: recovered?.['status'],
            })
          );
        } else {
          console.info(
            '[RR09-I09 report recovery readback]',
            JSON.stringify({ postId: fixture.postId, exactReportCount: 0 })
          );
        }
      } catch (recoveryError) {
        cleanupErrors.push(
          `exact report recovery failed: ${
            recoveryError instanceof Error
              ? recoveryError.message
              : 'unknown error'
          }`
        );
      }
    }
    if (assignmentId) {
      const unassign = await jsonRequest<unknown>(
        ownerPage,
        `/api/permissions/assignment/${assignmentId}`,
        'DELETE',
        undefined,
        ownerConsoleHeaders
      );
      console.info(
        '[RR09-I09 guarded exact assignment unassign response]',
        JSON.stringify({ assignmentId, status: unassign.status })
      );
    }
    if (fixture.postId && authorPage) {
      const deletePost = await jsonRequest<unknown>(
        authorPage,
        `/api/social/post/${fixture.postId}`,
        'DELETE'
      );
      if (![200, 204].includes(deletePost.status)) {
        cleanupErrors.push(`exact post delete HTTP ${deletePost.status}`);
      }
    }
    if (authorJoined) {
      const leaveAuthor = await jsonRequest<unknown>(
        authorPage,
        `/api/social/community/${community.id}/leave`,
        'POST',
        {}
      );
      if (![200, 201, 204].includes(leaveAuthor.status)) {
        cleanupErrors.push(`author leave HTTP ${leaveAuthor.status}`);
      }
      authorJoined = false;
    }
    if (reporterJoined) {
      const leaveReporter = await jsonRequest<unknown>(
        reporterPage,
        `/api/social/community/${community.id}/leave`,
        'POST',
        {}
      );
      if (![200, 201, 204].includes(leaveReporter.status)) {
        cleanupErrors.push(`reporter leave HTTP ${leaveReporter.status}`);
      }
      reporterJoined = false;
    }
    if (reporterPage && authorPage && ownerPage) {
      const postSearch = await jsonRequest<unknown>(
        authorPage,
        '/api/social/post/find',
        'POST',
        { criteria: { id: fixture.postId }, opts: { limit: 1 } }
      );
      const searchedRows = unwrap<Array<Record<string, unknown>>>(
        postSearch.body
      );
      if (
        postSearch.status !== 201 ||
        searchedRows.some((row) => row['id'] === fixture.postId)
      ) {
        cleanupErrors.push('exact post search did not confirm absence');
      }
      const reporterMembershipAfter = await jsonGet<boolean>(
        reporterPage,
        `/api/social/community/${community.id}/membership`
      );
      const authorMembershipAfter = await jsonGet<boolean>(
        authorPage,
        `/api/social/community/${community.id}/membership`
      );
      if (reporterMembershipAfter || authorMembershipAfter) {
        cleanupErrors.push('synthetic community membership not restored');
      }
      const membersRead = await jsonGet<unknown>(
        authorPage,
        `/api/social/community/${community.id}/members`
      );
      const members = unwrap<Array<{ id?: string }>>(membersRead)
        .map((member) => member.id ?? '')
        .sort();
      if (
        members.length !== fixture.baselineMemberCount ||
        createHash('sha256').update(JSON.stringify(members)).digest('hex') !==
          fixture.baselineMemberIdsSha256
      ) {
        cleanupErrors.push(
          'community membership snapshot digest/count differs from baseline'
        );
      }
      if (assignmentId) {
        const reporterRolesAfter = await jsonGet<RoleAssignment[]>(
          reporterPage,
          `/api/permissions/user-roles/${fixture.reporterProfileId}?appScope=client-interface`
        );
        if (
          reporterRolesAfter.some(
            (entry) => entry.role?.name === 'client_interface_operator'
          )
        ) {
          cleanupErrors.push(
            'temporary client_interface_operator assignment remains'
          );
        }
      }
      console.info(
        '[RR09-I09 exact cleanup readback]',
        JSON.stringify({
          postId: fixture.postId,
          postSearchCount: searchedRows.length,
          reporterMembership: reporterMembershipAfter,
          authorMembership: authorMembershipAfter,
          communityMemberCount: members.length,
          communityMemberIdsSha256: createHash('sha256')
            .update(JSON.stringify(members))
            .digest('hex'),
          baselineMemberCount: fixture.baselineMemberCount,
          baselineMemberIdsSha256: fixture.baselineMemberIdsSha256,
          reportId,
          retainedReportStatus: 'dismissed',
        })
      );
    }
    await Promise.allSettled([
      reporterContext.close(),
      authorContext.close(),
      ownerContext.close(),
    ]);
    if (cleanupErrors.length) {
      console.error(
        '[RR09-I09 exact cleanup failures]',
        cleanupErrors.join('; ')
      );
    }
  }
  expect(cleanupErrors, 'all exact cleanup actions must succeed').toEqual([]);
  expect(
    reportId,
    'one retained report row with dismissed status'
  ).toBeTruthy();
  expect(reportDispositionConfirmed).toBe(true);
});

test.skip(
  !enabled || process.env['RR09_I09_ROLE_CLEANUP_ONLY'] !== 'true',
  'Runs only the exact temporary role-assignment readback and guarded cleanup'
);

test('RR09 I09 inspect and unassign only the exact temporary reporter operator assignment', async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== 'chromium-desktop',
    'One desktop browser run owns exact assignment cleanup'
  );
  test.setTimeout(180_000);
  const reporterContext = await browser.newContext({ baseURL: origin });
  const ownerContext = await browser.newContext({ baseURL: origin });
  const reporterPage = await reporterContext.newPage();
  const ownerPage = await ownerContext.newPage();
  try {
    const reporter = await login(
      reporterPage,
      credentials(reporterCredentialsPath, 'rr09-i04-nonowner-')
    );
    expect(reporter.profileId).toBe('adee0191-8158-472a-a828-d58473bb0886');
    const ownerLogin = await loginDefaultOwner(
      ownerPage,
      credentials(adminCredentialsPath)
    );
    expect(ownerLogin.loginStatus).toBe(201);
    const assignments = await jsonGet<RoleAssignment[]>(
      reporterPage,
      `/api/permissions/user-roles/${reporter.profileId}?appScope=client-interface`
    );
    const temporary = assignments.filter(
      (entry) => entry.role?.name === 'client_interface_operator'
    );
    if (temporary.length === 0) {
      const uncachedCheck = await reporterPage.request.post(
        `${origin}/api/permissions/check-permission`,
        {
          headers: { ...headers, 'content-type': 'application/json' },
          data: {
            permission: 'content.report.review',
            appScope: 'client-interface',
            targetId: reporter.profileId,
          },
        }
      );
      expect(uncachedCheck.status()).toBe(201);
      const uncachedBody = (await uncachedCheck.json()) as { data?: boolean };
      const directPermission =
        typeof uncachedBody.data === 'boolean'
          ? uncachedBody.data
          : (uncachedBody as unknown as boolean);
      const operatorRead = await reporterPage.request.get(
        `${origin}/api/privacy/operator/reports`,
        { headers }
      );
      console.info(
        '[RR09-I09 exact assignment cleanup readback]',
        JSON.stringify({
          reporterProfileId: reporter.profileId,
          clientInterfaceOperatorAssignments: 0,
          baselineRoleAssignments: 5,
          remainingRoleNames: assignments.map((entry) => entry.role?.name),
          uncachedContentReportReviewPermission: directPermission,
          operatorReportsStatus: operatorRead.status(),
          earlierDeleteHttpStatus: 500,
          earlierDeleteError:
            'gateway reported no elements in sequence after permissions service returned void',
        })
      );
      expect(assignments).toHaveLength(5);
      expect(assignments.map((entry) => entry.role?.name).sort()).toEqual(
        [
          'AssetUser',
          'ProfileOwner',
          'client_interface_user',
          'community_owner',
          'forum_user',
        ].sort()
      );
      expect(
        directPermission,
        'uncached permission check reflects removal'
      ).toBe(false);
      expect([200, 403]).toContain(operatorRead.status());
      const cacheWaitStartedAt = Date.now();
      let effectiveOperatorStatus = operatorRead.status();
      while (
        effectiveOperatorStatus === 200 &&
        Date.now() - cacheWaitStartedAt < 150_000
      ) {
        await reporterPage.waitForTimeout(10_000);
        const refreshedRead = await reporterPage.request.get(
          `${origin}/api/privacy/operator/reports`,
          { headers }
        );
        effectiveOperatorStatus = refreshedRead.status();
      }
      console.info(
        '[RR09-I09 post-revocation operator permission readback]',
        JSON.stringify({
          directPermission,
          initialCachedOperatorStatus: operatorRead.status(),
          effectiveOperatorStatus,
          cacheRefreshWaitMs: Date.now() - cacheWaitStartedAt,
        })
      );
      expect(
        effectiveOperatorStatus,
        'operator authorization expires after the documented cache TTL'
      ).toBe(403);
      return;
    }
    expect(temporary).toHaveLength(1);
    const assignmentId = temporary[0].id;
    expect(assignmentId).toMatch(/^[0-9a-f-]{36}$/i);
    const response = await jsonRequest<unknown>(
      ownerPage,
      `/api/permissions/assignment/${assignmentId}`,
      'DELETE',
      undefined,
      ownerConsoleHeaders
    );
    const body = response.body as { message?: unknown; statusCode?: unknown };
    console.info(
      '[RR09-I09 exact assignment unassign result]',
      JSON.stringify({
        assignmentId,
        roleName: temporary[0].role?.name,
        profileId: reporter.profileId,
        responseStatus: response.status,
        responseMessage:
          typeof body?.message === 'string'
            ? body.message.slice(0, 300)
            : undefined,
        statusCode: body?.statusCode,
      })
    );
    expect([200, 204]).toContain(response.status);
    const remaining = await jsonGet<RoleAssignment[]>(
      reporterPage,
      `/api/permissions/user-roles/${reporter.profileId}?appScope=client-interface`
    );
    expect(
      remaining.some(
        (entry) => entry.role?.name === 'client_interface_operator'
      )
    ).toBe(false);
  } finally {
    await Promise.allSettled([reporterContext.close(), ownerContext.close()]);
  }
});

test.skip(
  !enabled || process.env['RR09_I09_ROLE_CLEANUP_ONLY'] !== 'true',
  'Runs only the explicitly bounded owner-HTTP assignment and exact cleanup proof'
);

test('RR09 I09 guarded temporary role assignment returns an acknowledged exact unassign', async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== 'chromium-desktop',
    'One desktop run owns the temporary assignment lifecycle'
  );
  test.setTimeout(90_000);
  const reporterContext = await browser.newContext({ baseURL: origin });
  const ownerContext = await browser.newContext({ baseURL: origin });
  const reporterPage = await reporterContext.newPage();
  const ownerPage = await ownerContext.newPage();
  let assignmentId: string | undefined;
  try {
    const reporter = await login(
      reporterPage,
      credentials(reporterCredentialsPath, 'rr09-i04-nonowner-')
    );
    expect(reporter.profileId).toBe('adee0191-8158-472a-a828-d58473bb0886');
    const ownerLogin = await loginDefaultOwner(
      ownerPage,
      credentials(adminCredentialsPath)
    );
    expect(ownerLogin.loginStatus).toBe(201);
    const baselineRoles = await jsonGet<RoleAssignment[]>(
      reporterPage,
      `/api/permissions/user-roles/${reporter.profileId}?appScope=client-interface`
    );
    expect(baselineRoles).toHaveLength(5);
    expect(baselineRoles.map((entry) => entry.role?.name).sort()).toEqual(
      [
        'AssetUser',
        'ProfileOwner',
        'client_interface_user',
        'community_owner',
        'forum_user',
      ].sort()
    );
    expect(
      baselineRoles.some(
        (entry) => entry.role?.name === 'client_interface_operator'
      )
    ).toBe(false);

    const assignment = await jsonRequest<unknown>(
      ownerPage,
      '/api/permissions/assignment',
      'POST',
      {
        roleId: 'd339a532-b53c-4521-b5c8-3df8391027f1',
        profileId: reporter.profileId,
        appScopeId: '12361967-0230-4f31-bd91-4b3c62d0bca1',
      },
      ownerConsoleHeaders
    );
    expect(assignment.status, 'guarded owner-console assignment').toBe(201);
    const assignmentRecord = unwrap<Record<string, unknown>>(assignment.body);
    assignmentId = String(assignmentRecord['id'] ?? '');
    expect(assignmentId).toMatch(/^[0-9a-f-]{36}$/i);
    const assignedRoles = await jsonGet<RoleAssignment[]>(
      reporterPage,
      `/api/permissions/user-roles/${reporter.profileId}?appScope=client-interface`
    );
    const exactRole = assignedRoles.filter(
      (entry) => entry.role?.name === 'client_interface_operator'
    );
    expect(exactRole).toHaveLength(1);
    expect(exactRole[0].id).toBe(assignmentId);

    const deletion = await jsonRequest<Record<string, unknown>>(
      ownerPage,
      `/api/permissions/assignment/${assignmentId}`,
      'DELETE',
      undefined,
      ownerConsoleHeaders
    );
    expect(deletion.status, 'guarded exact role DELETE acknowledgment').toBe(
      200
    );
    expect(unwrap<Record<string, unknown>>(deletion.body)).toMatchObject({
      success: true,
      assignmentId,
    });
    assignmentId = undefined;

    const finalRoles = await jsonGet<RoleAssignment[]>(
      reporterPage,
      `/api/permissions/user-roles/${reporter.profileId}?appScope=client-interface`
    );
    expect(finalRoles.map((entry) => entry.role?.name).sort()).toEqual(
      baselineRoles.map((entry) => entry.role?.name).sort()
    );
    const directPermission = await reporterPage.request.post(
      `${origin}/api/permissions/check-permission`,
      {
        headers: { ...headers, 'content-type': 'application/json' },
        data: {
          permission: 'content.report.review',
          appScope: 'client-interface',
          targetId: reporter.profileId,
        },
      }
    );
    expect(directPermission.status()).toBe(201);
    const directBody = (await directPermission.json()) as
      | boolean
      | { data?: boolean };
    const directValue =
      typeof directBody === 'boolean' ? directBody : directBody.data;
    expect(directValue).toBe(false);
    const operatorRead = await reporterPage.request.get(
      `${origin}/api/privacy/operator/reports`,
      { headers }
    );
    expect(
      operatorRead.status(),
      'operator route denies after exact revocation'
    ).toBe(403);
    console.info(
      '[RR09-I09 acknowledged role cleanup proof]',
      JSON.stringify({
        reporterProfileId: reporter.profileId,
        baselineRoleNames: baselineRoles
          .map((entry) => entry.role?.name)
          .sort(),
        remainingRoleNames: finalRoles.map((entry) => entry.role?.name).sort(),
        exactAssignmentDeleteStatus: deletion.status,
        deleteAck: unwrap<Record<string, unknown>>(deletion.body),
        directReviewPermission: directValue,
        operatorReadStatus: operatorRead.status(),
      })
    );
  } finally {
    if (assignmentId) {
      const exactRoles = await jsonGet<RoleAssignment[]>(
        reporterPage,
        `/api/permissions/user-roles/adee0191-8158-472a-a828-d58473bb0886?appScope=client-interface`
      );
      const remains = exactRoles.find((entry) => entry.id === assignmentId);
      if (remains) {
        await jsonRequest(
          ownerPage,
          `/api/permissions/assignment/${assignmentId}`,
          'DELETE',
          undefined,
          ownerConsoleHeaders
        );
      }
    }
    await Promise.allSettled([reporterContext.close(), ownerContext.close()]);
  }
});

test('RR09 I09 persists dismissal for the exact existing report row', async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== 'chromium-desktop',
    'One desktop run owns the exact existing report disposition update'
  );
  test.setTimeout(90_000);
  expect(enabled).toBe(true);
  expect(process.env['RR09_I09_EXISTING_REPORT_DISPOSITION']).toBe('true');
  const reportId = process.env['RR09_I09_EXISTING_REPORT_ID'];
  expect(reportId).toBe('f63b9033-68cf-412c-b3cc-ab7d25adba51');
  const reporterContext = await browser.newContext({ baseURL: origin });
  const ownerContext = await browser.newContext({ baseURL: origin });
  const reporterPage = await reporterContext.newPage();
  const ownerPage = await ownerContext.newPage();
  let assignmentId: string | undefined;
  try {
    const reporter = await login(
      reporterPage,
      credentials(reporterCredentialsPath, 'rr09-i04-nonowner-')
    );
    expect(reporter.profileId).toBe('adee0191-8158-472a-a828-d58473bb0886');
    const ownerLogin = await loginDefaultOwner(
      ownerPage,
      credentials(adminCredentialsPath)
    );
    expect(ownerLogin.loginStatus).toBe(201);
    const baselineRoles = await jsonGet<RoleAssignment[]>(
      reporterPage,
      `/api/permissions/user-roles/${reporter.profileId}?appScope=client-interface`
    );
    expect(baselineRoles).toHaveLength(5);
    expect(
      baselineRoles.some(
        (entry) => entry.role?.name === 'client_interface_operator'
      )
    ).toBe(false);

    const assignment = await jsonRequest<unknown>(
      ownerPage,
      '/api/permissions/assignment',
      'POST',
      {
        roleId: 'd339a532-b53c-4521-b5c8-3df8391027f1',
        profileId: reporter.profileId,
        appScopeId: '12361967-0230-4f31-bd91-4b3c62d0bca1',
      },
      ownerConsoleHeaders
    );
    expect(assignment.status).toBe(201);
    assignmentId = String(
      unwrap<Record<string, unknown>>(assignment.body)['id'] ?? ''
    );
    expect(assignmentId).toMatch(/^[0-9a-f-]{36}$/i);

    const update = await jsonRequest<Record<string, unknown>>(
      reporterPage,
      `/api/privacy/operator/reports/${reportId}`,
      'PUT',
      {
        status: 'dismissed',
        adminNotes:
          'RR09-I09 synthetic verification; retained audit disposition.',
      }
    );
    expect(update.status, 'same-row authorized disposition update').toBe(200);
    expect(unwrap<Record<string, unknown>>(update.body)).toMatchObject({
      id: reportId,
      status: 'dismissed',
      contentId: 'af4ac51b-e162-47dc-8fd1-f9033c953866',
      appScope: 'client-interface',
    });
    console.info(
      '[RR09-I09 existing report disposition response]',
      JSON.stringify({
        reportId,
        updateStatus: update.status,
        status: 'dismissed',
      })
    );
  } finally {
    if (assignmentId) {
      const exactRoles = await jsonGet<RoleAssignment[]>(
        reporterPage,
        `/api/permissions/user-roles/adee0191-8158-472a-a828-d58473bb0886?appScope=client-interface`
      );
      if (exactRoles.some((entry) => entry.id === assignmentId)) {
        const deletion = await jsonRequest<unknown>(
          ownerPage,
          `/api/permissions/assignment/${assignmentId}`,
          'DELETE',
          undefined,
          ownerConsoleHeaders
        );
        expect([200, 204]).toContain(deletion.status);
      }
    }
    await Promise.allSettled([reporterContext.close(), ownerContext.close()]);
  }
});

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

test.skip(
  !enabled,
  'Requires the existing local stack and retained RR09 synthetic profiles'
);
test.describe.configure({ retries: 0 });

test.skip(
  !enabled || process.env['RR09_I09_FIXTURE_SETUP'] !== 'true',
  'Fixture setup is an explicitly enabled, bounded local synthetic write'
);

test('RR09 I09 create one owned synthetic community post fixture', async ({
  browser,
}) => {
  test.skip(
    test.info().project.name !== 'chromium-desktop',
    'Run the bounded fixture writer once in the desktop browser project'
  );
  test.setTimeout(60_000);
  const reporterContext = await browser.newContext({ baseURL: origin });
  const authorContext = await browser.newContext({ baseURL: origin });
  const reporterPage = await reporterContext.newPage();
  const authorPage = await authorContext.newPage();
  let reporterJoined = false;
  let authorJoined = false;
  let createdPostId: string | null = null;
  let setupError: unknown;
  try {
    const reporter = await login(
      reporterPage,
      credentials(reporterCredentialsPath, 'rr09-i04-nonowner-')
    );
    const author = await login(
      authorPage,
      credentials(authorCredentialsPath, 'rr09-i03-')
    );
    expect(reporter.profileId).toBe('adee0191-8158-472a-a828-d58473bb0886');
    expect(author.profileId).toBe('9319acdf-f9de-454b-91fc-899b9e8a150f');
    const communityRead = await jsonGet<Record<string, unknown>>(
      authorPage,
      `/api/social/community/${community.id}`
    );
    expect(communityRead['isPrivate']).toBe(false);
    const baselineMembersRead = await jsonGet<unknown>(
      authorPage,
      `/api/social/community/${community.id}/members`
    );
    const baselineMembers = unwrap<Array<{ id?: string }>>(baselineMembersRead)
      .map((member) => member.id ?? '')
      .sort();
    const baselineMemberCount = Number(communityRead['memberCount']);
    expect(baselineMembers).toHaveLength(baselineMemberCount);
    expect(
      await jsonGet<boolean>(
        authorPage,
        `/api/social/community/${community.id}/membership`
      )
    ).toBe(false);
    expect(
      await jsonGet<boolean>(
        reporterPage,
        `/api/social/community/${community.id}/membership`
      )
    ).toBe(false);

    const authorJoin = await jsonRequest(
      authorPage,
      `/api/social/community/${community.id}/join`,
      'POST',
      {}
    );
    expect(
      authorJoin.status,
      'join existing public community as fixture author'
    ).toBe(201);
    authorJoined = true;
    const reporterJoin = await jsonRequest(
      reporterPage,
      `/api/social/community/${community.id}/join`,
      'POST',
      {}
    );
    expect(
      reporterJoin.status,
      'join existing public community as reporter'
    ).toBe(201);
    reporterJoined = true;

    const title = `RR09 I09 community report fixture ${Date.now()}`;
    const create = await jsonRequest<unknown>(
      authorPage,
      '/api/social/post',
      'POST',
      {
        title,
        content: `<p>${title}</p>`,
        profileId: author.profileId,
        visibility: 'public',
        communityId: community.id,
        appScope: 'client-interface',
      }
    );
    expect(create.status, 'create one owned public community fixture').toBe(
      201
    );
    const post = unwrap<Record<string, unknown>>(create.body);
    createdPostId = String(post['id'] ?? '');
    expect(createdPostId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(post['profileId']).toBe(author.profileId);
    expect(post['communityId']).toBe(community.id);
    expect(post['visibility']).toBe('public');

    const exactRead = await jsonRequest<unknown>(
      reporterPage,
      '/api/social/post/find',
      'POST',
      { criteria: { id: createdPostId }, opts: { limit: 1 } }
    );
    expect(exactRead.status).toBe(201);
    const rows = unwrap<Array<Record<string, unknown>>>(exactRead.body);
    expect(rows[0]?.['id']).toBe(createdPostId);
    expect(rows[0]?.['profileId']).toBe(author.profileId);
    expect(rows[0]?.['communityId']).toBe(community.id);

    mkdirSync(artifactDirectory, { recursive: true, mode: 0o700 });
    writeFileSync(
      fixtureStatePath,
      `${JSON.stringify({
        createdAt: new Date().toISOString(),
        postId: createdPostId,
        title,
        authorProfileId: author.profileId,
        reporterProfileId: reporter.profileId,
        communityId: community.id,
        communitySlug: community.slug,
        baselineMemberCount,
        baselineMemberIdsSha256: createHash('sha256')
          .update(JSON.stringify(baselineMembers))
          .digest('hex'),
      })}\n`,
      { mode: 0o600 }
    );
    chmodSync(fixtureStatePath, 0o600);
    console.info(
      '[RR09-I09 fixture created]',
      JSON.stringify({
        postId: createdPostId,
        title,
        authorProfileId: author.profileId,
        reporterProfileId: reporter.profileId,
        communityId: community.id,
        communitySlug: community.slug,
        baselineMemberCount,
      })
    );
  } catch (error) {
    setupError = error;
  } finally {
    if (setupError && createdPostId) {
      await jsonRequest(
        authorPage,
        `/api/social/post/${createdPostId}`,
        'DELETE'
      );
    }
    if (setupError && reporterJoined) {
      await jsonRequest(
        reporterPage,
        `/api/social/community/${community.id}/leave`,
        'POST',
        {}
      );
    }
    if (setupError && authorJoined) {
      await jsonRequest(
        authorPage,
        `/api/social/community/${community.id}/leave`,
        'POST',
        {}
      );
    }
    await Promise.allSettled([reporterContext.close(), authorContext.close()]);
  }
  if (setupError) throw setupError;
});

test('RR09 I09 read-only fixture and operator authorization preflight', async ({
  browser,
}) => {
  test.setTimeout(60_000);
  const reporterContext = await browser.newContext({ baseURL: origin });
  const authorContext = await browser.newContext({ baseURL: origin });
  const adminContext = await browser.newContext({ baseURL: origin });
  const ownerConsoleContext = await browser.newContext({ baseURL: origin });
  const reporterPage = await reporterContext.newPage();
  const authorPage = await authorContext.newPage();
  const adminPage = await adminContext.newPage();
  const ownerConsolePage = await ownerConsoleContext.newPage();
  try {
    const reporter = await login(
      reporterPage,
      credentials(reporterCredentialsPath, 'rr09-i04-nonowner-')
    );
    const author = await login(
      authorPage,
      credentials(authorCredentialsPath, 'rr09-i03-')
    );
    const ownerConsoleLogin = await loginDefaultOwner(
      ownerConsolePage,
      credentials(adminCredentialsPath)
    );
    const adminLogin = await loginDefaultOwner(
      adminPage,
      credentials(adminCredentialsPath),
      'client-interface'
    );
    const admin = adminLogin.session;
    const ownerConsoleSession = ownerConsoleLogin.session;
    expect(reporter.profileId).not.toBe(author.profileId);

    const [
      reporterRoles,
      authorRoles,
      communityRead,
      reporterMembership,
      authorMembership,
      myReports,
    ] = await Promise.all([
      jsonGet<RoleAssignment[]>(
        reporterPage,
        `/api/permissions/user-roles/${reporter.profileId}?appScope=client-interface`
      ),
      jsonGet<RoleAssignment[]>(
        authorPage,
        `/api/permissions/user-roles/${author.profileId}?appScope=client-interface`
      ),
      jsonGet<Record<string, unknown>>(
        authorPage,
        `/api/social/community/${community.id}`
      ),
      jsonGet<boolean>(
        reporterPage,
        `/api/social/community/${community.id}/membership`
      ),
      jsonGet<boolean>(
        authorPage,
        `/api/social/community/${community.id}/membership`
      ),
      jsonGet<Array<Record<string, unknown>>>(
        reporterPage,
        '/api/privacy/reports'
      ),
    ]);
    const baselinePostSearch = await authorPage.request.post(
      `${origin}/api/social/post/find`,
      {
        headers: { ...headers, 'content-type': 'application/json' },
        data: { criteria: { id: baselinePostId }, opts: { limit: 1 } },
      }
    );
    expect(baselinePostSearch.status(), 'baseline exact-post search').toBe(201);
    const baselinePostSearchBody = await baselinePostSearch.json();
    const baselinePostRows =
      baselinePostSearchBody?.data ?? baselinePostSearchBody;
    const baselinePost = Array.isArray(baselinePostRows)
      ? baselinePostRows[0]
      : undefined;

    const reporterOperatorRead = await reporterPage.request.get(
      `${origin}/api/privacy/operator/reports`,
      { headers }
    );
    const reporterCanReviewReports = reporterOperatorRead.status() === 200;
    const authorOperatorRead = await authorPage.request.get(
      `${origin}/api/privacy/operator/reports`,
      { headers }
    );
    const authorCanReviewReports = authorOperatorRead.status() === 200;
    const adminRoles = admin
      ? await jsonGet<RoleAssignment[]>(
          adminPage,
          `/api/permissions/user-roles/${admin.profileId}?appScope=client-interface`
        )
      : [];
    const ownerConsoleHeaders = {
      'x-ot-app-id': 'owner-console',
      'x-ot-appscope': 'owner-console',
    };
    const ownerConsoleRoles = ownerConsoleSession
      ? await jsonGet<RoleAssignment[]>(
          ownerConsolePage,
          `/api/permissions/user-roles/${ownerConsoleSession.profileId}?appScope=owner-console`,
          ownerConsoleHeaders
        )
      : [];
    const defaultOwnerOperatorRead = admin
      ? await adminPage.request.get(`${origin}/api/privacy/operator/reports`, {
          headers,
        })
      : undefined;
    const defaultOwnerCanReviewReports =
      defaultOwnerOperatorRead?.status() === 200;
    const authorCanAssignRoles = authorRoles.some((assignment) =>
      assignment.role?.permissions?.some(
        (permission) => permission.name === 'users.update'
      )
    );
    const defaultOwnerCanAssignRoles = adminRoles.some((assignment) =>
      assignment.role?.permissions?.some(
        (permission) => permission.name === 'users.update'
      )
    );
    const ownerConsolePermissionRead = ownerConsoleSession
      ? await ownerConsolePage.request.post(
          `${origin}/api/permissions/check-permission`,
          {
            headers: {
              ...ownerConsoleHeaders,
              'content-type': 'application/json',
            },
            data: {
              permission: 'users.update',
              appScope: 'owner-console',
              targetId: ownerConsoleSession.profileId,
            },
          }
        )
      : undefined;
    const ownerConsolePermissionBody = ownerConsolePermissionRead
      ? await ownerConsolePermissionRead.json()
      : null;
    const ownerConsoleScope = await jsonGet<Record<string, unknown>>(
      adminPage,
      '/api/permissions/scope/client-interface'
    );
    const allRoles = await jsonGet<Array<Record<string, unknown>>>(
      adminPage,
      '/api/permissions/role'
    );
    const operatorRole = allRoles.find(
      (role) => role['name'] === 'client_interface_operator'
    );
    let globalOwnerProfile: Record<string, unknown> | undefined;
    let globalOwnerRoleNames: Array<string | null> = [];
    if (admin?.name) {
      const matches = await jsonGet<Array<Record<string, unknown>>>(
        adminPage,
        `/api/profile/search?q=${encodeURIComponent(admin.name)}&limit=25`
      );
      globalOwnerProfile = matches.find(
        (profile) =>
          profile['userId'] === admin.userId &&
          (profile['appScope'] === 'global' || profile['appScope'] == null)
      );
      if (globalOwnerProfile?.['id']) {
        const assignments = await jsonGet<RoleAssignment[]>(
          adminPage,
          `/api/permissions/user-roles/${encodeURIComponent(
            String(globalOwnerProfile['id'])
          )}?appScope=global`
        );
        globalOwnerRoleNames = assignments.map(
          (assignment) => assignment.role?.name ?? null
        );
      }
    }
    const [adminUsersUpdate, adminReportReview] = await Promise.all(
      ['users.update', 'content.report.review'].map(async (permission) => {
        if (!admin) return { status: adminLogin.loginStatus, allowed: false };
        const response = await adminPage.request.post(
          `${origin}/api/permissions/check-permission`,
          {
            headers: { ...headers, 'content-type': 'application/json' },
            data: {
              permission,
              appScope: 'client-interface',
              targetId: admin.profileId,
            },
          }
        );
        const body =
          response.status() === 200 || response.status() === 201
            ? await response.json()
            : null;
        return {
          status: response.status(),
          allowed: body?.data?.allowed ?? body?.data ?? body?.allowed ?? body,
        };
      })
    );

    console.info(
      '[RR09-I09 preflight]',
      JSON.stringify({
        reporterProfileId: reporter.profileId,
        authorProfileId: author.profileId,
        defaultOwnerProfileId: admin?.profileId ?? null,
        ownerConsoleLoginStatus: ownerConsoleLogin.loginStatus,
        defaultOwnerLoginStatus: adminLogin.loginStatus,
        distinctSyntheticProfiles: true,
        reporterMembership,
        authorMembership,
        community: {
          id: community.id,
          slug: community.slug,
          isPrivate: communityRead['isPrivate'],
          memberCount: communityRead['memberCount'],
        },
        baselinePost: baselinePost
          ? {
              id: baselinePostId,
              userId: baselinePost['userId'] ?? null,
              profileId: baselinePost['profileId'] ?? null,
              visibility: baselinePost['visibility'] ?? null,
              communityId: baselinePost['communityId'] ?? null,
            }
          : null,
        baselinePostSearch: {
          status: baselinePostSearch.status(),
          exactMatch: Boolean(baselinePost),
        },
        priorReporterReportCount: Array.isArray(myReports)
          ? myReports.length
          : null,
        reporterRoleNames: reporterRoles.map(
          (assignment) => assignment.role?.name ?? null
        ),
        authorRoleNames: authorRoles.map(
          (assignment) => assignment.role?.name ?? null
        ),
        defaultOwnerRoleNames: adminRoles.map(
          (assignment) => assignment.role?.name ?? null
        ),
        ownerConsoleProfileId: ownerConsoleSession?.profileId ?? null,
        ownerConsoleRoleNames: ownerConsoleRoles.map(
          (assignment) => assignment.role?.name ?? null
        ),
        ownerConsoleUsersUpdate: {
          status:
            ownerConsolePermissionRead?.status() ??
            ownerConsoleLogin.loginStatus,
          allowed:
            ownerConsolePermissionBody?.data?.allowed ??
            ownerConsolePermissionBody?.data ??
            ownerConsolePermissionBody?.allowed ??
            ownerConsolePermissionBody,
        },
        clientInterfaceScopeId: ownerConsoleScope['id'] ?? null,
        clientInterfaceOperatorRoleId: operatorRole?.['id'] ?? null,
        configuredOwnerGlobalProfile: globalOwnerProfile
          ? {
              id: globalOwnerProfile['id'],
              appScope: globalOwnerProfile['appScope'] ?? null,
              namePresent: Boolean(
                globalOwnerProfile['profileName'] ?? globalOwnerProfile['name']
              ),
              nameMatchesAuthenticatedAccount:
                (globalOwnerProfile['profileName'] ??
                  globalOwnerProfile['name']) === admin?.name,
              nameSha256: createHash('sha256')
                .update(
                  String(
                    globalOwnerProfile['profileName'] ??
                      globalOwnerProfile['name'] ??
                      ''
                  )
                )
                .digest('hex'),
              bioPresent: Boolean(globalOwnerProfile['bio']),
              bioSha256: createHash('sha256')
                .update(String(globalOwnerProfile['bio'] ?? ''))
                .digest('hex'),
              globalRoleNames: globalOwnerRoleNames,
            }
          : null,
        reporterCanReviewReports,
        authorCanReviewReports,
        authorCanAssignRoles,
        defaultOwnerCanReviewReports,
        defaultOwnerCanAssignRoles,
        adminUsersUpdate,
        adminReportReview,
      })
    );

    expect(reporter.profileId).toBeTruthy();
    expect(author.profileId).toBeTruthy();
    if (admin) expect(admin.profileId).toBeTruthy();
    expect(communityRead['isPrivate']).toBe(false);
    expect(reporterMembership).toBe(false);
    if (baselinePost) {
      expect(baselinePost['id']).toBe(baselinePostId);
      expect(baselinePost['profileId']).not.toBe(reporter.profileId);
    }
    expect(reporterCanReviewReports).toBe(false);
    expect(reporterOperatorRead.status()).toBe(403);
  } finally {
    await Promise.allSettled([
      reporterContext.close(),
      authorContext.close(),
      adminContext.close(),
      ownerConsoleContext.close(),
    ]);
  }
});
