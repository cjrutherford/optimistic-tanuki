import { EnvironmentInjector } from '@angular/core';
import { runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  CanActivateFn,
  Router,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '@angular/router';
import {
  FINANCE_HOST_CONFIG,
  createFinanceRoutes,
  financeRoutes,
  financeHostReadyGuard,
  type FinanceHostConfig,
} from './finance.routes';

describe('financeRoutes host seams', () => {
  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/workspace/personal' } as RouterStateSnapshot;

  it('keeps Fin Commander defaults when no host config override is provided', () => {
    expect(financeRoutes[0].path).toBe('onboarding');
    expect(financeRoutes[1].children?.[0].redirectTo).toBe('personal');
  });

  it('creates routes using the host-provided default workspace', () => {
    const routes = createFinanceRoutes({
      routeBase: '/workspace',
      shellTitle: 'Embedded Finance',
      defaultWorkspace: 'business',
    });

    expect(routes[1].children?.[0].redirectTo).toBe('business');
  });

  it('redirects through the host when host readiness requirements fail', async () => {
    const hostConfig: FinanceHostConfig = {
      routeBase: '/workspace',
      shellTitle: 'Embedded Finance',
      authGuardLabel: 'Host session',
      defaultWorkspace: 'personal',
      isReady: async () => false,
      redirectTo: '/host/login',
    };
    const navigate = jest.fn().mockResolvedValue(true);

    await TestBed.configureTestingModule({
      providers: [
        {
          provide: FINANCE_HOST_CONFIG,
          useValue: hostConfig,
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: navigate,
          },
        },
      ],
    }).compileComponents();

    const injector = TestBed.inject(EnvironmentInjector);
    const result = await runInInjectionContext(injector, () =>
      (financeHostReadyGuard as CanActivateFn)(route, state)
    );

    expect(result).toBe(false);
    expect(navigate).toHaveBeenCalledWith('/host/login');
  });
});
