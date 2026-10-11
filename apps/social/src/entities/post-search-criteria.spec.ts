import { FindOperator, FindOptionsWhere } from 'typeorm';
import { Post, postSearchDtoToFindManyOptions } from './post.entity';
import {
  PostVisibilityScope,
  visiblePostWhere,
} from '../app/common/post-visibility.util';

describe('post search criteria', () => {
  const postId = '72ab3104-78c8-4d1b-9a61-ec7de68fd6b6';
  const communityId = 'a3b2d967-5d89-4ae4-b1c1-3c72f41fe440';
  const scope: PostVisibilityScope = {
    viewerProfileId: 'viewer-profile',
    followedProfileIds: ['followed-profile'],
    blockedProfileIds: [],
    viewerAccountId: 'viewer-account',
  };

  it('maps an exact post id instead of leaving the query unfiltered', () => {
    const options = postSearchDtoToFindManyOptions({ id: postId });

    expect(options.where).toEqual({ id: postId });
  });

  it('keeps exact id and community criteria on every visibility branch', () => {
    const options = postSearchDtoToFindManyOptions({
      id: postId,
      communityId,
      appScope: 'social',
      title: 'release check',
    });
    const branches = visiblePostWhere(
      scope,
      options.where as FindOptionsWhere<Post>
    );

    expect(branches).toHaveLength(6);
    for (const branch of branches) {
      expect(branch.id).toBe(postId);
      expect(branch.appScope).toBe('social');
      expect(branch.title).toBeInstanceOf(FindOperator);
      expect(branch.communityId).toBeInstanceOf(FindOperator);
    }
  });

  it('leaves exact id absent when callers use the existing non-id filters', () => {
    const options = postSearchDtoToFindManyOptions({
      communityId,
      appScope: 'local-hub',
    });

    expect(options.where).toEqual({
      communityId,
      appScope: 'local-hub',
    });
    expect((options.where as FindOptionsWhere<Post>).id).toBeUndefined();
  });
});
