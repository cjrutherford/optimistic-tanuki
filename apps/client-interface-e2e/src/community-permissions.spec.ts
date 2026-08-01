import { APIRequestContext, expect, test } from '@playwright/test';

const PASSWORD = 'Password123!';
const APP_HEADERS = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'client-interface',
};
const SOCIAL_HEADERS = {
  'x-ot-app-id': 'client-interface',
  'x-ot-appscope': 'social',
};

function uniqueEmail(role: string): string {
  return `community-${role}-${Date.now()}-${Math.floor(
    Math.random() * 1_000_000
  )}@example.test`;
}

type AuthenticatedUser = {
  token: string;
  profileId: string;
};

function profileIdFromToken(token: string): string {
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
  );
  expect(payload.profileId).toEqual(expect.any(String));
  return payload.profileId;
}

async function registerAndLogin(
  request: APIRequestContext,
  role: string
): Promise<AuthenticatedUser> {
  const email = uniqueEmail(role);
  const register = await request.post('/api/authentication/register', {
    headers: APP_HEADERS,
    data: {
      email,
      fn: role,
      ln: 'Community',
      password: PASSWORD,
      confirm: PASSWORD,
      bio: 'Community permissions test participant',
    },
  });
  expect(register.status()).toBe(201);

  const login = await request.post('/api/authentication/login', {
    headers: APP_HEADERS,
    data: { email, password: PASSWORD },
  });
  expect(login.status()).toBe(201);
  const payload = await login.json();
  const token = payload?.data?.newToken;
  expect(token).toEqual(expect.any(String));
  return { token, profileId: profileIdFromToken(token) };
}

function authenticatedHeaders(token: string, scope = APP_HEADERS) {
  return { ...scope, Authorization: `Bearer ${token}` };
}

test.describe('Community permissions', () => {
  test.setTimeout(180000);

  test('contains posts and reactions to approved community members', async ({
    request,
  }) => {
    const owner = await registerAndLogin(request, 'owner');
    const member = await registerAndLogin(request, 'member');
    const outsider = await registerAndLogin(request, 'outsider');

    const createCommunity = await request.post('/api/social/community', {
      headers: authenticatedHeaders(owner.token),
      data: {
        name: `Permission community ${Date.now()}`,
        slug: `permission-community-${Date.now()}`,
        description: 'Deterministic community authorization fixture',
        isPrivate: false,
        joinPolicy: 'public',
        localityType: 'city',
        countryCode: 'US',
        adminArea: 'New York',
        city: 'New York',
      },
    });
    expect(createCommunity.status()).toBe(201);
    const community = await createCommunity.json();
    expect(community.id).toEqual(expect.any(String));

    const outsiderPost = await request.post('/api/social/post', {
      headers: authenticatedHeaders(outsider.token, SOCIAL_HEADERS),
      data: {
        title: 'Outsider post',
        content: 'This must be rejected.',
        profileId: outsider.profileId,
        communityId: community.id,
      },
    });
    expect(outsiderPost.status()).toBeGreaterThanOrEqual(400);

    const join = await request.post(
      `/api/social/community/${community.id}/join`,
      {
        headers: authenticatedHeaders(member.token),
      }
    );
    expect(join.status()).toBe(201);

    const memberPost = await request.post('/api/social/post', {
      headers: authenticatedHeaders(member.token, SOCIAL_HEADERS),
      data: {
        title: 'Member post',
        content: 'This is allowed.',
        profileId: member.profileId,
        communityId: community.id,
      },
    });
    expect(memberPost.status(), await memberPost.text()).toBe(201);

    const memberPostBody = await memberPost.json();
    expect(memberPostBody.id).toEqual(expect.any(String));

    const outsiderReaction = await request.post('/api/social/reaction', {
      headers: authenticatedHeaders(outsider.token, SOCIAL_HEADERS),
      data: {
        value: 1,
        postId: memberPostBody.id,
        profileId: outsider.profileId,
      },
    });
    expect(outsiderReaction.status()).toBeGreaterThanOrEqual(400);
  });
});
