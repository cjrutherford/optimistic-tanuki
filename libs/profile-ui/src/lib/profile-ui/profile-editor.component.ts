import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { CardComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  ImageUploadComponent,
} from '@optimistic-tanuki/form-ui';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import {
  ProfileDto,
  CreateProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { ProfilePhotoComponent } from './profile-photo/profile-photo.component';

@Component({
  selector: 'lib-profile-editor',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ModalComponent,
    TextInputComponent,
    ImageUploadComponent,
    ButtonComponent,
    CardComponent,
    ProfilePhotoComponent,
  ],
  templateUrl: './profile-editor.component.html',
  styleUrls: ['./profile-editor.component.scss'],
})
export class ProfileEditorComponent implements OnChanges {
  @Input() open = false;
  @Input() profile: ProfileDto | null = null;
  @Input() defaultName = '';
  @Output() createProfile = new EventEmitter<CreateProfileDto>();
  @Output() updateProfile = new EventEmitter<UpdateProfileDto>();
  @Output() closeEditor = new EventEmitter<void>();

  profileForm!: FormGroup;

  constructor(private fb: FormBuilder) {
    this.profileForm = this.fb.group({
      profileName: this.fb.control('', Validators.required),
      description: this.fb.control(''),
      profilePic: this.fb.control(''),
      coverPic: this.fb.control(''),
      bio: this.fb.control(''),
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['open'] && this.open) {
      this.loadProfileIntoForm();
    }
    if (changes['profile'] && this.open) {
      this.loadProfileIntoForm();
    }
  }

  private loadProfileIntoForm() {
    if (this.profile) {
      this.profileForm.patchValue({
        profileName: this.profile.profileName || '',
        description: (this.profile as any).description || '',
        profilePic: this.profile.profilePic || '',
        coverPic: this.profile.coverPic || '',
        bio: (this.profile as any).bio || '',
      });
    } else {
      // If no profile provided, prefill the profileName with a default (e.g. user's name) if available
      this.profileForm.reset();
      if (this.defaultName && this.defaultName.length) {
        this.profileForm.get('profileName')?.setValue(this.defaultName);
      }
    }
  }

  onProfilePicUpload(base64: string) {
    this.profileForm.get('profilePic')?.setValue(base64);
  }

  onCoverPicUpload(base64: string) {
    this.profileForm.get('coverPic')?.setValue(base64);
  }

  save() {
    if (this.profileForm.valid) {
      const v = this.profileForm.value;
      if (this.profile) {
        const payload: UpdateProfileDto = {
          id: this.profile.id,
          name: v.profileName,
          description: v.description,
          profilePic: v.profilePic,
          coverPic: v.coverPic,
          bio: v.bio,
        } as any;
        this.updateProfile.emit(payload);
      } else {
        const payload: CreateProfileDto = {
          name: v.profileName,
          description: v.description,
          profilePic: v.profilePic,
          coverPic: v.coverPic,
          bio: v.bio,
          userId: '',
          location: '',
          occupation: '',
          interests: '',
          skills: '',
        } as any;
        this.createProfile.emit(payload);
      }
      this.close();
    }
  }

  close() {
    this.closeEditor.emit();
  }
}
