import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { MessageService } from '@optimistic-tanuki/message-ui';

import { RegisterComponent } from './register.component';
import { AuthenticationService } from '../../authentication.service';
import { AuthStateService } from '../../auth-state.service';
import { ProfileService } from '../../profile/profile.service';

/**
 * The spec beside this one covers the email registration submit. These drive
 * the OAuth side, whose failure branches all funnel into a user-facing message
 * — the thing a user actually sees when a provider refuses them.
 *
 * The component constructs its own OAuthService in its constructor rather than
 * injecting it, so the instance is reached through the component and its
 * methods replaced per test.
 */
describe('RegisterComponent OAuth', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let http: HttpTestingController;
  let addMessage: jest.Mock;

  interface OAuthLike {
    initiateOAuthLogin: jest.Mock;
    completeOAuthRegistration: jest.Mock;
    configureProviders: jest.Mock;
  }

  const oauth = () =>
    (component as unknown as { oauthService: OAuthLike }).oauthService;

  beforeEach(async () => {
    addMessage = jest.fn();

    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        { provide: AuthenticationService, useValue: { register: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: MessageService, useValue: { addMessage } },
        {
          provide: AuthStateService,
          useValue: {
            setToken: jest.fn(),
            restoreSession: jest.fn(async () => false),
            isAuthenticated: false,
            getDecodedTokenValue: jest.fn(),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getAllProfiles: jest.fn(async () => []),
            currentUserProfiles: jest.fn(() => []),
            selectProfile: jest.fn(),
          },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);

    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('loading the provider config', () => {
    it('hands a returned config to the OAuth service', async () => {
      const configure = jest.fn();
      oauth().configureProviders = configure;

      component.ngOnInit();
      http.expectOne('/api/oauth/config').flush({ google: { enabled: true } });
      await Promise.resolve();

      expect(configure).toHaveBeenCalledWith({ google: { enabled: true } });
    });

    it('falls back to defaults when the request fails', async () => {
      const configure = jest.fn();
      oauth().configureProviders = configure;

      component.ngOnInit();
      http
        .expectOne('/api/oauth/config')
        .flush(null, { status: 500, statusText: 'Server Error' });
      await Promise.resolve();

      // Swallowed on purpose — a missing config must not block registration.
      expect(configure).not.toHaveBeenCalled();
    });
  });

  describe('provider failures', () => {
    it('surfaces the provider’s own error message', async () => {
      oauth().initiateOAuthLogin = jest.fn(async () => ({
        success: false,
        error: 'Provider said no',
      }));

      await component.onOAuthProvider({ provider: 'google' } as never);

      expect(addMessage).toHaveBeenCalledWith({
        content: 'Provider said no',
        type: 'error',
      });
    });

    it('falls back to a generic message when the provider gives none', async () => {
      oauth().initiateOAuthLogin = jest.fn(async () => ({ success: false }));

      await component.onOAuthProvider({ provider: 'google' } as never);

      expect(addMessage).toHaveBeenCalledWith({
        content: 'OAuth registration failed. Please try again.',
        type: 'error',
      });
    });

    it('reports a thrown error rather than letting it escape', async () => {
      oauth().initiateOAuthLogin = jest.fn(async () => {
        throw new Error('network down');
      });

      await expect(
        component.onOAuthProvider({ provider: 'google' } as never)
      ).resolves.toBeUndefined();

      expect(addMessage).toHaveBeenCalledWith({
        content: 'network down',
        type: 'error',
      });
    });

    it('warns when a session cannot be restored without a token', async () => {
      oauth().initiateOAuthLogin = jest.fn(async () => ({
        success: true,
        session: true,
      }));

      await component.onOAuthProvider({ provider: 'google' } as never);

      expect(addMessage).toHaveBeenCalledWith({
        content:
          'OAuth registration could not restore your session. Please try again.',
        type: 'error',
      });
    });
  });

  describe('completing a new registration', () => {
    it('reports a failed completion', async () => {
      oauth().initiateOAuthLogin = jest.fn(async () => ({
        success: false,
        needsRegistration: true,
        userData: {
          displayName: 'Ada Lovelace',
          provider: 'google',
          providerUserId: 'g-1',
          email: 'ada@example.com',
        },
      }));
      oauth().completeOAuthRegistration = jest.fn(async () => ({
        success: false,
        error: 'Email already taken',
      }));

      await component.onOAuthProvider({ provider: 'google' } as never);

      expect(addMessage).toHaveBeenCalledWith({
        content: 'Email already taken',
        type: 'error',
      });
    });

    it('splits the display name into first and last before completing', async () => {
      oauth().initiateOAuthLogin = jest.fn(async () => ({
        success: false,
        needsRegistration: true,
        userData: {
          displayName: 'Ada Byron Lovelace',
          provider: 'google',
          providerUserId: 'g-1',
          email: 'ada@example.com',
        },
      }));
      const complete = jest.fn(async () => ({ success: false }));
      oauth().completeOAuthRegistration = complete;

      await component.onOAuthProvider({ provider: 'google' } as never);

      // Everything after the first token is the surname.
      expect(complete).toHaveBeenCalledWith(
        'google',
        'g-1',
        'ada@example.com',
        'Ada',
        'Byron Lovelace',
        ''
      );
    });
  });
});
