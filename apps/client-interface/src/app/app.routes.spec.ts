import { AuthGuard } from './guards/auth.guard';
import { ProfileGuard } from './guards/profile.guard';
import { appRoutes } from './app.routes';
import { PublicContactPageComponent } from '@optimistic-tanuki/common-ui';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  ResolveFn,
  Route,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthStateService } from './state/auth-state.service';

describe('client-interface direct product routes', () => {
  async function communityActor(session: {
    userId: string;
    profileId?: string;
  }) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthStateService,
          useValue: {
            getPersistedSelectedProfile: () => ({
              id: 'legacy-global-profile',
            }),
            getDecodedTokenValue: () => session,
          },
        },
      ],
    });
    const community = appRoutes.find((route) => route.path === 'communities')!;
    const routes = await (community.loadChildren as () => Promise<Route[]>)();
    const chat = routes[0].children!.find(
      (route) => route.path === ':communitySlug/chat'
    )!;
    const resolver = chat.resolve!['currentUserId'] as ResolveFn<string>;
    return TestBed.runInInjectionContext(() =>
      resolver({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  }

  it('uses the session profile for community chat instead of an old selected profile', async () => {
    expect(
      await communityActor({
        userId: 'account',
        profileId: 'active-ot-profile',
      })
    ).toBe('active-ot-profile');
  });

  it('does not substitute an account or stored profile when the session has no profile', async () => {
    expect(await communityActor({ userId: 'account' })).toBe('');
  });

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
