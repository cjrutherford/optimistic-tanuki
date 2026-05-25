import { docsSlugMatcher, routes } from './app.routes';
import { NavSidebarComponent } from './shared';
import { UrlSegment } from '@angular/router';

describe('ui-playground routes', () => {
  it('includes the full curated library route set', () => {
    const libraryPaths = routes
      .map((route) => route.path)
      .filter((path): path is string => path !== undefined && path !== '**');

    expect(libraryPaths).toEqual([
      '',
      'docs',
      'docs/api/:library',
      'motion-ui',
      'common-ui',
      'form-ui',
      'theme-ui',
      'navigation-ui',
      'social-ui',
      'notification-ui',
      'store-ui',
      'auth-ui',
      'profile-ui',
      'chat-ui',
      'message-ui',
      'search-ui',
      'persona-ui',
      'ag-grid-ui',
      'blogging-ui',
      'business-ui',
      'classified-ui',
      'community-ui',
      'forum-ui',
      'hai-ui',
      'payments-ui',
      'project-ui',
      'validation',
    ]);
  });

  it('captures nested docs slugs through the docs matcher', () => {
    const result = docsSlugMatcher([
      new UrlSegment('docs', {}),
      new UrlSegment('architecture', {}),
      new UrlSegment('workspace-map', {}),
    ]);

    expect(result?.posParams.slug.path).toBe('architecture/workspace-map');
  });

  it('keeps the sidebar library index aligned with the route set', () => {
    const component = new NavSidebarComponent();

    expect(component.libraries.map((library) => library.path)).toEqual([
      '/common-ui',
      '/docs',
      '/docs/operators/overview',
      '/form-ui',
      '/navigation-ui',
      '/theme-ui',
      '/motion-ui',
      '/notification-ui',
      '/social-ui',
      '/docs/operators/runbooks',
      '/auth-ui',
      '/profile-ui',
      '/chat-ui',
      '/message-ui',
      '/store-ui',
      '/blogging-ui',
      '/business-ui',
      '/classified-ui',
      '/community-ui',
      '/forum-ui',
      '/payments-ui',
      '/project-ui',
      '/validation',
      '/search-ui',
      '/persona-ui',
      '/ag-grid-ui',
      '/hai-ui',
    ]);
  });
});
