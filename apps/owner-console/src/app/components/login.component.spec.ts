import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { OAuthService } from '@optimistic-tanuki/auth-ui';

import { AuthService } from '../services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const login = jest.fn();
  const setToken = jest.fn();
  const restoreSession = jest.fn();
  const get = jest.fn();

  function createComponent(queryParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [LoginComponent, RouterTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login,
            setToken,
            restoreSession,
          },
        },
        {
          provide: HttpClient,
          useValue: {
            get,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of(queryParams),
            snapshot: { queryParams },
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(LoginComponent);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    get.mockReturnValue(of({ providers: [] }));
    restoreSession.mockReturnValue(of(true));
  });

  it('shows an inline notice when OAuth provider config cannot be loaded', async () => {
    get.mockReturnValue(throwError(() => new Error('Missing config')));
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { component } = createComponent();

    await component['loadOAuthConfig']();

    expect(component.oauthConfigMessage).toBe(
      'OAuth provider configuration is unavailable right now. Use email/password sign-in until providers are configured.'
    );
    expect(consoleSpy.mock.calls.flat()).not.toContain(
      'OAuth config not loaded from server, using defaults'
    );

    consoleSpy.mockRestore();
  });

  it('clears the OAuth notice after provider config loads successfully', async () => {
    const configureProvidersSpy = jest
      .spyOn(OAuthService.prototype, 'configureProviders')
      .mockImplementation(() => {});
    const { component } = createComponent();

    component.oauthConfigMessage = 'stale';
    await component['loadOAuthConfig']();

    expect(component.oauthConfigMessage).toBe('');
    expect(configureProvidersSpy).toHaveBeenCalledWith({ providers: [] });

    configureProvidersSpy.mockRestore();
  });

  it('does not expose a public owner registration link', () => {
    const { fixture } = createComponent();

    expect(fixture.nativeElement.textContent).not.toContain(
      'Register as Owner'
    );
    expect(
      fixture.nativeElement.querySelector('a[href="/register"]')
    ).toBeNull();
  });

  it('explains that owner accounts must be provisioned after a legacy registration redirect', () => {
    const { fixture } = createComponent({ provisioning: 'required' });

    expect(fixture.nativeElement.textContent).toContain(
      'Owner accounts must be provisioned by an existing operator.'
    );
  });

  it('announces provisioning guidance as a status update', () => {
    const { fixture } = createComponent({ provisioning: 'required' });

    expect(
      fixture.nativeElement.querySelector('[role="status"]')?.textContent
    ).toContain('Owner accounts must be provisioned');
  });

  it('requires an OAuth user without an owner account to be provisioned', async () => {
    const initiateOAuthLogin = jest
      .spyOn(OAuthService.prototype, 'initiateOAuthLogin')
      .mockResolvedValue({
        success: false,
        needsRegistration: true,
        userData: {
          displayName: 'New Operator',
          provider: 'google',
          providerUserId: 'oauth-user-1',
          email: 'operator@example.com',
        },
      });
    const completeOAuthRegistration = jest
      .spyOn(OAuthService.prototype, 'completeOAuthRegistration')
      .mockResolvedValue({ success: true, token: 'should-not-be-issued' });
    const { component } = createComponent();

    await component.onOAuthProvider({ provider: 'google' } as any);

    expect(completeOAuthRegistration).not.toHaveBeenCalled();
    expect(component.error).toContain('provisioned');

    initiateOAuthLogin.mockRestore();
    completeOAuthRegistration.mockRestore();
  });

  it('starts OAuth with a cookie session and restores it before navigating', async () => {
    const initiateOAuthLogin = jest
      .spyOn(OAuthService.prototype, 'initiateOAuthLogin')
      .mockResolvedValue({ success: true, session: true });
    const { component } = createComponent();
    const router = TestBed.inject(Router);

    await component.onOAuthProvider({ provider: 'google' } as any);

    expect(initiateOAuthLogin).toHaveBeenCalledWith(
      'google',
      'owner-console',
      true
    );
    expect(restoreSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);

    initiateOAuthLogin.mockRestore();
  });

  it('restores the cookie session after password login before navigating', async () => {
    login.mockReturnValue(of({ data: {} }));
    const { component } = createComponent();
    const router = TestBed.inject(Router);

    component.onLogin({ email: 'owner@example.com', password: 'password' });
    await Promise.resolve();

    expect(restoreSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
