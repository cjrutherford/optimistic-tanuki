import { inject } from '@angular/core';
import {
  MessageService,
  MessageLevelType,
} from '@optimistic-tanuki/message-ui';
import {
  BannerComponent,
  CharacterSheetComponent,
  type CharacterSheetSkin,
  ProfilePhotoComponent,
} from '@optimistic-tanuki/profile-ui';
import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CreateProfileDto,
  ProfileTelosDto,
  ProfileDto,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';

import { ProfileService } from '../../profile/profile.service';

@Component({
  selector: 'app-profile',
  imports: [
    CommonModule,
    ProfilePhotoComponent,
    BannerComponent,
    CharacterSheetComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly messageService = inject(MessageService);
  availableProfiles = signal<ProfileDto[]>([]);
  selectedProfile = signal<ProfileDto | null>(null);
  profileTelos = signal<ProfileTelosDto | null>(null);
  characterSheetEnabled = signal(false);
  characterSheetSkin = signal<CharacterSheetSkin>('fantasy');
  constructor(private readonly profileService: ProfileService) {}

  async ngOnInit() {
    await Promise.all([this.loadProfiles(), this.loadCharacterSheetFlag()]);
    // Check router state for modal trigger and message
    const nav = window?.history?.state;
    if (nav?.showProfileModal) {
      setTimeout(() => {
        window.location.href = '/settings';
        if (nav.profileMessage) {
          this.showMessage(nav.profileMessage, 'warning');
        }
      }, 100);
    }
  }
  goToSettings() {
    window.location.href = '/settings';
  }

  showMessage(msg: string, type: MessageLevelType = 'info') {
    // Use message service if available, fallback to alert
    this.messageService.addMessage({ content: msg, type });
  }

  private async loadProfiles() {
    await this.profileService.getAllProfiles();
    const profiles = this.profileService.currentUserProfiles();
    this.availableProfiles.set(profiles);
    if (profiles.length) {
      const selectedProfile =
        this.profileService.getEffectiveProfile() ||
        this.profileService.getCurrentUserProfile() ||
        profiles[0];
      this.selectedProfile.set(selectedProfile);
      await this.loadProfileTelos(selectedProfile.id);
    }
  }

  private async loadCharacterSheetFlag() {
    const { enabled, skin } =
      await this.profileService.loadCharacterSheetConfig();
    this.characterSheetEnabled.set(enabled);
    this.characterSheetSkin.set(skin);
  }

  private async loadProfileTelos(profileId: string) {
    const telos = await this.profileService.getProfileTelos(profileId);
    this.profileTelos.set(telos);
  }

  selectProfile(profile: ProfileDto) {
    this.selectedProfile.set(profile);
    this.profileService.selectProfile(profile);
    void this.loadProfileTelos(profile.id);
    this.showMessage('Profile selected!', 'success');
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  }

  createProfile(newProfile: CreateProfileDto) {
    this.profileService.createProfile(newProfile).then(() => {
      this.loadProfiles();
      this.showMessage('Profile created and selected!', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    });
  }

  updateProfile(updatedProfile: UpdateProfileDto) {
    this.profileService
      .updateProfile(updatedProfile.id, updatedProfile)
      .then(() => {
        this.loadProfiles();
      });
  }
}
