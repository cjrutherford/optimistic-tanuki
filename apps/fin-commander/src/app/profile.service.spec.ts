import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { API_BASE_URL, ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile.service';
import { AuthStateService } from './state/auth-state.service';

describe('ProfileService', () => {
  const financeProfile: ProfileDto = {
    id: 'finance-profile',
    userId: 'user-1',
    profileName: 'Finance Captain',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    created_at: new Date('2026-01-01'),
    appScope: 'finance',
  };

  const globalProfile: ProfileDto = {
    ...financeProfile,
    id: 'global-profile',
    profileName: 'Global Captain',
    appScope: 'global',
  };

  const authState = {
    getDecodedTokenValue: jest.fn().mockReturnValue({ userId: 'user-1' }),
    persistProfiles: jest.fn(),
    persistSelectedProfile: jest.fn(),
    getPersistedProfiles: jest.fn().mockReturnValue(null),
    getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
  };

  const http = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: HttpClient, useValue: http },
        { provide: AuthStateService, useValue: authState },
      ],
    });
  });

  it('defaults the profile app scope to finance', () => {
    const service = TestBed.inject(ProfileService);

    expect(service.appScope).toBe('finance');
  });

  it('prefers a finance-scoped profile over a global profile', async () => {
    http.get.mockReturnValue(of([globalProfile, financeProfile]));
    const service = TestBed.inject(ProfileService);

    await service.getAllProfiles();

    expect(service.getEffectiveProfile()).toEqual(financeProfile);
  });

  it('persists selected profiles and updates the current profile state', () => {
    const service = TestBed.inject(ProfileService);
    service.currentUserProfiles.set([globalProfile, financeProfile]);

    service.selectProfile(financeProfile);

    expect(service.getCurrentUserProfile()).toEqual(financeProfile);
    expect(authState.persistSelectedProfile).toHaveBeenCalledWith(
      financeProfile
    );
  });
});
