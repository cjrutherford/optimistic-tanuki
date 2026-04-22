import { AppScopePolicyRegistry } from './app-scope-policy.registry';
import { PolicyRoleSpec } from './app-scope-policy';

describe('AppScopePolicyRegistry', () => {
  it('returns client-interface defaults and social cross-scope mappings', () => {
    const registry = new AppScopePolicyRegistry();
    const policy = registry.get('client-interface');

    const defaults = policy.buildDefaults();
    expect(defaults.roles.map((role: PolicyRoleSpec) => role.name)).toContain(
      'community_owner',
    );
    expect(defaults.assignments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ roleName: 'client_interface_user' }),
        expect.objectContaining({ roleName: 'community_owner' }),
      ]),
    );

    expect(policy.buildPermissionMirrors?.(defaults.permissions)).toEqual([
      {
        targetScope: 'social',
        permissionNames: [
          'community.create',
          'community.read',
          'community.update',
          'community.delete',
          'community.invite',
        ],
      },
    ]);

    expect(
      policy.buildCrossScopeMappings?.({
        roleName: 'community_owner',
        profileId: 'profile-1',
      }),
    ).toEqual([
      {
        roleName: 'community_owner',
        profileId: 'profile-1',
        appScope: 'social',
      },
    ]);
  });
});
