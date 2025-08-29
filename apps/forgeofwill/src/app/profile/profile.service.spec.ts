import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProfileService } from './profile.service';
import { AuthStateService } from '../auth-state.service';
import { ProfileDto, CreateProfileDto, UpdateProfileDto, AssetDto } from '@optimistic-tanuki/ui-models';

describe('ProfileService', () => {
  let service: ProfileService;
  let httpMock: HttpTestingController;
  let authStateServiceMock: any;

  const mockProfile: ProfileDto = {
    id: '1',
    userId: 'user1',
    profileName: 'Test Profile',
    profilePic: '/api/asset/pic1',
    coverPic: '/api/asset/cover1',
    bio: 'test bio',
    location: 'test location',
    occupation: 'test occupation',
    interests: 'testing',
    skills: 'testing',
    created_at: new Date(),
  };

  const mockAsset: AssetDto = {
    id: 'asset1',
    name: 'test-asset',
    type: 'image',
    profileId: '1',
    storageStrategy: 'local_block_storage',
    storagePath: 'path/to/asset',
  };

  beforeEach(() => {
    authStateServiceMock = {
      getDecodedTokenValue: jest.fn().mockReturnValue({ userId: 'user1' }),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProfileService,
        { provide: AuthStateService, useValue: authStateServiceMock },
      ],
    });

    service = TestBed.inject(ProfileService);
    httpMock = TestBed.inject(HttpTestingController);

    // Mock localStorage
    let store: { [key: string]: string } = {};
    const mockLocalStorage = {
        getItem: (key: string): string | null => store[key] || null,
        setItem: (key: string, value: string) => (store[key] = value),
        removeItem: (key: string) => delete store[key],
        clear: () => (store = {}),
      };
      Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should select a profile and store it', () => {
    service.currentUserProfiles.set([mockProfile]);
    service.selectProfile(mockProfile);
    expect(service.currentUserProfile()).toEqual(mockProfile);
    const stored = JSON.parse(localStorage.getItem('selectedProfile')!);
    expect(stored).toEqual(JSON.parse(JSON.stringify(mockProfile)));
  });

  it('should get all profiles for the current user', async () => {
    const allProfiles: ProfileDto[] = [mockProfile, { ...mockProfile, id: '2', userId: 'user2' }];
    const userProfiles = [mockProfile];

    const promise = service.getAllProfiles();

    const req = httpMock.expectOne('/api/profile');
    expect(req.request.method).toBe('GET');
    req.flush(allProfiles);

    await promise;

    expect(service.allProfiles()).toEqual(allProfiles);
    expect(service.currentUserProfiles()).toEqual(userProfiles);
    const stored = JSON.parse(localStorage.getItem('profiles')!);
    expect(stored).toEqual(JSON.parse(JSON.stringify(allProfiles)));
  });

  it('should create a profile with assets', fakeAsync(() => {
    const createProfileDto: CreateProfileDto = {
        name: 'New Profile',
        description: 'A new profile',
        profilePic: 'data:image/png;base64,abc',
        coverPic: 'data:image/png;base64,def',
        userId: 'user1',
        bio: 'new bio',
        location: 'new location',
        occupation: 'new occupation',
        interests: 'new interests',
        skills: 'new skills',
    };
    const createdProfile: ProfileDto = { ...mockProfile, id: '2', profileName: 'New Profile' };
    
    service.createProfile(createProfileDto);
    tick(); // Advance time to allow the first HTTP request to be made

    const profileReq = httpMock.expectOne('/api/profile');
    expect(profileReq.request.method).toBe('POST');
    profileReq.flush(createdProfile);
    tick(); // Advance time to allow asset requests to be made

    const assetRequest1 = httpMock.expectOne('/api/asset');
    expect(assetRequest1.request.method).toBe('POST');
    assetRequest1.flush({ ...mockAsset, id: 'asset2' });
    tick(); // Advance time to allow the second asset request to be made

    const assetRequest2 = httpMock.expectOne('/api/asset');
    expect(assetRequest2.request.method).toBe('POST');
    assetRequest2.flush({ ...mockAsset, id: 'asset3' });
    tick(); // Advance time to allow the final PUT request to be made

    const updateProfileReq = httpMock.expectOne(`/api/profile/${createdProfile.id}`);
    expect(updateProfileReq.request.method).toBe('PUT');
    updateProfileReq.flush(createdProfile);
    tick(); // Advance time to allow the promise to resolve

    expect(service.currentUserProfiles()).toContainEqual(createdProfile);
  }));

  it('should update a profile', async () => {
    const updateDto: UpdateProfileDto = { id: '1', bio: 'Updated Bio', name: 'a', description: 'b' };
    const updatedProfile: ProfileDto = { ...mockProfile, bio: 'Updated Bio' };

    service.currentUserProfiles.set([mockProfile]);
    service.currentUserProfile.set(mockProfile);

    const promise = service.updateProfile('1', updateDto);

    const req = httpMock.expectOne('/api/profile/1');
    expect(req.request.method).toBe('PUT');
    req.flush(updatedProfile);

    await promise;

    expect(service.currentUserProfiles()).toContainEqual(updatedProfile);
    expect(service.currentUserProfile()).toEqual(updatedProfile);
  });

  it('should delete a profile', async () => {
    service.currentUserProfiles.set([mockProfile]);
    service.currentUserProfile.set(mockProfile);

    const promise = service.deleteProfile('1');

    const req = httpMock.expectOne('/api/profiles/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});

    await promise;

    expect(service.currentUserProfiles()).not.toContainEqual(mockProfile);
    expect(service.currentUserProfile()).toBeNull();
  });
});