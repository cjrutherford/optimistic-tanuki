import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { API_BASE_URL, ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile.service';
import { AuthStateService } from './auth-state.service';
import { AuthenticationService } from './authentication.service';

/**
 * Covers profile selection, the persisted-state fallbacks, and the
 * create/update/list flows. Local (leads-app) profiles win over global ones.
 */
describe('ProfileService behaviour', () => {
  let service: ProfileService;
  let http: HttpTestingController;
  let authState: {
    persistProfiles: jest.Mock;
    persistSelectedProfile: jest.Mock;
    getPersistedProfiles: jest.Mock;
    getPersistedSelectedProfile: jest.Mock;
    getDecodedTokenValue: jest.Mock;
    restoreSession: jest.Mock;
  };
  let authentication: { issue: jest.Mock };

  const profile = (overrides: Partial<ProfileDto> = {}): ProfileDto =>
    ({
      id: 'prof-1',
      userId: 'user-1',
      appScope: 'leads-app',
      ...overrides,
    } as ProfileDto);

  beforeEach(() => {
    authState = {
      persistProfiles: jest.fn(),
      persistSelectedProfile: jest.fn(),
      getPersistedProfiles: jest.fn().mockReturnValue(null),
      getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
      getDecodedTokenValue: jest.fn().mockReturnValue({ userId: 'user-1' }),
      restoreSession: jest.fn().mockResolvedValue(undefined),
    };
    authentication = { issue: jest.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
        { provide: AuthStateService, useValue: authState },
        { provide: AuthenticationService, useValue: authentication },
      ],
    });

    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('getEffectiveProfile', () => {
    it('prefers a leads-app profile over a global one', () => {
      service.currentUserProfiles.set([
        profile({ id: 'global-1', appScope: 'global' }),
        profile({ id: 'local-1', appScope: 'leads-app' }),
      ]);

      expect(service.getEffectiveProfile()?.id).toBe('local-1');
    });

    it('falls back to a global profile', () => {
      service.currentUserProfiles.set([
        profile({ id: 'global-1', appScope: 'global' }),
      ]);

      expect(service.getEffectiveProfile()?.id).toBe('global-1');
    });

    it('treats a profile with no scope as global', () => {
      service.currentUserProfiles.set([
        profile({ id: 'scopeless', appScope: undefined }),
      ]);

      expect(service.getEffectiveProfile()?.id).toBe('scopeless');
    });

    it('is null with nothing to choose from', () => {
      expect(service.getEffectiveProfile()).toBeNull();
    });
  });

  describe('hasLocalProfile', () => {
    it('reports whether a leads-app profile exists', () => {
      service.currentUserProfiles.set([profile({ appScope: 'global' })]);
      expect(service.hasLocalProfile()).toBe(false);

      service.currentUserProfiles.set([profile({ appScope: 'leads-app' })]);
      expect(service.hasLocalProfile()).toBe(true);
    });
  });

  describe('persisted fallbacks', () => {
    it('hydrates the profile list from storage when empty', () => {
      authState.getPersistedProfiles.mockReturnValue([profile()]);

      expect(service.getCurrentUserProfiles()).toHaveLength(1);
      expect(service.currentUserProfiles()).toHaveLength(1);
    });

    it('does not re-read storage once profiles are loaded', () => {
      service.currentUserProfiles.set([profile()]);

      service.getCurrentUserProfiles();

      expect(authState.getPersistedProfiles).not.toHaveBeenCalled();
    });

    it('hydrates the selected profile from storage when empty', () => {
      authState.getPersistedSelectedProfile.mockReturnValue(profile());

      expect(service.getCurrentUserProfile()?.id).toBe('prof-1');
      expect(service.currentUserProfile()?.id).toBe('prof-1');
    });

    it('stays null when storage has no selection', () => {
      expect(service.getCurrentUserProfile()).toBeNull();
    });
  });

  describe('selectProfile', () => {
    it('selects and persists a known profile', () => {
      service.currentUserProfiles.set([profile()]);

      service.selectProfile(profile());

      expect(service.currentUserProfile()?.id).toBe('prof-1');
      expect(authState.persistSelectedProfile).toHaveBeenCalled();
    });

    it('ignores a profile that is not the user’s', () => {
      service.currentUserProfiles.set([profile({ id: 'mine' })]);

      service.selectProfile(profile({ id: 'someone-else' }));

      expect(service.currentUserProfile()).toBeNull();
      expect(authState.persistSelectedProfile).not.toHaveBeenCalled();
    });
  });

  describe('activateProfile', () => {
    it('issues a new token when the session is on a different profile', async () => {
      service.currentUserProfiles.set([profile({ id: 'prof-2' })]);
      authState.getDecodedTokenValue.mockReturnValue({
        userId: 'user-1',
        profileId: 'prof-1',
      });

      await service.activateProfile(profile({ id: 'prof-2' }));

      expect(authentication.issue).toHaveBeenCalledWith({
        profileId: 'prof-2',
      });
      expect(authState.restoreSession).toHaveBeenCalled();
    });

    it('does nothing when the token already names that profile', async () => {
      service.currentUserProfiles.set([profile({ id: 'prof-1' })]);
      authState.getDecodedTokenValue.mockReturnValue({
        userId: 'user-1',
        profileId: 'prof-1',
      });

      await service.activateProfile(profile({ id: 'prof-1' }));

      expect(authentication.issue).not.toHaveBeenCalled();
    });

    it('stops when the profile is not selectable', async () => {
      service.currentUserProfiles.set([]);

      await service.activateProfile(profile({ id: 'unknown' }));

      expect(authentication.issue).not.toHaveBeenCalled();
    });
  });

  describe('getAllProfiles', () => {
    it('keeps only this user’s global and leads-app profiles', async () => {
      const promise = service.getAllProfiles();

      http
        .expectOne('/api/profile')
        .flush([
          profile({ id: 'mine-local', appScope: 'leads-app' }),
          profile({ id: 'mine-global', appScope: 'global' }),
          profile({ id: 'mine-other', appScope: 'other-app' }),
          profile({ id: 'theirs', userId: 'user-2' }),
        ]);

      const result = await promise;

      expect(result.map((p) => p.id)).toEqual(['mine-local', 'mine-global']);
      expect(service.allProfiles()).toHaveLength(4);
      expect(authState.persistProfiles).toHaveBeenCalled();
    });

    it('restores a previously selected profile', async () => {
      authState.getPersistedSelectedProfile.mockReturnValue(
        profile({ id: 'mine-global', appScope: 'global' })
      );

      const promise = service.getAllProfiles();
      http
        .expectOne('/api/profile')
        .flush([profile({ id: 'mine-global', appScope: 'global' })]);
      await promise;

      expect(service.currentUserProfile()?.id).toBe('mine-global');
    });

    it('otherwise selects the local profile', async () => {
      const promise = service.getAllProfiles();
      http
        .expectOne('/api/profile')
        .flush([
          profile({ id: 'mine-global', appScope: 'global' }),
          profile({ id: 'mine-local', appScope: 'leads-app' }),
        ]);
      await promise;

      expect(service.currentUserProfile()?.id).toBe('mine-local');
    });

    it('selects nothing when only a global profile exists', async () => {
      const promise = service.getAllProfiles();
      http
        .expectOne('/api/profile')
        .flush([profile({ id: 'mine-global', appScope: 'global' })]);
      await promise;

      expect(service.currentUserProfile()).toBeNull();
    });
  });

  describe('createProfile', () => {
    it('posts with the user id and app scope, then selects the result', async () => {
      const promise = service.createProfile({ name: 'Ada' } as never);

      const request = http.expectOne('/api/profile');
      expect(request.request.body).toMatchObject({
        name: 'Ada',
        userId: 'user-1',
        appScope: 'leads-app',
      });
      request.flush(profile({ id: 'created-1' }));

      const created = await promise;

      expect(created.id).toBe('created-1');
      expect(service.currentUserProfile()?.id).toBe('created-1');
      expect(service.currentUserProfiles().map((p) => p.id)).toContain(
        'created-1'
      );
      expect(authState.persistSelectedProfile).toHaveBeenCalled();
    });

    it('unwraps a wrapped profile response', async () => {
      const promise = service.createProfile({ name: 'Ada' } as never);
      http
        .expectOne('/api/profile')
        .flush({ profile: profile({ id: 'wrapped-1' }) });

      await expect(promise).resolves.toMatchObject({ id: 'wrapped-1' });
    });

    it('replaces an existing entry with the same id rather than duplicating', async () => {
      service.currentUserProfiles.set([profile({ id: 'dup-1' })]);

      const promise = service.createProfile({ name: 'Ada' } as never);
      http.expectOne('/api/profile').flush(profile({ id: 'dup-1' }));
      await promise;

      expect(service.currentUserProfiles()).toHaveLength(1);
    });
  });

  describe('updateProfile', () => {
    it('replaces the profile in the list', async () => {
      service.currentUserProfiles.set([
        profile({ id: 'prof-1' }),
        profile({ id: 'prof-2' }),
      ]);

      const promise = service.updateProfile('prof-1', { name: 'New' } as never);
      const request = http.expectOne('/api/profile/prof-1');
      expect(request.request.method).toBe('PUT');
      request.flush(profile({ id: 'prof-1', name: 'New' } as never));
      await promise;

      expect(service.currentUserProfiles()[0]).toMatchObject({ name: 'New' });
      expect(authState.persistProfiles).toHaveBeenCalled();
    });

    it('refreshes the selection when the updated profile is the selected one', async () => {
      service.currentUserProfiles.set([profile({ id: 'prof-1' })]);
      service.currentUserProfile.set(profile({ id: 'prof-1' }));

      const promise = service.updateProfile('prof-1', { name: 'New' } as never);
      http
        .expectOne('/api/profile/prof-1')
        .flush(profile({ id: 'prof-1', name: 'New' } as never));
      await promise;

      expect(service.currentUserProfile()).toMatchObject({ name: 'New' });
      expect(authState.persistSelectedProfile).toHaveBeenCalled();
    });

    it('leaves a different selection alone', async () => {
      service.currentUserProfiles.set([profile({ id: 'prof-1' })]);
      service.currentUserProfile.set(profile({ id: 'prof-2' }));

      const promise = service.updateProfile('prof-1', { name: 'New' } as never);
      http
        .expectOne('/api/profile/prof-1')
        .flush(profile({ id: 'prof-1', name: 'New' } as never));
      await promise;

      expect(service.currentUserProfile()?.id).toBe('prof-2');
      expect(authState.persistSelectedProfile).not.toHaveBeenCalled();
    });
  });
});
