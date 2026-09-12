import { AuthGuard } from './guards/auth.guard';
import { ProfileGuard } from './guards/profile.guard';
import { appRoutes } from './app.routes';

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
});
