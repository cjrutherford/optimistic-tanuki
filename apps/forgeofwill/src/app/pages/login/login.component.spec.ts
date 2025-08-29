import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { LoginComponent } from './login.component';
import { AuthenticationService } from '../../authentication.service';
import { AuthStateService } from '../../auth-state.service';
import { ProfileService } from '../../profile/profile.service';
import { Router } from '@angular/router';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { of, throwError } from 'rxjs';
import { LoginType, ProfileDto } from '@optimistic-tanuki/ui-models';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: AuthenticationService;
  let authState: AuthStateService;
  let profileService: ProfileService;
  let router: Router;
  let messageService: MessageService;

  const mockLoginResponse = { data: { newToken: 'mock-token' } };
  const mockProfile: ProfileDto = { id: '1', userId: 'user1', profileName: 'Test Profile' } as ProfileDto;

  beforeEach(async () => {
    const authServiceMock = {
      login: jest.fn().mockResolvedValue(mockLoginResponse),
    };
    const authStateMock = {
      setToken: jest.fn(),
      isAuthenticated: true,
    };
    const profileServiceMock = {
      getAllProfiles: jest.fn().mockResolvedValue(undefined),
      currentUserProfiles: jest.fn().mockReturnValue([mockProfile]),
      selectProfile: jest.fn(),
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
        { provide: ProfileService, useValue: profileServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: MessageService, useValue: messageServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthenticationService);
    authState = TestBed.inject(AuthStateService);
    profileService = TestBed.inject(ProfileService);
    router = TestBed.inject(Router);
    messageService = TestBed.inject(MessageService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('onLoginSubmit', () => {
    const loginData: LoginType = { email: 'test@example.com', password: 'password' };

    it('should handle successful login with existing profiles', async () => {
      await component.onLoginSubmit(loginData);

      expect(authService.login).toHaveBeenCalledWith(loginData);
      expect(authState.setToken).toHaveBeenCalledWith(mockLoginResponse.data.newToken);
      expect(profileService.getAllProfiles).toHaveBeenCalled();
      expect(profileService.currentUserProfiles).toHaveBeenCalled();
      expect(profileService.selectProfile).toHaveBeenCalledWith(mockProfile);
      expect(router.navigate).toHaveBeenCalledWith(['/']);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Login successful! Welcome back.',
        type: 'success',
      });
    });

    it('should handle successful login with no existing profiles', async () => {
      jest.spyOn(profileService, 'currentUserProfiles').mockReturnValue([]);

      await component.onLoginSubmit(loginData);

      expect(authService.login).toHaveBeenCalledWith(loginData);
      expect(authState.setToken).toHaveBeenCalledWith(mockLoginResponse.data.newToken);
      expect(profileService.getAllProfiles).toHaveBeenCalled();
      expect(profileService.currentUserProfiles).toHaveBeenCalled();
      expect(profileService.selectProfile).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/profile']);
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'No profiles found. Please create a profile to continue.',
        type: 'warning',
      });
    });

    it('should handle login failure', async () => {
      jest.spyOn(authService, 'login').mockRejectedValue(new Error('Invalid credentials'));

      await component.onLoginSubmit(loginData);

      expect(authService.login).toHaveBeenCalledWith(loginData);
      expect(authState.setToken).not.toHaveBeenCalled();
      expect(profileService.getAllProfiles).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(messageService.addMessage).toHaveBeenCalledWith({
        content: 'Login failed: Invalid credentials',
        type: 'error',
      });
    });
  });
});
