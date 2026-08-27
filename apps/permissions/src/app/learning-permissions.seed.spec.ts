const seedData = require('../assets/default-permissions.json');

describe('learning permission seeds', () => {
  it('defines the learning app scope as active', () => {
    const scope = seedData.app_scopes.find(
      (entry: { name: string }) => entry.name === 'learning'
    );

    expect(scope).toBeDefined();
    expect(scope.active).toBe(true);
  });

  it('defines the four learning roles in the learning scope', () => {
    const expectedRoles = [
      'learning_learner',
      'learning_course_designer',
      'learning_course_editor',
      'learning_admin',
    ];

    for (const roleName of expectedRoles) {
      expect(
        seedData.roles.some(
          (role: { name: string; appScope: string }) =>
            role.name === roleName && role.appScope === 'learning'
        )
      ).toBe(true);
    }
  });

  it('never lets a learner grade or write an offering', () => {
    const learnerPermissions = seedData.role_permissions
      .filter(
        (entry: { role: string; permissionAppScope: string }) =>
          entry.role === 'learning_learner' &&
          entry.permissionAppScope === 'learning'
      )
      .map((entry: { permission: string }) => entry.permission);

    expect(learnerPermissions).not.toEqual(
      expect.arrayContaining([
        'evaluation.create',
        'evaluation.update',
        'offering.create',
        'offering.update',
        'offering.update.own',
        'offering.delete',
        'offering.delete.own',
      ])
    );
  });

  it('lets a course designer create an offering but never grade', () => {
    const designerPermissions = seedData.role_permissions
      .filter(
        (entry: { role: string; permissionAppScope: string }) =>
          entry.role === 'learning_course_designer' &&
          entry.permissionAppScope === 'learning'
      )
      .map((entry: { permission: string }) => entry.permission);

    expect(designerPermissions).toEqual(
      expect.arrayContaining(['offering.create'])
    );
    expect(designerPermissions).not.toEqual(
      expect.arrayContaining(['evaluation.create', 'evaluation.update'])
    );
  });

  it('lets a learning admin grade an attempt', () => {
    const adminPermissions = seedData.role_permissions
      .filter(
        (entry: { role: string; permissionAppScope: string }) =>
          entry.role === 'learning_admin' &&
          entry.permissionAppScope === 'learning'
      )
      .map((entry: { permission: string }) => entry.permission);

    expect(adminPermissions).toEqual(
      expect.arrayContaining(['evaluation.create'])
    );
  });

  it('points every learning role_permissions entry at a permission that actually exists', () => {
    const learningRoleNames = new Set(
      seedData.roles
        .filter((role: { appScope: string }) => role.appScope === 'learning')
        .map((role: { name: string }) => role.name)
    );

    const learningRolePermissions = seedData.role_permissions.filter(
      (entry: { role: string }) => learningRoleNames.has(entry.role)
    );

    // Sanity check: the seed actually wired something up for these roles.
    expect(learningRolePermissions.length).toBeGreaterThan(0);

    for (const entry of learningRolePermissions as Array<{
      role: string;
      permission: string;
      permissionAppScope: string;
    }>) {
      const matchingPermission = seedData.permissions.find(
        (permission: { name: string; appScope: string }) =>
          permission.name === entry.permission &&
          permission.appScope === entry.permissionAppScope
      );

      expect(matchingPermission).toBeDefined();
    }
  });

  // Platform owners answer for everything the platform does, so learning
  // cannot be a blind spot for them. They get the unscoped permissions only:
  // an owner acting on someone else's course uses offering.update, and
  // offering.update.own would never match.
  describe('owner authority over the learning scope', () => {
    const OWNER_ROLES = ['owner', 'global_admin'];

    const learningPermissionNames: string[] = seedData.permissions
      .filter((permission) => permission.appScope === 'learning')
      .map((permission) => permission.name as string);

    const unscoped = learningPermissionNames.filter(
      (name) => !name.endsWith('.own')
    );

    const grantsFor = (role: string): Set<string> =>
      new Set<string>(
        seedData.role_permissions
          .filter(
            (link) =>
              link.role === role && link.permissionAppScope === 'learning'
          )
          .map((link) => link.permission as string)
      );

    it.each(OWNER_ROLES)(
      'gives %s every unscoped learning permission',
      (role) => {
        const granted = grantsFor(role);
        const missing = unscoped.filter((name) => !granted.has(name));

        expect(missing).toEqual([]);
      }
    );

    it.each(OWNER_ROLES)('lets %s grade', (role) => {
      expect(grantsFor(role).has('evaluation.create')).toBe(true);
    });

    it.each(OWNER_ROLES)('does not hand %s the own-scoped variants', (role) => {
      const granted = [...grantsFor(role)];

      expect(granted.filter((name) => name.endsWith('.own'))).toEqual([]);
    });
  });
});
