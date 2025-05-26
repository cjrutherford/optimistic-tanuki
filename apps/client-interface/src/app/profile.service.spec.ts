import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { AuthStateService } from './state/auth-state.service';
import { ProfileDto } from '@optimistic-tanuki/profile-ui';

describe('ProfileService', () => {
  let service: ProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProfileService,
        { provide: AuthStateService, useValue: { getDecodedTokenValue: jest.fn() } }
      ]
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
        coverPic: '' ,
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