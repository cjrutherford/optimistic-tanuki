import type { AppConfigRequestContext } from '@optimistic-tanuki/app-config-models';

/**
 * Resolves the owner context for optional demo data without fabricating a
 * tenant. Operators must explicitly provide every persisted context ID.
 */
export function resolveAppConfigSeedContext(): AppConfigRequestContext | null {
  const ownerUserId = process.env.APP_CONFIG_SEED_OWNER_USER_ID?.trim();
  const ownerProfileId = process.env.APP_CONFIG_SEED_OWNER_PROFILE_ID?.trim();
  const workspaceId = process.env.APP_CONFIG_SEED_WORKSPACE_ID?.trim();
  const appInstanceId = process.env.APP_CONFIG_SEED_APP_INSTANCE_ID?.trim();
  const membershipId = process.env.APP_CONFIG_SEED_MEMBERSHIP_ID?.trim();

  if (
    !ownerUserId ||
    !ownerProfileId ||
    !workspaceId ||
    !appInstanceId ||
    !membershipId
  ) {
    return null;
  }

  return {
    ownerUserId,
    ownerProfileId,
    appScope: process.env.APP_CONFIG_SEED_APP_SCOPE?.trim() || 'business-site',
    workspaceId,
    appInstanceId,
    membershipId,
    membershipRole: 'owner',
    membershipStatus: 'active',
  };
}
