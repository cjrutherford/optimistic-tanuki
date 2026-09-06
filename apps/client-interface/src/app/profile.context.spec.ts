import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileContext } from './profile.context';
import { AuthStateService } from './state/auth-state.service';
import { ProfileService } from './profile.service';

const profile = (id: string, name = 'Ada'): ProfileDto =>
  ({ id, profileName: name, profilePic: `pic-${id}` } as ProfileDto);

describe('ProfileContext', () => {
  let isAuthenticated$: BehaviorSubject<boolean>;
  let currentProfile$: BehaviorSubject<ProfileDto | null>;
  let authState: {
    isAuthenticated: boolean;
    isAuthenticated$: BehaviorSubject<boolean>;
    currentProfile$: BehaviorSubject<ProfileDto | null>;
  };
  let profileService: {
    getAllProfiles: jest.Mock;
    getCurrentUserProfile: jest.Mock;
    getCurrentUserProfiles: jest.Mock;
    selectProfile: jest.Mock;
  };

  const configure = (platformId: string) => {
    isAuthenticated$ = new BehaviorSubject<boolean>(false);
    currentProfile$ = new BehaviorSubject<ProfileDto | null>(null);
    authState = { isAuthenticated: false, isAuthenticated$, currentProfile$ };
    TestBed.configureTestingModule({
      providers: [
        ProfileContext,
        { provide: AuthStateService, useValue: authState },
        { provide: ProfileService, useValue: profileService },
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });
    return TestBed.inject(ProfileContext);
  };

  beforeEach(() => {
    profileService = {
      getAllProfiles: jest.fn().mockResolvedValue(undefined),
      getCurrentUserProfile: jest.fn().mockReturnValue(null),
      getCurrentUserProfiles: jest.fn().mockReturnValue([]),
      selectProfile: jest.fn(),
    };
  });

  afterEach(() => TestBed.resetTestingModule());

  it('hydrates from storage on construction', () => {
    profileService.getCurrentUserProfiles.mockReturnValue([profile('a')]);
    profileService.getCurrentUserProfile.mockReturnValue(profile('a'));

    const ctx = configure('browser');

    expect(ctx.currentProfiles()).toEqual([profile('a')]);
    expect(ctx.currentProfile()).toEqual(profile('a'));
    expect(ctx.profileName()).toBe('Ada');
    expect(ctx.profilePic()).toBe('pic-a');
    expect(ctx.profileId()).toBe('a');
  });

  it('exposes empty computed values when there is no profile', () => {
    const ctx = configure('browser');

    expect(ctx.currentProfile()).toBeNull();
    expect(ctx.profileName()).toBe('');
    expect(ctx.profilePic()).toBe('');
    expect(ctx.profileId()).toBe('');
  });

  it('loads profiles when authentication turns on', async () => {
    const ctx = configure('browser');
    profileService.getCurrentUserProfile.mockReturnValue(profile('b'));
    profileService.getCurrentUserProfiles.mockReturnValue([profile('b')]);

    isAuthenticated$.next(true);
    await Promise.resolve();
    await Promise.resolve();

    expect(ctx.isAuthenticated()).toBe(true);
    expect(profileService.getAllProfiles).toHaveBeenCalled();
    expect(ctx.currentProfile()).toEqual(profile('b'));
    expect(ctx.currentProfiles()).toEqual([profile('b')]);
  });

  it('clears profiles when authentication turns off', () => {
    profileService.getCurrentUserProfiles.mockReturnValue([profile('a')]);
    profileService.getCurrentUserProfile.mockReturnValue(profile('a'));
    const ctx = configure('browser');

    isAuthenticated$.next(false);

    expect(ctx.isAuthenticated()).toBe(false);
    expect(ctx.currentProfile()).toBeNull();
    expect(ctx.currentProfiles()).toEqual([]);
  });

  it('mirrors the auth state current profile', () => {
    const ctx = configure('browser');

    currentProfile$.next(profile('c'));

    expect(ctx.currentProfile()).toEqual(profile('c'));
  });

  it('falls back to the saved profile when auth state clears the profile', () => {
    const ctx = configure('browser');
    profileService.getCurrentUserProfile.mockReturnValue(profile('saved'));

    currentProfile$.next(null);

    expect(ctx.currentProfile()).toEqual(profile('saved'));
  });

  it('logs and swallows a failure to load profiles', async () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const ctx = configure('browser');
    profileService.getAllProfiles.mockRejectedValue(new Error('nope'));

    await ctx.loadProfile();

    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to load profile:',
      expect.any(Error)
    );
    errorSpy.mockRestore();
  });

  it('delegates selectProfile to the profile service', () => {
    const ctx = configure('browser');

    ctx.selectProfile(profile('d'));

    expect(profileService.selectProfile).toHaveBeenCalledWith(profile('d'));
    expect(ctx.currentProfile()).toEqual(profile('d'));
  });

  it('re-reads the profile service on refreshProfile', () => {
    const ctx = configure('browser');
    profileService.getCurrentUserProfile.mockReturnValue(profile('e'));
    profileService.getCurrentUserProfiles.mockReturnValue([profile('e')]);

    ctx.refreshProfile();

    expect(ctx.currentProfile()).toEqual(profile('e'));
    expect(ctx.currentProfiles()).toEqual([profile('e')]);
  });

  describe('on the server', () => {
    it('does not subscribe or read from storage', () => {
      profileService.getCurrentUserProfiles.mockReturnValue([profile('a')]);
      profileService.getCurrentUserProfile.mockReturnValue(profile('a'));

      const ctx = configure('server');

      expect(ctx.currentProfile()).toBeNull();
      expect(ctx.currentProfiles()).toEqual([]);
      expect(profileService.getCurrentUserProfiles).not.toHaveBeenCalled();
      expect(isAuthenticated$.observed).toBe(false);
    });
  });
});
