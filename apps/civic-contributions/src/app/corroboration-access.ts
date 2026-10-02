import {
  effectivePermissions,
  ROLES,
  type RoleName,
} from '@optimistic-tanuki/civic-access';
import type { Actor } from '@optimistic-tanuki/civic-community';

/**
 * Who may corroborate (D20): a verified official never does. Grants are
 * additive, and an official is also a member, so the member grant is not
 * enough; civic-access's `effectivePermissions` applies the official's
 * denial, and this is where it is enforced.
 *
 * civic-community's Actor carries no roles yet, so the gateway may add them
 * here. Without a `roles` list nothing is known about the actor's roles and
 * only what this service itself recorded (an official standing in the town)
 * can refuse.
 */
export type ActorWithRoles = Actor & { roles?: readonly string[] };

export const CORROBORATION_PERMISSION = 'corroboration.create';

const KNOWN_ROLES: ReadonlySet<string> = new Set(ROLES);

/** Why an actor may not corroborate, or null when they may. */
export function corroborationRefusal(
  actor: ActorWithRoles,
  recordedOfficialInTown: boolean
): string | null {
  const roles = actor.roles?.filter((role): role is RoleName =>
    KNOWN_ROLES.has(role)
  );
  const official =
    recordedOfficialInTown ||
    (actor.roles?.includes('local_hub_verified_official') ?? false);
  if (official) {
    return 'A verified official cannot corroborate a report: an official is not an independent witness of what they oversee. Send your own report or an official record instead.';
  }
  if (
    actor.roles !== undefined &&
    !effectivePermissions(roles ?? []).has(CORROBORATION_PERMISSION)
  ) {
    return 'Your account is not permitted to corroborate reports.';
  }
  return null;
}
