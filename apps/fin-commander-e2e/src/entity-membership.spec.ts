import {
  test,
  expect,
  createTestUser,
  loginTestUser,
} from './fixtures/fin-commander.fixture';

async function createFinanceProfile(
  apiContext: Parameters<typeof createTestUser>[0],
  user: { id: string; token?: string; username: string }
) {
  const response = await apiContext.post('/api/profile', {
    headers: { authorization: `Bearer ${user.token}` },
    data: {
      name: user.username,
      description: 'Fin Commander membership matrix user',
      userId: user.id,
      profilePic: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
    },
    failOnStatusCode: false,
  });

  expect(response.ok(), `profile creation returned ${response.status()}`).toBe(
    true
  );
  const data = await response.json();
  return {
    id: data.profile?.id || data.id,
    token: data.newToken || user.token,
  };
}

async function financeRequest(
  apiContext: Parameters<typeof createTestUser>[0],
  token: string | undefined,
  tenantId?: string
) {
  return {
    post: (path: string, data: unknown) =>
      apiContext.post(path, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-ot-appscope': 'finance',
          ...(tenantId ? { 'x-finance-tenant-id': tenantId } : {}),
        },
        data,
        failOnStatusCode: false,
      }),
    get: (path: string) =>
      apiContext.get(path, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-ot-appscope': 'finance',
          ...(tenantId ? { 'x-finance-tenant-id': tenantId } : {}),
        },
        failOnStatusCode: false,
      }),
    delete: (path: string) =>
      apiContext.delete(path, {
        headers: {
          authorization: `Bearer ${token}`,
          'x-ot-appscope': 'finance',
          ...(tenantId ? { 'x-finance-tenant-id': tenantId } : {}),
        },
        failOnStatusCode: false,
      }),
  };
}

async function exchangeForFinance(
  apiContext: Parameters<typeof createTestUser>[0],
  token: string | undefined
) {
  const response = await apiContext.post('/api/authentication/exchange', {
    headers: { authorization: `Bearer ${token}` },
    data: { targetAppId: 'finance' },
    failOnStatusCode: false,
  });
  expect(
    response.ok(),
    `finance token exchange returned ${response.status()}: ${await response.text()}`
  ).toBe(true);
  const data = await response.json();
  return { id: data.profileId as string, token: data.token as string };
}

test.describe('entity membership role isolation', () => {
  test('models the five-account owner, admin, member, revoked, and unrelated matrix', async ({
    apiContext,
  }) => {
    const roles = ['owner', 'admin', 'member', 'revoked', 'unrelated'] as const;
    const suffix = Date.now();
    const users = await Promise.all(
      roles.map((role) =>
        createTestUser(apiContext, {
          email: `fc-${role}-${suffix}@example.com`,
          username: `fc-${role}-${suffix}`,
        })
      )
    );
    await Promise.all(users.map((user) => loginTestUser(apiContext, user)));

    expect(users).toHaveLength(5);
    expect(new Set(users.map((user) => user.email)).size).toBe(5);
    expect(users.every((user) => Boolean(user.id))).toBe(true);
    expect(users.every((user) => Boolean(user.token))).toBe(true);

    await Promise.all(
      users.map((user) => createFinanceProfile(apiContext, user))
    );
    const profiles = await Promise.all(
      users.map((user) => exchangeForFinance(apiContext, user.token))
    );
    expect(
      profiles.every((profile) => Boolean(profile.id && profile.token))
    ).toBe(true);

    const ownerApi = await financeRequest(apiContext, profiles[0].token);
    const createTenantResponse = await ownerApi.post('/api/finance/tenant', {
      name: `Five User Matrix ${suffix}`,
      type: 'household',
    });
    expect(createTenantResponse.ok()).toBe(true);
    const tenant = await createTenantResponse.json();
    expect(
      tenant.id,
      `tenant response: ${JSON.stringify(tenant)}`
    ).toBeTruthy();

    const ownerTenantApi = await financeRequest(
      apiContext,
      profiles[0].token,
      tenant.id
    );
    const currentTenantResponse = await ownerTenantApi.get(
      '/api/finance/tenant/current'
    );
    expect(
      currentTenantResponse.ok(),
      `current tenant response: ${await currentTenantResponse.text()}`
    ).toBe(true);
    const addAdminResponse = await ownerTenantApi.post(
      '/api/finance/tenant/members',
      { memberProfileId: profiles[1].id, role: 'finance_admin' }
    );
    expect(
      addAdminResponse.status(),
      `add admin response: ${await addAdminResponse.text()}`
    ).toBe(201);
    const adminMembership = await addAdminResponse.json();

    const addMemberResponse = await ownerTenantApi.post(
      '/api/finance/tenant/members',
      { memberProfileId: profiles[2].id, role: 'finance_member' }
    );
    expect(
      addMemberResponse.status(),
      `add member response: ${await addMemberResponse.text()}`
    ).toBe(201);

    const addRevokedResponse = await ownerTenantApi.post(
      '/api/finance/tenant/members',
      { memberProfileId: profiles[3].id, role: 'finance_member' }
    );
    expect(
      addRevokedResponse.status(),
      `add revoked response: ${await addRevokedResponse.text()}`
    ).toBe(201);
    const revokedMembership = await addRevokedResponse.json();

    const membershipsResponse = await ownerTenantApi.get(
      '/api/finance/tenant/members'
    );
    expect(membershipsResponse.status()).toBe(200);
    const memberships = await membershipsResponse.json();
    expect(memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: profiles[0].id,
          role: 'finance_admin',
        }),
        expect.objectContaining({
          id: adminMembership.id,
          profileId: profiles[1].id,
          role: 'finance_admin',
        }),
        expect.objectContaining({
          profileId: profiles[2].id,
          role: 'finance_member',
        }),
        expect.objectContaining({
          id: revokedMembership.id,
          profileId: profiles[3].id,
          role: 'finance_member',
        }),
      ])
    );

    const adminTenantApi = await financeRequest(
      apiContext,
      profiles[1].token,
      tenant.id
    );
    const memberTenantApi = await financeRequest(
      apiContext,
      profiles[2].token,
      tenant.id
    );
    const revokedTenantApi = await financeRequest(
      apiContext,
      profiles[3].token,
      tenant.id
    );
    const unrelatedTenantApi = await financeRequest(
      apiContext,
      profiles[4].token,
      tenant.id
    );

    expect(
      (await adminTenantApi.get('/api/finance/tenant/current')).status()
    ).toBe(200);
    expect(
      (await memberTenantApi.get('/api/finance/tenant/current')).status()
    ).toBe(200);
    expect(
      (await unrelatedTenantApi.get('/api/finance/tenant/current')).status()
    ).toBe(404);

    const nonOwnerMutation = await memberTenantApi.post(
      '/api/finance/tenant/members',
      {
        memberProfileId: profiles[4].id,
        role: 'finance_member',
      }
    );
    expect(nonOwnerMutation.status()).toBe(404);

    const revokeResponse = await ownerTenantApi.delete(
      `/api/finance/tenant/members/${revokedMembership.id}`
    );
    expect(
      revokeResponse.status(),
      `revoke response: ${await revokeResponse.text()}`
    ).toBe(200);
    expect(
      (await revokedTenantApi.get('/api/finance/tenant/current')).status()
    ).toBe(404);
  });
});
