import { AppScopePolicyRegistry } from './app-scope-policy.registry';

/**
 * The spec beside this one covers the client-interface and business-site
 * policies in detail. These walk every registered scope so that each policy's
 * builder actually runs — a scope registered with the wrong role names, or a
 * builder that throws for some profile id, would otherwise only surface the
 * first time that app seeded its roles.
 */
describe('AppScopePolicyRegistry scopes', () => {
  const registry = new AppScopePolicyRegistry();

  describe('scopes that assign roles', () => {
    it.each<[string, string[]]>([
      [
        'forgeofwill',
        [
          'forgeofwill_standard_user',
          'forgeofwill_planner',
          'forgeofwill_profile_owner',
        ],
      ],
      ['digital-homestead', ['digital_standard_user', 'digital_follower']],
      ['business-site', ['business_site_client']],
    ])('%s assigns its standing roles to the profile', (scope, roleNames) => {
      const defaults = registry.get(scope).buildDefaults('profile-1');

      expect(defaults.assignments.map((a) => a.roleName)).toEqual(roleNames);
      expect(
        defaults.assignments.every((a) => a.profileId === 'profile-1')
      ).toBe(true);
    });

    it.each(['forgeofwill', 'digital-homestead', 'business-site'])(
      '%s still lists its roles when no profile is given',
      (scope) => {
        const defaults = registry.get(scope).buildDefaults();

        expect(defaults.assignments.length).toBeGreaterThan(0);
        expect(
          defaults.assignments.every((a) => a.profileId === undefined)
        ).toBe(true);
      }
    );
  });

  describe('scopes that seed nothing', () => {
    it.each([
      'authentication',
      'profile',
      'blogging',
      'assets',
      'project-planning',
    ])('%s seeds no permissions, roles or assignments', (scope) => {
      const defaults = registry.get(scope).buildDefaults('profile-1');

      expect(defaults).toEqual({
        permissions: [],
        roles: [],
        assignments: [],
      });
    });
  });

  describe('scopes that seed their own permission sets', () => {
    it.each([
      ['leads-app', 'lead.'],
      ['local-hub', 'classified.'],
    ])('%s seeds permissions and roles of its own', (scope, prefix) => {
      const defaults = registry.get(scope).buildDefaults('profile-1');

      expect(defaults.permissions.length).toBeGreaterThan(0);
      expect(defaults.roles.length).toBeGreaterThan(0);
      expect(defaults.permissions.some((p) => p.name.startsWith(prefix))).toBe(
        true
      );
      expect(
        defaults.assignments.every((a) => a.profileId === 'profile-1')
      ).toBe(true);
    });
  });

  describe('client-interface cross-scope mapping', () => {
    it.each(['client_interface_user', 'community_owner'])(
      'mirrors a %s assignment into social',
      (roleName) => {
        const mapped = registry
          .get('client-interface')
          .buildCrossScopeMappings?.({ roleName, profileId: 'profile-1' });

        expect(mapped).toEqual([
          { roleName, profileId: 'profile-1', appScope: 'social' },
        ]);
      }
    );

    it.each([
      [
        'the role is not one of the two mirrored roles',
        'some_other_role',
        'profile-1',
      ],
      ['there is no profile to mirror', 'community_owner', undefined],
    ])('mirrors nothing when %s', (_case, roleName, profileId) => {
      expect(
        registry
          .get('client-interface')
          .buildCrossScopeMappings?.({ roleName, profileId })
      ).toEqual([]);
    });
  });

  describe('social', () => {
    it('seeds its permissions, roles and the standard user assignment', () => {
      const defaults = registry.get('social').buildDefaults('profile-1');

      expect(defaults.permissions.length).toBeGreaterThan(0);
      expect(defaults.roles.length).toBeGreaterThan(0);
      expect(defaults.assignments).toEqual([
        { roleName: 'social_standard_user', profileId: 'profile-1' },
      ]);
      // Everything social seeds belongs to social.
      expect(defaults.permissions.every((p) => p.appScope === 'social')).toBe(
        true
      );
    });
  });

  describe('optional policy hooks', () => {
    it.each(['forgeofwill', 'social', 'authentication'])(
      '%s mirrors no permissions by default',
      (scope) => {
        const policy = registry.get(scope);

        expect(policy.buildPermissionMirrors?.([])).toEqual([]);
      }
    );

    it.each(['forgeofwill', 'social', 'authentication'])(
      '%s maps nothing across scopes by default',
      (scope) => {
        const policy = registry.get(scope);

        expect(
          policy.buildCrossScopeMappings?.({
            roleName: 'anything',
            profileId: 'profile-1',
          })
        ).toEqual([]);
      }
    );

    it('client-interface mirrors nothing when no community permissions exist', () => {
      const policy = registry.get('client-interface');

      expect(
        policy.buildPermissionMirrors?.([
          {
            name: 'unrelated.read',
            resource: 'unrelated',
            action: 'read',
            description: 'Unrelated',
            appScope: 'client-interface',
          },
        ])
      ).toEqual([]);
    });
  });

  describe('unknown scopes', () => {
    it('falls back to a policy that seeds nothing', () => {
      const policy = registry.get('not-a-real-scope');

      expect(policy.scopeName).toBe('default');
      expect(policy.buildDefaults('profile-1')).toEqual({
        permissions: [],
        roles: [],
        assignments: [],
      });
    });

    it('returns the same fallback for every unknown scope', () => {
      expect(registry.get('nope-one')).toBe(registry.get('nope-two'));
    });
  });
});
