import {
  canTransitionMembershipLifecycle,
  resolveMembershipLifecycleTransition,
  type MembershipLifecycleAuditEvent,
} from './membership-lifecycle';

describe('membership lifecycle contract', () => {
  it('allows an owner to activate a pending relationship and emits an audit-ready result', () => {
    expect(
      resolveMembershipLifecycleTransition('pending', 'activate', 'owner')
    ).toEqual({
      from: 'pending',
      to: 'active',
      action: 'activate',
      changed: true,
      requiresAudit: true,
    });

    const audit: MembershipLifecycleAuditEvent = {
      workspaceId: 'workspace-1',
      subjectId: 'profile-2',
      actorId: 'profile-1',
      actor: 'owner',
      action: 'activate',
      from: 'pending',
      to: 'active',
      occurredAt: '2026-08-23T16:00:00.000Z',
    };

    expect(audit.to).toBe('active');
  });

  it('makes repeated terminal actions idempotent without creating a second audit event', () => {
    expect(
      resolveMembershipLifecycleTransition('suspended', 'suspend', 'moderator')
    ).toEqual({
      from: 'suspended',
      to: 'suspended',
      action: 'suspend',
      changed: false,
      requiresAudit: false,
    });
  });

  it('rejects member-initiated escalation and transitions from a revoked relationship', () => {
    expect(
      canTransitionMembershipLifecycle('pending', 'activate', 'member')
    ).toBe(false);
    expect(
      canTransitionMembershipLifecycle('revoked', 'activate', 'owner')
    ).toBe(false);
  });
});
