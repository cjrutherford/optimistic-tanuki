import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RegisterComponent } from './register.component';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { AuthStateService } from '../state/auth-state.service';
import { ProfileService } from '../profile.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent, HttpClientTestingModule],
      providers: [{ provide: API_BASE_URL, useValue: 'http://localhost:3000' }],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reports an error instead of continuing when cookie OAuth session restoration fails', async () => {
    const authStateService = (component as any).authStateService;
    const messageService = (component as any).messageService;
    const handlePostLogin = jest.spyOn(component as any, 'handlePostLogin');
    const addMessage = jest.spyOn(messageService, 'addMessage');

    (component as any).oauthService = {
      initiateOAuthLogin: jest.fn().mockResolvedValue({
        success: true,
        session: true,
      }),
    };
    jest.spyOn(authStateService, 'restoreSession').mockResolvedValue(false);

    await component.onOAuthProvider({ provider: 'google' } as any);

    expect(handlePostLogin).not.toHaveBeenCalled();
    expect(addMessage).toHaveBeenCalledWith({
      content:
        'OAuth registration could not restore your session. Please try again.',
      type: 'error',
    });
  });
});

describe('RegisterComponent behaviour', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;
  let httpMock: HttpTestingController;
  let authStateService: {
    setToken: jest.Mock;
    restoreSession: jest.Mock;
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

  beforeEach(async () => {
    jest.clearAllMocks();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    authStateService = {
      setToken: jest.fn(),
      restoreSession: jest.fn().mockResolvedValue(true),
      getDecodedTokenValue: jest.fn(() => ({ profileId: 'profile-1' })),
      isAuthenticated: true,
    };
    profileService = {
      getAllProfiles: jest.fn().mockResolvedValue(undefined),
      getCurrentUserProfiles: jest.fn(() => [{ id: 'profile-1' }]),
      selectProfile: jest.fn(),
    };
    router = { navigate: jest.fn() };
    messageService = { addMessage: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [RegisterComponent, HttpClientTestingModule],
      providers: [
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: AuthStateService, useValue: authStateService },
        { provide: ProfileService, useValue: profileService },
        { provide: Router, useValue: router },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    oauthService = { initiateOAuthLogin: jest.fn() };
    (component as unknown as { oauthService: unknown }).oauthService =
      oauthService;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  describe('loadOAuthConfig', () => {
    it('configures the providers from the server config', async () => {
      const configureProviders = jest.fn();
      (
        component as unknown as {
          oauthService: { configureProviders: unknown };
        }
      ).oauthService = { configureProviders } as never;

      component.ngOnInit();
      httpMock.expectOne('/api/oauth/config').flush({ github: true });
      await Promise.resolve();
      await Promise.resolve();

      expect(configureProviders).toHaveBeenCalledWith({ github: true });
    });

    it('falls back to defaults when the request fails', async () => {
      component.ngOnInit();
      httpMock
        .expectOne('/api/oauth/config')
        .flush(null, { status: 500, statusText: 'Server Error' });
      await Promise.resolve();
      await Promise.resolve();

      expect(logSpy).toHaveBeenCalledWith(
        'OAuth config not loaded from server, using defaults'
      );
    });
  });

  describe('onSubmit', () => {
    const form = {
      email: 'ada@example.com',
      password: 'pw',
      confirmation: 'pw',
      firstName: 'Ada',
      lastName: 'Lovelace',
      bio: 'maths',
    } as never;

    it('maps the form onto a register request and redirects to login', () => {
      const authenticationService = (
        component as unknown as { authenticationService: unknown }
      ).authenticationService as { register: unknown };
      const register = jest
        .spyOn(authenticationService as never, 'register' as never)
        .mockReturnValue(of({ id: 'u1' }) as never);

      component.onSubmit(form);

      expect(register).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'pw',
        confirm: 'pw',
        fn: 'Ada',
        ln: 'Lovelace',
        bio: 'maths',
      });
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('logs a registration failure without redirecting', () => {
      const authenticationService = (
        component as unknown as { authenticationService: unknown }
      ).authenticationService as { register: unknown };
      jest
        .spyOn(authenticationService as never, 'register' as never)
        .mockReturnValue(throwError(() => new Error('taken')) as never);

      component.onSubmit(form);

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

      expect(authStateService.setToken).toHaveBeenCalledWith('jwt');
      expect(profileService.selectProfile).toHaveBeenCalledWith({
        id: 'profile-1',
      });
      expect(router.navigate).toHaveBeenCalledWith(['/feed']);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Welcome! Registration successful.',
        type: 'success',
      });
    });

    it('restores a cookie session when only a session is returned', async () => {
      oauthService.initiateOAuthLogin.mockResolvedValue({
        success: true,
        session: true,
      });

      await component.onOAuthProvider(event);

      expect(authStateService.restoreSession).toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/feed']);
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
        content: 'OAuth registration failed. Please try again.',
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

  describe('handlePostLogin', () => {
    const run = () =>
      (
        component as unknown as { handlePostLogin: () => Promise<void> }
      ).handlePostLogin();

    it('does nothing when the user is not authenticated', async () => {
      authStateService.isAuthenticated = false;

      await run();

      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('sends a user with an empty profileId to settings without the modal', async () => {
      authStateService.getDecodedTokenValue.mockReturnValue({ profileId: '' });

      await run();

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

      await run();

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
  });
});
