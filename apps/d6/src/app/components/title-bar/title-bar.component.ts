import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  BannerComponent,
  ProfilePhotoComponent,
} from '@optimistic-tanuki/profile-ui';
import { AuthStateService } from '../../services/auth-state.service';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'app-title-bar',
  standalone: true,
  imports: [CommonModule, BannerComponent, ProfilePhotoComponent],
  template: `
    <header class="title-bar">
      <div class="title-bar-content">
        <div class="logo">
          <span class="logo-text">D6</span>
        </div>
        <nav class="nav-links">
          <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          <a routerLink="/daily-four" routerLinkActive="active">Daily Four</a>
          <a routerLink="/daily-six" routerLinkActive="active">Daily Six</a>
        </nav>
        <div class="user-section" *ngIf="profile">
          <lib-profile-photo
            [src]="profile.profilePic"
            [alt]="profile.profileName"
            [size]="32"
          >
          </lib-profile-photo>
          <span class="user-name">{{ profile.profileName }}</span>
          <button class="logout-btn" (click)="logout()">Logout</button>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .title-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 64px;
        background: white;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        z-index: 1000;
      }

      .title-bar-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 100%;
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 24px;
      }

      .logo-text {
        font-size: 1.5rem;
        font-weight: 700;
        color: #4f46e5;
        letter-spacing: 0.1em;
      }

      .nav-links {
        display: flex;
        gap: 8px;
      }

      .nav-links a {
        padding: 8px 16px;
        text-decoration: none;
        color: #6b7280;
        font-weight: 500;
        border-radius: 8px;
        transition: all 0.2s ease;
      }

      .nav-links a:hover {
        color: #4f46e5;
        background: #f3f4f6;
      }

      .nav-links a.active {
        color: #4f46e5;
        background: #eef2ff;
      }

      .user-section {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .user-name {
        font-weight: 500;
        color: #374151;
      }

      .logout-btn {
        padding: 8px 16px;
        background: #f3f4f6;
        border: none;
        border-radius: 8px;
        color: #6b7280;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .logout-btn:hover {
        background: #e5e7eb;
        color: #374151;
      }
    `,
  ],
})
export class TitleBarComponent implements OnInit {
  private authState = inject(AuthStateService);
  private profileService = inject(ProfileService);
  private router = inject(Router);

  profile: any = null;

  ngOnInit(): void {
    this.profile = this.profileService.getCurrentUserProfile();
  }

  logout(): void {
    this.authState.logout();
    this.router.navigate(['/login']);
  }
}
