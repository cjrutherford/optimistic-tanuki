import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileEditorComponent } from './profile-editor.component';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { ProfileDto, CreateProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models';
import { SimpleChange, EventEmitter } from '@angular/core';
import { NO_ERRORS_SCHEMA } from '@angular/core';

describe('ProfileEditorComponent', () => {
  let component: ProfileEditorComponent;
  let fixture: ComponentFixture<ProfileEditorComponent>;

  const mockProfileDto: ProfileDto = {
    id: 'profile-123',
    userId: 'user-123',
    profileName: 'Test User',
    profilePic: 'data:image/png;base64,test',
    coverPic: 'data:image/png;base64,cover',
    bio: 'Test bio',
    location: 'Test location',
    occupation: 'Test occupation',
    interests: 'Test interests',
    skills: 'Test skills',
    created_at: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileEditorComponent, ReactiveFormsModule],
      providers: [FormBuilder],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileEditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Form Initialization', () => {
    it('should create profile form with all fields', () => {
      expect(component.profileForm).toBeDefined();
      expect(component.profileForm.get('profileName')).toBeDefined();
      expect(component.profileForm.get('description')).toBeDefined();
      expect(component.profileForm.get('profilePic')).toBeDefined();
      expect(component.profileForm.get('coverPic')).toBeDefined();
      expect(component.profileForm.get('bio')).toBeDefined();
    });

    it('should require profileName', () => {
      const profileNameControl = component.profileForm.get('profileName');
      expect(profileNameControl?.hasError('required')).toBe(true);
      
      profileNameControl?.setValue('Test Name');
      expect(profileNameControl?.hasError('required')).toBe(false);
    });

    it('should not require other fields', () => {
      const descriptionControl = component.profileForm.get('description');
      const bioControl = component.profileForm.get('bio');
      
      expect(descriptionControl?.hasError('required')).toBe(false);
      expect(bioControl?.hasError('required')).toBe(false);
    });
  });

  describe('ngOnChanges', () => {
    it('should load profile into form when open changes to true', () => {
      component.profile = mockProfileDto;
      // NgOnChanges checks this.open, so we need to set it to the new value
      component.open = true;
      
      component.ngOnChanges({
        open: new SimpleChange(false, true, false),
      });

      expect(component.profileForm.get('profileName')?.value).toBe('Test User');
      expect(component.profileForm.get('profilePic')?.value).toBe('data:image/png;base64,test');
    });

    it('should load profile into form when profile changes and editor is open', () => {
      component.open = true;
      component.profile = mockProfileDto;
      
      component.ngOnChanges({
        profile: new SimpleChange(null, mockProfileDto, false),
      });

      expect(component.profileForm.get('profileName')?.value).toBe('Test User');
    });

    it('should reset form when no profile is provided', () => {
      // First set some values
      component.profileForm.patchValue({
        profileName: 'Old Name',
        bio: 'Old bio',
      });
      
      component.profile = null;
      component.defaultName = '';
      component.open = true;
      
      component.ngOnChanges({
        open: new SimpleChange(false, true, false),
      });

      // After reset, form values are null, not empty strings
      expect(component.profileForm.get('profileName')?.value).toBeNull();
    });

    it('should use defaultName when creating new profile', () => {
      component.profile = null;
      component.defaultName = 'John Doe';
      component.open = true;
      
      component.ngOnChanges({
        open: new SimpleChange(false, true, false),
      });

      expect(component.profileForm.get('profileName')?.value).toBe('John Doe');
    });
  });

  describe('Image Upload Handlers', () => {
    it('should set profile pic when onProfilePicUpload is called', () => {
      const base64Image = 'data:image/png;base64,newimage';
      component.onProfilePicUpload(base64Image);

      expect(component.profileForm.get('profilePic')?.value).toBe(base64Image);
    });

    it('should set cover pic when onCoverPicUpload is called', () => {
      const base64Image = 'data:image/png;base64,newcover';
      component.onCoverPicUpload(base64Image);

      expect(component.profileForm.get('coverPic')?.value).toBe(base64Image);
    });
  });

  describe('save', () => {
    it('should emit createProfile event when creating new profile', () => {
      jest.spyOn(component.createProfile, 'emit');
      jest.spyOn(component, 'close');

      component.profile = null;
      component.profileForm.patchValue({
        profileName: 'New User',
        description: 'Test description',
        bio: 'Test bio',
        profilePic: 'data:image/png;base64,pic',
        coverPic: 'data:image/png;base64,cover',
      });

      component.save();

      expect(component.createProfile.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New User',
          description: 'Test description',
          bio: 'Test bio',
          profilePic: 'data:image/png;base64,pic',
          coverPic: 'data:image/png;base64,cover',
        })
      );
      expect(component.close).toHaveBeenCalled();
    });

    it('should emit updateProfile event when updating existing profile', () => {
      jest.spyOn(component.updateProfile, 'emit');
      jest.spyOn(component, 'close');

      component.profile = mockProfileDto;
      component.profileForm.patchValue({
        profileName: 'Updated User',
        description: 'Updated description',
        bio: 'Updated bio',
        profilePic: 'data:image/png;base64,newpic',
        coverPic: 'data:image/png;base64,newcover',
      });

      component.save();

      expect(component.updateProfile.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'profile-123',
          name: 'Updated User',
          description: 'Updated description',
          bio: 'Updated bio',
          profilePic: 'data:image/png;base64,newpic',
          coverPic: 'data:image/png;base64,newcover',
        })
      );
      expect(component.close).toHaveBeenCalled();
    });

    it('should not emit events when form is invalid', () => {
      jest.spyOn(component.createProfile, 'emit');
      jest.spyOn(component.updateProfile, 'emit');

      component.profile = null;
      component.profileForm.patchValue({
        profileName: '', // Invalid - required field is empty
        description: 'Test',
      });

      component.save();

      expect(component.createProfile.emit).not.toHaveBeenCalled();
      expect(component.updateProfile.emit).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should emit closeEditor event', () => {
      jest.spyOn(component.closeEditor, 'emit');

      component.close();

      expect(component.closeEditor.emit).toHaveBeenCalled();
    });
  });

  describe('Input/Output bindings', () => {
    it('should have open input with default value false', () => {
      expect(component.open).toBe(false);
    });

    it('should have profile input with default value null', () => {
      expect(component.profile).toBeNull();
    });

    it('should have defaultName input with default empty string', () => {
      expect(component.defaultName).toBe('');
    });

    it('should have createProfile event emitter', () => {
      expect(component.createProfile).toBeDefined();
      expect(component.createProfile).toBeInstanceOf(EventEmitter);
    });

    it('should have updateProfile event emitter', () => {
      expect(component.updateProfile).toBeDefined();
      expect(component.updateProfile).toBeInstanceOf(EventEmitter);
    });

    it('should have closeEditor event emitter', () => {
      expect(component.closeEditor).toBeDefined();
      expect(component.closeEditor).toBeInstanceOf(EventEmitter);
    });
  });

  describe('Form validation', () => {
    it('should be invalid when profileName is empty', () => {
      component.profileForm.patchValue({
        profileName: '',
      });

      expect(component.profileForm.valid).toBe(false);
    });

    it('should be valid when profileName is provided', () => {
      component.profileForm.patchValue({
        profileName: 'Valid Name',
      });

      expect(component.profileForm.valid).toBe(true);
    });

    it('should be valid with only profileName filled', () => {
      component.profileForm.patchValue({
        profileName: 'Only Name',
        description: '',
        bio: '',
        profilePic: '',
        coverPic: '',
      });

      expect(component.profileForm.valid).toBe(true);
    });
  });
});
