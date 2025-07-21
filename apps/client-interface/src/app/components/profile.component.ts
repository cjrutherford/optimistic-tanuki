import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { BannerComponent, ProfileSelectorComponent } from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../profile.service';
import { UpdateProfileDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatListModule, 
    MatIconModule, 
    BannerComponent,
    ProfileSelectorComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  profileService: ProfileService

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
  }

  updateProfile(profile: UpdateProfileDto) {
    const id = profile.id
    this.profileService.updateProfile(id, profile).then(() => {
      this.profileService.getProfileById(id);
    });
  }

  get profile() {
    return this.profileService.getCurrentUserProfile();
  }
}
