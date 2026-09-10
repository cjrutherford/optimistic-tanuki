import { resolveAppConfigSeedContext } from './seed-context';

describe('resolveAppConfigSeedContext', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = { ...originalEnvironment };
    delete process.env.APP_CONFIG_SEED_OWNER_USER_ID;
    delete process.env.APP_CONFIG_SEED_OWNER_PROFILE_ID;
    delete process.env.APP_CONFIG_SEED_WORKSPACE_ID;
    delete process.env.APP_CONFIG_SEED_APP_INSTANCE_ID;
    delete process.env.APP_CONFIG_SEED_MEMBERSHIP_ID;
    delete process.env.APP_CONFIG_SEED_APP_SCOPE;
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('does not invent an owner context when bootstrap identity is absent', () => {
    expect(resolveAppConfigSeedContext()).toBeNull();
  });

  it('returns the explicitly configured bootstrap owner context', () => {
    process.env.APP_CONFIG_SEED_OWNER_USER_ID =
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    process.env.APP_CONFIG_SEED_OWNER_PROFILE_ID =
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    process.env.APP_CONFIG_SEED_WORKSPACE_ID =
      '123e4567-e89b-12d3-a456-426614174000';
    process.env.APP_CONFIG_SEED_APP_INSTANCE_ID =
      '123e4567-e89b-12d3-a456-426614174001';
    process.env.APP_CONFIG_SEED_MEMBERSHIP_ID =
      '123e4567-e89b-12d3-a456-426614174002';
    process.env.APP_CONFIG_SEED_APP_SCOPE = 'business-site';

    expect(resolveAppConfigSeedContext()).toEqual({
      ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ownerProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      appScope: 'business-site',
      workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      appInstanceId: '123e4567-e89b-12d3-a456-426614174001',
      membershipId: '123e4567-e89b-12d3-a456-426614174002',
      membershipRole: 'owner',
      membershipStatus: 'active',
    });
  });
});
