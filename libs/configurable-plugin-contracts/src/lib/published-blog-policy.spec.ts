import {
  resolveBlogCatalogReference,
  resolvePublishedBlogCatalogId,
} from './published-blog-policy';

describe('published Blog resource policy', () => {
  it('accepts only a blog-catalog resource reference', () => {
    expect(
      resolveBlogCatalogReference({ type: 'blog-catalog', id: ' catalog-1 ' })
    ).toBe('catalog-1');
    expect(
      resolveBlogCatalogReference({ type: 'store-catalog', id: 'catalog-1' })
    ).toBeUndefined();
  });

  it('resolves a catalog only for an enabled public Blogging placement', () => {
    expect(
      resolvePublishedBlogCatalogId({
        enabled: true,
        placement: 'public-content',
        resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
      })
    ).toBe('catalog-1');
    expect(
      resolvePublishedBlogCatalogId({
        enabled: true,
        placement: 'public-navigation',
        resourceRef: { type: 'blog-catalog', id: 'catalog-navigation' },
      })
    ).toBe('catalog-navigation');
    expect(
      resolvePublishedBlogCatalogId({
        enabled: true,
        placement: 'owner',
        resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
      })
    ).toBeUndefined();
    expect(
      resolvePublishedBlogCatalogId({
        enabled: true,
        placement: 'public-content',
        resourceRef: { type: 'store-catalog', id: 'catalog-1' },
      })
    ).toBeUndefined();
  });
});
