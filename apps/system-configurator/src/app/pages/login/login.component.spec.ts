import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { signal, WritableSignal } from '@angular/core';
import { MessageService } from '@optimistic-tanuki/message-ui';
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

  beforeEach(async () => {
    router = { navigate: jest.fn() };
    returnIntent = { consume: jest.fn().mockReturnValue('/checkout') };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            login: jest.fn().mockResolvedValue({ data: { newToken: 'token' } }),
          },
        },
        {
          provide: AuthStateService,
          useValue: {
            setToken: jest.fn(),
            isAuthenticated: true,
            getDecodedTokenValue: jest.fn().mockReturnValue({ userId: 'user-1' }),
          },
        },
        { provide: ProfileService, useClass: MockProfileService },
        { provide: Router, useValue: router },
        { provide: ReturnIntentService, useValue: returnIntent },
        {
          provide: MessageService,
          useValue: {
            addMessage: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    profileService = TestBed.inject(
      ProfileService
    ) as unknown as MockProfileService;
    fixture.detectChanges();
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
});
