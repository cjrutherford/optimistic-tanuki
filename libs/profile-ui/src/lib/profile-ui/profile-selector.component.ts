import { CommonModule } from "@angular/common";
import { Component, OnInit, AfterViewInit, Input, Output, EventEmitter, signal, inject, ElementRef, ChangeDetectorRef } from "@angular/core";
import { ReactiveFormsModule, FormGroup, FormBuilder, Validators } from "@angular/forms";
import { CardComponent, TileComponent, ButtonComponent, ModalComponent } from "@optimistic-tanuki/common-ui";
import { ThemeService, ThemeColors } from "@optimistic-tanuki/theme-ui";
import { ProfilePhotoComponent } from "./profile-photo/profile-photo.component";
import { TextInputComponent, ImageUploadComponent } from '@optimistic-tanuki/form-ui'
import { ProfileDto, CreateProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models'

/**
 * Component for selecting and managing user profiles.
 */
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
  ],
  templateUrl: './profile-selector.component.html',
  styleUrl: './profile-selector.component.scss',
})
export class ProfileSelectorComponent implements OnInit, AfterViewInit {
  /**
   * Input property for the list of available profiles.
   */
  @Input() profiles: ProfileDto[] = [];
  /**
   * Input property for the currently selected profile.
   */
  @Input() currentSelectedProfile: ProfileDto | null = null;
  /**
   * Emits the selected profile.
   */
  @Output() selectedProfile: EventEmitter<ProfileDto> = new EventEmitter<ProfileDto>();
  /**
   * Emits when a new profile is created.
   */
  @Output() profileCreated: EventEmitter<CreateProfileDto> = new EventEmitter<CreateProfileDto>();
  /**
   * Emits when a profile is updated.
   */
  @Output() profileUpdated: EventEmitter<UpdateProfileDto> = new EventEmitter<UpdateProfileDto>();
  
  /**
   * Internal signal for the selected profile.
   */
  internalSelectedProfile = signal<ProfileDto | null>(null);
  /**
   * The profile currently being edited.
   */
  editingProfile: ProfileDto | null = null;

  /**
   * Controls the visibility of the create profile form.
   */
  showCreateProfile = false;
  /**
   * The form group for profile creation/editing.
   */
  profileForm: FormGroup;
  /**
   * Controls the visibility of the profile modal.
   */
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

  /**
   * Creates an instance of ProfileSelectorComponent.
   * @param fb The FormBuilder instance.
   * @param elRef The ElementRef instance.
   * @param cdr The ChangeDetectorRef instance.
   */
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
  /**
   * Lifecycle hook that is called after a component's view, and its children's views, are initialized.
   */
  ngAfterViewInit(): void {
    // Manually trigger change detection if needed, especially if running in dev mode
    // and to prevent ExpressionChangedAfterItHasBeenCheckedError.
    this.cdr.detectChanges();
  }

  /**
   * Lifecycle hook that is called after data-bound properties of a directive are initialized.
   */
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

  /**
   * Selects a profile and emits the selected profile.
   * @param profile The profile to select.
   */
  selectProfile(profile: ProfileDto): void {
    this.internalSelectedProfile.set(profile);
    this.selectedProfile.emit(profile);
    this.showProfileModal = false; // Close the modal
  }

  /**
   * Opens the profile dialog for creating or editing a profile.
   * @param profile Optional profile data to pre-fill the form.
   */
  openProfileDialog(profile?: ProfileDto): void {
    this.editingProfile = profile || null;
    if (profile) {
      this.profileForm.patchValue(profile);
    } else {
      this.profileForm.reset(); // Reset form for new profile creation
    }
    this.showProfileModal = true; // Open the modal
  }

  /**
   * Handles the upload of a profile picture.
   * @param base64Image The base64 encoded string of the uploaded image.
   */
  onProfilePicUpload(base64Image: string): void {
    this.profileForm.get('profilePic')?.setValue(base64Image);
  }

  /**
   * Handles the upload of a cover picture.
   * @param base64Image The base64 encoded string of the uploaded image.
   */
  onCoverPicUpload(base64Image: string): void {
    this.profileForm.get('coverPic')?.setValue(base64Image);
  }

  /**
   * Saves the profile, either creating a new one or updating an existing one.
   */
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

  /**
   * Cancels the profile editing/creation process.
   */
  cancelEdit(): void {
    this.showProfileModal = false; // Close the modal
    this.profileForm.reset();
    this.editingProfile = null;
  }

  /**
   * Closes the profile modal.
   */
  closeProfileModal(): void {
    this.showProfileModal = false;
    this.profileForm.reset();
    this.editingProfile = null;
  }
}
