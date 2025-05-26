import { Component, EventEmitter, Input, Output, signal, TemplateRef, ViewChild, OnInit, HostListener, ElementRef, AfterViewInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, GridComponent, TileComponent, ThemeColors } from '@optimistic-tanuki/common-ui'; // Added ThemeColors import
import { ImageUploadComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { CreateProfileDto, UpdateProfileDto, ProfileDto } from '@optimistic-tanuki/ui-models';
import { ThemeService } from '@optimistic-tanuki/theme-ui';
import { ProfilePhotoComponent } from './profile-photo/profile-photo.component';

// Define an approximate width for each tile (including its padding/margin)
const APPROX_TILE_WIDTH_PX = 150; // Updated to match the CSS max-width

@Component({
  selector: 'lib-profile-selector',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    TileComponent,
    GridComponent,
    TextInputComponent,
    ButtonComponent,
    MatDialogModule,
    ImageUploadComponent, // Added ImageUploadComponent
    ProfilePhotoComponent,
    MatListModule, // Added MatListModule
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
  @ViewChild('profileDialog') profileDialog!: TemplateRef<unknown>; // Changed any to unknown
  internalSelectedProfile = signal<ProfileDto | null>(null);
  editingProfile: ProfileDto | null = null;
  dynamicGridColumns = signal(2); // Initialize with minimum columns

  showCreateProfile = false;
  profileForm: FormGroup;

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
    private dialog: MatDialog,
    private elRef: ElementRef,
    private cdr: ChangeDetectorRef
  ) {
    this.profileForm = this.fb.group({
      profileName: this.fb.control(''),
      // Ensure all form controls used in the template are defined here
      description: this.fb.control(''), 
      profilePic: this.fb.control(''),
      coverPic: this.fb.control(''),
      bio: this.fb.control('')
    });
  }
  ngAfterViewInit(): void {
    // Perform initial calculation after the view and its children are initialized.
    this.updateGridColumns();
    // Manually trigger change detection if needed, especially if running in dev mode
    // and to prevent ExpressionChangedAfterItHasBeenCheckedError.
    this.cdr.detectChanges();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateGridColumns();
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

  private updateGridColumns(): void {
    const hostElement = this.elRef.nativeElement as HTMLElement;
    let availableWidth = hostElement.offsetWidth;

    // Fallback if offsetWidth is 0 (e.g., element not visible yet)
    if (availableWidth === 0 && typeof window !== 'undefined') {
        availableWidth = window.innerWidth; // Or a more specific parent container width
    }
    
    // Subtract any horizontal padding of the container if not accounted for by offsetWidth
    // For example, if the grid container itself has padding.
    // const gridPadding = 0; // Example: 20px left + 20px right = 40
    // availableWidth -= gridPadding;

    if (availableWidth > 0) {
      const calculatedColumns = Math.floor(availableWidth / APPROX_TILE_WIDTH_PX);
      const columnsToSet = Math.max(2, calculatedColumns); // Ensure minimum of 2 columns
      this.dynamicGridColumns.set(columnsToSet);
    } else {
      this.dynamicGridColumns.set(2); // Default to 2 if width calculation is not possible
    }
  }

  selectProfile(profile: ProfileDto): void {
    this.internalSelectedProfile.set(profile);
    this.selectedProfile.emit(profile);
    this.dialog.closeAll();
  }

  openProfileDialog(profile?: ProfileDto): void {
    this.editingProfile = profile || null;
    if (profile) {
      this.profileForm.patchValue(profile);
    } else {
      this.profileForm.reset(); // Reset form for new profile creation
    }
    this.dialog.open(this.profileDialog, { width: '500px' });
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
      this.dialog.closeAll();
      this.profileForm.reset();
      this.editingProfile = null;
    }
  }

  cancelEdit(): void {
    this.dialog.closeAll();
    this.profileForm.reset();
    this.editingProfile = null;
  }
}
