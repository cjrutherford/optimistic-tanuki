import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { AuthStateService } from './state/auth-state.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

describe('ProfileService', () => {
  let service: ProfileService;

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
});
