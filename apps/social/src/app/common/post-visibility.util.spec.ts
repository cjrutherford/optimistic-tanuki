import { Brackets, FindOperator, FindOptionsWhere } from 'typeorm';
import { Post } from '../../entities/post.entity';
import {
  applyVisiblePostScope,
  PostVisibilityScope,
  visiblePostWhere,
} from './post-visibility.util';

function isOperator(value: unknown, type: string): value is FindOperator<any> {
  return value instanceof FindOperator && value.type === type;
}

describe('visiblePostWhere (where-fragment form)', () => {
  it('no viewer -> public + visible + unscheduled only', () => {
    const scope: PostVisibilityScope = {
      viewerProfileId: undefined,
      followedProfileIds: [],
      blockedProfileIds: [],
    };

    const branches = visiblePostWhere(scope);

    expect(branches).toHaveLength(1);
    expect(branches[0]).toEqual({
      visibility: 'public',
      moderationStatus: 'visible',
      isScheduled: false,
      communityId: expect.any(FindOperator),
    });
  });

  it('carries the base fragment into every branch', () => {
    const scope: PostVisibilityScope = {
      viewerProfileId: 'viewer',
      followedProfileIds: ['author-1'],
      blockedProfileIds: [],
    };

    const branches = visiblePostWhere(scope, { title: 'hello' as any });

    for (const branch of branches) {
      expect((branch as FindOptionsWhere<Post>).title).toBe('hello');
    }
  });

  it('viewer sees their own posts via an unconstrained author-own branch (hidden + scheduled)', () => {
    const scope: PostVisibilityScope = {
      viewerProfileId: 'viewer',
      followedProfileIds: [],
      blockedProfileIds: [],
    };

    const branches = visiblePostWhere(scope);
    const ownBranch = branches.find((b) =>
      isOperator((b as FindOptionsWhere<Post>).profileId, 'equal')
    );

    // The author-own branch does not constrain moderationStatus, isScheduled,
    // or visibility, so the author sees their own hidden and scheduled posts.
    expect((ownBranch as FindOptionsWhere<Post>).profileId).toEqual(
      expect.objectContaining({ type: 'equal', value: 'viewer' })
    );
  });

  it('followers-only posts are visible to a follower', () => {
    const scope: PostVisibilityScope = {
      viewerProfileId: 'viewer',
      followedProfileIds: ['author-1', 'author-2'],
      blockedProfileIds: [],
    };

    const branches = visiblePostWhere(scope);
    const followersBranch = branches.find(
      (b) => (b as FindOptionsWhere<Post>).visibility === 'followers'
    ) as FindOptionsWhere<Post> | undefined;

    expect(followersBranch).toBeDefined();
    expect(followersBranch!.moderationStatus).toBe('visible');
    expect(followersBranch!.isScheduled).toBe(false);
    expect(isOperator(followersBranch!.profileId, 'in')).toBe(true);
    // followed authors ∪ {viewer}
    expect((followersBranch!.profileId as FindOperator<any>).value).toEqual([
      'author-1',
      'author-2',
      'viewer',
    ]);
  });

  it('followers-only posts are invisible to a non-follower (only public + own branches)', () => {
    const scope: PostVisibilityScope = {
      viewerProfileId: 'viewer',
      followedProfileIds: [],
      blockedProfileIds: [],
    };

    const branches = visiblePostWhere(scope);
    const followersBranch = branches.find(
      (b) => (b as FindOptionsWhere<Post>).visibility === 'followers'
    );

    // With no follows, the only followers-branch author would be the viewer,
    // already covered by the author-own branch; there is no branch that
    // exposes anyone else's followers-only posts.
    expect(followersBranch).toBeDefined();
    expect(
      (followersBranch as FindOptionsWhere<Post>).profileId
    ).toBeInstanceOf(FindOperator);
    expect(
      (
        (followersBranch as FindOptionsWhere<Post>)
          .profileId as FindOperator<any>
      ).value
    ).toEqual(['viewer']);
  });

  it('excludes blocked authors both directions on public/followers branches', () => {
    const scope: PostVisibilityScope = {
      viewerProfileId: 'viewer',
      followedProfileIds: ['friend', 'blocked-friend'],
      // union of viewer-blocked and blockers-of-viewer
      blockedProfileIds: ['blocked-friend', 'i-blocked-viewer'],
    };

    const branches = visiblePostWhere(scope);

    const publicBranch = branches.find(
      (b) => (b as FindOptionsWhere<Post>).visibility === 'public'
    ) as FindOptionsWhere<Post>;
    expect(isOperator(publicBranch.profileId, 'not')).toBe(true);
    // FindOperator.value recursively unwraps Not(In([...])) to the array.
    expect((publicBranch.profileId as FindOperator<any>).value).toEqual([
      'blocked-friend',
      'i-blocked-viewer',
    ]);

    const followersBranch = branches.find(
      (b) => (b as FindOptionsWhere<Post>).visibility === 'followers'
    ) as FindOptionsWhere<Post>;
    // blocked authors are stripped from the followed IN(...) list
    expect((followersBranch.profileId as FindOperator<any>).value).toEqual([
      'friend',
      'viewer',
    ]);
  });

  it('empty block list emits no exclusion clause on the public branch', () => {
    const scope: PostVisibilityScope = {
      viewerProfileId: undefined,
      followedProfileIds: [],
      blockedProfileIds: [],
    };

    const [publicBranch] = visiblePostWhere(scope);
    expect((publicBranch as FindOptionsWhere<Post>).profileId).toBeUndefined();
  });

  it('constrains every visibility branch to a public or accessible community', () => {
    const branches = visiblePostWhere({
      viewerProfileId: 'viewer',
      followedProfileIds: ['friend'],
      blockedProfileIds: [],
      viewerAccountId: 'viewer-account',
    });

    expect(branches.length).toBeGreaterThan(1);
    for (const branch of branches) {
      const communityFilter = (branch as FindOptionsWhere<Post>)
        .communityId as FindOperator<any>;
      expect(communityFilter).toBeInstanceOf(FindOperator);
      expect(communityFilter.type).toBe('raw');
      expect((communityFilter as any)._objectLiteralParameters).toEqual({
        pv_account_id: 'viewer-account',
      });
      expect((communityFilter as any)._getSql('post.communityId')).toContain(
        "cm.status = 'approved'"
      );
    }
  });

  it('intersects caller profile filters with policy branches', () => {
    const branches = visiblePostWhere(
      {
        viewerProfileId: 'viewer',
        followedProfileIds: ['followed'],
        blockedProfileIds: ['blocked'],
      },
      { profileId: 'requested-author' as any }
    );
    expect(branches).toHaveLength(3);
    for (const branch of branches) {
      const profileFilter = branch.profileId as FindOperator<any>;
      expect(profileFilter.type).toBe('and');
      expect(
        (profileFilter.value as FindOperator<any>[]).some(
          (filter) => filter.value === 'requested-author'
        )
      ).toBe(true);
    }
  });

  it('deduplicates ids across follow and block inputs', () => {
    const scope: PostVisibilityScope = {
      viewerProfileId: 'viewer',
      followedProfileIds: ['dup', 'dup', 'other'],
      blockedProfileIds: ['b', 'b'],
    };

    const branches = visiblePostWhere(scope);
    const followersBranch = branches.find(
      (b) => (b as FindOptionsWhere<Post>).visibility === 'followers'
    ) as FindOptionsWhere<Post>;
    expect((followersBranch.profileId as FindOperator<any>).value).toEqual([
      'dup',
      'other',
      'viewer',
    ]);

    const publicBranch = branches.find(
      (b) => (b as FindOptionsWhere<Post>).visibility === 'public'
    ) as FindOptionsWhere<Post>;
    expect((publicBranch.profileId as FindOperator<any>).value).toEqual(['b']);
  });
});

