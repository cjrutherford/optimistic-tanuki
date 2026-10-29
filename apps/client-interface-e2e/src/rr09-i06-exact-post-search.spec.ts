import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const enabled = process.env['RR09_I06_LIVE_STACK'] === 'true';
const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const artifactDirectory = join(
  workspaceRoot,
  '.runtime-artifacts',
  'rr09',
  'i06'
);
const acceptancePath = join(artifactDirectory, 'acceptance.jsonl');
const fixturePath = join(artifactDirectory, 'fixture.jsonl');
const credentialsPath =
  process.env['RR09_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';
const publicBaselinePostId = '296180e0-24b7-4206-894e-9654bc387125';
const communityId = '3bd16edb-3a0e-40c1-b382-f014d0f0bbd6';
const mismatchedCommunityId = '00000000-0000-4000-8000-000000000000';

type ResponseShape = {
  status: number;
  ids: string[];
  metadata: Array<{
    id: string;
    communityId?: string | null;
    appScope?: string | null;
    visibility?: string | null;
  }>;
};

function record(path: string, value: Record<string, unknown>): void {
  mkdirSync(artifactDirectory, { recursive: true, mode: 0o700 });
  appendFileSync(
    path,
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
  chmodSync(path, 0o600);
}

async function jsonFetch(
  page: Page,
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown
): Promise<{ status: number; body: unknown; empty: boolean }> {
  return page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-ot-appscope': 'client-interface',
          'X-ot-app-id': 'client-interface',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      let parsed: unknown = null;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { nonJsonResponse: true };
        }
      }
      return {
        status: response.status,
        body: parsed,
        empty: text.length === 0,
      };
    },
    { path, method, body }
  );
}

