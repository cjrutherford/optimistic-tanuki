import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileContext } from './profile.context';
import { ProfileService } from './profile.service';
import { AuthStateService } from './state/auth-state.service';

describe('ProfileContext', () => {
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

  const isAuthenticated$ = new BehaviorSubject<boolean>(true);
  const currentProfile$ = new BehaviorSubject<ProfileDto | null>(null);
  const profileService = {
    getAllProfiles: jest.fn().mockResolvedValue(undefined),
    getCurrentUserProfiles: jest.fn().mockReturnValue([financeProfile]),
    getCurrentUserProfile: jest.fn().mockReturnValue(financeProfile),
    selectProfile: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    isAuthenticated$.next(true);
    currentProfile$.next(null);

    TestBed.configureTestingModule({
      providers: [
        ProfileContext,
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated: true,
            isAuthenticated$,
            currentProfile$,
          },
        },
        {
          provide: ProfileService,
          useValue: profileService,
        },
      ],
    });
  });

  it('loads the finance profile into downstream state', async () => {
    const context = TestBed.inject(ProfileContext);

    await context.loadProfile();

    expect(context.currentProfile()).toEqual(financeProfile);
    expect(context.currentProfiles()).toEqual([financeProfile]);
  });

  it('updates downstream state when a profile is selected', () => {
    const context = TestBed.inject(ProfileContext);

    context.selectProfile(financeProfile);

    expect(profileService.selectProfile).toHaveBeenCalledWith(financeProfile);
    expect(context.currentProfile()).toEqual(financeProfile);
  });
});
