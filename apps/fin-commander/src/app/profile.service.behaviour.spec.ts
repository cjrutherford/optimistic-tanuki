import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  API_BASE_URL,
  CreateProfileDto,
  ProfileDto,
} from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile.service';
import { AuthStateService } from './state/auth-state.service';

interface AuthStateStub {
  getDecodedTokenValue: jest.Mock;
  persistProfiles: jest.Mock;
  persistSelectedProfile: jest.Mock;
  getPersistedProfiles: jest.Mock;
  getPersistedSelectedProfile: jest.Mock;
  setToken: jest.Mock;
  restoreSession: jest.Mock;
}

describe('ProfileService media and mutation behaviour', () => {
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

  const newProfileRequest = (): CreateProfileDto => ({
    name: 'Finance Captain',
    description: 'Runs the ledger',
    userId: '',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    appScope: 'finance',
  });

  let service: ProfileService;
  let http: HttpTestingController;
  let authState: AuthStateStub;

  /**
   * The service awaits each HTTP call before issuing the next one, so a request
   * only reaches the testing backend once the preceding promise has settled.
   * Polling across microtask boundaries avoids hard-coding how many ticks each
   * `await` in the service costs.
   */
  async function flushNext(
    method: string,
    url: string,
    body: object | object[]
  ): Promise<TestRequest> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const matches = http.match(
        (request) => request.method === method && request.url === url
      );
      if (matches.length > 0) {
        matches[0].flush(body);
        return matches[0];
      }
      await Promise.resolve();
    }

    throw new Error(`Timed out waiting for a ${method} request to ${url}`);
  }

  beforeEach(() => {
    authState = {
      getDecodedTokenValue: jest.fn().mockReturnValue({ userId: 'user-1' }),
      persistProfiles: jest.fn(),
      persistSelectedProfile: jest.fn(),
      getPersistedProfiles: jest.fn().mockReturnValue(null),
      getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
      setToken: jest.fn(),
      restoreSession: jest.fn().mockResolvedValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: AuthStateService, useValue: authState },
      ],
    });

    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('reading profiles', () => {
    it('keeps only the signed-in user profiles that are in or above the finance scope', async () => {
      const otherUserProfile: ProfileDto = {
        ...financeProfile,
        id: 'someone-else',
        userId: 'user-2',
      };
      const otherAppProfile: ProfileDto = {
        ...financeProfile,
        id: 'social-profile',
        appScope: 'social',
      };

      const pending = service.getAllProfiles();
      const request = await flushNext('GET', '/api/profile', [
        globalProfile,
        financeProfile,
        otherUserProfile,
        otherAppProfile,
      ]);
      await pending;

      expect(request.request.method).toBe('GET');
      expect(service.currentUserProfiles()).toEqual([
        globalProfile,
        financeProfile,
      ]);
      expect(authState.persistProfiles).toHaveBeenCalledWith([
        globalProfile,
        financeProfile,
      ]);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(
        financeProfile
      );
      expect(service.currentUserProfile()).toEqual(financeProfile);
    });

    it('leaves the selection untouched when the user has no usable profile', async () => {
      const pending = service.getAllProfiles();
      await flushNext('GET', '/api/profile', []);
      await pending;

      expect(service.currentUserProfiles()).toEqual([]);
      expect(authState.persistProfiles).toHaveBeenCalledWith([]);
      expect(authState.persistSelectedProfile).not.toHaveBeenCalled();
      expect(service.currentUserProfile()).toBeNull();
    });

    it('selects a profile by id and persists it', async () => {
      const pending = service.getProfileById('global-profile');
      const request = await flushNext(
        'GET',
        '/api/profile/global-profile',
        globalProfile
      );
      await pending;

      expect(request.request.method).toBe('GET');
      expect(service.currentUserProfile()).toEqual(globalProfile);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(
        globalProfile
      );
    });

    it('rehydrates the profile list from persisted state and caches it in the signal', () => {
      authState.getPersistedProfiles.mockReturnValue([globalProfile]);

      expect(service.getCurrentUserProfiles()).toEqual([globalProfile]);
      expect(service.currentUserProfiles()).toEqual([globalProfile]);

      // Second read is served by the signal, so storage is only consulted once.
      authState.getPersistedProfiles.mockReturnValue(null);
      expect(service.getCurrentUserProfiles()).toEqual([globalProfile]);
    });

    it('rehydrates the selected profile from persisted state', () => {
      authState.getPersistedSelectedProfile.mockReturnValue(financeProfile);

      expect(service.getCurrentUserProfile()).toEqual(financeProfile);
      expect(service.currentUserProfile()).toEqual(financeProfile);
    });

    it('falls back to a global profile when no finance profile exists', () => {
      service.currentUserProfiles.set([globalProfile]);

      expect(service.getEffectiveProfile()).toEqual(globalProfile);
      expect(service.hasLocalProfile()).toBe(false);
    });

    it('treats a profile without an app scope as global', () => {
      const unscoped: ProfileDto = { ...globalProfile, appScope: undefined };
      service.currentUserProfiles.set([unscoped]);

      expect(service.getEffectiveProfile()).toEqual(unscoped);
    });

    it('reports no effective profile when nothing is loaded or persisted', () => {
      expect(service.getEffectiveProfile()).toBeNull();
      expect(service.hasLocalProfile()).toBe(false);
    });

    it('reports a local profile once a finance-scoped profile is loaded', () => {
      service.currentUserProfiles.set([globalProfile, financeProfile]);

      expect(service.hasLocalProfile()).toBe(true);
    });

    it('resolves a selection against the loaded list rather than the passed copy', () => {
      service.currentUserProfiles.set([financeProfile]);

      service.selectProfile({ ...financeProfile, profileName: 'Stale name' });

      expect(service.currentUserProfile()).toEqual(financeProfile);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(
        financeProfile
      );
    });
  });

  describe('createProfile', () => {
    it('strips inline images from the create payload and stamps the signed-in user id', async () => {
      const request = newProfileRequest();
      request.profilePic = 'data:image/png;base64,AAAA';

      const pending = service.createProfile(request);
      const post = await flushNext('POST', '/api/profile', financeProfile);
      await flushNext('POST', '/api/asset', { id: 'asset-1' });
      await flushNext('PUT', '/api/profile/finance-profile', financeProfile);
      await pending;

      expect(post.request.body.profilePic).toBe('');
      expect(post.request.body.coverPic).toBe('');
      expect(post.request.body.userId).toBe('user-1');
    });

    it('keeps the caller supplied user id when no session token is decoded', async () => {
      authState.getDecodedTokenValue.mockReturnValue(null);
      const request = newProfileRequest();
      request.userId = 'preset-user';

      const pending = service.createProfile(request);
      const post = await flushNext('POST', '/api/profile', financeProfile);
      await pending;

      expect(post.request.body.userId).toBe('preset-user');
    });

    it('does not upload assets or patch the profile when no images were supplied', async () => {
      const pending = service.createProfile(newProfileRequest());
      await flushNext('POST', '/api/profile', financeProfile);
      await pending;

      http.expectNone('/api/asset');
      http.expectNone('/api/profile/finance-profile');
      expect(service.currentUserProfiles()).toEqual([financeProfile]);
      expect(service.currentUserProfile()).toEqual(financeProfile);
      expect(authState.persistProfiles).toHaveBeenCalledWith([financeProfile]);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(
        financeProfile
      );
    });

    it('adopts the refreshed token returned alongside the created profile', async () => {
      const pending = service.createProfile(newProfileRequest());
      await flushNext('POST', '/api/profile', {
        profile: financeProfile,
        newToken: 'refreshed.jwt.token',
      });
      await pending;

      expect(authState.setToken).toHaveBeenCalledWith('refreshed.jwt.token');
      expect(authState.restoreSession).toHaveBeenCalled();
      expect(service.currentUserProfile()).toEqual(financeProfile);
    });

    it('restores the session without swapping tokens when none is returned', async () => {
      const pending = service.createProfile(newProfileRequest());
      await flushNext('POST', '/api/profile', { profile: financeProfile });
      await pending;

      expect(authState.setToken).not.toHaveBeenCalled();
      expect(authState.restoreSession).toHaveBeenCalled();
    });

    it('uploads both images and patches the profile with the stored asset urls', async () => {
      const request = newProfileRequest();
      request.profilePic = 'data:image/jpeg;base64,AAAA';
      request.coverPic = 'data:image/webp;base64,BBBB';

      const pending = service.createProfile(request);
      await flushNext('POST', '/api/profile', financeProfile);
      const photoAsset = await flushNext('POST', '/api/asset', {
        id: 'asset-photo',
      });
      const coverAsset = await flushNext('POST', '/api/asset', {
        id: 'asset-cover',
      });
      const patch = await flushNext(
        'PUT',
        '/api/profile/finance-profile',
        financeProfile
      );
      await pending;

      expect(photoAsset.request.body).toEqual({
        name: 'profile-Finance Captain-photo.jpeg',
        profileId: 'finance-profile',
        type: 'image',
        content: 'data:image/jpeg;base64,AAAA',
        fileExtension: 'jpeg',
      });
      expect(coverAsset.request.body).toEqual({
        name: 'profile-Finance Captain-cover.webp',
        profileId: 'finance-profile',
        type: 'image',
        content: 'data:image/webp;base64,BBBB',
        fileExtension: 'webp',
      });
      expect(patch.request.body).toEqual({
        profilePic: '/api/asset/asset-photo',
        coverPic: '/api/asset/asset-cover',
      });
      expect(service.currentUserProfile()).toEqual({
        ...financeProfile,
        profilePic: '/api/asset/asset-photo',
        coverPic: '/api/asset/asset-cover',
      });
    });

    it.each([
      ['a url with no media type', 'https://cdn.example.com/avatar.jpg'],
      ['a data url without a base64 marker', 'data:image/png,not-base64'],
      ['a data url with an atomic media type', 'data:text;base64,AAAA'],
    ])('falls back to a png extension for %s', async (_label, profilePic) => {
      const request = newProfileRequest();
      request.profilePic = profilePic;

      const pending = service.createProfile(request);
      await flushNext('POST', '/api/profile', financeProfile);
      const asset = await flushNext('POST', '/api/asset', { id: 'asset-1' });
      await flushNext('PUT', '/api/profile/finance-profile', financeProfile);
      await pending;

      expect(asset.request.body.fileExtension).toBe('png');
      expect(asset.request.body.name).toBe('profile-Finance Captain-photo.png');
    });
  });

  describe('updateProfile', () => {
    it('uploads a newly picked image and stores the asset url on the profile', async () => {
      service.currentUserProfiles.set([globalProfile, financeProfile]);
      const updated: ProfileDto = {
        ...financeProfile,
        profilePic: '/api/asset/asset-photo',
      };

      const pending = service.updateProfile('finance-profile', {
        id: 'finance-profile',
        profilePic: 'data:image/gif;base64,AAAA',
      });
      await flushNext('GET', '/api/profile/finance-profile', financeProfile);
      const asset = await flushNext('POST', '/api/asset', {
        id: 'asset-photo',
      });
      const put = await flushNext(
        'PUT',
        '/api/profile/finance-profile',
        updated
      );
      await pending;

      expect(asset.request.body).toEqual({
        name: 'profile-Finance Captain-photo.gif',
        profileId: 'finance-profile',
        type: 'image',
        content: 'data:image/gif;base64,AAAA',
        fileExtension: 'gif',
      });
      expect(put.request.body.profilePic).toBe('/api/asset/asset-photo');
      // Only the matching entry is replaced in the cached list.
      expect(service.currentUserProfiles()).toEqual([globalProfile, updated]);
      expect(service.currentUserProfile()).toEqual(updated);
      expect(authState.persistProfiles).toHaveBeenCalledWith([
        globalProfile,
        updated,
      ]);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(updated);
    });

    it('re-uploads a replaced cover image against the existing profile name', async () => {
      const pending = service.updateProfile('finance-profile', {
        id: 'finance-profile',
        coverPic: 'data:image/png;base64,CCCC',
      });
      await flushNext('GET', '/api/profile/finance-profile', financeProfile);
      const asset = await flushNext('POST', '/api/asset', {
        id: 'asset-cover',
      });
      const put = await flushNext(
        'PUT',
        '/api/profile/finance-profile',
        financeProfile
      );
      await pending;

      expect(asset.request.body.name).toBe('profile-Finance Captain-cover.png');
      expect(put.request.body.coverPic).toBe('/api/asset/asset-cover');
    });

    it('leaves images that already point at the asset service untouched', async () => {
      const pending = service.updateProfile('finance-profile', {
        id: 'finance-profile',
        profilePic: '/api/asset/asset-photo',
        coverPic: '/api/asset/asset-cover',
        bio: 'Steady as she goes',
      });

      // The PUT is issued synchronously when nothing new was picked, so at this
      // point there must be no pending lookup or upload ahead of it.
      http.expectNone((request) => request.method === 'GET');
      http.expectNone('/api/asset');

      const put = await flushNext(
        'PUT',
        '/api/profile/finance-profile',
        financeProfile
      );
      await pending;

      expect(put.request.body).toEqual({
        id: 'finance-profile',
        profilePic: '/api/asset/asset-photo',
        coverPic: '/api/asset/asset-cover',
        bio: 'Steady as she goes',
      });
    });

    it('sends field-only updates straight through', async () => {
      const updated: ProfileDto = { ...financeProfile, location: 'Dry dock' };

      const pending = service.updateProfile('finance-profile', {
        id: 'finance-profile',
        location: 'Dry dock',
      });
      const put = await flushNext(
        'PUT',
        '/api/profile/finance-profile',
        updated
      );
      await pending;

      expect(put.request.body).toEqual({
        id: 'finance-profile',
        location: 'Dry dock',
      });
      expect(service.currentUserProfile()).toEqual(updated);
    });
  });
});
