import { inject } from '@angular/core';
import {
  MessageLevelType,
  MessageService,
} from '@optimistic-tanuki/message-ui';
import { Component, OnInit } from '@angular/core';

import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { BannerComponent } from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../profile.service';
import {
  UpdateProfileDto,
  CreateProfileDto,
  ProfileDto,
} from '@optimistic-tanuki/ui-models';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CardComponent,
    ButtonComponent,
    MatListModule,
    MatIconModule,
    BannerComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly messageService = inject(MessageService);
  profileService: ProfileService;

  constructor(readonly _profileService: ProfileService) {
    this.profileService = _profileService;
    const profile = localStorage.getItem('selectedProfile');
    if (profile) {
      this.profileService.selectProfile(JSON.parse(profile));
    }
  }

  ngOnInit(): void {
    this.profileService.getAllProfiles().then(() => {
      const profile = localStorage.getItem('selectedProfile');
      if (profile) {
        this.profileService.selectProfile(JSON.parse(profile));
      }
    });
    // Check router state for modal trigger and message (redirect to settings)
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

  showMessage(msg: string, type: MessageLevelType = 'info') {
    this.messageService.addMessage({ content: msg, type });
  }

  updateProfile(profile: UpdateProfileDto) {
    const id = profile.id;
    this.profileService.updateProfile(id, profile).then(() => {
      this.profileService.getProfileById(id);
      this.showMessage('Profile updated and selected!', 'success');
      setTimeout(() => {
        window.location.href = '/feed';
      }, 500);
    });
  }
  selectProfile(profile: ProfileDto) {
    this.profileService.selectProfile(profile);
    this.showMessage('Profile selected!', 'success');
    setTimeout(() => {
      window.location.href = '/feed';
    }, 500);
  }

  createProfile(newProfile: CreateProfileDto) {
    this.profileService.createProfile(newProfile).then(() => {
      this.profileService.getAllProfiles().then(() => {
        this.showMessage('Profile created and selected!', 'success');
        setTimeout(() => {
          window.location.href = '/feed';
        }, 500);
      });
    });
  }

  goToSettings() {
    window.location.href = '/settings';
  }

  get profile() {
    return this.profileService.getCurrentUserProfile();
  }
}
