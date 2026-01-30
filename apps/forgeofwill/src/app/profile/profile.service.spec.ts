import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { AuthStateService } from '../auth-state.service';
import { ProfileDto, CreateProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;
  let authStateService: jest.Mocked<Partial<AuthStateService>>;

  const mockProfile: ProfileDto = {
    id: '1',
    userId: 'user1',
    profileName: 'Test Profile',
    appScope: 'forgeofwill',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    created_at: new Date('2026-01-29T02:09:44.371Z')
  };

  const mockGlobalProfile: ProfileDto = {
    ...mockProfile,
    id: '2',
    appScope: 'global'
  };

  beforeEach(() => {
    authStateService = {
      getDecodedTokenValue: jest.fn(() => ({ userId: 'user1' } as any)),
      setToken: jest.fn()
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProfileService,
        { provide: AuthStateService, useValue: authStateService },
      ],
    });

    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);
    
    localStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Profile Selection', () => {
    it('selectProfile should set signal and localStorage', () => {
      service.currentUserProfiles.set([mockProfile]);
      service.selectProfile(mockProfile);
      expect(service.currentUserProfile()).toEqual(mockProfile);
      expect(localStorage.getItem('selectedProfile')).toContain('Test Profile');
    });

    it('selectProfile should add to list if not present', () => {
        service.currentUserProfiles.set([]);
        service.selectProfile(mockProfile);
        expect(service.currentUserProfiles()).toContainEqual(mockProfile);
    });
  });

  describe('Getters', () => {
    it('getCurrentUserProfiles should fallback to localStorage', () => {
      localStorage.setItem('profiles', JSON.stringify([mockProfile]));
      const profiles = service.getCurrentUserProfiles();
      expect(profiles[0].id).toBe(mockProfile.id);
    });

    it('getCurrentUserProfile should fallback to localStorage', () => {
        localStorage.setItem('selectedProfile', JSON.stringify(mockProfile));
        const profile = service.getCurrentUserProfile();
        expect(profile?.id).toBe(mockProfile.id);
    });

    it('getCurrentUserProfile should fallback to first profile if nothing selected', () => {
        service.currentUserProfiles.set([mockProfile]);
        const profile = service.getCurrentUserProfile();
        expect(profile?.id).toBe(mockProfile.id);
    });
  });

  describe('API calls', () => {
    it('getAllProfiles should fetch and filter profiles', async () => {
      const promise = service.getAllProfiles();
      const req = httpMock.expectOne('/api/profile');
      req.flush([
          mockProfile, 
          { ...mockProfile, id: '3', userId: 'other' }, 
          mockGlobalProfile,
          { ...mockProfile, id: '4', appScope: 'other-app' }
      ]);
      await promise;
      // Should have mockProfile (forgeofwill) and mockGlobalProfile (global)
      expect(service.currentUserProfiles().length).toBe(2);
      expect(service.currentUserProfiles().map(p => p.id)).toContain('1');
      expect(service.currentUserProfiles().map(p => p.id)).toContain('2');
    });

    it('getProfileById should fetch and set', async () => {
        const promise = service.getProfileById('1');
        const req = httpMock.expectOne('/api/profile/1');
        req.flush(mockProfile);
        await promise;
        expect(service.currentUserProfile()).toEqual(mockProfile);
    });
  });

  describe('Profile Modification', () => {
    it('createProfile should handle base64 images and asset creation', async () => {
      const createDto: CreateProfileDto = {
        name: 'New',
        userId: 'user1',
        profilePic: 'data:image/png;base64,pic',
        coverPic: 'data:image/png;base64,cover',
        description: '',
        bio: '',
        location: '',
        occupation: '',
        interests: '',
        skills: ''
      };

      const promise = service.createProfile(createDto);

      // 1. Initial Profile POST
      const req1 = httpMock.expectOne('/api/profile');
      req1.flush({ ...mockProfile, id: 'new-id', profileName: 'New' });
      await Promise.resolve();
      await Promise.resolve();

      // 2. Profile Pic Asset POST
      const req2 = httpMock.expectOne('/api/asset');
      expect(req2.request.body.name).toContain('photo');
      req2.flush({ id: 'asset-pic' });
      await Promise.resolve();
      await Promise.resolve();

      // 3. Cover Pic Asset POST
      const req3 = httpMock.expectOne('/api/asset');
      expect(req3.request.body.name).toContain('cover');
      req3.flush({ id: 'asset-cover' });
      await Promise.resolve();
      await Promise.resolve();

      // 4. Profile PUT to update URLs
      const req4 = httpMock.expectOne('/api/profile/new-id');
      req4.flush({ ...mockProfile, id: 'new-id', profilePic: '/api/asset/asset-pic', coverPic: '/api/asset/asset-cover' });
      
      await promise;

      expect(service.currentUserProfiles()).toContainEqual(expect.objectContaining({ id: 'new-id' }));
    });

    it('deleteProfile should call API and update state', async () => {
        // Set initial state
        const initialProfiles = [mockProfile];
        service.currentUserProfiles.set(initialProfiles);
        service.currentUserProfile.set(mockProfile);
        
        const promise = service.deleteProfile('1');
        
        const req = httpMock.expectOne('/api/profiles/1');
        req.flush(null);
        await promise;
        
        expect(service.currentUserProfiles().length).toBe(0);
        expect(service.currentUserProfile()).toBeNull();
    });

    it('updateProfile should handle asset replacement', async () => {
        const initialProfile = { ...mockProfile, profilePic: '/api/asset/old-pic', coverPic: '/api/asset/old-cover' };
        service.currentUserProfiles.set([initialProfile]);
        
        const updateDto: UpdateProfileDto = {
            id: '1',
            profilePic: 'data:image/png;base64,new-pic',
            coverPic: 'data:image/png;base64,new-cover'
        };

        const promise = service.updateProfile('1', updateDto);

        // 1. Fetch original profile for pic logic
        const reqGet1 = httpMock.expectOne('/api/profile/1');
        reqGet1.flush(initialProfile);
        await Promise.resolve();
        await Promise.resolve();

        // 2. DELETE old pic
        const reqDelPic = httpMock.expectOne('/api/asset/old-pic');
        reqDelPic.flush(null);
        await Promise.resolve();
        await Promise.resolve();

        // 3. POST new pic asset
        const reqNewPic = httpMock.expectOne('/api/asset/');
        reqNewPic.flush({ id: 'new-pic-id' });
        await Promise.resolve();
        await Promise.resolve();

        // 4. Fetch original profile for cover logic
        const reqGet2 = httpMock.expectOne('/api/profile/1');
        reqGet2.flush(initialProfile);
        await Promise.resolve();
        await Promise.resolve();

        // 5. DELETE old cover
        const reqDelCover = httpMock.expectOne('/api/asset/old-cover');
        reqDelCover.flush(null);
        await Promise.resolve();
        await Promise.resolve();

        // 6. POST new cover asset
        const reqNewCover = httpMock.expectOne('/api/asset/');
        reqNewCover.flush({ id: 'new-cover-id' });
        await Promise.resolve();
        await Promise.resolve();

        // 7. PUT profile update
        const reqPut = httpMock.expectOne('/api/profile/1');
        reqPut.flush({ ...initialProfile, profilePic: '/api/asset/new-pic-id', coverPic: '/api/asset/new-cover-id' });
        
        await promise;

        expect(service.currentUserProfiles()[0].profilePic).toBe('/api/asset/new-pic-id');
    });

    it('updateProfile should create local profile if updating global and no local exists', async () => {
        service.currentUserProfiles.set([mockGlobalProfile]);
        const updateDto: UpdateProfileDto = { id: '2', bio: 'new bio' };
        
        const createSpy = jest.spyOn(service, 'createProfile').mockResolvedValue(undefined);
        
        await service.updateProfile('2', updateDto);
        
        expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
            appScope: 'forgeofwill',
            bio: 'new bio'
        }));
    });

    it('createProfile should handle newToken in response', async () => {
      const createDto: CreateProfileDto = {
        name: 'New',
        userId: 'user1',
        description: '', bio: '', location: '', occupation: '', interests: '', skills: '',
        profilePic: '', coverPic: ''
      };

      const promise = service.createProfile(createDto);
      const req = httpMock.expectOne('/api/profile');
      req.flush({ profile: mockProfile, newToken: 'new-token' });
      
      await promise;
      expect(authStateService.setToken).toHaveBeenCalledWith('new-token');
    });
  });

  describe('Helper methods', () => {
      it('getFileExtensionFromDataUrl should return correct extension', () => {
          expect(service.getFileExtensionFromDataUrl('data:image/jpeg;base64,abc')).toBe('jpeg');
          expect(service.getFileExtensionFromDataUrl('data:image/png;base64,abc')).toBe('png');
          expect(service.getFileExtensionFromDataUrl('')).toBe('');
          expect(service.getFileExtensionFromDataUrl(null)).toBe('');
          expect(service.getFileExtensionFromDataUrl('invalid')).toBe('');
      });

      it('loadProfilesFromLocalStorage and persistProfilesToLocalStorage', () => {
          service.currentUserProfiles.set([mockProfile]);
          service.currentUserProfile.set(mockProfile);
          service.persistProfilesToLocalStorage();
          
          expect(localStorage.getItem('profiles')).toContain('Test Profile');
          expect(localStorage.getItem('selectedProfile')).toContain('Test Profile');
          
          service.currentUserProfiles.set([]);
          service.currentUserProfile.set(null);
          
          service.loadProfilesFromLocalStorage();
          const loadedProfiles = service.currentUserProfiles();
          expect(loadedProfiles[0].id).toBe(mockProfile.id);
          expect(loadedProfiles[0].profileName).toBe(mockProfile.profileName);
          // Check date as string since it was JSON stringified
          expect(loadedProfiles[0].created_at.toString()).toBe(mockProfile.created_at.toISOString());
          
          expect(service.currentUserProfile()?.id).toBe(mockProfile.id);
      });

      it('getDisplayProfile should call API', () => {
          service.getDisplayProfile('1').subscribe();
          const req = httpMock.expectOne('/api/profile/1');
          expect(req.request.method).toBe('GET');
          req.flush(mockProfile);
      });

      it('getEffectiveProfile should prefer local over global', () => {
          service.currentUserProfiles.set([mockGlobalProfile, mockProfile]);
          expect(service.getEffectiveProfile()?.id).toBe('1');
      });

      it('getEffectiveProfile should fallback to global', () => {
          service.currentUserProfiles.set([mockGlobalProfile]);
          expect(service.getEffectiveProfile()?.id).toBe('2');
      });

      it('hasLocalProfile and hasOnlyGlobalProfile', () => {
          service.currentUserProfiles.set([mockGlobalProfile]);
          expect(service.hasLocalProfile()).toBe(false);
          expect(service.hasOnlyGlobalProfile()).toBe(true);

          service.currentUserProfiles.set([mockProfile]);
          expect(service.hasLocalProfile()).toBe(true);
          expect(service.hasOnlyGlobalProfile()).toBe(false);
      });
  });
});