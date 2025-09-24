import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateProfileDto, ProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { ThemeColors, ThemeService } from '@optimistic-tanuki/theme-lib';

import { ProfileSelectorComponent } from './profile-selector.component';
import { of } from 'rxjs';

describe('ProfileSelectorComponent', () => {
  let component: ProfileSelectorComponent;
  let fixture: ComponentFixture<ProfileSelectorComponent>;
  
  let mockThemeService: Partial<ThemeService>;
  
  let mockChangeDetectorRef: Partial<ChangeDetectorRef>;

  beforeEach(async () => {
    

    mockThemeService = {
      themeColors$: of({
        background: '#000',
        foreground: '#fff',
        accent: '#f00',
        complementary: '#0f0',
        accentShades: [['0', '#f00']],
        complementaryShades: [['0', '#0f0']],
        accentGradients: { dark: 'dark-gradient', light: 'light-gradient' },
        complementaryGradients: { dark: 'dark-comp-gradient', light: 'light-comp-gradient' },
        tertiary: '#0000ff',
        tertiaryShades: [['0', '#0000ff']],
        tertiaryGradients: { dark: 'dark-tertiary-gradient', light: 'light-tertiary-gradient' },
        success: '#00ff00',
        successShades: [['0', '#00ff00']],
        successGradients: { dark: 'dark-success-gradient', light: 'light-success-gradient' },
        danger: '#ff0000',
        dangerShades: [['0', '#ff0000']],
        dangerGradients: { dark: 'dark-danger-gradient', light: 'light-danger-gradient' },
        warning: '#ffff00',
        warningShades: [['0', '#ffff00']],
        warningGradients: { dark: 'dark-warning-gradient', light: 'light-warning-gradient' },
      } as ThemeColors),
    };

    
    

    mockChangeDetectorRef = {
      detectChanges: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileSelectorComponent, ReactiveFormsModule],
      providers: [
        FormBuilder,
        
        { provide: ThemeService, useValue: mockThemeService },
        
        { provide: ChangeDetectorRef, useValue: mockChangeDetectorRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set internalSelectedProfile on ngOnInit if currentSelectedProfile is provided', () => {
    const mockProfile: ProfileDto = { id: '1', profileName: 'Test Profile', profilePic: '', coverPic: '', bio: '', userId: '', location: '', occupation: '', interests: '', skills: '', created_at: new Date() };
    component.currentSelectedProfile = mockProfile;
    component.ngOnInit();
    expect(component.internalSelectedProfile()).toEqual(mockProfile);
  });

  it('should subscribe to theme changes on ngOnInit', () => {
    const mockColors: ThemeColors = {
      background: '#111',
      foreground: '#222',
      accent: '#333',
      complementary: '#444',
      accentShades: [['0', '#111']],
      complementaryShades: [['0', '#222']],
      accentGradients: { dark: 'dark-gradient', light: 'light-gradient' },
      complementaryGradients: { dark: 'dark-comp-gradient', light: 'light-comp-gradient' },
      success: '#00ff00',
      successShades: [['0', '#00ff00']],
      successGradients: { dark: 'dark-success-gradient', light: 'light-success-gradient' },
      danger: '#ff0000',
      dangerShades: [['0', '#ff0000']],
      dangerGradients: { dark: 'dark-danger-gradient', light: 'light-danger-gradient' },
      warning: '#ffff00',
      warningShades: [['0', '#ffff00']],
      warningGradients: { dark: 'dark-warning-gradient', light: 'light-warning-gradient' },
      tertiary: '',
      tertiaryShades: [],
      tertiaryGradients: { dark: '', light: '' }
    };
    (mockThemeService.themeColors$ as any) = of(mockColors);
    component.ngOnInit();
    expect(component.background).toBe(mockColors.background);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
  });

  

  

  it('should select profile, emit event, and close dialog', () => {
    const mockProfile: ProfileDto = { id: '1', profileName: 'Test Profile', profilePic: '', coverPic: '', bio: '', userId: '', location: '', occupation: '', interests: '', skills: '', created_at: new Date() };
    const emitSpy = jest.spyOn(component.selectedProfile, 'emit');
    component.selectProfile(mockProfile);
    expect(component.internalSelectedProfile()).toEqual(mockProfile);
    expect(emitSpy).toHaveBeenCalledWith(mockProfile);
    expect(component.showProfileModal).toBe(false);
  });

  it('should open profile dialog for new profile', () => {
    component.openProfileDialog();
    expect(component.editingProfile).toBeNull();
    expect(component.profileForm.value).toEqual({
      profileName: null,
      description: null,
      profilePic: null,
      coverPic: null,
      bio: null,
    });
    expect(component.showProfileModal).toBe(true);
  });

  it('should open profile dialog for editing existing profile', () => {
    const mockProfile: ProfileDto = { id: '1', profileName: 'Edit Profile', profilePic: 'edit.png', coverPic: 'edit_cover.png', bio: 'Edit Bio', userId: '', location: '', occupation: '', interests: '', skills: '', created_at: new Date() };
    component.openProfileDialog(mockProfile);
    expect(component.editingProfile).toEqual(mockProfile);
    expect(component.profileForm.value).toEqual({
      profileName: 'Edit Profile',
      description: '', // Description is not part of the mockProfile, so it should be null
      profilePic: 'edit.png',
      coverPic: 'edit_cover.png',
      bio: 'Edit Bio',
    });
    expect(component.showProfileModal).toBe(true);
  });

  it('should update profilePic on onProfilePicUpload', () => {
    const base64 = 'data:image/png;base64,test';
    component.onProfilePicUpload(base64);
    expect(component.profileForm.get('profilePic')?.value).toBe(base64);
  });

  it('should update coverPic on onCoverPicUpload', () => {
    const base64 = 'data:image/png;base64,test';
    component.onCoverPicUpload(base64);
    expect(component.profileForm.get('coverPic')?.value).toBe(base64);
  });

  describe('saveProfile', () => {
    it('should emit profileCreated for new profile', () => {
      const emitSpy = jest.spyOn(component.profileCreated, 'emit');
      component.profileForm.patchValue({
        profileName: 'New Profile',
        description: 'New Desc',
        profilePic: 'new.png',
        coverPic: 'new_cover.png',
        bio: 'New Bio',
      });
      component.editingProfile = null;
      component.saveProfile();
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Profile',
        description: 'New Desc',
        profilePic: 'new.png',
        coverPic: 'new_cover.png',
        bio: 'New Bio',
        userId: '',
        location: '',
        occupation: '',
        interests: '',
        skills: ''
      }));
      expect(component.showProfileModal).toBe(false);
      expect(component.profileForm.pristine).toBe(true);
      expect(component.editingProfile).toBeNull();
    });

    it('should emit profileUpdated for existing profile', () => {
      const emitSpy = jest.spyOn(component.profileUpdated, 'emit');
      const existingProfile: ProfileDto = { id: '1', profileName: 'Old Name', profilePic: 'old.png', coverPic: 'old_cover.png', bio: 'Old Bio', userId: '', location: '', occupation: '', interests: '', skills: '', created_at: new Date() };
      component.editingProfile = existingProfile;
      component.profileForm.patchValue({
        profileName: 'Updated Name',
        description: 'Updated Desc',
        profilePic: 'updated.png',
        coverPic: 'updated_cover.png',
        bio: 'Updated Bio',
      });
      component.saveProfile();
      expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: '1',
        name: 'Updated Name',
        description: 'Updated Desc',
        profilePic: 'updated.png',
        coverPic: 'updated_cover.png',
        bio: 'Updated Bio',
      }));
      expect(component.showProfileModal).toBe(false);
      expect(component.profileForm.pristine).toBe(true);
      expect(component.editingProfile).toBeNull();
    });

    it('should not save if form is invalid', () => {
      const createSpy = jest.spyOn(component.profileCreated, 'emit');
      const updateSpy = jest.spyOn(component.profileUpdated, 'emit');
      component.profileForm.get('profileName')?.setValue(''); // Make form invalid
      expect(component.profileForm.valid).toBe(false);
      component.saveProfile();
      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
      expect(component.showProfileModal).not.toBe(true);
    });
  });

  it('should cancel edit, close dialog, and reset form', () => {
    component.editingProfile = { id: '1', profileName: 'Test', profilePic: '', coverPic: '', bio: '', userId: '', location: '', occupation: '', interests: '', skills: '', created_at: new Date() };
    component.profileForm.patchValue({ profileName: 'Some Value' });
    component.cancelEdit();
    expect(component.showProfileModal).toBe(false);
    expect(component.profileForm.pristine).toBe(true);
    expect(component.editingProfile).toBeNull();
  });
});