import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { AuthStateService } from './state/auth-state.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

const API = 'http://localhost:3000';

const makeProfile = (overrides: Partial<ProfileDto> = {}): ProfileDto =>
  ({
    id: '1',
    userId: '123',
    profileName: 'Test User',
    profilePic: '',
    coverPic: '',
    bio: '',
    occupation: '',
    location: '',
    interests: '',
    skills: '',
    created_at: new Date(0),
    ...overrides,
  } as ProfileDto);

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;
  let authState: {
    getDecodedTokenValue: jest.Mock;
    getPersistedSelectedProfile: jest.Mock;
    getPersistedProfiles: jest.Mock;
    persistProfiles: jest.Mock;
    persistSelectedProfile: jest.Mock;
    setToken: jest.Mock;
  };

  beforeEach(() => {
    authState = {
      getDecodedTokenValue: jest.fn(),
      getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
      getPersistedProfiles: jest.fn().mockReturnValue(null),
      persistProfiles: jest.fn(),
      persistSelectedProfile: jest.fn(),
      setToken: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [],
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStateService, useValue: authState },
        { provide: API_BASE_URL, useValue: API },
      ],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  describe('getCurrentUserProfile', () => {
    it('should return the current user profile', () => {
      const mockProfile = makeProfile();
      service.currentUserProfile.set(mockProfile);

      const result = service.getCurrentUserProfile();

      expect(result).toEqual(mockProfile);
    });

    it('should return null if no current user profile is set', () => {
      service.currentUserProfile.set(null);

      const result = service.getCurrentUserProfile();

      expect(result).toBeNull();
    });

    it('falls back to the persisted selected profile', () => {
      const persisted = makeProfile({ id: 'persisted' });
      authState.getPersistedSelectedProfile.mockReturnValue(persisted);

      expect(service.getCurrentUserProfile()).toEqual(persisted);
      expect(service.currentUserProfile()).toEqual(persisted);
    });
  });

  it('loads scoped recipient profiles separately from the current user profiles', async () => {
    const pending = service.getDiscoverableProfiles();
    const request = httpMock.expectOne(`${API}/profile/discover`);
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 'profile-2', userId: 'user-2', profileName: 'Bob' }]);

    await pending;
    expect(service.discoverableProfiles()).toEqual([
      { id: 'profile-2', userId: 'user-2', profileName: 'Bob' },
    ]);
    expect(service.currentUserProfiles()).toEqual([]);
  });

  describe('app scope helpers', () => {
    const local = makeProfile({ id: 'local', appScope: 'client-interface' });
    const global = makeProfile({ id: 'global', appScope: 'global' });
    const scopeless = makeProfile({ id: 'scopeless', appScope: undefined });
    const other = makeProfile({ id: 'other', appScope: 'admin-console' });

    it('prefers the local profile', () => {
      service.currentUserProfiles.set([global, local]);
      expect(service.getEffectiveProfile()).toEqual(local);
    });

    it('falls back to the global profile', () => {
      service.currentUserProfiles.set([other, global]);
      expect(service.getEffectiveProfile()).toEqual(global);
    });

    it('treats a profile with no appScope as global', () => {
      service.currentUserProfiles.set([scopeless]);
      expect(service.getEffectiveProfile()).toEqual(scopeless);
      expect(service.hasOnlyGlobalProfile()).toBe(true);
    });

    it('returns null when no profile is usable', () => {
      service.currentUserProfiles.set([other]);
      expect(service.getEffectiveProfile()).toBeNull();
    });

    it('reports whether a local profile exists', () => {
      service.currentUserProfiles.set([global]);
      expect(service.hasLocalProfile()).toBe(false);
      service.currentUserProfiles.set([global, local]);
      expect(service.hasLocalProfile()).toBe(true);
      expect(service.hasOnlyGlobalProfile()).toBe(false);
    });
  });

  describe('selectProfile', () => {
    it('selects the known profile instance and persists it', () => {
      const known = makeProfile({ id: 'a', profileName: 'Known' });
      service.currentUserProfiles.set([known]);

      service.selectProfile(makeProfile({ id: 'a', profileName: 'Stale' }));

      expect(service.currentUserProfile()).toEqual(known);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(known);
    });

    it('falls back to the passed profile when it is unknown', () => {
      const unknown = makeProfile({ id: 'zzz' });
      service.selectProfile(unknown);
      expect(service.currentUserProfile()).toEqual(unknown);
    });
  });

  describe('getCurrentUserProfiles', () => {
    it('hydrates from persisted profiles when the signal is empty', () => {
      const persisted = [makeProfile({ id: 'p' })];
      authState.getPersistedProfiles.mockReturnValue(persisted);

      expect(service.getCurrentUserProfiles()).toEqual(persisted);
      expect(service.currentUserProfiles()).toEqual(persisted);
    });

    it('keeps the existing profiles when the signal already has some', () => {
      const existing = [makeProfile({ id: 'existing' })];
      service.currentUserProfiles.set(existing);

      expect(service.getCurrentUserProfiles()).toEqual(existing);
      expect(authState.getPersistedProfiles).not.toHaveBeenCalled();
    });

    it('returns an empty list when nothing is persisted', () => {
      authState.getPersistedProfiles.mockReturnValue([]);
      expect(service.getCurrentUserProfiles()).toEqual([]);
    });
  });

  describe('restorePersistedSelectedProfile', () => {
    it('restores the persisted profile', () => {
      const persisted = makeProfile({ id: 'persisted' });
      authState.getPersistedSelectedProfile.mockReturnValue(persisted);

      expect(service.restorePersistedSelectedProfile()).toEqual(persisted);
      expect(service.currentUserProfile()).toEqual(persisted);
    });

    it('leaves the signal alone when nothing is persisted', () => {
      expect(service.restorePersistedSelectedProfile()).toBeNull();
      expect(service.currentUserProfile()).toBeNull();
    });
  });

  describe('getAllProfiles', () => {
    it('keeps only the current user global and locally scoped profiles', async () => {
      authState.getDecodedTokenValue.mockReturnValue({ userId: '123' });
      const mine = makeProfile({ id: 'mine', appScope: 'client-interface' });
      const myGlobal = makeProfile({ id: 'my-global', appScope: 'global' });
      const myOtherApp = makeProfile({ id: 'other-app', appScope: 'admin' });
      const someoneElse = makeProfile({ id: 'theirs', userId: '999' });

      const pending = service.getAllProfiles();
      httpMock
        .expectOne(`${API}/profile`)
        .flush([mine, myGlobal, myOtherApp, someoneElse]);
      await pending;

      expect(service.allProfiles()).toHaveLength(4);
      expect(service.currentUserProfiles().map((p) => p.id)).toEqual([
        'mine',
        'my-global',
      ]);
      expect(authState.persistProfiles).toHaveBeenCalledWith([mine, myGlobal]);
    });

    it('keeps nothing when there is no decoded token', async () => {
      authState.getDecodedTokenValue.mockReturnValue(null);
      const pending = service.getAllProfiles();
      httpMock.expectOne(`${API}/profile`).flush([makeProfile()]);
      await pending;

      expect(service.currentUserProfiles()).toEqual([]);
    });
  });

  it('getProfileById sets and persists the fetched profile', async () => {
    const profile = makeProfile({ id: 'x' });
    const pending = service.getProfileById('x');
    const req = httpMock.expectOne(`${API}/profile/x`);
    expect(req.request.method).toBe('GET');
    req.flush(profile);
    await pending;

    expect(service.currentUserProfile()).toEqual(profile);
    expect(authState.persistSelectedProfile).toHaveBeenCalledWith(profile);
  });

  describe('createProfile', () => {
    it('creates a profile without images', async () => {
      authState.getDecodedTokenValue.mockReturnValue({ userId: 'u-token' });
      const created = makeProfile({ id: 'new' });

      const pending = service.createProfile({
        name: 'New',
        description: '',
      } as never);

      const req = httpMock.expectOne(`${API}/profile`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.userId).toBe('u-token');
      expect(req.request.body.profilePic).toBe('');
      req.flush(created);
      await pending;

      expect(service.currentUserProfiles()).toEqual([created]);
      expect(service.currentUserProfile()).toEqual(created);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(created);
    });

    it('adopts a refreshed token when the gateway returns one', async () => {
      const created = makeProfile({ id: 'new' });
      const pending = service.createProfile({ name: 'New' } as never);
      httpMock
        .expectOne(`${API}/profile`)
        .flush({ newToken: 'jwt', profile: created });
      await pending;

      expect(authState.setToken).toHaveBeenCalledWith('jwt');
      expect(service.currentUserProfile()).toEqual(created);
    });

    it('warns but continues when adopting the refreshed token fails', async () => {
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      authState.setToken.mockImplementation(() => {
        throw new Error('bad token');
      });
      const created = makeProfile({ id: 'new' });

      const pending = service.createProfile({ name: 'New' } as never);
      httpMock
        .expectOne(`${API}/profile`)
        .flush({ newToken: 'jwt', profile: created });
      await pending;

      expect(warn).toHaveBeenCalledWith(
        'Failed to set new token after profile creation',
        expect.any(Error)
      );
      expect(service.currentUserProfile()).toEqual(created);
      warn.mockRestore();
    });

    it('uploads the profile and cover pictures then patches the profile', async () => {
      const created = makeProfile({ id: 'new', profileName: 'Ada' });

      const pending = service.createProfile({
        name: 'Ada',
        profilePic: 'data:image/jpeg;base64,AAA',
        coverPic: 'data:image/png;base64,BBB',
      } as never);

      httpMock.expectOne(`${API}/profile`).flush(created);
      await Promise.resolve();

      const photoReq = httpMock.expectOne(`${API}/asset`);
      expect(photoReq.request.body).toMatchObject({
        name: 'profile-Ada-photo.jpeg',
        profileId: 'new',
        type: 'image',
        fileExtension: 'jpeg',
      });
      photoReq.flush({ id: 'asset-photo' });
      await Promise.resolve();

      const coverReq = httpMock.expectOne(`${API}/asset`);
      expect(coverReq.request.body).toMatchObject({
        name: 'profile-Ada-cover.png',
        fileExtension: 'png',
      });
      coverReq.flush({ id: 'asset-cover' });
      await Promise.resolve();

      const putReq = httpMock.expectOne(`${API}/profile/new`);
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.body).toEqual({
        profilePic: `${API}/asset/asset-photo`,
        coverPic: `${API}/asset/asset-cover`,
      });
      putReq.flush(created);

      await pending;
      expect(service.currentUserProfile()?.profilePic).toBe(
        `${API}/asset/asset-photo`
      );
    });

    it('defaults the asset extension to png for non data urls', async () => {
      const created = makeProfile({ id: 'new', profileName: 'Ada' });

      const pending = service.createProfile({
        name: 'Ada',
        profilePic: 'https://cdn.example.com/pic',
      } as never);

      httpMock.expectOne(`${API}/profile`).flush(created);
      await Promise.resolve();

      const photoReq = httpMock.expectOne(`${API}/asset`);
      expect(photoReq.request.body.fileExtension).toBe('png');
      photoReq.flush({ id: 'asset-photo' });
      await Promise.resolve();

      httpMock.expectOne(`${API}/profile/new`).flush(created);
      await pending;
    });
  });

  describe('updateProfile', () => {
    it('updates a local profile and syncs the selected profile', async () => {
      const local = makeProfile({ id: '1', appScope: 'client-interface' });
      service.currentUserProfiles.set([local]);
      service.currentUserProfile.set(local);
      const updated = makeProfile({ id: '1', bio: 'updated' });

      const pending = service.updateProfile('1', { bio: 'updated' } as never);
      const req = httpMock.expectOne(`${API}/profile/1`);
      expect(req.request.method).toBe('PUT');
      req.flush(updated);
      await pending;

      expect(service.currentUserProfiles()).toEqual([updated]);
      expect(service.currentUserProfile()).toEqual(updated);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(updated);
    });

    it('leaves the selected profile alone when a different profile is updated', async () => {
      const selected = makeProfile({
        id: 'other',
        appScope: 'client-interface',
      });
      const target = makeProfile({ id: '1', appScope: 'client-interface' });
      service.currentUserProfiles.set([selected, target]);
      service.currentUserProfile.set(selected);

      const pending = service.updateProfile('1', { bio: 'x' } as never);
      httpMock
        .expectOne(`${API}/profile/1`)
        .flush(makeProfile({ id: '1', bio: 'x' }));
      await pending;

      expect(service.currentUserProfile()).toEqual(selected);
    });

    it('creates a local profile instead of updating the global one', async () => {
      const log = jest
        .spyOn(console, 'log')
        .mockImplementation(() => undefined);
      const globalProfile = makeProfile({
        id: 'g',
        appScope: 'global',
        profileName: 'Ada',
        bio: 'old bio',
      });
      service.currentUserProfiles.set([globalProfile]);

      const pending = service.updateProfile('g', { bio: 'new bio' } as never);

      const req = httpMock.expectOne(`${API}/profile`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toMatchObject({
        name: 'Ada',
        bio: 'new bio',
        appScope: 'client-interface',
      });
      req.flush(makeProfile({ id: 'local-new', appScope: 'client-interface' }));
      await pending;

      expect(service.currentUserProfiles().map((p) => p.id)).toEqual([
        'g',
        'local-new',
      ]);
      log.mockRestore();
    });

    it('replaces an external profile picture with a stored asset', async () => {
      const existing = makeProfile({ id: '1', appScope: 'client-interface' });
      service.currentUserProfiles.set([existing]);

      const pending = service.updateProfile('1', {
        profilePic: 'data:image/png;base64,AAA',
      } as never);

      const getReq = httpMock.expectOne(`${API}/profile/1`);
      expect(getReq.request.method).toBe('GET');
      getReq.flush(
        makeProfile({
          id: '1',
          profileName: 'Ada',
          profilePic: `${API}/asset/old-asset`,
        })
      );
      await Promise.resolve();

      const delReq = httpMock.expectOne(`${API}/asset/old-asset`);
      expect(delReq.request.method).toBe('DELETE');
      delReq.flush(null);
      await Promise.resolve();

      const postReq = httpMock.expectOne(`${API}/asset/`);
      expect(postReq.request.body).toMatchObject({
        name: 'profile-Ada-photo.png',
        profileId: '1',
      });
      postReq.flush({ id: 'new-asset' });
      await Promise.resolve();

      const putReq = httpMock.expectOne(`${API}/profile/1`);
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.body.profilePic).toBe(`${API}/asset/new-asset`);
      putReq.flush(makeProfile({ id: '1' }));
      await pending;
    });

    it('skips the delete when the original profile had no picture', async () => {
      service.currentUserProfiles.set([
        makeProfile({ id: '1', appScope: 'client-interface' }),
      ]);

      const pending = service.updateProfile('1', {
        profilePic: 'data:image/png;base64,AAA',
      } as never);

      httpMock
        .expectOne(`${API}/profile/1`)
        .flush(makeProfile({ id: '1', profilePic: '' }));
      await Promise.resolve();

      httpMock.expectOne(`${API}/asset/`).flush({ id: 'new-asset' });
      await Promise.resolve();

      httpMock.expectOne(`${API}/profile/1`).flush(makeProfile({ id: '1' }));
      await pending;
      httpMock.verify();
    });

    it('leaves an already stored asset url untouched', async () => {
      service.currentUserProfiles.set([
        makeProfile({ id: '1', appScope: 'client-interface' }),
      ]);

      const pending = service.updateProfile('1', {
        profilePic: `${API}/asset/kept`,
      } as never);

      const putReq = httpMock.expectOne(`${API}/profile/1`);
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.body.profilePic).toBe(`${API}/asset/kept`);
      putReq.flush(makeProfile({ id: '1' }));
      await pending;
      httpMock.verify();
    });

    it('replaces an external cover picture with a stored asset', async () => {
      service.currentUserProfiles.set([
        makeProfile({ id: '1', appScope: 'client-interface' }),
      ]);

      const pending = service.updateProfile('1', {
        coverPic: 'data:image/gif;base64,AAA',
      } as never);

      httpMock.expectOne(`${API}/profile/1`).flush(
        makeProfile({
          id: '1',
          profileName: 'Ada',
          coverPic: `${API}/asset/old-cover`,
        })
      );
      await Promise.resolve();

      httpMock.expectOne(`${API}/asset/old-cover`).flush(null);
      await Promise.resolve();

      const postReq = httpMock.expectOne(`${API}/asset/`);
      expect(postReq.request.body).toMatchObject({
        name: 'profile-Ada-cover.gif',
        fileExtension: 'gif',
      });
      postReq.flush({ id: 'new-cover' });
      await Promise.resolve();

      const putReq = httpMock.expectOne(`${API}/profile/1`);
      expect(putReq.request.body.coverPic).toBe(`${API}/asset/new-cover`);
      putReq.flush(makeProfile({ id: '1' }));
      await pending;
    });
  });

  describe('deleteProfile', () => {
    it('removes the profile and clears the selection when it was selected', async () => {
      const profile = makeProfile({ id: '1' });
      service.currentUserProfiles.set([profile, makeProfile({ id: '2' })]);
      service.currentUserProfile.set(profile);

      const pending = service.deleteProfile('1');
      const req = httpMock.expectOne(`${API}/profiles/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      await pending;

      expect(service.currentUserProfiles().map((p) => p.id)).toEqual(['2']);
      expect(service.currentUserProfile()).toBeNull();
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(null);
    });

    it('keeps the selection when a different profile is deleted', async () => {
      const selected = makeProfile({ id: '2' });
      service.currentUserProfiles.set([makeProfile({ id: '1' }), selected]);
      service.currentUserProfile.set(selected);

      const pending = service.deleteProfile('1');
      httpMock.expectOne(`${API}/profiles/1`).flush(null);
      await pending;

      expect(service.currentUserProfile()).toEqual(selected);
    });
  });

  describe('local storage bridging', () => {
    it('loads both profiles and the selected profile', () => {
      const profiles = [makeProfile({ id: 'a' })];
      const selected = makeProfile({ id: 'b' });
      authState.getPersistedProfiles.mockReturnValue(profiles);
      authState.getPersistedSelectedProfile.mockReturnValue(selected);

      service.loadProfilesFromLocalStorage();

      expect(service.currentUserProfiles()).toEqual(profiles);
      expect(service.currentUserProfile()).toEqual(selected);
    });

    it('leaves the signals alone when nothing is persisted', () => {
      service.loadProfilesFromLocalStorage();
      expect(service.currentUserProfiles()).toEqual([]);
      expect(service.currentUserProfile()).toBeNull();
    });

    it('persists both signals', () => {
      const profiles = [makeProfile({ id: 'a' })];
      service.currentUserProfiles.set(profiles);
      service.currentUserProfile.set(profiles[0]);

      service.persistProfilesToLocalStorage();

      expect(authState.persistProfiles).toHaveBeenCalledWith(profiles);
      expect(authState.persistSelectedProfile).toHaveBeenCalledWith(
        profiles[0]
      );
    });
  });

  describe('block list endpoints', () => {
    it('gets a display profile', (done) => {
      service.getDisplayProfile('x').subscribe((p) => {
        expect(p.id).toBe('x');
        done();
      });
      httpMock.expectOne(`${API}/profile/x`).flush(makeProfile({ id: 'x' }));
    });

    it('gets blocked users', (done) => {
      service.getBlockedUsers('p1').subscribe((b) => {
        expect(b).toEqual([]);
        done();
      });
      const req = httpMock.expectOne(`${API}/profile/p1/blocked`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('blocks a user', (done) => {
      service.blockUser('p1', 'p2').subscribe(() => done());
      const req = httpMock.expectOne(`${API}/profile/p1/block`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ blockedProfileId: 'p2' });
      req.flush(null);
    });

    it('unblocks a user', (done) => {
      service.unblockUser('p1', 'p2').subscribe(() => done());
      const req = httpMock.expectOne(`${API}/profile/p1/block/p2`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });
});
