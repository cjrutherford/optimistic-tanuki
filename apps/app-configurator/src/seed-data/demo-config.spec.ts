import { demoAppConfig, demoAppConfigForScope } from './demo-config';

describe('demo app seed configuration', () => {
  it('keeps the business-site fixture unchanged and publishable only when requested for configurable-client', () => {
    expect(demoAppConfig.domain).toBeUndefined();
    expect(demoAppConfig.manifest).toBeUndefined();

    const configurable = demoAppConfigForScope(
      'configurable-client',
      '11111111-1111-4111-8111-111111111111'
    );

    expect(configurable.domain).toBe('demo-app.configurable-client.local');
    expect(configurable.manifest).toEqual({
      schemaVersion: 1,
      surfaceType: 'business-site',
      capabilities: {
        'blogging.posts': {
          enabled: true,
          placement: 'public-navigation',
          permissions: ['blog.post.read'],
          resourceRef: {
            type: 'blog-catalog',
            id: '11111111-1111-4111-8111-111111111111',
          },
          deepLink: { path: '/blog', label: 'Blog' },
        },
      },
    });
    expect(configurable.features).toEqual(
      expect.objectContaining({ blogging: { enabled: true } })
    );
    expect(configurable.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/blog',
          componentType: 'feature',
          featureName: 'blogging',
          showInNav: true,
        }),
      ])
    );
  });
});
