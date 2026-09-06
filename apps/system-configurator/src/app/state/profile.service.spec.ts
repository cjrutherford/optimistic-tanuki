import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile.service';
import { AuthStateService } from './auth-state.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;
  let authStateMock: {
    getDecodedTokenValue: jest.Mock;
    persistProfiles: jest.Mock;
    getPersistedProfiles: jest.Mock;
    persistSelectedProfile: jest.Mock;
    getPersistedSelectedProfile: jest.Mock;
  };

  const profile = (over: Partial<ProfileDto> = {}): ProfileDto =>
    ({
      id: 'p1',
      userId: 'u1',
      appScope: 'system-configurator',
      ...over,
    } as ProfileDto);

  beforeEach(() => {
    authStateMock = {
      getDecodedTokenValue: jest.fn().mockReturnValue({ userId: 'u1' }),
      persistProfiles: jest.fn(),
      getPersistedProfiles: jest.fn().mockReturnValue(null),
      persistSelectedProfile: jest.fn(),
      getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: AuthStateService, useValue: authStateMock }],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches profiles and keeps only ones matching the user and scope', async () => {
    const promise = service.getAllProfiles();
    const req = httpMock.expectOne('/api/profile');
    req.flush([
      profile({ id: 'mine-scoped', appScope: 'system-configurator' }),
      profile({ id: 'mine-global', appScope: 'global' }),
      profile({ id: 'mine-no-scope', appScope: undefined }),
      profile({ id: 'other-user', userId: 'someone-else' }),
      profile({ id: 'mine-other-scope', appScope: 'other-app' }),
    ]);
    await promise;

    const kept = service.currentUserProfiles().map((p) => p.id);
    expect(kept).toEqual(['mine-scoped', 'mine-global', 'mine-no-scope']);
    expect(authStateMock.persistProfiles).toHaveBeenCalledWith(
      service.currentUserProfiles()
    );
  });

  it('getCurrentUserProfiles falls back to persisted profiles', () => {
    authStateMock.getPersistedProfiles.mockReturnValue([profile()]);
    expect(service.getCurrentUserProfiles()).toEqual([profile()]);
  });

  it('getCurrentUserProfiles returns empty array when nothing is available', () => {
    expect(service.getCurrentUserProfiles()).toEqual([]);
  });

  it('getEffectiveProfile prefers the in-memory selected profile', () => {
    service.selectProfile(profile({ id: 'selected' }));
    expect(service.getEffectiveProfile()?.id).toBe('selected');
  });

  it('getEffectiveProfile falls back to the persisted selected profile', () => {
    authStateMock.getPersistedSelectedProfile.mockReturnValue(
      profile({ id: 'persisted-selected' })
    );
    expect(service.getEffectiveProfile()?.id).toBe('persisted-selected');
  });

  it('getEffectiveProfile falls back to a scoped profile', () => {
    authStateMock.getPersistedProfiles.mockReturnValue([
      profile({ id: 'scoped', appScope: 'system-configurator' }),
    ]);
    expect(service.getEffectiveProfile()?.id).toBe('scoped');
  });

  it('getEffectiveProfile falls back to a global profile', () => {
    authStateMock.getPersistedProfiles.mockReturnValue([
      profile({ id: 'global-only', appScope: 'global' }),
    ]);
    expect(service.getEffectiveProfile()?.id).toBe('global-only');
  });

  it('getEffectiveProfile returns null when no profile can be resolved', () => {
    authStateMock.getPersistedProfiles.mockReturnValue([
      profile({ id: 'unrelated', appScope: 'unrelated-app' }),
    ]);
    expect(service.getEffectiveProfile()).toBeNull();
  });

  it('createProfile posts, appends, persists and selects the created profile', async () => {
    const promise = service.createProfile({
      userId: 'u1',
      name: 'New',
    } as never);
    const req = httpMock.expectOne('/api/profile');
    expect(req.request.body.appScope).toBe('system-configurator');
    req.flush(profile({ id: 'created' }));

    const created = await promise;
    expect(created.id).toBe('created');
    expect(service.currentUserProfile()?.id).toBe('created');
    expect(authStateMock.persistProfiles).toHaveBeenCalled();
  });

  it('createProfile unwraps a {profile, newToken} response shape', async () => {
    const promise = service.createProfile({ userId: 'u1' } as never);
    const req = httpMock.expectOne('/api/profile');
    req.flush({ profile: profile({ id: 'wrapped' }), newToken: 'tok' });

    const created = await promise;
    expect(created.id).toBe('wrapped');
  });

  it('updateProfile puts, replaces the matching profile, persists and selects it', async () => {
    authStateMock.getPersistedProfiles.mockReturnValue([
      profile({ id: 'p1', name: 'old' } as never),
    ]);

    const promise = service.updateProfile('p1', { name: 'new' } as never);
    const req = httpMock.expectOne('/api/profile/p1');
    expect(req.request.method).toBe('PUT');
    req.flush(profile({ id: 'p1', name: 'new' } as never));

    const updated = await promise;
    expect(updated.id).toBe('p1');
    expect(service.currentUserProfile()?.id).toBe('p1');
  });
});
