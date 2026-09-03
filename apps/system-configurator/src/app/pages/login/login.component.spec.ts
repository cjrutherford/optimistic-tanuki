import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { OAuthService } from '@optimistic-tanuki/auth-ui';
import { LoginType, ProfileDto } from '@optimistic-tanuki/ui-models';
import { LoginComponent } from './login.component';
import { AuthenticationService } from '../../services/authentication.service';
import { AuthStateService } from '../../state/auth-state.service';
import { ProfileService } from '../../state/profile.service';
import { ReturnIntentService } from '../../state/return-intent.service';

class MockProfileService {
  currentUserProfiles: WritableSignal<ProfileDto[]> = signal<ProfileDto[]>([]);
  getAllProfiles = jest.fn().mockResolvedValue(undefined);
  getEffectiveProfile = jest.fn();
  selectProfile = jest.fn();
}

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let profileService: MockProfileService;
  let router: { navigate: jest.Mock };
  let returnIntent: { consume: jest.Mock };
  let authStateMock: {
    login: jest.Mock;
    restoreSession: jest.Mock;
    isAuthenticated: boolean;
    getDecodedTokenValue: jest.Mock;
  };
  let messageServiceMock: { addMessage: jest.Mock };
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    router = { navigate: jest.fn() };
    returnIntent = { consume: jest.fn().mockReturnValue('/checkout') };
    authStateMock = {
      login: jest.fn().mockResolvedValue({ data: {} }),
      restoreSession: jest.fn().mockResolvedValue(undefined),
      isAuthenticated: true,
      getDecodedTokenValue: jest.fn().mockReturnValue({ userId: 'user-1' }),
    };
    messageServiceMock = { addMessage: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            login: jest.fn().mockResolvedValue({ data: {} }),
          },
        },
        { provide: AuthStateService, useValue: authStateMock },
        { provide: ProfileService, useClass: MockProfileService },
        { provide: Router, useValue: router },
        { provide: ReturnIntentService, useValue: returnIntent },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MessageService, useValue: messageServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    profileService = TestBed.inject(
      ProfileService
    ) as unknown as MockProfileService;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Some tests intentionally leave the oauth-config request unflushed.
    httpMock.match(() => true).forEach((req) => req.flush(null));
  });

  it('returns the user to the stored route after login when an effective profile exists', async () => {
    const profile = {
      id: 'profile-1',
      userId: 'user-1',
      profileName: 'HAI Primary',
      profilePic: '',
      coverPic: '',
      bio: '',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      created_at: new Date(),
      appScope: 'system-configurator',
    } as ProfileDto;
    profileService.getEffectiveProfile.mockReturnValue(profile);

    await component.onLoginSubmit({
      email: 'hai@example.com',
      password: 'secret',
    } as LoginType);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(profileService.selectProfile).toHaveBeenCalledWith(profile);
    expect(returnIntent.consume).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/checkout']);
  });

  it('navigates to the profile gate when no effective profile exists', async () => {
    profileService.getEffectiveProfile.mockReturnValue(null);

    await component.onLoginSubmit({
      email: 'hai@example.com',
      password: 'secret',
    } as LoginType);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(router.navigate).toHaveBeenCalledWith(['/profile-gate']);
  });

  it('shows an error message when login rejects', async () => {
    authStateMock.login.mockRejectedValue(new Error('bad credentials'));

    await component.onLoginSubmit({
      email: 'hai@example.com',
      password: 'wrong',
    } as LoginType);

    expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
      content: 'Login failed. Please verify your email and password.',
      type: 'error',
    });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('loadOAuthConfig configures providers when the endpoint returns config', async () => {
    const configureSpy = jest.spyOn(
      OAuthService.prototype,
      'configureProviders'
    );

    const req = httpMock.expectOne('/api/oauth/config');
    req.flush({ google: { clientId: 'abc' } });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(configureSpy).toHaveBeenCalledWith({ google: { clientId: 'abc' } });
    configureSpy.mockRestore();
  });

  it('loadOAuthConfig silently keeps defaults when the endpoint errors', async () => {
    const req = httpMock.expectOne('/api/oauth/config');
    req.error(new ProgressEvent('error'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // No exception should propagate and no navigation should occur.
    expect(router.navigate).not.toHaveBeenCalled();
  });

  describe('onOAuthProvider', () => {
    beforeEach(() => {
      httpMock.expectOne('/api/oauth/config').flush(null);
    });

    it('signs the user in and routes to the return url on success', async () => {
      const profile = { id: 'p1' } as ProfileDto;
      profileService.getEffectiveProfile.mockReturnValue(profile);
      jest
        .spyOn(OAuthService.prototype, 'initiateOAuthLogin')
        .mockResolvedValue({ success: true } as never);

      await component.onOAuthProvider({
        provider: 'google',
      } as never);

      expect(authStateMock.restoreSession).toHaveBeenCalled();
      expect(profileService.selectProfile).toHaveBeenCalledWith(profile);
      expect(router.navigate).toHaveBeenCalledWith(['/checkout']);
    });

    it('routes to the profile gate on success without an effective profile', async () => {
      profileService.getEffectiveProfile.mockReturnValue(null);
      jest
        .spyOn(OAuthService.prototype, 'initiateOAuthLogin')
        .mockResolvedValue({ success: true } as never);

      await component.onOAuthProvider({ provider: 'google' } as never);

      expect(router.navigate).toHaveBeenCalledWith(['/profile-gate']);
    });

    it('shows a message when the provider needs registration', async () => {
      jest
        .spyOn(OAuthService.prototype, 'initiateOAuthLogin')
        .mockResolvedValue({
          success: false,
          needsRegistration: true,
        } as never);

      await component.onOAuthProvider({ provider: 'google' } as never);

      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'OAuth login did not complete. Please try again.',
        type: 'error',
      });
    });

    it('shows a generic failure message otherwise', async () => {
      jest
        .spyOn(OAuthService.prototype, 'initiateOAuthLogin')
        .mockResolvedValue({ success: false } as never);

      await component.onOAuthProvider({ provider: 'google' } as never);

      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'OAuth login failed. Please try again.',
        type: 'error',
      });
    });

    it('catches and reports unexpected errors', async () => {
      jest
        .spyOn(OAuthService.prototype, 'initiateOAuthLogin')
        .mockRejectedValue(new Error('popup blocked'));

      await component.onOAuthProvider({ provider: 'google' } as never);

      expect(messageServiceMock.addMessage).toHaveBeenCalledWith({
        content: 'OAuth login failed. Please try again.',
        type: 'error',
      });
    });
  });
});
