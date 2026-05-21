import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CardComponent,
  ButtonComponent,
} from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  TextAreaComponent,
} from '@optimistic-tanuki/form-ui';
import { ProfileService } from '../../services/profile.service';
import { MessageService } from '../../services/message.service';
import { AuthStateService } from '../../services/auth-state.service';
import { 
  ProfileDto, 
  CreateProfileDto, 
  UpdateProfileDto 
} from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    TextInputComponent,
    TextAreaComponent,
  ],
  template: `
    <div class="profile-container">
      <h1 class="page-title">Your Profile</h1>

      <otui-card class="profile-card">
        <div class="profile-header">
          <div class="photo-section">
            <img 
              [src]="profilePhotoUrl()" 
              [alt]="displayName()"
              class="profile-avatar"
            />
            @if (isEditing()) {
            <button class="change-photo-btn" (click)="fileInput.click()">
              Change Photo
            </button>
            <input
              #fileInput
              type="file"
              accept="image/*"
              (change)="onPhotoSelected($event)"
              hidden
            />
            }
          </div>

          <div class="profile-info">
            @if (!isEditing()) {
            <h2 class="display-name">{{ displayName() }}</h2>
            <p class="bio-text">{{ bio() }}</p>
            <otui-button [variant]="'primary'" (action)="startEditing()">
              Edit Profile
            </otui-button>
            } @else {
            <lib-text-input
              [label]="'Display Name'"
              [(ngModel)]="editedName"
              name="displayName"
            >
            </lib-text-input>
            <lib-text-area
              [label]="'Bio'"
              [(ngModel)]="editedBio"
              name="bio"
              [rows]="4"
            >
            </lib-text-area>
            <div class="edit-actions">
              <otui-button [variant]="'primary'" (action)="saveProfile()">
                Save Changes
              </otui-button>
              <otui-button [variant]="'secondary'" (action)="cancelEditing()">
                Cancel
              </otui-button>
            </div>
            }
          </div>
        </div>
      </otui-card>

      <otui-card class="stats-card">
        <h2>Your Journey</h2>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">0</span>
            <span class="stat-label">Daily Fours</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">0</span>
            <span class="stat-label">Daily Sixes</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">0</span>
            <span class="stat-label">Day Streak</span>
          </div>
        </div>
      </otui-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .profile-container {
      max-width: 800px;
      margin: 0 auto;
      padding: var(--spacing-lg, 24px);
    }

    .page-title {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: var(--spacing-lg, 24px);
      color: var(--foreground, #212121);
    }

    .profile-card {
      margin-bottom: var(--spacing-lg, 24px);
    }

    .profile-header {
      display: flex;
      gap: var(--spacing-xl, 32px);
      align-items: flex-start;
    }

    @media (max-width: 600px) {
      .profile-header {
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
    }

    .photo-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--spacing-sm, 8px);
    }

    .profile-avatar {
      width: 120px;
      height: 120px;
      border-radius: 50%;
      object-fit: cover;
      border: 4px solid var(--border, #e5e7eb);
    }

    .change-photo-btn {
      background: none;
      border: none;
      color: var(--primary, #4f46e5);
      cursor: pointer;
      font-size: 0.875rem;
      text-decoration: underline;
    }

    .profile-info {
      flex: 1;
    }

    .display-name {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 var(--spacing-sm, 8px) 0;
      color: var(--foreground, #1f2937);
    }

    .bio-text {
      color: var(--muted, #6b7280);
      line-height: 1.6;
      margin-bottom: var(--spacing-md, 16px);
    }

    .edit-actions {
      display: flex;
      gap: var(--spacing-md, 16px);
      margin-top: var(--spacing-md, 16px);
    }

    .stats-card {
      h2 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: var(--spacing-lg, 24px);
        color: var(--foreground, #1f2937);
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--spacing-lg, 24px);
    }

    @media (max-width: 600px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }

    .stat-item {
      text-align: center;
      padding: var(--spacing-md, 16px);
      background: var(--surface-alt, #f9fafb);
      border-radius: var(--border-radius-md, 8px);
    }

    .stat-value {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary, #4f46e5);
    }

    .stat-label {
      display: block;
      font-size: 0.875rem;
      color: var(--muted, #6b7280);
      margin-top: var(--spacing-xs, 4px);
    }
  `],
})
export class ProfilePageComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly messageService = inject(MessageService);
  private readonly authState = inject(AuthStateService);

  displayName = signal('Anonymous');
  bio = signal('No bio yet. Tell us about yourself!');
  profilePhotoUrl = signal('https://placehold.co/120x120');
  isEditing = signal(false);

  editedName = '';
  editedBio = '';
  editedPhotoUrl = '';

  ngOnInit(): void {
    this.loadProfile();
  }

  startEditing(): void {
    const profile = this.profileService.getCurrentUserProfile();
    this.editedName = profile?.profileName || this.displayName();
    this.editedBio = profile?.bio || '';
    this.editedPhotoUrl = this.profilePhotoUrl();
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    this.isEditing.set(false);
  }

  async saveProfile(): Promise<void> {
    const profile = this.profileService.getCurrentUserProfile();
    const userId = this.authState.getDecodedTokenValue()?.userId;

    if (!userId) {
      this.messageService.error('Unable to save profile: Not authenticated');
      return;
    }

    try {
      if (profile) {
        // Update existing profile
        const updateDto: UpdateProfileDto = {
          id: profile.id,
          name: this.editedName,
          bio: this.editedBio,
          profilePic: this.editedPhotoUrl,
        };
        await this.profileService.updateProfile(profile.id, updateDto);
        this.messageService.success('Profile updated successfully!');
      } else {
        // Create new profile
        const createDto: CreateProfileDto = {
          userId,
          name: this.editedName,
          description: '',
          profilePic: this.editedPhotoUrl,
          coverPic: '',
          bio: this.editedBio,
          location: '',
          occupation: '',
          interests: '',
          skills: '',
          appScope: 'd6',
        };
        await this.profileService.createProfile(createDto);
        this.messageService.success('Profile created successfully!');
      }

      this.updateLocalState();
      this.isEditing.set(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      this.messageService.error('Failed to save profile. Please try again.');
    }
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        this.editedPhotoUrl = e.target?.result as string;
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  private async loadProfile(): Promise<void> {
    const profile = this.profileService.getCurrentUserProfile();
    
    if (profile) {
      this.updateSignalsFromProfile(profile);
    } else {
      // Try to load from API
      try {
        await this.profileService.getAllProfiles();
        const loadedProfile = this.profileService.getEffectiveProfile();
        if (loadedProfile) {
          this.updateSignalsFromProfile(loadedProfile);
          this.profileService.selectProfile(loadedProfile);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      }
    }
  }

  private updateSignalsFromProfile(profile: ProfileDto): void {
    this.displayName.set(profile.profileName || 'Anonymous');
    this.bio.set(profile.bio || 'No bio yet. Tell us about yourself!');
    this.profilePhotoUrl.set(
      profile.profilePic || 'https://placehold.co/120x120'
    );
  }

  private updateLocalState(): void {
    this.displayName.set(this.editedName);
    this.bio.set(this.editedBio);
    this.profilePhotoUrl.set(this.editedPhotoUrl);
  }
}
