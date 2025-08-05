import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { ButtonComponent, CardComponent, ModalComponent, ThemeColors, TileComponent } from '@optimistic-tanuki/common-ui'; // Removed GridComponent
import { CreateProfileDto, ProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ImageUploadComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';

import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { ProfilePhotoComponent } from './profile-photo/profile-photo.component';
import { ThemeService } from '@optimistic-tanuki/theme-ui';

@Component({
  selector: 'lib-profile-selector',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    TileComponent,
    TextInputComponent,
    ButtonComponent,
    ModalComponent, 
    ImageUploadComponent,
    ProfilePhotoComponent,
    MatListModule,
  ],
  templateUrl: './profile-selector.component.html',
  styleUrl: './profile-selector.component.scss',
})
export class ProfileSelectorComponent implements OnInit, AfterViewInit {
  @Input() profiles: ProfileDto[] = [];
  @Input() currentSelectedProfile: ProfileDto | null = null;
  @Output() selectedProfile: EventEmitter<ProfileDto> = new EventEmitter<ProfileDto>();
  @Output() profileCreated: EventEmitter<CreateProfileDto> = new EventEmitter<CreateProfileDto>();
  @Output() profileUpdated: EventEmitter<UpdateProfileDto> = new EventEmitter<UpdateProfileDto>();
  
  internalSelectedProfile = signal<ProfileDto | null>(null);
  editingProfile: ProfileDto | null = null;

  showCreateProfile = false;
  profileForm: FormGroup;
  showProfileModal = false; // Control for the new modal component

  // Injected ThemeService if needed for direct theme manipulation, otherwise remove if not used.
  private themeService = inject(ThemeService); 

  // Theme properties that might be needed for direct styling if not using host bindings from a base class
  background?: string;
  foreground?: string;
  accent?: string;
  complement?: string;
  borderColor?: string;
  borderGradient?: string;
  transitionDuration?: string = '0.3s'; // Default transition duration

  constructor(
    private fb: FormBuilder,
    private elRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {
    this.profileForm = this.fb.group({
      profileName: this.fb.control('', Validators.required),
      // Ensure all form controls used in the template are defined here
      description: this.fb.control(''), 
      profilePic: this.fb.control(''),
      coverPic: this.fb.control(''),
      bio: this.fb.control('')
    });
  }
  ngAfterViewInit(): void {
    // Manually trigger change detection if needed, especially if running in dev mode
    // and to prevent ExpressionChangedAfterItHasBeenCheckedError.
    this.cdr.detectChanges();
  }

  ngOnInit(): void {
    if (this.currentSelectedProfile) {
      this.internalSelectedProfile.set(this.currentSelectedProfile);
    }
    // Subscribe to theme changes if direct styling is needed
    this.themeService.themeColors$.subscribe((colors: ThemeColors | undefined) => {
      if (colors) {
        this.background = colors.background;
        this.foreground = colors.foreground;
        this.accent = colors.accent;
        // Potentially map other colors if needed for the component's template or direct style bindings
      }
    });
  }

  selectProfile(profile: ProfileDto): void {
    this.internalSelectedProfile.set(profile);
    this.selectedProfile.emit(profile);
    this.showProfileModal = false; // Close the modal
  }

  openProfileDialog(profile?: ProfileDto): void {
    this.editingProfile = profile || null;
    if (profile) {
      this.profileForm.patchValue(profile);
    } else {
      this.profileForm.reset(); // Reset form for new profile creation
    }
    this.showProfileModal = true; // Open the modal
  }

  onProfilePicUpload(base64Image: string): void {
    this.profileForm.get('profilePic')?.setValue(base64Image);
  }

  onCoverPicUpload(base64Image: string): void {
    this.profileForm.get('coverPic')?.setValue(base64Image);
  }

  saveProfile(): void {
    if (this.profileForm.valid) {
      const formValue = this.profileForm.value;
      if (this.editingProfile) {
        // Update existing profile
        const payload: UpdateProfileDto = {
          id: this.editingProfile.id,
          name: formValue.profileName, // Ensure this matches formControlName
          description: formValue.description,
          profilePic: formValue.profilePic,
          coverPic: formValue.coverPic,
          bio: formValue.bio,
        };
        this.profileUpdated.emit(payload);
      } else {
        // Create new profile
        const newProfile: CreateProfileDto = {
          name: formValue.profileName, // Ensure this matches formControlName
          description: formValue.description,
          profilePic: formValue.profilePic,
          coverPic: formValue.coverPic,
          bio: formValue.bio,
          userId: '',
          location: '',
          occupation: '',
          interests: '',
          skills: ''
        };
        this.profileCreated.emit(newProfile);
      }
      this.showProfileModal = false; // Close the modal
      this.profileForm.reset();
      this.editingProfile = null;
    }
  }

  cancelEdit(): void {
    this.showProfileModal = false; // Close the modal
    this.profileForm.reset();
    this.editingProfile = null;
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.profileForm.reset();
    this.editingProfile = null;
  }
}
