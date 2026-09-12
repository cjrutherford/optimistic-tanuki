import type { AppConfigRequestContext } from '@optimistic-tanuki/app-config-models';

/**
 * The only inputs accepted by app-configurator context resolution. The app
 * instance and membership identifiers are deliberately not part of this
 * request; they must be read from persistence.
 */
export type AppConfigContextResolutionRequest = Pick<
  AppConfigRequestContext,
  'ownerUserId' | 'ownerProfileId' | 'appScope'
> &
  Required<Pick<AppConfigRequestContext, 'workspaceId'>>;

/** The complete context returned after persisted ownership is verified. */
export type ResolvedAppConfigRequestContext = AppConfigRequestContext &
  Required<
    Pick<
      AppConfigRequestContext,
      | 'workspaceId'
      | 'appInstanceId'
      | 'membershipId'
      | 'membershipRole'
      | 'membershipStatus'
    >
  >;
