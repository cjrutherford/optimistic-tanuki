import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { OAuthService } from '@optimistic-tanuki/auth-ui';
import { AuthSessionService } from '../services/auth-session.service';
import { ConfigurableClientLoginComponent } from './configurable-client-login.component';

describe('ConfigurableClientLoginComponent', () => {
  let http: HttpTestingController;
  const oauth = { configureProviders: jest.fn() };
  const auth = {
    login: jest.fn(),
    restoreSession: jest.fn(),
  };
  const navigateByUrl = jest.fn();
  let returnTo = '/';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthSessionService, useValue: auth },
        { provide: OAuthService, useValue: oauth },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'returnTo' ? returnTo : null),
              },
            },
          },
        },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    oauth.configureProviders.mockClear();
    auth.login.mockReset();
    auth.restoreSession.mockReset();
    navigateByUrl.mockReset();
    returnTo = '/';
  });

  afterEach(() => http.verify());

  it('loads server-advertised OAuth providers when the sign-in entry starts', async () => {
    const component = TestBed.runInInjectionContext(
      () => new ConfigurableClientLoginComponent()
    );

    component.ngOnInit();
    const request = http.expectOne('/api/oauth/config');
    request.flush({ google: { clientId: 'google-client', enabled: true } });
    await Promise.resolve();

    expect(oauth.configureProviders).toHaveBeenCalledWith({
      google: { clientId: 'google-client', enabled: true },
    });
  });

  it('returns to the preserved app context after email sign-in', async () => {
    returnTo = '/app/demo-app?workspaceSlug=north-star';
    auth.login.mockResolvedValue(true);
    const component = TestBed.runInInjectionContext(
      () => new ConfigurableClientLoginComponent()
    );

    await component.onSubmit({
      email: 'owner@example.com',
      password: 'secret',
    } as any);

    expect(navigateByUrl).toHaveBeenCalledWith(
      '/app/demo-app?workspaceSlug=north-star'
    );
  });

  it('drops an unsafe external return target instead of navigating away', async () => {
    returnTo = 'https://evil.example/steal';
    auth.login.mockResolvedValue(true);
    const component = TestBed.runInInjectionContext(
      () => new ConfigurableClientLoginComponent()
    );

    await component.onSubmit({
      email: 'owner@example.com',
      password: 'secret',
    } as any);

    expect(navigateByUrl).toHaveBeenCalledWith('/');
  });
});
