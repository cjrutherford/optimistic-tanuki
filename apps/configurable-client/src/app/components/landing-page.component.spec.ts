import {
  publishedAppBasePath,
  publishedAppFeaturePath,
} from './landing-page.component';

describe('published client route context', () => {
  it.each([
    ['/app/north-star', '/app/north-star', '/'],
    ['/app/north-star/blog', '/app/north-star', '/blog'],
    ['/config/config-1', '/config/config-1', '/'],
    ['/config/config-1/blog?ref=shared', '/config/config-1', '/blog'],
    ['/blog', '/', '/blog'],
    ['/', '/', '/'],
  ])('keeps %s inside its published context', (url, basePath, featurePath) => {
    expect(publishedAppBasePath(url)).toBe(basePath);
    expect(publishedAppFeaturePath(url)).toBe(featurePath);
  });
});
