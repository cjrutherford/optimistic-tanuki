import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <header class="topbar">
        <a class="brand" routerLink="/">
          <span class="brand-mark">SF</span>
          <span class="brand-copy">
            <strong>Signal Foundry</strong>
            <small>Campaign concepts for products and services</small>
          </span>
        </a>

        <nav class="topnav">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            Overview
          </a>
          <a routerLink="/create" routerLinkActive="active">Create</a>
          <a routerLink="/results" routerLinkActive="active">Results</a>
        </nav>
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
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        backdrop-filter: blur(18px);
        background: color-mix(in srgb, var(--surface, #10151c) 78%, transparent);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        text-decoration: none;
      }

      .brand-mark {
        width: 2.75rem;
        height: 2.75rem;
        border-radius: var(--border-radius-md, 14px);
        display: grid;
        place-items: center;
        font-weight: 800;
        color: var(--background, #081018);
        background: var(--primary-gradient, linear-gradient(135deg, #d97706, #2563eb));
      }

      .brand-copy {
        display: grid;
      }

      .brand-copy small {
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      .topnav {
        display: flex;
        gap: 0.8rem;
        flex-wrap: wrap;
      }

      .topnav a {
        padding: 0.65rem 0.9rem;
        border-radius: 999px;
        text-decoration: none;
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      .topnav a.active,
      .topnav a:hover {
        color: var(--foreground, #f7f1e6);
        background: color-mix(in srgb, var(--foreground, #fff) 8%, transparent);
      }

      .brand:focus-visible,
      .topnav a:focus-visible {
        outline: 2px solid var(--primary, #d97706);
        outline-offset: 3px;
      }

      .page-shell {
        width: min(1280px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 1.5rem 0 4rem;
      }

      @media (max-width: 820px) {
        .topbar {
          flex-direction: column;
          align-items: flex-start;
        }
      }
    `,
  ],
})
export class AppComponent {
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.themeService.setTheme('dark');
      this.themeService.setPersonality('control-center');
      this.themeService.setPrimaryColor('#d97706');
    }
  }
}
