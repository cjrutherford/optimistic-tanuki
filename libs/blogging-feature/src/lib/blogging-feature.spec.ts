import { BLOGGING_POSTS_FEATURE } from './blogging-feature';

describe('Blogging configurable feature shell', () => {
  it('declares public and owner routes for the blogging.posts capability', () => {
    expect(BLOGGING_POSTS_FEATURE).toEqual({
      id: 'blogging-posts',
      surfaceType: 'business-site',
      routes: [
        {
          id: 'blogging-posts-public',
          capabilityId: 'blogging.posts',
          placement: 'public',
        },
        {
          id: 'blogging-posts-owner',
          capabilityId: 'blogging.posts',
          placement: 'owner',
        },
      ],
    });
  });
});
