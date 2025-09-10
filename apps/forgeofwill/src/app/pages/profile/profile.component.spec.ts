import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ProfileComponent } from './profile.component';
import { ProfileService } from '../../profile/profile.service';
import { of } from 'rxjs';
import { CreateProfileDto, ProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models';

describe('ProfileComponent', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let profileService: ProfileService;

  const mockProfile: ProfileDto = {
    id: '1',
    userId: 'user1',
    profileName: 'Test Profile',
    profilePic: '',
    coverPic: '',
    bio: '',
    location: '',
    occupation: '',
    interests: '',
    skills: '',
    created_at: new Date(),
  };

  beforeEach(async () => {
    const profileServiceMock = {
      getAllProfiles: jest.fn().mockResolvedValue(undefined),
      currentUserProfiles: jest.fn(),
      selectProfile: jest.fn(),
      createProfile: jest.fn().mockResolvedValue(undefined),
      updateProfile: jest.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        { provide: ProfileService, useValue: profileServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    profileService = TestBed.inject(ProfileService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load profiles and set selected profile', fakeAsync(() => {
      jest.spyOn(profileService, 'getAllProfiles').mockResolvedValue(undefined);
      jest.spyOn(profileService, 'currentUserProfiles').mockReturnValue([mockProfile]);
      jest.spyOn(profileService, 'currentUserProfiles').mockReturnValue([mockProfile]);

      component.ngOnInit();
      tick();

      expect(profileService.getAllProfiles).toHaveBeenCalled();
      expect(component.availableProfiles()).toEqual([mockProfile]);
      expect(component.selectedProfile()).toEqual(mockProfile);
    }));

    it('should not set selected profile if no profiles are available', fakeAsync(() => {
      jest.spyOn(profileService, 'getAllProfiles').mockResolvedValue(undefined);
      jest.spyOn(profileService, 'currentUserProfiles').mockReturnValue([]);

      component.ngOnInit();
      tick();

      expect(profileService.getAllProfiles).toHaveBeenCalled();
      expect(component.availableProfiles()).toEqual([]);
      expect(component.selectedProfile()).toBeNull();
    }));
  });

  describe('selectProfile', () => {
    it('should select a profile', () => {
      const newProfile: ProfileDto = { ...mockProfile, id: '2', profileName: 'New Profile' };
      component.selectProfile(newProfile);
      expect(component.selectedProfile()).toEqual(newProfile);
      expect(profileService.selectProfile).toHaveBeenCalledWith(newProfile);
    });
  });

  describe('createProfile', () => {
    it('should create a profile and reload profiles', fakeAsync(() => {
      const createDto: CreateProfileDto = { name: 'New Profile', userId: 'user1' } as CreateProfileDto;
      jest.spyOn(profileService, 'createProfile').mockResolvedValue(undefined);
      jest.spyOn(profileService, 'getAllProfiles').mockResolvedValue(undefined);
      jest.spyOn(profileService, 'currentUserProfiles').mockReturnValue([mockProfile, { ...mockProfile, id: '2' }]);

      component.createProfile(createDto);
      tick();

      expect(profileService.createProfile).toHaveBeenCalledWith(createDto);
      expect(profileService.getAllProfiles).toHaveBeenCalled();
      expect(component.availableProfiles()).toEqual([mockProfile, { ...mockProfile, id: '2' }]);
    }));
  });

  describe('updateProfile', () => {
    it('should update a profile and reload profiles', fakeAsync(() => {
      const updateDto: UpdateProfileDto = { id: '1', profileName: 'Updated Profile' } as UpdateProfileDto;
      jest.spyOn(profileService, 'updateProfile').mockResolvedValue(undefined);
      jest.spyOn(profileService, 'getAllProfiles').mockResolvedValue(undefined);
      jest.spyOn(profileService, 'currentUserProfiles').mockReturnValue([mockProfile]); // Explicitly set for this test

      component.updateProfile(updateDto);
      tick();

      expect(profileService.updateProfile).toHaveBeenCalledWith(updateDto.id, updateDto);
      expect(profileService.getAllProfiles).toHaveBeenCalled();
      expect(component.availableProfiles()).toEqual([mockProfile]);
    }));
  });
});
