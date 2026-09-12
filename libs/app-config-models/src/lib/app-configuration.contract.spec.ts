import type {
  AppConfigRequestContext,
  PublishAppConfigDto,
  PublishedAppConfiguration,
  RollbackAppConfigDto,
  UpdateAppConfigDto,
} from './app-configuration.model';

describe('app configuration contracts', () => {
  it('accepts the legacy gateway transport context during the P2/P3 transition', () => {
    const legacyContext: AppConfigRequestContext = {
      ownerUserId: 'user-1',
      ownerProfileId: 'profile-1',
      appScope: 'business-site',
    };

    expect(legacyContext).toEqual({
      ownerUserId: 'user-1',
      ownerProfileId: 'profile-1',
      appScope: 'business-site',
    });
  });

  it('carries canonical workspace and membership context separately from appScope', () => {
    const context: AppConfigRequestContext = {
      ownerUserId: 'user-1',
      ownerProfileId: 'profile-1',
      appScope: 'business-site',
      workspaceId: 'workspace-1',
      appInstanceId: 'app-instance-1',
      membershipId: 'membership-1',
      membershipRole: 'owner',
      membershipStatus: 'active',
    };

    expect(context).toEqual({
      ownerUserId: 'user-1',
      ownerProfileId: 'profile-1',
      appScope: 'business-site',
      workspaceId: 'workspace-1',
      appInstanceId: 'app-instance-1',
      membershipId: 'membership-1',
      membershipRole: 'owner',
      membershipStatus: 'active',
    });
    expect(context.workspaceId).not.toBe(context.appScope);
  });

  it('includes an expected revision on every owner mutation DTO', () => {
    const update: UpdateAppConfigDto = { expectedRevision: 3 };
    const publish: PublishAppConfigDto = {
      expectedRevision: 3,
      releaseNotes: 'Ready to publish',
    };
    const rollback: RollbackAppConfigDto = {
      expectedRevision: 3,
      version: 2,
      releaseNotes: 'Restore previous release',
    };

    expect(update.expectedRevision).toBe(3);
    expect(publish.expectedRevision).toBe(3);
    expect(rollback.expectedRevision).toBe(3);
  });

  it('keeps the published projection free of private owner and release metadata', () => {
    const published: PublishedAppConfiguration = {
      id: 'config-1',
      name: 'Public site',
      landingPage: { sections: [], layout: 'single-column' },
      routes: [],
      features: {},
      theme: {},
      active: true,
      publishedVersion: 4,
    };

    expect(published).toEqual(
      expect.objectContaining({ id: 'config-1', publishedVersion: 4 })
    );
    expect(published).not.toHaveProperty('ownerUserId');
    expect(published).not.toHaveProperty('ownerProfileId');
    expect(published).not.toHaveProperty('revision');
    expect(published).not.toHaveProperty('release');
  });
});
