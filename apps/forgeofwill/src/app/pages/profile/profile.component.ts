import { inject } from '@angular/core';
import { MessageLevelType, MessageService, MessageType } from '@optimistic-tanuki/message-ui';
import { BannerComponent, ProfilePhotoComponent, ProfileSelectorComponent } from '@optimistic-tanuki/profile-ui';
import { Component, signal } from '@angular/core';
import { CreateProfileDto, ProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models';


import { ProfileService } from '../../profile/profile.service';

@Component({
  selector: 'app-profile',
  imports: [ProfileSelectorComponent, ProfilePhotoComponent, BannerComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  private readonly messageService = inject(MessageService);
  availableProfiles = signal<ProfileDto[]>([]);
  selectedProfile = signal<ProfileDto | null>(null);
  constructor(private readonly profileService: ProfileService) {}

  ngOnInit() {
    this.loadProfiles();
    // Check router state for modal trigger and message
    const nav = window?.history?.state;
    if (nav?.showProfileModal) {
      setTimeout(() => {
        this.openProfileModalFromSelector();
        if (nav.profileMessage) {
          this.showMessage(nav.profileMessage, 'warning');
        }
      }, 100);
    }
  }
  // Helper to trigger modal in selector
  openProfileModalFromSelector() {
    const selector = document.querySelector('lib-profile-selector') as unknown;
    if (selector && (selector as { openProfileDialog?: () => void }).openProfileDialog) {
      (selector as { openProfileDialog?: () => void }).openProfileDialog?.();
    }
  }

  showMessage(msg: string, type: MessageLevelType = 'info') {
    // Use message service if available, fallback to alert
    this.messageService.addMessage({ content: msg, type });
  }

  private loadProfiles() {
    this.profileService.getAllProfiles().then(() => {
      const profiles = this.profileService.currentUserProfiles();
      this.availableProfiles.set(profiles);
      if (profiles.length) {
        this.selectedProfile.set(profiles[0]);
      }
    });
  }

  selectProfile(profile: ProfileDto) {
    this.selectedProfile.set(profile);
    this.profileService.selectProfile(profile);
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
    this.profileService.updateProfile(updatedProfile.id, updatedProfile).then(() => {
      this.loadProfiles();
    });
  }
}