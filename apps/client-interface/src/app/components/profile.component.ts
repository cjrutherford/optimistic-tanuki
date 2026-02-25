import { inject, PLATFORM_ID } from '@angular/core';
import {
  MessageLevelType,
  MessageService,
} from '@optimistic-tanuki/message-ui';
import { Component, OnInit } from '@angular/core';
import {
  BannerComponent,
  ProfileEditorComponent,
} from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../profile.service';
import {
  UpdateProfileDto,
  CreateProfileDto,
  ProfileDto,
} from '@optimistic-tanuki/ui-models';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CardComponent,
    ButtonComponent,
    BannerComponent,
    ProfileEditorComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly messageService = inject(MessageService);
  private readonly profileService = inject(ProfileService);
  showProfileEditor = false;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      if (isPlatformBrowser(this.platformId)) {
        const profile = localStorage.getItem('selectedProfile');
        if (profile) {
          this.profileService.selectProfile(JSON.parse(profile));
        }
      }
    }
  }

  ngOnInit(): void {
    this.profileService.getAllProfiles().then(() => {
      if (isPlatformBrowser(this.platformId)) {
        const profile = localStorage.getItem('selectedProfile');
        if (profile) {
          this.profileService.selectProfile(JSON.parse(profile));
        }
      }
    });
    // Check router state for modal trigger and message (redirect to settings)
    if (isPlatformBrowser(this.platformId)) {
      const nav = window?.history?.state;
      if (nav?.showProfileModal) {
        // navigate to settings where profile editor lives
        setTimeout(() => {
          window.location.href = '/settings';
          if (nav.profileMessage) {
            this.showMessage(nav.profileMessage, 'warning');
          }
        }, 100);
      }
    }
  }

  showMessage(msg: string, type: MessageLevelType = 'info') {
    this.messageService.addMessage({ content: msg, type });
  }

  onBannerClick() {
    this.showProfileEditor = true;
  }

  onProfileEditorClose() {
    this.showProfileEditor = false;
  }

  updateProfile(profile: UpdateProfileDto) {
    const id = profile.id;
    this.profileService
      .updateProfile(id, { ...profile, bio: profile.bio ? profile.bio : '' })
      .then(() => {
        this.profileService.getProfileById(id);
        this.showMessage('Profile updated and selected!', 'success');
        this.showProfileEditor = false;
      });
  }

  selectProfile(profile: ProfileDto) {
    this.profileService.selectProfile(profile);
    this.showMessage('Profile selected!', 'success');
    setTimeout(() => {
      if (isPlatformBrowser(this.platformId)) {
        window.location.href = '/feed';
      }
    }, 500);
  }

  createProfile(newProfile: CreateProfileDto) {
    this.profileService.createProfile(newProfile).then(() => {
      this.profileService.getAllProfiles().then(() => {
        this.showMessage('Profile created and selected!', 'success');
        this.showProfileEditor = false;
      });
    });
  }

  goToSettings() {
    if (isPlatformBrowser(this.platformId)) {
      window.location.href = '/settings';
    }
  }

  get profile() {
    return this.profileService.getCurrentUserProfile();
  }
}
