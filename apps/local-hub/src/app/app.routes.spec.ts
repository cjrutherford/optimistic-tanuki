import { AuthGuard } from './guards/auth.guard';
import { appRoutes } from './app.routes';
import { PublicContactPageComponent } from '@optimistic-tanuki/common-ui';

describe('local-hub direct product routes', () => {
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

  it('keeps the existing account route behind authentication', () => {
    const route = appRoutes.find((candidate) => candidate.path === 'account');

    expect(route?.canActivate).toEqual([AuthGuard]);
  });
});
