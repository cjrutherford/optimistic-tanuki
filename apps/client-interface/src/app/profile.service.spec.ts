import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { AuthStateService } from './state/auth-state.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        ProfileService,
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthStateService,
          useValue: {
            getDecodedTokenValue: jest.fn(),
            getPersistedSelectedProfile: jest.fn().mockReturnValue(null),
          },
        },
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    });
    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  describe('getCurrentUserProfile', () => {
    it('should return the current user profile', () => {
      const mockProfile: ProfileDto = {
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
        created_at: new Date(),
      };
      service.currentUserProfile.set(mockProfile);

      const result = service.getCurrentUserProfile();

      expect(result).toEqual(mockProfile);
    });

    it('should return null if no current user profile is set', () => {
      service.currentUserProfile.set(null);

      const result = service.getCurrentUserProfile();

      expect(result).toBeNull();
    });
  });

  it('loads scoped recipient profiles separately from the current user profiles', async () => {
    const pending = service.getDiscoverableProfiles();
    const request = httpMock.expectOne(
      'http://localhost:3000/profile/discover'
    );
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 'profile-2', userId: 'user-2', profileName: 'Bob' }]);

    await pending;
    expect(service.discoverableProfiles()).toEqual([
      { id: 'profile-2', userId: 'user-2', profileName: 'Bob' },
    ]);
    expect(service.currentUserProfiles()).toEqual([]);
  });
});
