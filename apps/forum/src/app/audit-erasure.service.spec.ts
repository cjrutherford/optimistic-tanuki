import { FORUM_AUDIT_ERASURE_POLICIES } from './audit-erasure.service';

describe('Forum audit erasure registry', () => {
  it('redacts actor identity and opaque subject details while retaining the action receipt', () => {
    expect(FORUM_AUDIT_ERASURE_POLICIES).toEqual([
      {
        table: 'forum_moderation_action',
        accountColumns: [],
        profileColumns: ['actorProfileId'],
        clearColumns: { subjectId: 'null', details: 'json-object' },
      },
    ]);
  });
});
