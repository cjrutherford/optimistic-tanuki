import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { Router } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { By } from '@angular/platform-browser';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  const authStateService = {
    restoreSession: jest.fn().mockResolvedValue(false),
    isAuthenticated: true,
    getDecodedTokenValue: jest.fn(() => ({ profileId: 'profile-1' })),
  };
  const profileService = {
    getAllProfiles: jest.fn().mockResolvedValue([]),
    getCurrentUserProfiles: jest.fn(() => [
      { id: 'profile-1', profileName: 'Test profile' },
    ]),
    selectProfile: jest.fn(),
  };
  const router = { navigate: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AuthStateService, useValue: authStateService },
        { provide: ProfileService, useValue: profileService },
        { provide: Router, useValue: router },
        { provide: MessageService, useValue: { addMessage: jest.fn() } },
        {
          provide: ThemeService,
          useValue: { themeColors$: of(null) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('returns magic-link sessions through login so the cookie session is restored', () => {
    const loginBlock = fixture.debugElement.query(
      By.directive(LoginBlockComponent)
    ).componentInstance as LoginBlockComponent;

    expect(loginBlock.returnPath).toBe('/login');
  });

  it('continues into the feed when a cookie session restores on login startup', async () => {
    authStateService.restoreSession.mockResolvedValue(true);
    jest
      .spyOn(component as any, 'loadOAuthConfig')
      .mockResolvedValue(undefined);

    component.ngOnInit();
    await Promise.resolve();
    await Promise.resolve();

    expect(authStateService.restoreSession).toHaveBeenCalled();
    expect(profileService.selectProfile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'profile-1' })
    );
    expect(router.navigate).toHaveBeenCalledWith(['/feed']);
  });
});

