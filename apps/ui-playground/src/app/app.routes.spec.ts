import { routes } from './app.routes';
import { NavSidebarComponent } from './shared';

describe('ui-playground routes', () => {
  it('includes the full curated library route set', () => {
    const libraryPaths = routes
      .map((route) => route.path)
      .filter((path): path is string => path !== undefined && path !== '**');

    expect(libraryPaths).toEqual([
      '',
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
      'validation',
    ]);
  });

  it('keeps the sidebar library index aligned with the route set', () => {
    const component = new NavSidebarComponent();

    expect(component.libraries.map((library) => library.path)).toEqual([
      '/motion-ui',
      '/common-ui',
      '/form-ui',
      '/theme-ui',
      '/navigation-ui',
      '/social-ui',
      '/notification-ui',
      '/store-ui',
      '/auth-ui',
      '/profile-ui',
      '/chat-ui',
      '/message-ui',
      '/search-ui',
      '/persona-ui',
      '/ag-grid-ui',
      '/validation',
    ]);
  });
});
