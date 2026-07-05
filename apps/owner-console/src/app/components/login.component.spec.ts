import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { OAuthService } from '@optimistic-tanuki/auth-ui';

import { AuthService } from '../services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const login = jest.fn();
  const setToken = jest.fn();
  const get = jest.fn();

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [LoginComponent, RouterTestingModule],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login,
            setToken,
          },
        },
        {
          provide: HttpClient,
          useValue: {
            get,
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
});
