import { RoleInitBuilder } from './permission-builder';

/**
 * The builder is a fluent accumulator: every method mutates an options object
 * and returns `this`, and `build()` deep-clones the result. These pin the
 * shape of what it produces, since the permissions service consumes it
 * verbatim.
 */
describe('RoleInitBuilder', () => {
  describe('scope and identity', () => {
    it('carries the scope, resource and identities through to the build', () => {
      const result = new RoleInitBuilder()
        .setScopeName('blogging')
        .setScopeResourceId('resource-1')
        .setUserId('user-1')
        .setProfile('profile-1')
        .assignRoleToUser('reader')
        .assignRoleToProfile('author')
        .build();

      expect(result.scopeName).toBe('blogging');
      expect(result.scopeResourceId).toBe('resource-1');
      expect(result.assignments).toEqual([
        { roleName: 'reader', userId: 'user-1' },
        { roleName: 'author', profileId: 'profile-1' },
      ]);
    });

    it('starts empty', () => {
      const result = new RoleInitBuilder().build();

      expect(result).toEqual({
        permissions: [],
        roles: [],
        assignments: [],
      });
    });

    it('returns itself from every mutator so calls can be chained', () => {
      const builder = new RoleInitBuilder();

      expect(builder.setScopeName('x')).toBe(builder);
      expect(builder.setScopeResourceId('x')).toBe(builder);
      expect(builder.setUserId('x')).toBe(builder);
      expect(builder.setProfile('x')).toBe(builder);
      expect(builder.addRole('x')).toBe(builder);
      expect(builder.addPermission('a', 'b', 'c')).toBe(builder);
      expect(builder.assignRoleToProfile('x')).toBe(builder);
      expect(builder.assignRoleToUser('x')).toBe(builder);
    });
  });

  describe('addPermission', () => {
    it('defaults the description and inherits the builder scope', () => {
      const result = new RoleInitBuilder()
        .setScopeName('assets')
        .addPermission('asset.read', 'asset', 'read')
        .build();

      expect(result.permissions).toEqual([
        {
          name: 'asset.read',
          resource: 'asset',
          action: 'read',
          description: '',
          targetId: undefined,
          appScope: 'assets',
        },
      ]);
    });

    it('lets an explicit app scope override the builder scope', () => {
      const result = new RoleInitBuilder()
        .setScopeName('assets')
        .addPermission('a.b', 'a', 'b', 'desc', 'target-1', 'other-scope')
        .build();

      expect(result.permissions?.[0]).toMatchObject({
        targetId: 'target-1',
        appScope: 'other-scope',
        description: 'desc',
      });
    });

    it('leaves the app scope undefined when the builder has no scope', () => {
      const result = new RoleInitBuilder()
        .addPermission('a.b', 'a', 'b')
        .build();

      expect(result.permissions?.[0].appScope).toBeUndefined();
    });
  });

  describe('addRole', () => {
    it('records a role with no permissions by default', () => {
      const result = new RoleInitBuilder().addRole('Reader').build();

      expect(result.roles).toEqual([
        { name: 'Reader', description: undefined, permissions: [] },
      ]);
    });

    it('records the named permissions', () => {
      const result = new RoleInitBuilder()
        .addRole('Author', 'Writes posts', ['post.create', 'post.update'])
        .build();

      expect(result.roles?.[0]).toMatchObject({
        description: 'Writes posts',
        permissions: ['post.create', 'post.update'],
      });
    });
  });

  describe('addAssetOwnerPermissions', () => {
    it('grants full CRUD on assets and binds it to an AssetUser role', () => {
      const result = new RoleInitBuilder()
        .setProfile('profile-1')
        .addAssetOwnerPermissions()
        .build();

      expect(result.permissions?.map((p) => p.name)).toEqual([
        'asset.create',
        'asset.read',
        'asset.update',
        'asset.delete',
      ]);
      expect(result.permissions?.every((p) => p.resource === 'asset')).toBe(
        true
      );

      // The role has to exist and be assigned, otherwise the permissions are
      // created but never reachable.
      expect(result.roles).toHaveLength(1);
      expect(result.roles?.[0]).toMatchObject({
        name: 'AssetUser',
        permissions: [
          'asset.create',
          'asset.read',
          'asset.update',
          'asset.delete',
        ],
      });
      expect(result.assignments).toEqual([
        { roleName: 'AssetUser', profileId: 'profile-1' },
      ]);
    });
  });

  describe('addDefaultProfileOwner', () => {
    it('scopes read and update to the profile and assigns ProfileOwner', () => {
      const result = new RoleInitBuilder()
        .setProfile('profile-1')
        .addDefaultProfileOwner('profile-1', 'blogging')
        .build();

      expect(result.scopeResourceId).toBe('profile-1');
      expect(result.permissions).toEqual([
        expect.objectContaining({
          name: 'profile.read',
          targetId: 'profile-1',
          appScope: 'blogging',
        }),
        expect.objectContaining({
          name: 'profile.update',
          targetId: 'profile-1',
          appScope: 'blogging',
        }),
      ]);
      expect(result.roles?.[0]).toMatchObject({ name: 'ProfileOwner' });
      expect(result.assignments).toEqual([
        { roleName: 'ProfileOwner', profileId: 'profile-1' },
      ]);
    });

    it('falls back to the builder scope when none is given', () => {
      const result = new RoleInitBuilder()
        .setScopeName('social')
        .addDefaultProfileOwner('profile-1')
        .build();

      expect(result.permissions?.[0].appScope).toBe('social');
    });
  });

  describe('assignOwnerRole', () => {
    it('assigns every owner role configured for the scope', () => {
      const result = new RoleInitBuilder()
        .setScopeName('client-interface')
        .setProfile('profile-1')
        .assignOwnerRole()
        .build();

      expect(result.assignments?.map((a) => a.roleName)).toEqual([
        'client_profile_owner',
        'client_asset_manager',
        'forum_moderator',
      ]);
    });

    it('defaults to the global owner roles when no scope is set', () => {
      const result = new RoleInitBuilder()
        .setProfile('profile-1')
        .assignOwnerRole()
        .build();

      expect(result.assignments?.map((a) => a.roleName)).toEqual([
        'owner',
        'forum_moderator',
      ]);
    });

    it('assigns nothing for a scope with no owner roles', () => {
      const result = new RoleInitBuilder()
        .setScopeName('not-a-real-scope')
        .assignOwnerRole()
        .build();

      expect(result.assignments).toEqual([]);
    });
  });

  describe('addAppScopeDefaults', () => {
    it('takes the owner-console path rather than the policy registry', () => {
      const result = new RoleInitBuilder()
        .setScopeName('owner-console')
        .setProfile('profile-1')
        .addAppScopeDefaults()
        .build();

      expect(result.assignments?.map((a) => a.roleName)).toEqual([
        'owner_console_owner',
        'forum_moderator',
      ]);
      // The owner path grants roles only; it does not enumerate permissions.
      expect(result.permissions).toEqual([]);
    });

    it('pulls permissions, roles and assignments from the policy registry', () => {
      const result = new RoleInitBuilder()
        .setScopeName('social')
        .setProfile('profile-1')
        .addAppScopeDefaults()
        .build();

      expect(result.permissions?.length).toBeGreaterThan(0);
      expect(result.roles?.length).toBeGreaterThan(0);
      // Assignments from the registry carry the profile they were built for.
      expect(result.assignments?.[0].profileId).toBe('profile-1');
      // Registry permissions are copied field-for-field, not summarised.
      expect(result.permissions?.[0]).toEqual(
        expect.objectContaining({
          name: expect.any(String),
          resource: expect.any(String),
          action: expect.any(String),
        })
      );
    });

    it('produces assignments even for a scope that defines no permissions', () => {
      const result = new RoleInitBuilder()
        .setScopeName('video-client')
        .setProfile('profile-1')
        .addAppScopeDefaults()
        .build();

      expect(result.permissions).toEqual([]);
      expect(result.assignments?.length).toBeGreaterThan(0);
    });

    it('yields nothing for a scope with no registered policy', () => {
      const result = new RoleInitBuilder()
        .setScopeName('blogging')
        .setProfile('profile-1')
        .addAppScopeDefaults()
        .build();

      expect(result).toMatchObject({
        permissions: [],
        roles: [],
        assignments: [],
      });
    });

    it('falls back to the global scope defaults when no scope is set', () => {
      const result = new RoleInitBuilder()
        .setProfile('profile-1')
        .addAppScopeDefaults()
        .build();

      expect(result.scopeName).toBeUndefined();
      expect(Array.isArray(result.permissions)).toBe(true);
    });
  });

  describe('build', () => {
    it('returns a deep copy, so later mutation cannot reach a built result', () => {
      const builder = new RoleInitBuilder()
        .setScopeName('social')
        .addPermission('a.b', 'a', 'b');

      const first = builder.build();
      builder.addPermission('c.d', 'c', 'd');
      const second = builder.build();

      expect(first.permissions).toHaveLength(1);
      expect(second.permissions).toHaveLength(2);
      expect(first.permissions).not.toBe(second.permissions);
    });
  });
});
