import { resolveBloggingPublishedComposition } from './published-blogging-composition';

describe('Blogging published composition', () => {
  it('resolves the shared published policy for public blog content', () => {
    expect(resolveBloggingPublishedComposition()).toEqual(
      expect.objectContaining({
        kind: 'capability',
        capabilityId: 'blogging.posts',
        placement: 'public-content',
        resourceRef: { type: 'blog-catalog', id: 'blog-north-star' },
      })
    );
  });
});