async function anonymousFetch(
  request: APIRequestContext,
  path: string,
  method: 'GET' | 'POST',
  body?: unknown
): Promise<{ status: number; body: unknown; empty: boolean }> {
  const response = await request.fetch(`${origin}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-ot-appscope': 'client-interface',
      'X-ot-app-id': 'client-interface',
    },
    ...(body === undefined ? {} : { data: body }),
  });
  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { nonJsonResponse: true };
    }
  }
  return { status: response.status(), body: parsed, empty: text.length === 0 };
}

function unwrap(value: unknown): any {
  const record = value as { data?: unknown } | null;
  return record && typeof record === 'object' && 'data' in record
    ? record.data
    : value;
}

function searchShape(result: { status: number; body: unknown }): ResponseShape {
  const body = unwrap(result.body);
  const rows = Array.isArray(body) ? body : [];
  return {
    status: result.status,
    ids: rows.map((row) => String(row?.id ?? '')),
    metadata: rows.map((row) => ({
      id: String(row?.id ?? ''),
      communityId: row?.communityId ?? null,
      appScope: row?.appScope ?? null,
      visibility: row?.visibility ?? null,
    })),
  };
}

test('RR09-I06 exact post search and visibility acceptance', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  test.skip(
    !enabled,
    'Set RR09_I06_LIVE_STACK=true for the authorized live HTTP probe'
  );

  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });

  const sessionResponse = await jsonFetch(
    page,
    '/api/authentication/session',
    'GET'
  );
  const session = unwrap(sessionResponse.body) as {
    profileId?: string;
    userId?: string;
  };
  expect(sessionResponse.status, 'authenticated existing session').toBe(200);
  expect(session.profileId, 'existing owner profile A').toBe(
    '9319acdf-f9de-454b-91fc-899b9e8a150f'
  );
  const ownerProfileId = session.profileId!;

  const publicDirect = await jsonFetch(
    page,
    `/api/social/post/${publicBaselinePostId}`,
    'GET'
  );
  const publicPost = unwrap(publicDirect.body) as Record<string, unknown>;
  expect(publicDirect.status, 'known retained public baseline read').toBe(200);
  expect(publicPost.id, 'direct response exact baseline identity').toBe(
    publicBaselinePostId
  );
  expect(publicPost.visibility, 'baseline remains public').toBe('public');

  const publicExact = searchShape(
    await jsonFetch(page, '/api/social/post/find', 'POST', {
      criteria: { id: publicBaselinePostId },
      opts: { limit: 1 },
    })
  );
  expect(publicExact.status, 'exact public search HTTP response').toBe(201);
  expect(publicExact.ids, 'exact public search matches direct GET').toEqual([
    publicBaselinePostId,
  ]);
  record(acceptancePath, {
    type: 'public-known-id-search',
    directGetStatus: publicDirect.status,
    searchStatus: publicExact.status,
    expectedId: publicBaselinePostId,
    returnedIds: publicExact.ids,
    metadata: publicExact.metadata,
    limit: 1,
  });

  const anonymousPublic = searchShape(
    await anonymousFetch(request, '/api/social/post/find', 'POST', {
      criteria: { id: publicBaselinePostId },
      opts: { limit: 1 },
    })
  );
  expect(anonymousPublic.status, 'anonymous public exact search').toBe(201);
  expect(anonymousPublic.ids).toEqual([publicBaselinePostId]);
  record(acceptancePath, {
    type: 'anonymous-public-id-search',
    status: anonymousPublic.status,
    expectedId: publicBaselinePostId,
    returnedIds: anonymousPublic.ids,
  });

  const unknownId = randomUUID();
  const unknownSearch = searchShape(
    await jsonFetch(page, '/api/social/post/find', 'POST', {
      criteria: { id: unknownId },
      opts: { limit: 1 },
    })
  );
  expect(unknownSearch.status, 'unknown ID search status').toBe(201);
  expect(unknownSearch.ids, 'unknown ID returns no post').toEqual([]);
  record(acceptancePath, {
    type: 'unknown-id-search',
    status: unknownSearch.status,
    unknownId,
    returnedIds: unknownSearch.ids,
  });

  const membershipResponse = await jsonFetch(
    page,
    `/api/social/community/${communityId}/membership`,
    'GET'
  );
  expect(membershipResponse.status, 'community fixture membership read').toBe(
    200
  );
  expect(
    unwrap(membershipResponse.body),
    'pre-fixture membership is absent'
  ).toBe(false);
  const communityResponse = await jsonFetch(
    page,
    `/api/social/community/${communityId}`,
    'GET'
  );
  const community = unwrap(communityResponse.body) as Record<string, unknown>;
  expect(communityResponse.status, 'existing public community read').toBe(200);
  expect(community.isPrivate, 'fixture community is public').toBe(false);
  const baselineMemberCount = Number(community.memberCount);
  expect(baselineMemberCount).toBe(2);
  const communityBaselineSearch = searchShape(
    await jsonFetch(page, '/api/social/post/find', 'POST', {
      criteria: { communityId },
      opts: { limit: 100 },
    })
  );
  expect(communityBaselineSearch.status).toBe(201);
  const baselineReadableCommunityPostIds = communityBaselineSearch.ids;
  expect(
    baselineReadableCommunityPostIds,
    'pre-fixture nonmember cannot read community posts'
  ).toEqual([]);
  const baselineMembersResponse = await jsonFetch(
    page,
    `/api/social/community/${communityId}/members`,
    'GET'
  );
  const baselineMembers = unwrap(baselineMembersResponse.body);
  expect(baselineMembersResponse.status).toBe(200);
  expect(Array.isArray(baselineMembers)).toBe(true);
  const baselineMemberIds = (baselineMembers as Array<{ id?: string }>)
    .map((member) => member.id ?? '')
    .sort();
  expect(baselineMemberIds).toHaveLength(baselineMemberCount);
  const baselineMemberIdsSha256 = createHash('sha256')
    .update(JSON.stringify(baselineMemberIds))
    .digest('hex');
  record(fixturePath, {
    type: 'fixture-baseline',
    communityId,
    communityPublic: community.isPrivate === false,
    membership: false,
    memberCount: baselineMemberCount,
    membershipIdsSha256: baselineMemberIdsSha256,
    readablePostIds: baselineReadableCommunityPostIds,
    baselineOriginalPostId: '2e2eeab2-7ef7-4b7c-997a-c559cbfd9d2f',
  });

  let joinedFixtureCommunity = false;
  const fixturePostIds: string[] = [];
  let testFailed = false;
  let testError: unknown;
  const cleanupErrors: unknown[] = [];
  const recordCleanup = (value: Record<string, unknown>): void => {
    try {
      record(fixturePath, value);
    } catch (error) {
      cleanupErrors.push(error);
    }
  };
  try {
    const join = await jsonFetch(
      page,
      `/api/social/community/${communityId}/join`,
      'POST',
      {}
    );
    joinedFixtureCommunity = true;
    expect(join.status, 'join existing public community').toBe(201);

    const createFixture = async (
      visibility: 'public' | 'followers',
      inCommunity: boolean
    ): Promise<string> => {
      const title = `RR09-I06 exact lookup ${randomUUID()}`;
      const create = await jsonFetch(page, '/api/social/post', 'POST', {
        title,
        content: `<p>${title}</p>`,
        profileId: ownerProfileId,
        visibility,
        ...(inCommunity ? { communityId } : {}),
        appScope: 'client-interface',
      });
      const createdPost = unwrap(create.body) as Record<string, unknown>;
      const postId = String(createdPost.id ?? '');
      const validPostId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          postId
        );
      if (validPostId) fixturePostIds.push(postId);
      expect(
        create.status,
        `create owned ${visibility} no-attachment fixture`
      ).toBe(201);
      expect(postId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(createdPost.profileId, 'fixture author is existing owner').toBe(
        ownerProfileId
      );
      expect(createdPost.visibility).toBe(visibility);
      expect(createdPost.communityId ?? null).toBe(
        inCommunity ? communityId : null
      );
      record(fixturePath, {
        type: 'fixture-post-created',
        postId,
        profileId: ownerProfileId,
        communityId: inCommunity ? communityId : null,
        appScope: 'client-interface',
        visibility,
        attachmentCount: 0,
        setup:
          'existing authenticated owner profile; existing public community only for public community fixture; no account/profile/community creation',
        titleSha256: await page.evaluate(async (value) => {
          const digest = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(value)
          );
          return Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, '0')
          ).join('');
        }, title),
      });
      return postId;
    };

    const publicCommunityPostId = await createFixture('public', true);
    const privatePostId = await createFixture('followers', false);

    const publicCommunityDirect = await jsonFetch(
      page,
      `/api/social/post/${publicCommunityPostId}`,
      'GET'
    );
    const publicCommunityPost = unwrap(publicCommunityDirect.body) as Record<
      string,
      unknown
    >;
    expect(publicCommunityDirect.status).toBe(200);
    expect(publicCommunityPost.id).toBe(publicCommunityPostId);
    const exactCombined = searchShape(
      await jsonFetch(page, '/api/social/post/find', 'POST', {
        criteria: {
          id: publicCommunityPostId,
          communityId,
          appScope: 'client-interface',
          visibility: 'public',
        },
        opts: { limit: 1 },
      })
    );
    expect(exactCombined.status, 'combined exact criteria response').toBe(201);
    expect(
      exactCombined.ids,
      'combined exact ID/community/scope/audience'
    ).toEqual([publicCommunityPostId]);
    expect(exactCombined.metadata[0]).toMatchObject({
      id: publicCommunityPostId,
      communityId,
      appScope: 'client-interface',
      visibility: 'public',
    });
    record(acceptancePath, {
      type: 'owner-public-combined-id-community-search',
      directGetStatus: publicCommunityDirect.status,
      searchStatus: exactCombined.status,
      expectedId: publicCommunityPostId,
      returnedIds: exactCombined.ids,
      metadata: exactCombined.metadata,
      preservedCriteria: ['communityId', 'appScope', 'visibility'],
    });

    const wrongCommunity = searchShape(
      await jsonFetch(page, '/api/social/post/find', 'POST', {
        criteria: {
          id: publicCommunityPostId,
          communityId: mismatchedCommunityId,
        },
        opts: { limit: 1 },
      })
    );
    expect(wrongCommunity.status).toBe(201);
    expect(
      wrongCommunity.ids,
      'mismatched community rejects exact post'
    ).toEqual([]);
    record(acceptancePath, {
      type: 'mismatched-community-search',
      status: wrongCommunity.status,
      expectedEmpty: true,
      returnedIds: wrongCommunity.ids,
    });

    const wrongScope = searchShape(
      await jsonFetch(page, '/api/social/post/find', 'POST', {
        criteria: { id: publicCommunityPostId, appScope: 'local-hub' },
        opts: { limit: 1 },
      })
    );
    expect(wrongScope.status).toBe(201);
    expect(wrongScope.ids, 'appScope remains an independent criterion').toEqual(
      []
    );

    const privateDirectOwner = await jsonFetch(
      page,
      `/api/social/post/${privatePostId}`,
      'GET'
    );
    const privatePost = unwrap(privateDirectOwner.body) as Record<
      string,
      unknown
    >;
    expect(
      privateDirectOwner.status,
      'owner direct read of private fixture'
    ).toBe(200);
    expect(privatePost.id, 'owner direct GET identifies private fixture').toBe(
      privatePostId
    );
    const privateOwnerSearch = searchShape(
      await jsonFetch(page, '/api/social/post/find', 'POST', {
        criteria: {
          id: privatePostId,
          appScope: 'client-interface',
          visibility: 'followers',
        },
        opts: { limit: 1 },
      })
    );
    expect(privateOwnerSearch.status).toBe(201);
    expect(privateOwnerSearch.ids).toEqual([privatePostId]);
    const wrongVisibility = searchShape(
      await jsonFetch(page, '/api/social/post/find', 'POST', {
        criteria: { id: privatePostId, visibility: 'public' },
        opts: { limit: 1 },
      })
    );
    expect(wrongVisibility.status).toBe(201);
    expect(
      wrongVisibility.ids,
      'visibility remains an independent criterion'
    ).toEqual([]);

    const anonymousPrivateSearch = searchShape(
      await anonymousFetch(request, '/api/social/post/find', 'POST', {
        criteria: { id: privatePostId },
        opts: { limit: 1 },
      })
    );
    expect(anonymousPrivateSearch.status, 'anonymous exact search status').toBe(
      201
    );
    expect(
      anonymousPrivateSearch.ids,
      'anonymous exact search does not disclose private fixture'
    ).toEqual([]);
    const anonymousPrivateDirect = await anonymousFetch(
      request,
      `/api/social/post/${privatePostId}/shared`,
      'GET'
    );
    const anonymousPrivatePost = unwrap(anonymousPrivateDirect.body) as Record<
      string,
      unknown
    > | null;
    expect(
      anonymousPrivatePost?.id,
      'anonymous shared-post GET does not disclose private fixture'
    ).not.toBe(privatePostId);
    record(acceptancePath, {
      type: 'anonymous-private-id-denial',
      ownerDirectGetStatus: privateDirectOwner.status,
      ownerSearchStatus: privateOwnerSearch.status,
      ownerSearchIds: privateOwnerSearch.ids,
      anonymousSearchStatus: anonymousPrivateSearch.status,
      anonymousSearchReturnedIds: anonymousPrivateSearch.ids,
      anonymousSharedGetStatus: anonymousPrivateDirect.status,
      anonymousSharedGetEmpty: anonymousPrivateDirect.empty,
      anonymousSharedGetReturnedPrivateId:
        anonymousPrivatePost?.id === privatePostId,
    });
  } catch (error) {
    testFailed = true;
    testError = error;
  } finally {
    for (const fixturePostId of [...fixturePostIds].reverse()) {
      try {
        const deletion = await jsonFetch(
          page,
          `/api/social/post/${fixturePostId}`,
          'DELETE'
        );
        const tombstone = await jsonFetch(
          page,
          `/api/social/post/${fixturePostId}`,
          'GET'
        );
        const tombstoneBody = unwrap(tombstone.body) as Record<
          string,
          unknown
        > | null;
        const absentSearch = searchShape(
          await jsonFetch(page, '/api/social/post/find', 'POST', {
            criteria: { id: fixturePostId },
            opts: { limit: 1 },
          })
        );
        expect(
          absentSearch.ids,
          'deleted fixture absent from exact search'
        ).toEqual([]);
        recordCleanup({
          type: 'fixture-cleanup-post',
          postId: fixturePostId,
          deleteStatus: deletion.status,
          tombstoneStatus: tombstone.status,
          tombstoneEmpty: tombstone.empty,
          tombstoneReturnedFixture: tombstoneBody?.id === fixturePostId,
          exactSearchStatus: absentSearch.status,
          exactSearchAbsent: absentSearch.ids.length === 0,
        });
        expect(deletion.status, 'delete exact fixture through owner API').toBe(
          200
        );
        expect(
          tombstoneBody?.id,
          'deleted exact fixture is absent on owner readback'
        ).not.toBe(fixturePostId);
      } catch (error) {
        cleanupErrors.push(error);
        recordCleanup({
          type: 'fixture-cleanup-post-failure',
          postId: fixturePostId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (joinedFixtureCommunity) {
      try {
        const leave = await jsonFetch(
          page,
          `/api/social/community/${communityId}/leave`,
          'POST',
          {}
        );
        const membershipAfter = await jsonFetch(
          page,
          `/api/social/community/${communityId}/membership`,
          'GET'
        );
        const communityAfterResponse = await jsonFetch(
          page,
          `/api/social/community/${communityId}`,
          'GET'
        );
        const communityAfter = unwrap(communityAfterResponse.body) as Record<
          string,
          unknown
        >;
        const membershipRestored = unwrap(membershipAfter.body) === false;
        const membersAfterResponse = await jsonFetch(
          page,
          `/api/social/community/${communityId}/members`,
          'GET'
        );
        const membersAfter = unwrap(membersAfterResponse.body);
        const memberIdsAfter = Array.isArray(membersAfter)
          ? (membersAfter as Array<{ id?: string }>)
              .map((member) => member.id ?? '')
              .sort()
          : [];
        const memberIdsAfterSha256 = createHash('sha256')
          .update(JSON.stringify(memberIdsAfter))
          .digest('hex');
        const memberIdsRestored =
          membersAfterResponse.status === 200 &&
          memberIdsAfterSha256 === baselineMemberIdsSha256;
        const communityPostsAfter = searchShape(
          await jsonFetch(page, '/api/social/post/find', 'POST', {
            criteria: { communityId },
            opts: { limit: 100 },
          })
        );
        const readableRowsRestored =
          JSON.stringify(communityPostsAfter.ids) ===
          JSON.stringify(baselineReadableCommunityPostIds);
        recordCleanup({
          type: 'fixture-cleanup-membership',
          communityId,
          leaveStatus: leave.status,
          membershipReadbackStatus: membershipAfter.status,
          membershipRestored,
          membersReadbackStatus: membersAfterResponse.status,
          memberIdsSha256Before: baselineMemberIdsSha256,
          memberIdsSha256After: memberIdsAfterSha256,
          memberIdsRestored,
          communityReadbackStatus: communityAfterResponse.status,
          memberCountBefore: baselineMemberCount,
          memberCountAfter: communityAfter.memberCount,
          communityStillPublic: communityAfter.isPrivate === false,
          communityPostSearchStatus: communityPostsAfter.status,
          readablePostIdsBefore: baselineReadableCommunityPostIds,
          readablePostIdsAfter: communityPostsAfter.ids,
          readableRowsRestored,
        });
        expect(leave.status, 'restore pre-fixture membership').toBe(201);
        expect(membershipAfter.status).toBe(200);
        expect(membershipRestored).toBe(true);
        expect(communityAfterResponse.status).toBe(200);
        expect(communityAfter.memberCount).toBe(baselineMemberCount);
        expect(memberIdsRestored).toBe(true);
        expect(readableRowsRestored).toBe(true);
      } catch (error) {
        cleanupErrors.push(error);
        recordCleanup({
          type: 'fixture-cleanup-membership-failure',
          communityId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  recordCleanup({
    type: 'fixture-cleanup-complete',
    fixturePostIds,
    joinedFixtureCommunity,
    cleanupFailureCount: cleanupErrors.length,
    cleanupFailures: cleanupErrors.map((error) =>
      error instanceof Error ? error.message : String(error)
    ),
    testBodyFailed: testFailed,
  });
  if (testFailed) throw testError;
  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, 'I06 fixture cleanup failed');
  }
});
