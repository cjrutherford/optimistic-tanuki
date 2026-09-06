import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile.service';

const profileFixture = (overrides: Partial<ProfileDto> = {}): ProfileDto => ({
  id: 'profile-1',
  userId: 'user-1',
  profileName: 'Tanuki',
  profilePic: 'pic-1',
  coverPic: 'cover-1',
  bio: 'Builds things',
  location: 'Toronto',
  occupation: 'Creator',
  interests: 'video',
  skills: 'editing',
  created_at: new Date('2026-04-17T14:00:00.000Z'),
  ...overrides,
});

/**
 * The service only touches localStorage on the browser platform, so each suite
 * below pins PLATFORM_ID explicitly rather than relying on the jsdom default.
 */
function configure(platformId: 'browser' | 'server') {
  TestBed.configureTestingModule({
    providers: [
      ProfileService,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: PLATFORM_ID, useValue: platformId },
    ],
  });

  return {
    service: TestBed.inject(ProfileService),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('ProfileService behaviour', () => {
  describe('on the browser platform', () => {
    let service: ProfileService;
    let http: HttpTestingController;

    beforeEach(() => {
      localStorage.clear();
      ({ service, http } = configure('browser'));
    });

    afterEach(() => {
      http.verify();
      localStorage.clear();
    });

    it('publishes the fetched profiles on profiles$ and returns them', async () => {
      const profiles = [profileFixture(), profileFixture({ id: 'profile-2' })];
      const pending = service.getAllProfiles();

      const request = http.expectOne('/api/profile');
      expect(request.request.method).toBe('GET');
      request.flush(profiles);

      await expect(pending).resolves.toEqual(profiles);
      expect(service.getCurrentUserProfiles()).toEqual(profiles);
      await expect(firstValueFrom(service.profiles$)).resolves.toEqual(
        profiles
      );
    });

    it('reads a single profile by id without touching the cached list', async () => {
      const profile = profileFixture();
      const pending = service.getProfileById('profile-1');

      const request = http.expectOne('/api/profile/profile-1');
      expect(request.request.method).toBe('GET');
      request.flush(profile);

      await expect(pending).resolves.toEqual(profile);
      expect(service.getCurrentUserProfiles()).toEqual([]);
    });

    it('appends a newly created profile to the cached list', async () => {
      const existing = profileFixture();
      const seed = service.getAllProfiles();
      http.expectOne('/api/profile').flush([existing]);
      await seed;

      const created = profileFixture({ id: 'profile-2', profileName: 'New' });
      const pending = service.createProfile({ profileName: 'New' });

      const request = http.expectOne('/api/profile');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ profileName: 'New' });
      request.flush(created);

      await expect(pending).resolves.toEqual(created);
      expect(service.getCurrentUserProfiles()).toEqual([existing, created]);
    });

    it('replaces the matching entry in the cached list on update', async () => {
      const first = profileFixture();
      const second = profileFixture({ id: 'profile-2' });
      const seed = service.getAllProfiles();
      http.expectOne('/api/profile').flush([first, second]);
      await seed;

      const updated = profileFixture({ bio: 'Updated bio' });
      const pending = service.updateProfile('profile-1', {
        bio: 'Updated bio',
      });

      const request = http.expectOne('/api/profile/profile-1');
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ bio: 'Updated bio' });
      request.flush(updated);

      await expect(pending).resolves.toEqual(updated);
      expect(service.getCurrentUserProfiles()).toEqual([updated, second]);
      // The updated profile was not the selected one, so the selection stays empty.
      expect(service.getCurrentUserProfile()).toBeNull();
    });

    it('refreshes the selected profile when the update targets it', async () => {
      service.selectProfile(profileFixture());

      const updated = profileFixture({ bio: 'Updated bio' });
      const pending = service.updateProfile('profile-1', {
        bio: 'Updated bio',
      });
      http.expectOne('/api/profile/profile-1').flush(updated);
      await pending;

      expect(service.getCurrentUserProfile()).toEqual(updated);
    });

    it('leaves the selection alone when a different profile is updated', async () => {
      const selected = profileFixture();
      service.selectProfile(selected);

      const pending = service.updateProfile('profile-2', { bio: 'Other' });
      http
        .expectOne('/api/profile/profile-2')
        .flush(profileFixture({ id: 'profile-2', bio: 'Other' }));
      await pending;

      expect(service.getCurrentUserProfile()).toEqual(selected);
    });

    it('persists the selected profile to localStorage', () => {
      const profile = profileFixture();

      service.selectProfile(profile);

      expect(service.getCurrentUserProfile()).toEqual(profile);
      expect(
        JSON.parse(localStorage.getItem('selectedProfile') ?? 'null')
      ).toEqual(JSON.parse(JSON.stringify(profile)));
    });

    it('restores a previously stored profile', () => {
      const profile = profileFixture();
      localStorage.setItem('selectedProfile', JSON.stringify(profile));

      service.loadStoredProfile();

      expect(service.getCurrentUserProfile()).toMatchObject({
        id: 'profile-1',
        profileName: 'Tanuki',
      });
    });

    it('keeps no selection when nothing has been stored', () => {
      service.loadStoredProfile();

      expect(service.getCurrentUserProfile()).toBeNull();
    });

    it('reports a parse failure and keeps no selection for corrupt stored JSON', () => {
      localStorage.setItem('selectedProfile', '{not json');
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      service.loadStoredProfile();

      expect(consoleError).toHaveBeenCalledWith(
        'Failed to parse stored profile'
      );
      expect(service.getCurrentUserProfile()).toBeNull();
      consoleError.mockRestore();
    });
  });

  describe('on the server platform', () => {
    let service: ProfileService;
    let http: HttpTestingController;

    beforeEach(() => {
      localStorage.clear();
      ({ service, http } = configure('server'));
    });

    afterEach(() => {
      http.verify();
      localStorage.clear();
    });

    it('selects a profile in memory without writing to localStorage', () => {
      const profile = profileFixture();

      service.selectProfile(profile);

      expect(service.getCurrentUserProfile()).toEqual(profile);
      expect(localStorage.getItem('selectedProfile')).toBeNull();
    });

    it('does not read stored state during server rendering', () => {
      localStorage.setItem('selectedProfile', JSON.stringify(profileFixture()));

      service.loadStoredProfile();

      expect(service.getCurrentUserProfile()).toBeNull();
    });
  });
});
