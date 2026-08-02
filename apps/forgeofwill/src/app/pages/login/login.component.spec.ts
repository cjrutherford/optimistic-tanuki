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
import { Router } from '@angular/router';
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
      expect(router.navigate).toHaveBeenCalledWith(['/']);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Login successful! Welcome back.',
        type: 'success',
      });
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
    expect(router.navigate).toHaveBeenCalledWith(['/']);
    jest.restoreAllMocks();
  });
});
