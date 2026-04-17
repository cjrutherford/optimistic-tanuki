import { RoleInitBuilder } from '@optimistic-tanuki/permission-lib';

describe('RoleInitBuilder leads-app defaults', () => {
  it('creates the minimum leads permissions and role for a fresh database', () => {
    const result = new RoleInitBuilder()
      .setScopeName('leads-app')
      .setProfile('profile-1')
      .addAppScopeDefaults()
      .build();

    expect(result.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'lead.read',
          resource: 'lead',
          action: 'read',
          appScope: 'leads-app',
        }),
        expect.objectContaining({
          name: 'lead.topic.read',
          resource: 'lead.topic',
          action: 'read',
          appScope: 'leads-app',
        }),
        expect.objectContaining({
          name: 'lead.onboarding.update',
          resource: 'lead.onboarding',
          action: 'update',
          appScope: 'leads-app',
        }),
      ])
    );

    expect(result.roles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'leads_app_member',
          permissions: expect.arrayContaining([
            'lead.read',
            'lead.topic.read',
            'lead.onboarding.update',
          ]),
        }),
      ])
    );

    expect(result.assignments).toEqual(
      expect.arrayContaining([
        {
          roleName: 'leads_app_member',
          profileId: 'profile-1',
        },
      ])
    );
  });
});
