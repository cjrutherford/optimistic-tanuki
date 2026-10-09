import {
  And,
  Brackets,
  Equal,
  FindOperator,
  FindOptionsWhere,
  In,
  IsNull,
  Not,
  Raw,
  SelectQueryBuilder,
} from 'typeorm';
import { Post } from '../../entities/post.entity';

/**
 * Shared post-visibility scope for the social service.
 *
 * A single predicate applied uniformly across search, trending, feeds and
 * single-post fetch so that read paths cannot leak posts a viewer is not
 * entitled to see. It enforces:
 *
 *  - `moderationStatus = 'visible'` (moderator-hidden posts are excluded)
 *  - `isScheduled = false` (unpublished scheduled posts are excluded)
 *  - `visibility = 'public'` OR
 *    (`visibility = 'followers'` AND author ∈ followed ∪ {viewer})
 *  - author ∉ blocked (both directions: the viewer's blocks and the users who
 *    blocked the viewer — the caller unions those into `blockedProfileIds`)
 *
 * The author always sees their own posts, including their own hidden and
 * scheduled ones (author-own branch bypasses the moderation / scheduled /
 * blocked constraints).
 *
 * Identity is the viewer's profile id, forwarded by the gateway from the
 * authenticated request context. When it is absent the call is treated as an
 * anonymous read and only public, visible, unscheduled posts are returned.
 *
 * Moderator override is intentionally NOT implemented here: moderation flows
 * use dedicated endpoints (see PrivacyService.moderateContent /
 * PostService.moderate), so a moderator never relies on these read paths to
 * see hidden content.
 *
 * Note: this scope does not depend on the `Post` entity carrying a `deleted`
 * column — removal in this service is a hard delete, so there is nothing to
 * filter for soft-deletion.
 */
export interface PostVisibilityScope {
  /** Authenticated viewer's profile id, or undefined for anonymous reads. */
  viewerProfileId?: string;
  /** Profile ids the viewer follows. */
  followedProfileIds: string[];
  /**
   * Union of authors the viewer blocked and authors who blocked the viewer.
   * Empty emits no exclusion clause.
   */
  blockedProfileIds: string[];
  /** Account identity used to check current approved membership in the read query. */
  viewerAccountId?: string;
}

function uniqueDefined(values: (string | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => !!value))
  );
}

function normalizeNullWhereValues<T extends FindOptionsWhere<Post>>(
  where: T
): T {
  return Object.fromEntries(
    Object.entries(where).map(([key, value]) => [
      key,
      value === null ? IsNull() : value,
    ])
  ) as T;
}

function accessibleCommunityCondition(viewerAccountId?: string) {
  return Raw(
    (column) => {
      const visibilityColumn = column.replace(/communityId"?$/, (name) =>
        name.endsWith('"') ? 'visibility"' : 'visibility'
      );
      const explicitColumn = column.replace(/communityId"?$/, (name) =>
        name.endsWith('"')
          ? 'publicAudienceExplicit"'
          : 'publicAudienceExplicit'
      );
      const memberOnly = `(${visibilityColumn} = 'community' OR (${visibilityColumn} = 'public' AND ${explicitColumn} = false))`;
      return `(${column} IS NULL OR EXISTS (SELECT 1 FROM community c WHERE c.id = ${column} AND ((c."isPrivate" = false AND NOT ${memberOnly}) OR EXISTS (SELECT 1 FROM community_member cm WHERE cm."communityId" = c.id AND cm."userId" = :pv_account_id AND cm.status = 'approved'))))`;
    },
    viewerAccountId
      ? { pv_account_id: viewerAccountId }
      : { pv_account_id: '__anonymous__' }
  );
}

function memberCommunityCondition(viewerAccountId?: string) {
  return Raw(
    (column) =>
      `(${column} IS NOT NULL AND EXISTS (SELECT 1 FROM community_member cm WHERE cm."communityId" = ${column} AND cm."userId" = :pv_member_account_id AND cm.status = 'approved'))`,
    { pv_member_account_id: viewerAccountId ?? '__anonymous__' }
  );
}

function asFindOperator(value: unknown): FindOperator<any> {
  if (value instanceof FindOperator) return value;
  return value === null ? IsNull() : Equal(value as any);
}

function intersectCondition(existing: unknown, constraint: FindOperator<any>) {
  if (existing === undefined) return constraint;
  return And(asFindOperator(existing), constraint);
}

function constrainWhere(
  base: FindOptionsWhere<Post>,
  key: keyof FindOptionsWhere<Post>,
  constraint: unknown
) {
  const existing = base[key];
  return existing === undefined
    ? constraint
    : And(asFindOperator(existing), asFindOperator(constraint));
}