describe('LoginComponent behaviour', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let httpMock: HttpTestingController;
  let authStateService: {
    restoreSession: jest.Mock;
    login: jest.Mock;
    setToken: jest.Mock;
    getDecodedTokenValue: jest.Mock;
    isAuthenticated: boolean;
  };
  let profileService: {
    getAllProfiles: jest.Mock;
    getCurrentUserProfiles: jest.Mock;
    selectProfile: jest.Mock;
  };
  let router: { navigate: jest.Mock };
  let messageService: { addMessage: jest.Mock };
  let oauthService: { initiateOAuthLogin: jest.Mock };
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const themeColors = {
    background: '#fff',
    foreground: '#000',
    accent: '#f00',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    authStateService = {
      restoreSession: jest.fn().mockResolvedValue(false),
      login: jest.fn().mockResolvedValue({ data: {} }),
      setToken: jest.fn(),
      getDecodedTokenValue: jest.fn(() => ({ profileId: 'profile-1' })),
      isAuthenticated: true,
    };
    profileService = {
      getAllProfiles: jest.fn().mockResolvedValue(undefined),
      getCurrentUserProfiles: jest.fn(() => [
        { id: 'profile-1', profileName: 'Test profile' },
      ]),
      selectProfile: jest.fn(),
    };
    router = { navigate: jest.fn() };
    messageService = { addMessage: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent, HttpClientTestingModule],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AuthStateService, useValue: authStateService },
        { provide: ProfileService, useValue: profileService },
        { provide: Router, useValue: router },
        { provide: MessageService, useValue: messageService },
        { provide: ThemeService, useValue: { themeColors$: of(themeColors) } },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    oauthService = { initiateOAuthLogin: jest.fn() };
    (component as unknown as { oauthService: unknown }).oauthService =
      oauthService;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('maps the theme colours onto the inline styles', () => {
    expect(component.themeStyles).toEqual({
      backgroundColor: '#fff',
      color: '#000',
      border: '1px solid #f00',
    });
  });

  it('unsubscribes from the theme on destroy', () => {
    const sub = component.themeSub;
    expect(sub?.closed).toBe(true);
    component.ngOnDestroy();
    expect(sub?.closed).toBe(true);
  });

  describe('loadOAuthConfig', () => {
    it('hands the server config to the oauth service', async () => {
      const configureProviders = jest.fn();
      (
        component as unknown as {
          oauthService: { configureProviders: unknown };
        }
      ).oauthService = { configureProviders } as never;

      const pending = (
        component as unknown as { loadOAuthConfig: () => Promise<void> }
      ).loadOAuthConfig();
      httpMock.expectOne('/api/oauth/config').flush({ google: true });
      await pending;

      expect(configureProviders).toHaveBeenCalledWith({ google: true });
    });

    it('falls back to defaults when the request fails', async () => {
      const pending = (
        component as unknown as { loadOAuthConfig: () => Promise<void> }
      ).loadOAuthConfig();
      httpMock
        .expectOne('/api/oauth/config')
        .flush(null, { status: 500, statusText: 'Server Error' });
      await pending;

      expect(logSpy).toHaveBeenCalledWith(
        'OAuth config not loaded from server, using defaults'
      );
    });
  });

  describe('onSubmit', () => {
    const credentials = {
      email: 'ada@example.com',
      password: 'pw',
    } as never;

    it('selects the first profile and lands on the feed', async () => {
      await component.onSubmit(credentials);

      expect(authStateService.login).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'pw',
      });
      expect(profileService.selectProfile).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'profile-1' })
      );
      expect(router.navigate).toHaveBeenCalledWith(['/feed']);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Login successful! Welcome back.',
        type: 'success',
      });
    });

    it('sends a user with an empty profileId to settings without the modal', async () => {
      authStateService.getDecodedTokenValue.mockReturnValue({ profileId: '' });

      await component.onSubmit(credentials);

      expect(router.navigate).toHaveBeenCalledWith(['/settings'], {
        state: {
          showProfileModal: false,
          profileMessage: 'Please create your profile to continue.',
        },
      });
      expect(profileService.getAllProfiles).not.toHaveBeenCalled();
    });

    it('sends a user with no profiles to settings with the modal', async () => {
      profileService.getCurrentUserProfiles.mockReturnValue([]);

      await component.onSubmit(credentials);

      expect(router.navigate).toHaveBeenCalledWith(['/settings'], {
        state: {
          showProfileModal: true,
          profileMessage:
            'No profiles found. Please create a profile to continue.',
        },
      });
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'No profiles found. Please create a profile to continue.',
        type: 'warning',
      });
    });

    it('does nothing further when the login leaves the user unauthenticated', async () => {
      authStateService.isAuthenticated = false;

      await component.onSubmit(credentials);

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('logs a failed login instead of throwing', async () => {
      authStateService.login.mockRejectedValue(new Error('bad credentials'));

      await expect(component.onSubmit(credentials)).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('onOAuthProvider', () => {
    const event = { provider: 'google' } as never;

    it('adopts a returned token and continues into the feed', async () => {
      oauthService.initiateOAuthLogin.mockResolvedValue({
        success: true,
        token: 'jwt',
      });

      await component.onOAuthProvider(event);

      expect(oauthService.initiateOAuthLogin).toHaveBeenCalledWith(
        'google',
        'client-interface',
        true
      );
      expect(authStateService.setToken).toHaveBeenCalledWith('jwt');
      expect(router.navigate).toHaveBeenCalledWith(['/feed']);
    });

    it('restores a cookie session when only a session is returned', async () => {
      oauthService.initiateOAuthLogin.mockResolvedValue({
        success: true,
        session: true,
      });
      authStateService.restoreSession.mockResolvedValue(true);

      await component.onOAuthProvider(event);

      expect(authStateService.restoreSession).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/feed']);
    });

    it('reports a session that cannot be restored', async () => {
      oauthService.initiateOAuthLogin.mockResolvedValue({
        success: true,
        session: true,
      });
      authStateService.restoreSession.mockResolvedValue(false);

      await component.onOAuthProvider(event);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content:
          'OAuth login could not restore your session. Please try again.',
        type: 'error',
      });
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('reports a missing result', async () => {
      oauthService.initiateOAuthLogin.mockResolvedValue(undefined);

      await component.onOAuthProvider(event);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'OAuth login failed. Please try again.',
        type: 'error',
      });
    });

    it('reports a result that needs registration', async () => {
      oauthService.initiateOAuthLogin.mockResolvedValue({
        needsRegistration: true,
      });

      await component.onOAuthProvider(event);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'OAuth login did not complete. Please try again.',
        type: 'error',
      });
    });

    it('surfaces the provider error message', async () => {
      oauthService.initiateOAuthLogin.mockResolvedValue({
        success: false,
        error: 'provider said no',
      });

      await component.onOAuthProvider(event);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'provider said no',
        type: 'error',
      });
    });

    it('falls back to a generic message for an unexplained failure', async () => {
      oauthService.initiateOAuthLogin.mockResolvedValue({ success: false });

      await component.onOAuthProvider(event);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'OAuth login failed. Please try again.',
        type: 'error',
      });
    });

    it('surfaces a thrown error message', async () => {
      oauthService.initiateOAuthLogin.mockRejectedValue(new Error('network'));

      await component.onOAuthProvider(event);

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'network',
        type: 'error',
      });
    });
  });

  describe('completeAuthenticatedLogin', () => {
    const complete = () =>
      (
        component as unknown as {
          completeAuthenticatedLogin: () => Promise<void>;
        }
      ).completeAuthenticatedLogin();

    it('bails out when the user is not authenticated', async () => {
      authStateService.isAuthenticated = false;

      await complete();

      expect(profileService.getAllProfiles).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('sends a user with an empty profileId to settings', async () => {
      authStateService.getDecodedTokenValue.mockReturnValue({ profileId: '' });

      await complete();

      expect(router.navigate).toHaveBeenCalledWith(['/settings'], {
        state: {
          showProfileModal: false,
          profileMessage: 'Please create your profile to continue.',
        },
      });
    });

    it('sends a user with no profiles to settings with the modal', async () => {
      profileService.getCurrentUserProfiles.mockReturnValue([]);

      await complete();

      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'No profiles found. Please create a profile to continue.',
        type: 'warning',
      });
    });
  });
});