/**
 * Minimal recorder implementing the WhereExpressionBuilder surface used by
 * applyVisiblePostScope. It flattens nested Brackets into a list of leaf SQL
 * clauses with their bound params so predicates can be asserted.
 */
class WhereRecorder {
  clauses: string[] = [];
  params: Record<string, unknown> = {};

  where(arg: string | Brackets, params?: Record<string, unknown>): this {
    return this.capture(arg, params);
  }
  andWhere(arg: string | Brackets, params?: Record<string, unknown>): this {
    return this.capture(arg, params);
  }
  orWhere(arg: string | Brackets, params?: Record<string, unknown>): this {
    return this.capture(arg, params);
  }

  private capture(
    arg: string | Brackets,
    params?: Record<string, unknown>
  ): this {
    if (arg instanceof Brackets) {
      (arg.whereFactory as (qb: WhereRecorder) => void)(this);
    } else {
      this.clauses.push(arg);
      Object.assign(this.params, params ?? {});
    }
    return this;
  }

  get sql(): string {
    return this.clauses.join(' | ');
  }
}

describe('applyVisiblePostScope (query-builder form)', () => {
  function run(scope: PostVisibilityScope): WhereRecorder {
    const recorder = new WhereRecorder();
    const returned = applyVisiblePostScope(recorder as any, scope, 'post');
    expect(returned).toBe(recorder);
    return recorder;
  }

  it('no viewer -> visible, unscheduled, public only; no IN/NOT IN, no viewer clause', () => {
    const recorder = run({
      viewerProfileId: undefined,
      followedProfileIds: [],
      blockedProfileIds: [],
    });

    expect(recorder.sql).toContain('post.moderationStatus = :pv_visible');
    expect(recorder.sql).toContain('post.isScheduled = :pv_scheduled');
    expect(recorder.sql).toContain('post.visibility = :pv_public');
    expect(recorder.sql).not.toContain('IN (:...pv_followed)');
    expect(recorder.sql).not.toContain('NOT IN (:...pv_blocked)');
    expect(recorder.sql).not.toContain('post.profileId = :pv_viewer');
    expect(recorder.params.pv_visible).toBe('visible');
    expect(recorder.params.pv_scheduled).toBe(false);
  });

  it('viewer with follows and blocks emits the full predicate with params', () => {
    const recorder = run({
      viewerProfileId: 'viewer',
      followedProfileIds: ['friend'],
      blockedProfileIds: ['blocked'],
    });

    expect(recorder.sql).toContain('post.profileId NOT IN (:...pv_blocked)');
    expect(recorder.sql).toContain('post.profileId IN (:...pv_followed)');
    expect(recorder.sql).toContain('post.visibility = :pv_followers');
    expect(recorder.sql).toContain('post.profileId = :pv_viewer');
    expect(recorder.params.pv_blocked).toEqual(['blocked']);
    expect(recorder.params.pv_followed).toEqual(['friend', 'viewer']);
    expect(recorder.params.pv_viewer).toBe('viewer');
  });

  it('empty block list emits no NOT IN clause', () => {
    const recorder = run({
      viewerProfileId: 'viewer',
      followedProfileIds: [],
      blockedProfileIds: [],
    });
    expect(recorder.sql).not.toContain('NOT IN (:...pv_blocked)');
    // viewer still has an IN list (contains itself) and an own-branch clause
    expect(recorder.params.pv_followed).toEqual(['viewer']);
    expect(recorder.sql).toContain('post.profileId = :pv_viewer');
  });

  it('applies community access outside the query-builder visibility OR', () => {
    const recorder = run({
      viewerProfileId: 'viewer',
      followedProfileIds: ['friend'],
      blockedProfileIds: [],
      viewerAccountId: 'viewer-account',
    });

    expect(recorder.sql).toContain('post.communityId IS NULL OR EXISTS');
    expect(recorder.sql).toContain('community_member cm');
    expect(recorder.sql).toContain('cm."userId" = :pv_account_id');
    expect(recorder.params.pv_account_id).toBe('viewer-account');
  });
});
