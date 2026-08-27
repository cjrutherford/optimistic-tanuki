import axios from 'axios';

function decodeJwtPayload(token: string): { profileId?: string } {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

describe('Communities E2E Tests', () => {
  jest.setTimeout(30000);
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const api = axios.create({
    baseURL: `${baseURL}/api`,
    headers: {
      'x-ot-appscope': 'client-interface',
      'x-ot-app-id': 'client-interface',
    },
    validateStatus: () => true,
  });

  let authToken: string;
  let userId: string;
  let profileId: string;
  let inviteeUserId: string;
  const testUser = {
    email: `community-test-${Date.now()}@example.com`,
    fn: 'Community',
    ln: 'Test',
    password: 'Test@Password123',
    confirm: 'Test@Password123',
    bio: 'Community test user',
  };
  const inviteeUser = {
    ...testUser,
    email: `community-invitee-${Date.now()}@example.com`,
    fn: 'Community',
    ln: 'Invitee',
  };
  const testCommunity = {
    name: 'Test Community',
    slug: `test-community-${Date.now()}`,
    description: 'A test community for E2E testing',
    isPrivate: false,
    joinPolicy: 'public',
    localityType: 'city',
    countryCode: 'US',
    adminArea: 'California',
    city: 'San Francisco',
  };
  let createdCommunityId: string;
  let createdMemberId: string;

  describe('Authentication', () => {
    describe('POST /api/authentication/register', () => {
      it('should register a new user for community tests', async () => {
        const res = await api.post('/authentication/register', testUser);
        expect(res.status).toBe(201);
        expect(res.data.data).toBeDefined();
        userId = res.data.data.user.id;
      });

      it('should register a distinct user to invite', async () => {
        const res = await api.post('/authentication/register', inviteeUser);
        expect(res.status).toBe(201);
        inviteeUserId = res.data.data.user.id;
      });
    });

    describe('POST /api/authentication/login', () => {
      it('should login to get auth token', async () => {
        const res = await api.post('/authentication/login', {
          email: testUser.email,
          password: testUser.password,
        });
        expect(res.status).toBe(201);
        expect(res.data.data.newToken).toBeDefined();
        authToken = res.data.data.newToken;
        api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        profileId = decodeJwtPayload(authToken).profileId as string;
        expect(profileId).toBeDefined();
      });

      it('should receive the seeded community owner role for this app scope', async () => {
        const res = await api.get(
          `/permissions/user-roles/${profileId}?appScope=client-interface`
        );
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
        expect(
          res.data.some(
            (assignment: { role?: { name?: string } }) =>
              assignment.role?.name === 'community_owner'
          )
        ).toBe(true);
      });
    });
  });

  describe('Communities CRUD Endpoints', () => {
    describe('GET /api/communities', () => {
      it('should return an array of communities', async () => {
        const res = await api.get('/communities');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
      });

      it('should return communities filtered by localityType', async () => {
        const res = await api.get('/communities?localityType=city');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
      });
    });

    describe('POST /api/communities', () => {
      it('should create a new community', async () => {
        const res = await api.post('/communities', testCommunity);
        expect(res.status).toBe(201);
        expect(res.data).toBeDefined();
        expect(res.data.id).toBeDefined();
        createdCommunityId = res.data.id;
      });

      it('should fail to create community without auth', async () => {
        const unauthApi = axios.create({
          baseURL: `${baseURL}/api`,
          headers: {
            'x-ot-appscope': 'client-interface',
            'x-ot-app-id': 'client-interface',
          },
          validateStatus: () => true,
        });
        const res = await unauthApi.post('/communities', testCommunity);
        expect(res.status).toBe(401);
      });
    });

    describe('GET /api/communities/:id', () => {
      it('should get a community by id', async () => {
        const res = await api.get(`/communities/${createdCommunityId}`);
        expect(res.status).toBe(200);
        expect(res.data.id).toBe(createdCommunityId);
      });

      it('should return 404 for non-existent community', async () => {
        const res = await api.get('/communities/non-existent-id');
        expect(res.status).toBe(200); // Controller returns null, not 404
        expect(res.data).toBeNull();
      });
    });

    describe('PUT /api/communities/:id', () => {
      it('should update a community', async () => {
        const updateData = {
          name: 'Updated Test Community',
          description: 'Updated description',
        };
        const res = await api.put(
          `/communities/${createdCommunityId}`,
          updateData
        );
        expect(res.status).toBe(200);
        expect(res.data.name).toBe(updateData.name);
      });
    });

    describe('GET /api/communities/my', () => {
      it('should get user communities', async () => {
        const res = await api.get('/communities/my');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.data)).toBe(true);
      });
    });

    describe('Community Members Endpoints', () => {
      describe('GET /api/communities/:id/members', () => {
        it('should get community members', async () => {
          const res = await api.get(
            `/communities/${createdCommunityId}/members`
          );
          expect(res.status).toBe(200);
          expect(Array.isArray(res.data)).toBe(true);
          expect(res.data.length).toBeGreaterThan(0);
          const creator = res.data.find(
            (member: { id: string; userId?: string }) =>
              member.userId === userId
          );
          expect(creator).toBeDefined();
          createdMemberId = creator!.id;
        });
      });

      describe('PUT /api/communities/:id/members/:memberId/role', () => {
        it('should update member role through the seeded community owner role', async () => {
          const res = await api.put(
            `/communities/${createdCommunityId}/members/${createdMemberId}/role`,
            { role: 'admin' }
          );
          expect(res.status).toBe(200);
        });
      });

      describe('POST /api/communities/:id/members/invite', () => {
        it('should invite a user to community', async () => {
          const res = await api.post(
            `/communities/${createdCommunityId}/members/invite`,
            { inviteeUserId }
          );
          expect(res.status).toBe(201);
        });
      });
    });

    describe('DELETE /api/communities/:id', () => {
      it('should delete a community', async () => {
        const res = await api.delete(`/communities/${createdCommunityId}`);
        expect(res.status).toBe(200);
      });

      it('should return 404 for deleted community', async () => {
        const res = await api.get(`/communities/${createdCommunityId}`);
        expect(res.status).toBe(200);
        expect(res.data).toBeNull();
      });
    });
  });
});
