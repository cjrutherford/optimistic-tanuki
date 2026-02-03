import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileService } from '../services/profile.service';
import { ProfileDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-settings">
      <h1>Profile Settings</h1>
      
      <div class="current-profile" *ngIf="currentProfile">
        <h2>Current Profile</h2>
        <div class="profile-card">
          <img *ngIf="currentProfile.avatarAssetId" 
               [src]="'/api/asset/' + currentProfile.avatarAssetId" 
               alt="Profile Avatar"
               class="avatar" />
          <div class="profile-info">
            <h3>{{ currentProfile.handle }}</h3>
            <p>{{ currentProfile.bio }}</p>
          </div>
        </div>
      </div>

      <div class="all-profiles" *ngIf="profiles.length > 0">
        <h2>All Profiles</h2>
        <div class="profile-list">
          <div *ngFor="let profile of profiles" 
               class="profile-item"
               [class.selected]="profile.id === currentProfile?.id"
               (click)="selectProfile(profile)">
            <img *ngIf="profile.avatarAssetId" 
                 [src]="'/api/asset/' + profile.avatarAssetId" 
                 alt="Profile Avatar" 
                 class="avatar-small" />
            <span>{{ profile.handle }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-settings {
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      margin: 0 0 2rem 0;
    }

    h2 {
      margin: 2rem 0 1rem 0;
    }

    .profile-card {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid #ddd;
      border-radius: 8px;
    }

    .avatar {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
    }

    .avatar-small {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .profile-info h3 {
      margin: 0 0 0.5rem 0;
    }

    .profile-info p {
      margin: 0;
      opacity: 0.7;
    }

    .profile-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .profile-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .profile-item:hover {
      background: #f5f5f5;
    }

    .profile-item.selected {
      background: #e3f2fd;
      border-color: #2196f3;
    }
  `]
})
export class ProfileSettingsComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  
  currentProfile: ProfileDto | null = null;
  profiles: ProfileDto[] = [];

  async ngOnInit() {
    this.currentProfile = this.profileService.getCurrentUserProfile();
    this.profiles = await this.profileService.getAllProfiles();
  }

  selectProfile(profile: ProfileDto) {
    this.profileService.selectProfile(profile);
    this.currentProfile = profile;
  }
}
