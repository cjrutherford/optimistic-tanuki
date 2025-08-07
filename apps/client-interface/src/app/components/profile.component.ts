import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { BannerComponent, ProfileSelectorComponent } from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../profile.service';
import { UpdateProfileDto } from '@optimistic-tanuki/ui-models';

/**
 * Component for displaying and managing user profiles.
 */
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
  /**
   * The ProfileService instance.
   */
  profileService: ProfileService

  /**
   * Creates an instance of ProfileComponent.
   * @param _profileService The ProfileService instance to inject.
   */
  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    readonly _profileService: ProfileService
  ) {
    this.profileService = _profileService;
    if (isPlatformBrowser(this.platformId)) {
      const profile = localStorage.getItem('selectedProfile');
      if (profile) {
        this.profileService.selectProfile(JSON.parse(profile));
      }
    }
  }


  /**
   * Initializes the component and loads user profiles.
   */
  ngOnInit(): void {
    this.profileService.getAllProfiles().then(() => {
      if (isPlatformBrowser(this.platformId)) {
        const profile = localStorage.getItem('selectedProfile');
        if (profile) {
          this.profileService.selectProfile(JSON.parse(profile));
        }
      }
    });
  }

  /**
   * Updates a user profile.
   * @param profile The profile data to update.
   */
  updateProfile(profile: UpdateProfileDto) {
    const id = profile.id
    this.profileService.updateProfile(id, profile).then(() => {
      this.profileService.getProfileById(id);
    });
  }

  /**
   * Gets the current user profile.
   */
  get profile() {
    return this.profileService.getCurrentUserProfile();
  }
}
