import { AuthGuard } from './guards/auth.guard';
import { ProfileGuard } from './guards/profile.guard';
import { appRoutes } from './app.routes';
import { PublicContactPageComponent } from '@optimistic-tanuki/common-ui';

describe('client-interface direct product routes', () => {
  it('keeps the Social feed behind the existing session and profile guards', () => {
    const route = appRoutes.find((candidate) => candidate.path === 'feed');

    expect(route?.canActivate).toEqual([AuthGuard, ProfileGuard]);
  });

  it('keeps the Forum entry public while its child routes resolve identity context', () => {
    const route = appRoutes.find((candidate) => candidate.path === 'forum');

    expect(route?.canActivate).toBeUndefined();
    expect(route?.loadChildren).toBeDefined();
  });

  it('loads the shared contact page as an explicit public route before the fallback', async () => {
    const contactIndex = appRoutes.findIndex(
      (candidate) => candidate.path === 'contact'
    );
    const fallbackIndex = appRoutes.findIndex(
      (candidate) => candidate.path === '**'
    );
    const contactRoute = appRoutes[contactIndex];
    expect(contactIndex).toBeGreaterThanOrEqual(0);
    expect(contactIndex).toBeLessThan(fallbackIndex);
    expect(contactRoute.canActivate).toBeUndefined();
    expect(contactRoute.component).toBe(PublicContactPageComponent);
  });
});
