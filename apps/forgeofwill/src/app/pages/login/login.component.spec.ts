import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LoginComponent } from './login.component';
import { AuthenticationService } from '../../authentication.service';
import { AuthStateService } from '../../auth-state.service';
import { ProfileService } from '../../profile/profile.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { of, throwError } from 'rxjs';
import { LoginType, ProfileDto } from '@optimistic-tanuki/ui-models';
import { signal, WritableSignal } from '@angular/core';
import { OAuthService } from '@optimistic-tanuki/auth-ui';

class MockProfileService {
  getAllProfiles = jest.fn().mockResolvedValue(undefined);
  currentUserProfiles: WritableSignal<ProfileDto[]> = signal<ProfileDto[]>([]);
  selectProfile = jest.fn();
}

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: AuthenticationService;
  let authState: AuthStateService;
  let profileService: MockProfileService;
  let router: Router;
  let activatedRoute: ActivatedRoute;
  let messageService: MessageService;

  const mockProfile: ProfileDto = {
    id: '1',
    userId: 'user1',
    profileName: 'Test Profile',
  } as ProfileDto;

  beforeEach(async () => {
    const authServiceMock = {
      login: jest.fn().mockResolvedValue({ data: {} }),
    };
    const authStateMock = {
      login: jest.fn().mockResolvedValue({ data: {} }),
      setToken: jest.fn(),
      restoreSession: jest.fn().mockResolvedValue(true),
      isAuthenticated: true,
      getDecodedTokenValue: jest.fn().mockReturnValue({ userId: 'user1' }),
    };
    const routerMock = {
      navigate: jest.fn(),
      navigateByUrl: jest.fn(),
    };
    const activatedRouteMock = {
      snapshot: {
        queryParamMap: {
          get: jest.fn(),
        },
      },
    };
    const messageServiceMock = {
      addMessage: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthenticationService, useValue: authServiceMock },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: ProfileService, useClass: MockProfileService },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: activatedRouteMock },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MessageService, useValue: messageServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthenticationService);
    authState = TestBed.inject(AuthStateService);
    profileService = TestBed.inject(
      ProfileService
    ) as unknown as MockProfileService;
    router = TestBed.inject(Router);
    activatedRoute = TestBed.inject(ActivatedRoute);
    messageService = TestBed.inject(MessageService);
    fixture.detectChanges();
  });

  describe('onLoginSubmit', () => {
    const loginData: LoginType = {
      email: 'test@example.com',
      password: 'password',
    };

    it('should handle successful login with existing profiles', async () => {
      profileService.currentUserProfiles.set([mockProfile]);
      await component.onLoginSubmit(loginData);

      // Wait for promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authState.login).toHaveBeenCalledWith(loginData);
      expect(authService.login).not.toHaveBeenCalled();
      expect(profileService.getAllProfiles).toHaveBeenCalled();
      expect(profileService.selectProfile).toHaveBeenCalledWith(mockProfile);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/projects');
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Login successful! Welcome back.',
        type: 'success',
      });
    });

    it('refetches the cookie session before navigating a successful login to projects', async () => {
      let resolveSessionRestore!: (restored: boolean) => void;
      const sessionRestore = new Promise<boolean>((resolve) => {
        resolveSessionRestore = resolve;
      });
      (authState as any).isAuthenticated = false;
      (authState as any).restoreSession.mockReturnValue(sessionRestore);
      profileService.currentUserProfiles.set([mockProfile]);

      const submitted = component.onLoginSubmit(loginData);
      await Promise.resolve();

      expect(profileService.getAllProfiles).not.toHaveBeenCalled();
      (authState as any).isAuthenticated = true;
      resolveSessionRestore(true);
      await submitted;

      expect((authState as any).restoreSession).toHaveBeenCalledTimes(1);
      expect(profileService.selectProfile).toHaveBeenCalledWith(mockProfile);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/projects');
    });

    it('returns a restored cookie session to its internal deep link with query state', async () => {
      profileService.currentUserProfiles.set([mockProfile]);
      (activatedRoute.snapshot.queryParamMap.get as jest.Mock).mockReturnValue(
        '/messages/new?recipient=forge'
      );

      await component.onLoginSubmit(loginData);

      expect((authState as any).restoreSession).toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith(
        '/messages/new?recipient=forge'
      );
      expect(router.navigate).not.toHaveBeenCalledWith(['/projects']);
    });

    it('should handle successful login with no existing profiles', async () => {
      profileService.currentUserProfiles.set([]);

      await component.onLoginSubmit(loginData);

      // Wait for promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authState.login).toHaveBeenCalledWith(loginData);
      expect(authService.login).not.toHaveBeenCalled();
      expect(profileService.getAllProfiles).toHaveBeenCalled();
      expect(profileService.selectProfile).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/profile'], {
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

    it('should handle login failure', async () => {
      jest
        .spyOn(authState, 'login')
        .mockRejectedValue(new Error('Invalid credentials'));

      await component.onLoginSubmit(loginData);

      // Wait for promises to resolve
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(authState.login).toHaveBeenCalledWith(loginData);
      expect(authState.setToken).not.toHaveBeenCalled();
      expect(profileService.getAllProfiles).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      // Note: The actual component logs to console.error but doesn't call messageService on failure
    });
  });

  it('restores an HttpOnly OAuth session before continuing the login flow', async () => {
    jest.spyOn(OAuthService.prototype, 'initiateOAuthLogin').mockResolvedValue({
      success: true,
      session: true,
    });
    profileService.currentUserProfiles.set([mockProfile]);

    await component.onOAuthProvider({ provider: 'google' });
    await Promise.resolve();

    expect((authState as any).restoreSession).toHaveBeenCalled();
    expect(authState.setToken).not.toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/projects');
    jest.restoreAllMocks();
  });

  it('returns an OAuth-restored cookie session to the safe internal deep link', async () => {
    jest.spyOn(OAuthService.prototype, 'initiateOAuthLogin').mockResolvedValue({
      success: true,
      session: true,
    });
    profileService.currentUserProfiles.set([mockProfile]);
    (activatedRoute.snapshot.queryParamMap.get as jest.Mock).mockReturnValue(
      '/projects?tab=active'
    );

    await component.onOAuthProvider({ provider: 'google' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/projects?tab=active');
    jest.restoreAllMocks();
  });

  it('does not continue an OAuth auto-registration when its cookie session cannot be restored', async () => {
    jest.spyOn(OAuthService.prototype, 'initiateOAuthLogin').mockResolvedValue({
      success: false,
      needsRegistration: true,
      userData: {
        provider: 'google',
        providerUserId: 'provider-user-1',
        email: 'forge@example.test',
        displayName: 'Forge Planner',
      },
    });
    jest
      .spyOn(OAuthService.prototype, 'completeOAuthRegistration')
      .mockResolvedValue({ success: true, session: true });
    (authState as any).restoreSession.mockResolvedValue(false);

    await component.onOAuthProvider({ provider: 'google' });

    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(messageService.addMessage).toHaveBeenCalledWith({
      content:
        'OAuth registration could not restore your session. Please try again.',
      type: 'error',
    });
    jest.restoreAllMocks();
  });
});
