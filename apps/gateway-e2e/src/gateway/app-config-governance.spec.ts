import axios, { AxiosInstance } from 'axios';
import {
  createAppConfigGovernanceFixture,
  type AppConfigGovernanceFixture,
} from '../support/app-config-governance-fixture';

describe('P3.3 app-config governance', () => {
  jest.setTimeout(110_000);

  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  let fixture: AppConfigGovernanceFixture;

  beforeAll(async () => {
    fixture = await createAppConfigGovernanceFixture(baseURL);
  });

  beforeEach(async () => {
    await fixture.reset();
  });

  afterAll(async () => {
    await fixture?.cleanup();
  });

  function expectDenied(response: { status: number }): void {
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  }

  function authenticated(identity: 'owner' | 'foreign'): AxiosInstance {
    return fixture.apiFor(fixture[identity]);
  }

  it('allows an active owner to read only the canonical workspace configuration', async () => {
    const response = await authenticated('owner').get('/app-config', {
      params: { workspaceSlug: fixture.workspace.slug },
    });

    expect(response.status).toBe(200);
    expect(response.data).toEqual([
      expect.objectContaining({
        id: fixture.configuration.id,
        workspaceId: fixture.workspace.id,
        appInstanceId: fixture.appInstance.id,
        ownerUserId: fixture.owner.userId,
        ownerProfileId: fixture.owner.profileId,
        appScope: 'business-site',
      }),
    ]);
  });

  it('denies an unauthenticated app-config request', async () => {
    const response = await fixture.anonymous.get('/app-config', {
      params: { workspaceSlug: fixture.workspace.slug },
    });

    expect(response.status).toBe(401);
  });

  it('denies an owner from reading a foreign workspace configuration', async () => {
    const response = await authenticated('owner').get('/app-config', {
      params: { workspaceSlug: fixture.foreignWorkspace.slug },
    });

    expectDenied(response);
  });

  it('denies an otherwise-permitted identity whose app membership has an insufficient role', async () => {
    await fixture.setMembershipRole('member');

    const response = await authenticated('owner').get('/app-config', {
      params: { workspaceSlug: fixture.workspace.slug },
    });

    expectDenied(response);
  });

  it('denies access when the canonical app instance is missing', async () => {
    await fixture.removeOwnerAppInstance();

    const response = await authenticated('owner').get('/app-config', {
      params: { workspaceSlug: fixture.workspace.slug },
    });

    expectDenied(response);
  });

  it('denies access when the canonical app instance is inactive', async () => {
    await fixture.setAppInstanceStatus('suspended');

    const response = await authenticated('owner').get('/app-config', {
      params: { workspaceSlug: fixture.workspace.slug },
    });

    expectDenied(response);
  });

  it('ignores forged authoritative IDs in a mutation and persists the canonical context', async () => {
    const response = await authenticated('owner').put(
      `/app-config/${fixture.configuration.id}`,
      {
        expectedRevision: 1,
        description: 'Updated through the canonical owner context',
        appInstanceId: fixture.forged.appInstanceId,
        membershipId: fixture.forged.membershipId,
        membershipRole: 'member',
        membershipStatus: 'active',
      },
      { params: { workspaceSlug: fixture.workspace.slug } }
    );

    expect(response.status).toBe(200);
    expect(response.data).toEqual(
      expect.objectContaining({
        id: fixture.configuration.id,
        workspaceId: fixture.workspace.id,
        appInstanceId: fixture.appInstance.id,
        ownerUserId: fixture.owner.userId,
        ownerProfileId: fixture.owner.profileId,
      })
    );

    await expect(fixture.readOwnerConfiguration()).resolves.toEqual(
      expect.objectContaining({
        id: fixture.configuration.id,
        workspaceId: fixture.workspace.id,
        appInstanceId: fixture.appInstance.id,
        ownerUserId: fixture.owner.userId,
        ownerProfileId: fixture.owner.profileId,
      })
    );
  });

  it('preserves anonymous published-domain lookup', async () => {
    const response = await fixture.anonymous.get(
      `/app-config/by-domain/${fixture.configuration.domain}`
    );

    expect(response.status).toBe(200);
    expect(response.data).toEqual(
      expect.objectContaining({
        id: fixture.configuration.id,
        domain: fixture.configuration.domain,
        publishedVersion: 1,
      })
    );
    expect(response.data.ownerUserId).toBeUndefined();
    expect(response.data.ownerProfileId).toBeUndefined();
  });
});