/**
 * Where-fragment form for `repo.find`.
 *
 * Returns an array of {@link FindOptionsWhere} branches. TypeORM OR's a
 * top-level where array, so every branch carries the full scope predicate
 * ANDed with `base`. Callers composing their own OR (e.g. an ILike on title
 * OR content) must call this once per base fragment and concatenate the
 * results, otherwise the scope would only guard one arm of their OR.
 */
export function visiblePostWhere(
  scope: PostVisibilityScope,
  base: FindOptionsWhere<Post> = {}
): FindOptionsWhere<Post>[] {
  base = normalizeNullWhereValues(base);
  const { viewerProfileId, followedProfileIds, blockedProfileIds } = scope;
  const blocked = uniqueDefined(blockedProfileIds);
  const branches: FindOptionsWhere<Post>[] = [];
  const addCommunityScope = (branch: FindOptionsWhere<Post>) => {
    if (branch.communityId === null) return branch;
    const communityCondition = accessibleCommunityCondition(
      scope.viewerAccountId
    );
    return {
      ...branch,
      communityId: intersectCondition(
        (branch as any).communityId,
        communityCondition
      ),
    };
  };

  // Public, visible, unscheduled posts (visible to everyone).
  const publicBranch: FindOptionsWhere<Post> = {
    ...base,
    visibility: constrainWhere(base, 'visibility', 'public') as any,
    moderationStatus: constrainWhere(
      base,
      'moderationStatus',
      'visible'
    ) as any,
    isScheduled: constrainWhere(base, 'isScheduled', false) as any,
    communityId: constrainWhere(base, 'communityId', IsNull()) as any,
  };
  const explicitCommunityPublicBranch: FindOptionsWhere<Post> = {
    ...base,
    visibility: constrainWhere(base, 'visibility', 'public') as any,
    publicAudienceExplicit: constrainWhere(
      base,
      'publicAudienceExplicit',
      true
    ) as any,
    moderationStatus: constrainWhere(
      base,
      'moderationStatus',
      'visible'
    ) as any,
    isScheduled: constrainWhere(base, 'isScheduled', false) as any,
    communityId: intersectCondition(
      base.communityId,
      Raw((column) => `${column} IS NOT NULL`)
    ) as any,
  };
  if (blocked.length > 0) {
    publicBranch.profileId = intersectCondition(
      publicBranch.profileId,
      Not(In(blocked))
    ) as any;
    explicitCommunityPublicBranch.profileId = intersectCondition(
      explicitCommunityPublicBranch.profileId,
      Not(In(blocked))
    ) as any;
  }
  branches.push(addCommunityScope(publicBranch));
  branches.push(addCommunityScope(explicitCommunityPublicBranch));

  // Ordinary community posts are member-visible. Legacy public community
  // posts with an unconfirmed audience remain member-visible until edited.
  if (scope.viewerAccountId) {
    const communityBranch: FindOptionsWhere<Post> = {
      ...base,
      visibility: constrainWhere(base, 'visibility', 'community') as any,
      moderationStatus: constrainWhere(
        base,
        'moderationStatus',
        'visible'
      ) as any,
      isScheduled: constrainWhere(base, 'isScheduled', false) as any,
      communityId: intersectCondition(
        base.communityId,
        memberCommunityCondition(scope.viewerAccountId)
      ) as any,
    };
    branches.push(communityBranch);

    const legacyCommunityBranch: FindOptionsWhere<Post> = {
      ...base,
      visibility: constrainWhere(base, 'visibility', 'public') as any,
      publicAudienceExplicit: constrainWhere(
        base,
        'publicAudienceExplicit',
        false
      ) as any,
      moderationStatus: constrainWhere(
        base,
        'moderationStatus',
        'visible'
      ) as any,
      isScheduled: constrainWhere(base, 'isScheduled', false) as any,
      communityId: intersectCondition(
        base.communityId,
        memberCommunityCondition(scope.viewerAccountId)
      ) as any,
    };
    branches.push(legacyCommunityBranch);
  }

  // Followers-only posts, visible only to followers (and the viewer's own,
  // which is also covered by the author-own branch below).
  const followedAuthors = uniqueDefined([
    ...followedProfileIds,
    viewerProfileId,
  ]).filter((id) => !blocked.includes(id));
  if (followedAuthors.length > 0) {
    const followersBranch: FindOptionsWhere<Post> = {
      ...base,
      visibility: constrainWhere(base, 'visibility', 'followers') as any,
      moderationStatus: constrainWhere(
        base,
        'moderationStatus',
        'visible'
      ) as any,
      isScheduled: constrainWhere(base, 'isScheduled', false) as any,
    };
    followersBranch.profileId = intersectCondition(
      followersBranch.profileId,
      In(followedAuthors)
    ) as any;
    branches.push(addCommunityScope(followersBranch));
  }

  // Author always sees their own posts — including hidden and scheduled ones.
  if (viewerProfileId) {
    const ownBranch: FindOptionsWhere<Post> = { ...base };
    ownBranch.profileId = intersectCondition(
      ownBranch.profileId,
      Equal(viewerProfileId)
    ) as any;
    branches.push(addCommunityScope(ownBranch));
  }

  return branches;
}

