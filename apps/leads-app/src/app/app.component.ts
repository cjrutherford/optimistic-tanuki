import { Component, inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AuthStateService } from './auth-state.service';
import { Subscription, filter } from 'rxjs';
import { NotificationBellComponent } from '@optimistic-tanuki/notification-ui';

@Component({
  imports: [CommonModule, RouterModule, NotificationBellComponent],
  selector: 'app-root',
  template: `
    <nav class="app-nav">
      <a [routerLink]="brandRoute" class="nav-brand">Lead Command</a>
      <div *ngIf="!isOnboardingRoute && isAuthenticated" class="nav-links">
        <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Dashboard
        </a>
        <a routerLink="/leads" routerLinkActive="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Leads
        </a>
        <a routerLink="/topics" routerLinkActive="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          Topics
        </a>
        <a routerLink="/analytics" routerLinkActive="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Analytics
        </a>
        <a routerLink="/settings" routerLinkActive="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82L4.21 7.2a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10 3.25V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </a>
      </div>
      <div *ngIf="!isOnboardingRoute && !isAuthenticated" class="nav-links">
        <a routerLink="/login" routerLinkActive="active">Login</a>
        <a routerLink="/register" routerLinkActive="active">Register</a>
      </div>
      <div class="nav-spacer"></div>
      <div *ngIf="isAuthenticated && !isOnboardingRoute" class="nav-utility">
        <notif-notification-bell
          [notifications]="notifications"
          [unreadCount]="unreadCount"
        ></notif-notification-bell>
        <a routerLink="/settings" class="account-link">Account</a>
      </div>
      <span *ngIf="isAuthenticated && currentProfileName" class="profile-chip">
        {{ currentProfileName }}
      </span>
      <button *ngIf="isAuthenticated && !isOnboardingRoute" class="nav-quiet-button" (click)="logout()">
        Logout
      </button>
      <button class="theme-toggle" (click)="toggleTheme()" [title]="isDark ? 'Switch to light mode' : 'Switch to dark mode'">
        <svg *ngIf="!isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg *ngIf="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      </button>
    </nav>
    <main class="app-main">
      <router-outlet></router-outlet>
    </main>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  protected title = 'leads-app';
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);
  isDark = false;
  isOnboardingRoute = false;
  isAuthenticated = false;
  currentProfileName = '';
  notifications = signal<any[]>([]);
  unreadCount = signal(0);
  private readonly subscriptions = new Subscription();

  get brandRoute(): string {
    if (this.isOnboardingRoute) {
      return '/onboarding';
    }

    return this.isAuthenticated ? '/leads' : '/login';
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.themeService.setPersonality('control-center');
      this.isDark = this.themeService.getTheme() === 'dark';
      this.isOnboardingRoute = this.router.url.startsWith('/onboarding');
      this.subscriptions.add(this.themeService.theme$().subscribe((theme) => {
        this.isDark = theme === 'dark';
      }));
      this.subscriptions.add(this.authState.isAuthenticated$.subscribe((value) => {
        this.isAuthenticated = value;
        if (!value) {
          this.currentProfileName = '';
        }
      }));
      this.subscriptions.add(this.authState.currentProfile$.subscribe((profile) => {
        this.currentProfileName = profile?.profileName || '';
      }));
      this.subscriptions.add(this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => {
          this.isOnboardingRoute = event.urlAfterRedirects.startsWith('/onboarding');
        }));
    }
  }

  toggleTheme() {
    this.themeService.toggleTheme();
  }

  async logout() {
    this.authState.logout();
    await this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
