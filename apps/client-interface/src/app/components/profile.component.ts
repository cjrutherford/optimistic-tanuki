import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { BannerComponent } from '@optimistic-tanuki/profile-ui';
import { ProfileService } from '../profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule, 
    MatCardModule, 
    MatListModule, 
    MatIconModule, 
    BannerComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {

  constructor(private readonly profileService: ProfileService) {
    const profile = localStorage.getItem('selectedProfile');
    if (profile) {
      this.profileService.selectProfile(JSON.parse(profile));
    }
  }
  get profile() {
    return this.profileService.getCurrentUserProfile();
  }
}
