import axios, { AxiosInstance } from 'axios';

type Identity = {
  userId: string;
  profileId: string;
  token: string;
};

function decodeJwtPayload(token: string): { profileId: string } {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

describe('Workspace governance fixture', () => {
  jest.setTimeout(90_000);

  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const suffix = `${Date.now()}`;
  const headers = {
    'x-ot-appscope': 'client-interface',
    'x-ot-app-id': 'client-interface',
  };
  const anonymous = axios.create({
    baseURL: `${baseURL}/api`,
    headers,
    validateStatus: () => true,
  });

  let ownerA: Identity;
  let ownerB: Identity;
  let activeMember: Identity;
  let moderator: Identity;
  let ownerACommunityId: string;
  let ownerBCommunityId: string;

  function authenticated(identity: Identity): AxiosInstance {
    return axios.create({
      baseURL: `${baseURL}/api`,
      headers: { ...headers, Authorization: `Bearer ${identity.token}` },
      validateStatus: () => true,
    });
  }

  async function registerIdentity(role: string): Promise<Identity> {
    const email = `g19-${role}-${suffix}@example.com`;
    const password = 'Test@Password123';
    const registration = await anonymous.post('/authentication/register', {
      email,
      fn: `G19 ${role}`,
      ln: 'Fixture',
      password,
      confirm: password,
      bio: 'G19 isolated governance fixture',
    });
    expect(registration.status).toBe(201);

    const login = await anonymous.post('/authentication/login', {
      email,
      password,
    });
    expect(login.status).toBe(201);
    const token = login.data.data.newToken as string;
    return {
      userId: registration.data.data.user.id,
      profileId: decodeJwtPayload(token).profileId,
      token,
    };
  }

  async function createCommunity(
    owner: Identity,
    tenant: string
  ): Promise<string> {
    const response = await authenticated(owner).post('/communities', {
      name: `G19 ${tenant} ${suffix}`,
      slug: `g19-${tenant.toLowerCase()}-${suffix}`,
      description: 'Isolated G19 governance fixture community',
      isPrivate: false,
      joinPolicy: 'public',
      localityType: 'city',
      countryCode: 'US',
    });
    expect(response.status).toBe(201);
    expect(response.data.id).toEqual(expect.any(String));
    return response.data.id;
  }

  it('provisions isolated owner, member, moderator, anonymous, and second-tenant identities', async () => {
    [ownerA, ownerB, activeMember, moderator] = await Promise.all([
      registerIdentity('owner-a'),
      registerIdentity('owner-b'),
      registerIdentity('member-a'),
      registerIdentity('moderator-a'),
    ]);

    ownerACommunityId = await createCommunity(ownerA, 'Tenant A');
    ownerBCommunityId = await createCommunity(ownerB, 'Tenant B');
    expect(ownerACommunityId).not.toBe(ownerBCommunityId);

    for (const identity of [activeMember, moderator]) {
      const joined = await authenticated(identity).post(
        `/communities/${ownerACommunityId}/join`
      );
      expect(joined.status).toBe(201);
    }

    const appoint = await authenticated(ownerA).post(
      `/communities/${ownerACommunityId}/manager`,
      {
        userId: moderator.userId,
        profileId: moderator.profileId,
      }
    );
    expect(appoint.status).toBe(201);

    expect(anonymous.defaults.headers.common['Authorization']).toBeUndefined();
  });

  it('denies cross-tenant management and exposes only workspace-scoped reports to a moderator', async () => {
    const crossTenantAppointment = await authenticated(ownerB).post(
      `/communities/${ownerACommunityId}/manager`,
      {
        userId: activeMember.userId,
        profileId: activeMember.profileId,
      }
    );
    expect(crossTenantAppointment.status).toBe(403);

    const communityReport = await authenticated(activeMember).post(
      '/privacy/report',
      {
        contentType: 'community',
        contentId: ownerACommunityId,
        reason: 'spam',
      }
    );
    expect(communityReport.status).toBe(201);

    const appReport = await authenticated(activeMember).post(
      '/privacy/report',
      {
        contentType: 'profile',
        contentId: ownerB.profileId,
        reason: 'spam',
      }
    );
    expect(appReport.status).toBe(201);

    const myReports = await authenticated(activeMember).get('/privacy/reports');
    expect(myReports.status).toBe(200);
    expect(myReports.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: communityReport.data.id,
          workspaceId: expect.any(String),
        }),
        expect.objectContaining({ id: appReport.data.id, workspaceId: null }),
      ])
    );

    const moderatorReports = await authenticated(moderator).get(
      '/privacy/admin/reports',
      { params: { communityId: ownerACommunityId } }
    );
    expect(moderatorReports.status).toBe(200);
    expect(moderatorReports.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: communityReport.data.id }),
      ])
    );
    expect(moderatorReports.data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: appReport.data.id }),
      ])
    );

    const workspaceDecision = await authenticated(moderator).put(
      `/privacy/admin/reports/${communityReport.data.id}`,
      { status: 'reviewed', adminNotes: 'reviewed in tenant A' },
      { params: { communityId: ownerACommunityId } }
    );
    expect(workspaceDecision.status).toBe(200);
    expect(workspaceDecision.data).toEqual(
      expect.objectContaining({
        id: communityReport.data.id,
        status: 'reviewed',
      })
    );

    const crossWorkspaceDecision = await authenticated(moderator).put(
      `/privacy/admin/reports/${appReport.data.id}`,
      { status: 'reviewed', adminNotes: 'must not cross workspace boundary' },
      { params: { communityId: ownerACommunityId } }
    );
    expect(crossWorkspaceDecision.status).toBe(404);
  });
});
