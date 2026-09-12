export const MEMBERSHIP_LIFECYCLE_STATES = [
  'pending',
  'active',
  'suspended',
  'revoked',
] as const;

export type MembershipLifecycleState =
  (typeof MEMBERSHIP_LIFECYCLE_STATES)[number];

export const MEMBERSHIP_LIFECYCLE_ACTIONS = [
  'activate',
  'suspend',
  'revoke',
] as const;

export type MembershipLifecycleAction =
  (typeof MEMBERSHIP_LIFECYCLE_ACTIONS)[number];

export const MEMBERSHIP_LIFECYCLE_ACTORS = [
  'owner',
  'moderator',
  'system',
] as const;

export type MembershipLifecycleActor =
  (typeof MEMBERSHIP_LIFECYCLE_ACTORS)[number];

export interface MembershipLifecycleTransition {
  from: MembershipLifecycleState;
  to: MembershipLifecycleState;
  action: MembershipLifecycleAction;
  changed: boolean;
  requiresAudit: boolean;
}

export interface MembershipLifecycleAuditEvent {
  workspaceId: string;
  subjectId: string;
  actorId: string;
  actor: MembershipLifecycleActor;
  action: MembershipLifecycleAction;
  from: MembershipLifecycleState;
  to: MembershipLifecycleState;
  occurredAt: string;
}

const TRANSITIONS: Record<
  MembershipLifecycleState,
  Partial<Record<MembershipLifecycleAction, MembershipLifecycleState>>
> = {
  pending: { activate: 'active', revoke: 'revoked' },
  active: { suspend: 'suspended', revoke: 'revoked' },
  suspended: { activate: 'active', revoke: 'revoked' },
  revoked: {},
};

function isLifecycleActor(value: string): value is MembershipLifecycleActor {
  return (MEMBERSHIP_LIFECYCLE_ACTORS as readonly string[]).includes(value);
}

export function canTransitionMembershipLifecycle(
  from: MembershipLifecycleState,
  action: MembershipLifecycleAction,
  actor: string
): boolean {
  if (!isLifecycleActor(actor)) {
    return false;
  }

  return Boolean(
    TRANSITIONS[from][action] ||
      (action === 'activate' && from === 'active') ||
      (action === 'suspend' && from === 'suspended') ||
      (action === 'revoke' && from === 'revoked')
  );
}

export function resolveMembershipLifecycleTransition(
  from: MembershipLifecycleState,
  action: MembershipLifecycleAction,
  actor: string
): MembershipLifecycleTransition | null {
  if (!canTransitionMembershipLifecycle(from, action, actor)) {
    return null;
  }

  const to =
    TRANSITIONS[from][action] ||
    (action === 'activate'
      ? 'active'
      : action === 'suspend'
      ? 'suspended'
      : 'revoked');

  return {
    from,
    to,
    action,
    changed: from !== to,
    requiresAudit: from !== to,
  };
}