/**
 * QueryBuilder form for aggregate queries (e.g. trending).
 *
 * Applies the same predicate as {@link visiblePostWhere} in SQL via an
 * `andWhere` bracketed OR, using parameterized queries. Empty follow / block
 * lists are handled explicitly (no `IN ()` is ever emitted). Parameter names
 * are namespaced (`pv_*`) to avoid colliding with the caller's params.
 */
export function applyVisiblePostScope<T extends SelectQueryBuilder<Post>>(
  qb: T,
  scope: PostVisibilityScope,
  alias = 'post'
): T {
  const { viewerProfileId, followedProfileIds, blockedProfileIds } = scope;
  const blocked = uniqueDefined(blockedProfileIds);
  const followedAuthors = uniqueDefined([
    ...followedProfileIds,
    viewerProfileId,
  ]).filter((id) => !blocked.includes(id));

  return qb.andWhere(
    new Brackets((outer) => {
      outer.where(
        new Brackets((visibility) => {
          // Everyone-visible arm: visible, unscheduled, not blocked, and either
          // public or a followers-only post by a followed author.
          visibility.where(
            new Brackets((visible) => {
              visible
                .where(`${alias}.moderationStatus = :pv_visible`, {
                  pv_visible: 'visible',
                })
                .andWhere(`${alias}.isScheduled = :pv_scheduled`, {
                  pv_scheduled: false,
                });

              if (blocked.length > 0) {
                visible.andWhere(`${alias}.profileId NOT IN (:...pv_blocked)`, {
                  pv_blocked: blocked,
                });
              }

              visible.andWhere(
                new Brackets((vis) => {
                  vis.where(
                    new Brackets((publicPosts) => {
                      publicPosts
                        .where(`${alias}.visibility = :pv_public`, {
                          pv_public: 'public',
                        })
                        .andWhere(
                          `(${alias}.communityId IS NULL OR ${alias}.publicAudienceExplicit = :pv_public_explicit)`,
                          { pv_public_explicit: true }
                        );
                    })
                  );
                  if (followedAuthors.length > 0) {
                    vis.orWhere(
                      new Brackets((followers) => {
                        followers
                          .where(`${alias}.visibility = :pv_followers`, {
                            pv_followers: 'followers',
                          })
                          .andWhere(`${alias}.profileId IN (:...pv_followed)`, {
                            pv_followed: followedAuthors,
                          });
                      })
                    );
                  }
                  if (scope.viewerAccountId) {
                    vis.orWhere(
                      new Brackets((communityPosts) => {
                        communityPosts
                          .where(`${alias}.visibility = :pv_community`, {
                            pv_community: 'community',
                          })
                          .andWhere(
                            `${alias}.communityId IS NOT NULL AND EXISTS (SELECT 1 FROM community_member pv_cm WHERE pv_cm."communityId" = ${alias}.communityId AND pv_cm."userId" = :pv_member_account_id AND pv_cm.status = 'approved')`,
                            { pv_member_account_id: scope.viewerAccountId }
                          );
                      })
                    );
                    vis.orWhere(
                      new Brackets((legacyPosts) => {
                        legacyPosts
                          .where(`${alias}.visibility = :pv_legacy_public`, {
                            pv_legacy_public: 'public',
                          })
                          .andWhere(
                            `${alias}.publicAudienceExplicit = :pv_legacy_explicit`,
                            { pv_legacy_explicit: false }
                          )
                          .andWhere(
                            `${alias}.communityId IS NOT NULL AND EXISTS (SELECT 1 FROM community_member pv_legacy_cm WHERE pv_legacy_cm."communityId" = ${alias}.communityId AND pv_legacy_cm."userId" = :pv_member_account_id AND pv_legacy_cm.status = 'approved')`,
                            { pv_member_account_id: scope.viewerAccountId }
                          );
                      })
                    );
                  }
                })
              );
            })
          );

          // Author-own arm: the viewer always sees their own posts.
          if (viewerProfileId) {
            visibility.orWhere(`${alias}.profileId = :pv_viewer`, {
              pv_viewer: viewerProfileId,
            });
          }
        })
      );
      outer.andWhere(
        `(${alias}.communityId IS NULL OR EXISTS (SELECT 1 FROM community c WHERE c.id = ${alias}.communityId AND ((c."isPrivate" = false AND NOT (${alias}.visibility = 'community' OR (${alias}.visibility = 'public' AND ${alias}.publicAudienceExplicit = false))) OR EXISTS (SELECT 1 FROM community_member cm WHERE cm."communityId" = c.id AND cm."userId" = :pv_account_id AND cm.status = 'approved'))))`,
        { pv_account_id: scope.viewerAccountId ?? '__anonymous__' }
      );
    })
  );
}
