import {
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileEditorComponent } from '@optimistic-tanuki/profile-ui';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import {
  CreateProfileDto,
  ProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-profile-dialog',
  standalone: true,
  imports: [CommonModule, ProfileEditorComponent, ModalComponent],
  template: `
    <lib-modal [open]="open" (close)="onClose()">
      <lib-profile-editor
        [open]="open"
        [profile]="currentProfile()"
        [defaultName]="defaultName"
        (createProfile)="onCreateProfile($event)"
        (updateProfile)="onUpdateProfile($event)"
        (closeEditor)="onClose()"
      >
      </lib-profile-editor>
    </lib-modal>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ProfileDialogComponent {
  @Input() open = false;
  @Input() profile: ProfileDto | null = null;
  @Input() defaultName = '';
  @Output() close = new EventEmitter<void>();

  private profileService = inject(ProfileService);

  currentProfile = signal<ProfileDto | null>(null);

  ngOnChanges(): void {
    this.currentProfile.set(this.profile);
  }

  onClose(): void {
    this.close.emit();
  }

  async onCreateProfile(dto: CreateProfileDto): Promise<void> {
    try {
      await this.profileService.createProfile(dto);
      this.onClose();
    } catch (error) {
      console.error('Failed to create profile:', error);
    }
  }

  async onUpdateProfile(dto: UpdateProfileDto): Promise<void> {
    if (!this.currentProfile()) return;
    try {
      await this.profileService.updateProfile(this.currentProfile()!.id, dto);
      this.onClose();
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  }
}
