import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import {
  DEFAULT_TRAINER_SITE_CONFIG,
  TrainerApiService,
  TrainerAuthService,
  TrainerSiteConfig,
} from '@optimistic-tanuki/trainer-data-access';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" routerLink="/">
          <span class="brand-mark">{{ site().brand.monogram }}</span>
          <span class="brand-copy">
            <strong>{{ site().brand.businessName }}</strong>
            <small>{{ site().brand.tagline }}</small>
          </span>
        </a>

        <nav class="topnav">
          <a href="/#about">About</a>
          <a href="/#results">Results</a>
          <a href="/#contact">Contact</a>
          <a routerLink="/client" routerLinkActive="active">Client Portal</a>
        </nav>

        <div class="auth-actions">
          @if (isClientAuthenticated()) {
            <a class="ghost" routerLink="/client/dashboard">Client Portal</a>
            <button class="ghost" (click)="signOutClient()">Sign Out (Client)</button>
          } @else {
            <a class="ghost" routerLink="/client/login">Client Login</a>
          }
          @if (auth.isAuthenticated()) {
            <a class="ghost" routerLink="/trainer/dashboard">Workspace</a>
            <button class="solid" (click)="logout()">Sign Out</button>
          } @else {
            <a class="solid" routerLink="/trainer/login">Trainer Login</a>
          }
        </div>
      </header>

      <main class="page-shell">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [
    `
      .app-shell {
        min-height: 100vh;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.5rem;
        border-bottom: var(--personality-border-width, 1px) solid var(--border);
        backdrop-filter: blur(18px);
        background: color-mix(in srgb, var(--background, #fff) 82%, transparent);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        text-decoration: none;
        min-width: 0;
      }

      .brand-mark {
        width: 2.75rem;
        height: 2.75rem;
        border-radius: var(--personality-border-radius, 1rem);
        display: grid;
        place-items: center;
        font-weight: 800;
        color: white;
        background: linear-gradient(
          135deg,
          var(--primary, #1f7a63),
          color-mix(in srgb, var(--primary, #1f7a63) 55%, #0f172a)
        );
      }

      .brand-copy {
        display: grid;
        min-width: 0;
      }

      .brand-copy strong {
        font-size: 1rem;
      }

      .brand-copy small {
        color: color-mix(in srgb, var(--foreground, #0f172a) 62%, transparent);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .topnav {
        display: flex;
        justify-content: center;
        gap: 0.8rem;
        flex-wrap: wrap;
      }

      .topnav a,
      .auth-actions a,
      .auth-actions button {
        padding: 0.65rem 0.9rem;
        border-radius: var(--personality-button-radius, 999px);
        text-decoration: none;
        transition: background-color 160ms ease, color 160ms ease,
          border-color 160ms ease;
        font-size: inherit;
        font-family: inherit;
        cursor: pointer;
      }

      .topnav a {
        color: color-mix(in srgb, var(--foreground, #0f172a) 74%, transparent);
      }

      .topnav a.active,
      .topnav a:hover {
        color: var(--foreground, #0f172a);
        background: color-mix(in srgb, var(--primary, #1f7a63) 10%, white);
      }

      .auth-actions {
        display: flex;
        gap: 0.65rem;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
      }

      .ghost {
        border: var(--personality-border-width, 1px) solid var(--border);
        background: transparent;
        color: var(--foreground, #0f172a);
      }

      .solid {
        background: var(--primary, #1f7a63);
        color: white;
        border: none;
      }

      .ghost:hover {
        background: rgba(15, 23, 42, 0.04);
      }

      .solid:hover {
        background: color-mix(in srgb, var(--primary, #1f7a63) 88%, black);
      }

      .brand:focus-visible,
      .topnav a:focus-visible,
      .auth-actions a:focus-visible,
      .auth-actions button:focus-visible {
        outline: 2px solid var(--primary, #1f7a63);
        outline-offset: 3px;
      }

      .page-shell {
        width: min(1160px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 1.5rem 0 4rem;
      }

      @media (max-width: 980px) {
        .topbar {
          grid-template-columns: 1fr;
          justify-items: stretch;
        }

        .topnav {
          justify-content: flex-start;
        }

        .auth-actions {
          justify-content: flex-start;
        }
      }
    `,
  ],
})
export class AppComponent {
  readonly site = signal<TrainerSiteConfig>(DEFAULT_TRAINER_SITE_CONFIG);
  readonly configId = signal<string | null>(null);
  readonly auth = inject(TrainerAuthService);
  readonly isClientAuthenticated = this.auth.isClientAuthenticated;
  readonly clientUser = this.auth.clientUser;
  private readonly api = inject(TrainerApiService);
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  constructor() {
    this.api.getSiteConfig().subscribe({
      next: (res) => {
        this.configId.set(res.configId ?? null);
        const merged = res.config
          ? { ...DEFAULT_TRAINER_SITE_CONFIG, ...res.config }
          : DEFAULT_TRAINER_SITE_CONFIG;
        this.site.set(merged);
      },
      error: () => this.site.set(DEFAULT_TRAINER_SITE_CONFIG),
    });

    if (isPlatformBrowser(this.platformId)) {
      const hasStoredPersonalityTheme = !!localStorage.getItem(
        'optimistic-tanuki-personality-theme'
      );

      if (!hasStoredPersonalityTheme) {
        const theme = this.site().theme;
        this.themeService.setTheme(theme.mode);
        this.themeService.setPersonality(theme.personalityId);
        this.themeService.setPrimaryColor(theme.primaryColor);
        return;
      }

      this.themeService.setTheme(this.themeService.getTheme());
    }
  }

  logout(): void {
    this.auth.logout();
  }

  signOutClient(): void {
    this.auth.logoutClient();
    this.router.navigate(['/client/login']);
  }
}
