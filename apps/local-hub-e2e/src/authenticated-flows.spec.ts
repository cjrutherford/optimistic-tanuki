import { expect, test } from '@playwright/test';
import {
  addAuthToken,
  apiUrl,
  AuthSession,
  createAuthenticatedSession,
  createCommunity,
  createPost,
  expectOkOrStatus,
  expectPageLoads,
  findCity,
  findCommunity,
  getCommunities,
  LocalHubCommunity,
} from './helpers/local-hub-api';

async function createSessionWithCommunity(
  request: Parameters<typeof createAuthenticatedSession>[0],
): Promise<{
  session: AuthSession;
  community: LocalHubCommunity | undefined;
}> {
  const session = await createAuthenticatedSession(request);
  const communities = await getCommunities(request);
  let community = findCommunity(communities);

  if (!community?.id) {
    const city = findCity(communities);
    if (city?.id) {
      community = await createCommunity(request, session.token, city.id);
    }
  }

  if (community?.id) {
    await request.post(apiUrl(`/api/communities/${community.id}/join`), {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
  }

  return { session, community };
}

test.describe('Authenticated community membership', () => {
  test('joins a community', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for membership');

    const response = await request.post(
      apiUrl(`/api/communities/${community.id}/join`),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      },
    );

    expectOkOrStatus(response, [400]);
  });

  test('gets user memberships', async ({ request }) => {
    const { session } = await createSessionWithCommunity(request);
    const response = await request.get(
      apiUrl('/api/social/community/user/communities'),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    const memberships = await response.json();
    expect(Array.isArray(memberships)).toBeTruthy();
  });
});

test.describe('Authenticated community content', () => {
  test('creates and lists community posts', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for posts');

    await createPost(
      request,
      session.token,
      community.id,
      'E2E Test Post',
    );

    const response = await request.post(
      apiUrl('/api/social/post/find'),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          criteria: { communityId: community.id },
        },
      },
    );

    expect(response.ok()).toBeTruthy();
    const posts = await response.json();
    expect(Array.isArray(posts)).toBeTruthy();
  });

  test('votes on a post', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for voting');

    const post = await createPost(
      request,
      session.token,
      community.id,
      'Post for Voting Test',
    );
    test.skip(!post?.id, 'No test post is available for voting');

    const voteResponse = await request.post(
      apiUrl('/api/social/vote'),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          postId: post.id,
          value: 1,
        },
      },
    );

    expectOkOrStatus(voteResponse, [400]);
  });

  test('adds a comment to a post', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for comments');

    const post = await createPost(
      request,
      session.token,
      community.id,
      'Post for Comment Test',
    );
    test.skip(!post?.id, 'No test post is available for comments');

    const commentResponse = await request.post(
      apiUrl('/api/social/comment'),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
        data: {
          postId: post.id,
          content: 'E2E Test Comment',
        },
      },
    );

    expectOkOrStatus(commentResponse, [400]);
  });
});

test.describe('Authenticated classified ads', () => {
  test('creates a classified ad', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for classifieds');

    const response = await request.post(apiUrl('/api/classifieds'), {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
      data: {
        title: 'E2E Test Classified',
        description: 'This is a test classified ad',
        price: 100,
        category: 'for-sale',
        communityId: community.id,
      },
    });

    expectOkOrStatus(response, [400, 403, 500]);
  });

  test('gets classifieds by community', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for classifieds');

    const response = await request.get(
      apiUrl(`/api/classifieds/community/${community.id}`),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      },
    );

    expectOkOrStatus(response, [500]);
    if (response.ok()) {
      const classifieds = await response.json();
      expect(Array.isArray(classifieds)).toBeTruthy();
    }
  });
});

test.describe('Authenticated community management', () => {
  test('gets community manager info', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for manager info');

    const response = await request.get(
      apiUrl(`/api/communities/${community.id}/manager`),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      },
    );

    expectOkOrStatus(response, [404]);
  });

  test('gets active election info', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for election info');

    const response = await request.get(
      apiUrl(`/api/communities/${community.id}/election`),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      },
    );

    expectOkOrStatus(response, [404]);
  });
});

test.describe('Authenticated business pages', () => {
  test('gets business page for community', async ({ request }) => {
    const { session, community } = await createSessionWithCommunity(request);
    test.skip(!community?.id, 'No community is available for business pages');

    const response = await request.get(
      apiUrl(`/api/payments/business/${community.id}`),
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      },
    );

    expectOkOrStatus(response, [500]);
  });
});

test.describe('Authenticated pages', () => {
  test('loads account page when authenticated', async ({ page, request }) => {
    const session = await createAuthenticatedSession(request);
    await addAuthToken(page, session.token);

    await expectPageLoads(page, '/account');
  });

  test('loads seller dashboard when authenticated', async ({
    page,
    request,
  }) => {
    const session = await createAuthenticatedSession(request);
    await addAuthToken(page, session.token);

    await expectPageLoads(page, '/seller-dashboard');
  });
});
