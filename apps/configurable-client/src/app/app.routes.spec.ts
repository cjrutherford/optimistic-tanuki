import { oauthCallbackRoutes } from '@optimistic-tanuki/auth-ui';
import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthSessionService } from './services/auth-session.service';
import { appRoutes } from './app.routes';

@Component({ standalone: true, template: '<p>guarded</p>' })
class GuardedRouteComponent {}

describe('configurable-client appRoutes', () => {
  it('registers the shared OAuth popup callback before the root resolver', () => {
    expect(appRoutes.map((route) => route.path)).toEqual(
      expect.arrayContaining(['oauth/callback'])
    );
    expect(appRoutes.find((route) => route.path === 'oauth/callback')).toBe(
      oauthCallbackRoutes[0]
    );
    expect(
      appRoutes.findIndex((route) => route.path === 'oauth/callback')
    ).toBeLessThan(appRoutes.findIndex((route) => route.path === ''));
  });

  it('keeps the local login entry and protected resolver routes after callbacks', async () => {
    const callbackIndex = appRoutes.findIndex(
      (route) => route.path === 'oauth/callback'
    );
    const loginIndex = appRoutes.findIndex((route) => route.path === 'login');
    const rootIndex = appRoutes.findIndex((route) => route.path === '');

    expect(loginIndex).toBeGreaterThan(callbackIndex);
    expect(loginIndex).toBeLessThan(rootIndex);
    await expect(appRoutes[loginIndex].loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'ConfigurableClientLoginComponent' })
    );
  });

  it('registers protected owner entry and workspace-scoped dashboard routes', async () => {
    const ownerRoute = appRoutes.find((route) => route.path === 'owner');
    const scopedRoute = appRoutes.find(
      (route) => route.path === 'owner/workspace/:workspaceSlug'
    );

    expect(ownerRoute?.canActivate).toBeDefined();
    expect(scopedRoute?.canActivate).toBeDefined();
    await expect(ownerRoute?.loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'OwnerWorkspaceEntryComponent' })
    );
    await expect(scopedRoute?.loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'OwnerWorkspaceDashboardComponent' })
    );
  });

  it('registers a real scoped authoring route', async () => {
    const route = appRoutes.find(
      (candidate) => candidate.path === 'owner/workspace/:workspaceSlug/author'
    );
    expect(route?.canActivate).toBeDefined();
    await expect(route?.loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'OwnerWorkspaceAuthoringComponent' })
    );
  });

  it('registers a distinct guarded generic configuration editor route', async () => {
    const route = appRoutes.find(
      (candidate) =>
        candidate.path === 'owner/workspace/:workspaceSlug/config/:configId'
    );

    expect(route?.canActivate).toBeDefined();
    expect(route?.canDeactivate).toHaveLength(1);
    expect(
      appRoutes
        .filter((candidate) => candidate.path?.startsWith('owner'))
        .filter((candidate) => candidate.path !== route?.path)
        .every((candidate) => !candidate.canDeactivate)
    ).toBe(true);
    await expect(route?.loadComponent?.()).resolves.toEqual(
      expect.objectContaining({ name: 'OwnerWorkspaceConfigEditorComponent' })
    );
    expect(
      appRoutes.find((candidate) => candidate.path === 'config/:configId')
    ).toBeDefined();
  });

  it('performs a real guarded navigation through RouterTestingHarness', async () => {
    const auth = {
      isSignedIn: false,
      status: 'idle',
      restoreSession: jest.fn().mockResolvedValue(false),
    };
    TestBed.configureTestingModule({
      imports: [GuardedRouteComponent],
      providers: [
        provideRouter([
          {
            path: 'owner',
            canActivate: [
              appRoutes.find((route) => route.path === 'owner')!
                .canActivate![0],
            ],
            component: GuardedRouteComponent,
          },
          { path: 'login', component: GuardedRouteComponent },
        ]),
        { provide: AuthSessionService, useValue: auth },
      ],
    });

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/owner');

    expect(TestBed.inject(Location).path()).toBe('/login?returnTo=%2Fowner');
    expect(auth.restoreSession).not.toHaveBeenCalled();
  });
});
