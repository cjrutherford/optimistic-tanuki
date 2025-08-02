import { BannerComponent, ProfilePhotoComponent, ProfileSelectorComponent } from '@optimistic-tanuki/profile-ui';
import { Component, signal } from '@angular/core';
import { CreateProfileDto, ProfileDto, UpdateProfileDto } from '@optimistic-tanuki/ui-models';

import { CommonModule } from '@angular/common';
import { ProfileService } from '../../profile/profile.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, ProfileSelectorComponent, ProfilePhotoComponent, BannerComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  availableProfiles = signal<ProfileDto[]>([]);
  selectedProfile = signal<ProfileDto | null>(null);
  constructor(private readonly profileService: ProfileService) {}

  ngOnInit() {
    this.loadProfiles();
  }

  private loadProfiles() {
    this.profileService.getAllProfiles().then(() => {
      const profiles = this.profileService.currentUserProfiles();
      console.log('Available profiles:', profiles);
      this.availableProfiles.set(profiles);
      if (profiles.length) {
        this.selectedProfile.set(profiles[0]);
      }
    });
  }

  selectProfile(profile: ProfileDto) {
    this.selectedProfile.set(profile);
    this.profileService.selectProfile(profile);
    console.log('Selected profile:', profile);
  }

  createProfile(newProfile: CreateProfileDto) {
    this.profileService.createProfile(newProfile).then(() => {
      this.loadProfiles();
    });
  }

  updateProfile(updatedProfile: UpdateProfileDto) {
    this.profileService.updateProfile(updatedProfile.id, updatedProfile).then(() => {
      this.loadProfiles();
    });
  }
}