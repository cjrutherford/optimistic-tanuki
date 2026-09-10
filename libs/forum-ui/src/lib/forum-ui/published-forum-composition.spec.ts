import { resolveForumPublishedComposition } from './published-forum-composition';

describe('Forum published composition', () => {
  it('resolves the shared published policy for public discussions', () => {
    expect(resolveForumPublishedComposition()).toEqual(
      expect.objectContaining({
        kind: 'capability',
        capabilityId: 'forum.discussions',
        placement: 'public-content',
        resourceRef: { type: 'forum', id: 'forum-north-star' },
      })
    );
  });
});
