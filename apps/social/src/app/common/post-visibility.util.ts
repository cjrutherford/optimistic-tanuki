import {
  Brackets,
  FindOptionsWhere,
  In,
  Not,
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
}

function uniqueDefined(values: (string | undefined)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => !!value))
  );
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
  const { viewerProfileId, followedProfileIds, blockedProfileIds } = scope;
  const blocked = uniqueDefined(blockedProfileIds);
  const branches: FindOptionsWhere<Post>[] = [];

  // Public, visible, unscheduled posts (visible to everyone).
  const publicBranch: FindOptionsWhere<Post> = {
    ...base,
    visibility: 'public',
    moderationStatus: 'visible',
    isScheduled: false,
  };
  if (blocked.length > 0) {
    publicBranch.profileId = Not(In(blocked));
  }
  branches.push(publicBranch);

  // Followers-only posts, visible only to followers (and the viewer's own,
  // which is also covered by the author-own branch below).
  const followedAuthors = uniqueDefined([
    ...followedProfileIds,
    viewerProfileId,
  ]).filter((id) => !blocked.includes(id));
  if (followedAuthors.length > 0) {
    branches.push({
      ...base,
      visibility: 'followers',
      moderationStatus: 'visible',
      isScheduled: false,
      profileId: In(followedAuthors),
    });
  }

  // Author always sees their own posts — including hidden and scheduled ones.
  if (viewerProfileId) {
    branches.push({ ...base, profileId: viewerProfileId });
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
      // Everyone-visible arm: visible, unscheduled, not blocked, and either
      // public or a followers-only post by a followed author.
      outer.where(
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
              vis.where(`${alias}.visibility = :pv_public`, {
                pv_public: 'public',
              });
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
            })
          );
        })
      );

      // Author-own arm: the viewer always sees their own posts.
      if (viewerProfileId) {
        outer.orWhere(`${alias}.profileId = :pv_viewer`, {
          pv_viewer: viewerProfileId,
        });
      }
    })
  );
}
