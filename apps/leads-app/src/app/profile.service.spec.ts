import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL, ProfileDto } from '@optimistic-tanuki/ui-models';
import { ProfileService } from './profile.service';
import { AuthStateService } from './auth-state.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  const authStateStub = {
    getDecodedTokenValue: jest.fn(),
    getPersistedProfiles: jest.fn(),
    persistProfiles: jest.fn(),
    getPersistedSelectedProfile: jest.fn(),
    persistSelectedProfile: jest.fn(),
    restoreSession: jest.fn(),
  };

  const leadsProfile: ProfileDto = {
    id: 'leads-profile',
    userId: 'user-1',
    profileName: 'Lead Operator',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    appScope: 'leads-app',
  } as ProfileDto;

  beforeEach(() => {
    jest.clearAllMocks();
    authStateStub.getDecodedTokenValue.mockReturnValue({
      userId: 'user-1',
      email: 'user@example.com',
      name: 'User One',
      profileId: 'global-profile',
    });
    authStateStub.getPersistedProfiles.mockReturnValue(null);
    authStateStub.getPersistedSelectedProfile.mockReturnValue(null);

    TestBed.configureTestingModule({
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: API_BASE_URL,
          useValue: '/api',
        },
        {
          provide: AuthStateService,
          useValue: authStateStub,
        },
      ],
    });

    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('refreshes the cookie session when activating a different leads profile', async () => {
    service.currentUserProfiles.set([leadsProfile]);

    const activationPromise = service.activateProfile(leadsProfile);

    const req = httpMock.expectOne('/api/authentication/issue');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ profileId: 'leads-profile' });
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-ot-session-mode')).toBe('cookie');
    req.flush({ data: {} });

    await activationPromise;

    expect(authStateStub.restoreSession).toHaveBeenCalled();
    expect(authStateStub.persistSelectedProfile).toHaveBeenCalledWith(
      leadsProfile
    );
  });
});
