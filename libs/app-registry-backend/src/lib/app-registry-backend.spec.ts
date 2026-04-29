import {
  DEFAULT_APP_REGISTRY,
  DEFAULT_NAVIGATION_LINKS,
} from '../index';

describe('app-registry-backend', () => {
  it('exposes the default registry through a server-safe package', () => {
    expect(DEFAULT_APP_REGISTRY.apps.map((app) => app.appId)).toContain('hai');
    expect(DEFAULT_APP_REGISTRY.apps.map((app) => app.appId)).toContain(
      'system-configurator'
    );
  });

  it('exposes bundled navigation links without any Angular runtime dependency', () => {
    expect(DEFAULT_NAVIGATION_LINKS.map((link) => link.linkId)).toContain(
      'hai-to-configurator'
    );
  });
});
