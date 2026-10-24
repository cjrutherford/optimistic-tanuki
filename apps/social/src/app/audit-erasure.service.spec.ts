import { SOCIAL_AUDIT_ERASURE_POLICIES } from './audit-erasure.service';

describe('Social audit erasure registry', () => {
  it('redacts participation receipts and deletes only private profile activity', () => {
    expect(SOCIAL_AUDIT_ERASURE_POLICIES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'activity',
          disposition: 'delete-private',
          profileColumns: ['profileId'],
        }),
        expect.objectContaining({
          table: 'community_membership_audit',
          accountColumns: ['actorId'],
          profileColumns: ['subjectId'],
          clearColumns: { workspaceId: 'null' },
        }),
        expect.objectContaining({
          table: 'guardian_content_audit',
          accountColumns: ['actorUserId', 'dependentUserId'],
          profileColumns: ['dependentProfileId'],
          clearColumns: {
            resourceId: 'null',
            changedFields: 'serialized-json-array',
          },
        }),
      ])
    );
    expect(
      SOCIAL_AUDIT_ERASURE_POLICIES.map(({ table }) => table)
    ).not.toContain('guardian_published_asset_grant');
  });

  it('does not traverse content references and clears identifying action context', () => {
    expect(SOCIAL_AUDIT_ERASURE_POLICIES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'content_moderation_action',
          profileColumns: ['actorProfileId'],
          clearColumns: {
            subjectId: 'null',
            reportId: 'null',
            workspaceId: 'null',
            details: 'json-object',
          },
        }),
        expect.objectContaining({
          table: 'profile_view',
          accountColumns: ['viewerId'],
          profileColumns: ['profileId'],
          clearColumns: { source: 'empty-text' },
        }),
      ])
    );
  });
});
