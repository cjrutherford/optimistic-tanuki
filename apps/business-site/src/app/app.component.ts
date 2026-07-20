import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { filter } from 'rxjs';
import {
  DEFAULT_BUSINESS_SITE_CONFIG,
  BusinessAuthService,
  BusinessSiteConfig,
  BusinessSiteConfigStore,
  mergeBusinessSiteConfig,
} from '@optimistic-tanuki/business-data-access';

type StoredThemeConfig = {
  personalityId: string;
  primaryColor: string;
  mode: 'light' | 'dark';
  version?: string;
};

type TopNavLink = {
  label: string;
  route: string[];
  fragment?: string;
};

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink],
  template: `
    <div class="app-shell">
      <header class="topbar entrance">
        <a class="brand" [routerLink]="brandHomeLink()">
          <span class="brand-mark">{{ brandMark() }}</span>
          <span class="brand-copy">
            <strong>{{ brandTitle() }}</strong>
            <small>{{ brandSubtitle() }}</small>
          </span>
        </a>

        <nav class="topnav">
          @for (link of topNavLinks(); track link.label) {
          <a [routerLink]="link.route" [fragment]="link.fragment">{{
            link.label
          }}</a>
          }
        </nav>

        <div class="auth-actions">
          <button
            class="theme-toggle"
            (click)="toggleTheme()"
            [attr.aria-label]="
              currentTheme() === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
            "
          >
            @if (currentTheme() === 'dark') {
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
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
            } @else {
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
            }
          </button>

          @if (isClientAuthenticated()) { @if
          (site().features.clientPortal.enabled) {
          <a class="ghost" [routerLink]="clientDashboardLink()"
            >Client Portal</a
          >
          }
          <button class="ghost" (click)="signOutClient()">Sign Out</button>
          } @else if (!auth.isAuthenticated()) { @if
          (site().features.clientPortal.enabled) {
          <a class="ghost" [routerLink]="hostedClientAuthLink('login')"
            >Client Login</a
          >
          } } @if (auth.isAuthenticated()) {
          <a class="ghost" [routerLink]="ownerDashboardLink()">Workspace</a>
          <button class="solid" (click)="logout()">Sign Out</button>
          } @else if (!isClientAuthenticated()) {
          <a class="solid" [routerLink]="hostedOwnerAuthLink('login')"
            >Owner Login</a
          >
          }
        </div>
      </header>

      @if (configLoadError()) {
      <div class="config-load-error" role="status">
        We couldn't refresh this business's configuration. Showing the most
        recently available details.
      </div>
      }

      <main class="page-shell">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [
    `
      @keyframes topbar-slide {
        from {
          opacity: 0;
          transform: translateY(-12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .app-shell {
        min-height: 100vh;
      }

      .entrance {
        animation: topbar-slide 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }

      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 1rem;
        padding: 0.85rem 1.5rem;
        border-bottom: var(--personality-border-width, 1px) solid var(--border);
        backdrop-filter: blur(20px) saturate(1.2);
        background: color-mix(in srgb, var(--background) 78%, transparent);
        transition: box-shadow 0.3s ease;
      }

      .topbar:has(.topnav a:hover) {
        box-shadow: 0 4px 20px
          color-mix(in srgb, var(--primary) 4%, transparent);
      }

      .config-load-error {
        padding: 0.6rem 1.5rem;
        font-size: 0.85rem;
        text-align: center;
        color: color-mix(in srgb, var(--danger, #991b1b) 90%, black);
        background: color-mix(in srgb, var(--danger, #fee2e2) 16%, transparent);
        border-bottom: 1px solid
          color-mix(in srgb, var(--danger, #991b1b) 30%, transparent);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        text-decoration: none;
        min-width: 0;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .brand:hover {
        transform: scale(1.02);
      }

      .brand-mark {
        width: 2.75rem;
        height: 2.75rem;
        border-radius: var(--personality-border-radius, 1rem);
        display: grid;
        place-items: center;
        font-weight: 800;
        font-size: 1rem;
        color: var(--primary-foreground);
        background: linear-gradient(
          135deg,
          var(--primary),
          color-mix(in srgb, var(--primary) 55%, var(--foreground))
        );
        box-shadow: 0 4px 14px
          color-mix(in srgb, var(--primary) 30%, transparent);
        transition: box-shadow 0.3s ease, transform 0.3s ease;
      }

      .brand:hover .brand-mark {
        box-shadow: 0 6px 20px
          color-mix(in srgb, var(--primary) 45%, transparent);
        transform: rotate(-3deg);
      }

      .brand-copy {
        display: grid;
        min-width: 0;
      }

      .brand-copy strong {
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground);
        letter-spacing: -0.01em;
      }

      .brand-copy small {
        color: color-mix(in srgb, var(--foreground) 58%, transparent);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 0.82rem;
      }

      .topnav {
        display: flex;
        justify-content: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }

      .topnav a,
      .auth-actions a,
      .auth-actions button {
        padding: 0.55rem 0.85rem;
        border-radius: var(--personality-button-radius, 999px);
        text-decoration: none;
        transition: background-color 0.2s ease, color 0.2s ease,
          border-color 0.2s ease,
          transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
        font-size: inherit;
        font-family: inherit;
        cursor: pointer;
        font-weight: 500;
        font-size: 0.88rem;
        will-change: transform;
      }

      .topnav a {
        color: color-mix(in srgb, var(--foreground) 68%, transparent);
      }

      .topnav a.active,
      .topnav a:hover {
        color: var(--foreground);
        background: color-mix(in srgb, var(--primary) 10%, var(--background));
        transform: translateY(-1px);
      }

      .auth-actions {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
      }

      .theme-toggle {
        display: grid;
        place-items: center;
        width: 2.2rem;
        height: 2.2rem;
        padding: 0;
        border-radius: 999px;
        border: var(--personality-border-width, 1px) solid var(--border);
        background: transparent;
        color: color-mix(in srgb, var(--foreground) 65%, transparent);
        cursor: pointer;
        transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
      }

      .theme-toggle:hover {
        background: color-mix(in srgb, var(--primary) 10%, transparent);
        color: var(--primary);
        transform: rotate(15deg) scale(1.1);
      }

      .ghost {
        border: var(--personality-border-width, 1px) solid var(--border);
        background: transparent;
        color: var(--foreground);
      }

      .ghost:hover {
        background: color-mix(in srgb, var(--primary) 6%, transparent);
        border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
        transform: translateY(-1px);
      }

      .solid {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        box-shadow: 0 4px 12px
          color-mix(in srgb, var(--primary) 24%, transparent);
      }

      .solid:hover {
        background: color-mix(in srgb, var(--primary) 88%, var(--foreground));
        box-shadow: 0 6px 18px
          color-mix(in srgb, var(--primary) 32%, transparent);
        transform: translateY(-1px);
      }

      .brand:focus-visible,
      .topnav a:focus-visible,
      .auth-actions a:focus-visible,
      .auth-actions button:focus-visible,
      .theme-toggle:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 3px;
      }

      .page-shell {
        width: calc(100% - 2rem);
        margin: 0 auto;
        padding: 1.5rem 0 4rem;
      }

      @media (max-width: 980px) {
        .topbar {
          grid-template-columns: 1fr;
          justify-items: stretch;
          gap: 0.75rem;
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
  readonly site = signal<BusinessSiteConfig>(DEFAULT_BUSINESS_SITE_CONFIG);
  readonly configId = signal<string | null>(null);
  /**
   * Truthy when the most recent business-site config fetch failed and the
   * store fell back to defaults, so we can tell that apart from a feature
   * that is genuinely turned off.
   */
  readonly configLoadError = signal<string | null>(null);
  readonly currentTheme = signal<'light' | 'dark'>('light');
  readonly auth = inject(BusinessAuthService);
  readonly isClientAuthenticated = this.auth.isClientAuthenticated;
  readonly clientUser = this.auth.clientUser;
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly currentUrl = signal(this.router.url || '/');
  private lastAppliedThemeSignature: string | null = null;
  private readonly personalityThemeStorageKey =
    'optimistic-tanuki-personality-theme';
  private userThemeBeforeHostedRoute: StoredThemeConfig | null | undefined =
    undefined;

  private applySiteTheme(theme: BusinessSiteConfig['theme']): void {
    const signature = JSON.stringify(theme);
    if (signature === this.lastAppliedThemeSignature) {
      return;
    }

    this.lastAppliedThemeSignature = signature;
    this.themeService.setTheme(theme.mode);
    void this.themeService.setPersonality(theme.personalityId);
    this.themeService.setPrimaryColor(theme.primaryColor);
    this.currentTheme.set(theme.mode);
  }

  private isHostedBusinessRoute(url: string): boolean {
    return url.startsWith('/sites/');
  }

  private currentHostedSiteSlug(): string | null {
    const match = this.currentUrl().match(/^\/sites\/([^/]+)/);
    return match?.[1] ?? null;
  }

  private shouldPreserveConfiguredSiteSlug(): boolean {
    return /^\/(owner|client)(\/|$)/.test(this.currentUrl());
  }

  private activeSiteSlug(): string | null {
    const hostedSiteSlug = this.currentHostedSiteSlug();
    if (hostedSiteSlug) {
      return hostedSiteSlug;
    }

    if (this.shouldPreserveConfiguredSiteSlug()) {
      return this.site().site.slug || null;
    }

    return null;
  }

  private hostedSiteBaseRoute(): string[] | null {
    const siteSlug = this.activeSiteSlug();
    return siteSlug ? ['/sites', siteSlug] : null;
  }

  private syncHostedRouteConfig(): void {
    const siteSlug = this.currentHostedSiteSlug();
    if (siteSlug) {
      this.siteConfig.fetch(false, siteSlug).subscribe();
    }
  }

  private readStoredTheme(): StoredThemeConfig | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    try {
      const raw = localStorage.getItem(this.personalityThemeStorageKey);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as StoredThemeConfig;
    } catch {
      return null;
    }
  }

  private applyStoredUserTheme(): void {
    const storedTheme =
      this.userThemeBeforeHostedRoute ?? this.readStoredTheme();
    if (!storedTheme) {
      this.applySiteTheme(this.site().theme);
      return;
    }

    this.lastAppliedThemeSignature = JSON.stringify(storedTheme);
    this.themeService.setTheme(storedTheme.mode);
    void this.themeService.setPersonality(storedTheme.personalityId);
    this.themeService.setPrimaryColor(storedTheme.primaryColor);
    this.currentTheme.set(storedTheme.mode);
  }

  private syncRouteTheme(site: BusinessSiteConfig): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const onHostedRoute = this.isHostedBusinessRoute(this.currentUrl());

    if (onHostedRoute) {
      if (this.userThemeBeforeHostedRoute === undefined) {
        this.userThemeBeforeHostedRoute = this.readStoredTheme();
      }
      this.applySiteTheme(site.theme);
      return;
    }

    if (this.userThemeBeforeHostedRoute !== undefined) {
      this.applyStoredUserTheme();
      this.userThemeBeforeHostedRoute = undefined;
      return;
    }

    if (!this.readStoredTheme()) {
      this.applySiteTheme(site.theme);
    }
  }

  constructor() {
    effect(() => {
      this.title.setTitle(this.pageTitleForUrl(this.currentUrl()));
    });

    effect(() => {
      const site = mergeBusinessSiteConfig(this.siteConfig.site());
      this.site.set(site);
      this.configId.set(this.siteConfig.configId());
      this.configLoadError.set(this.siteConfig.loadError?.() ?? null);
      this.syncRouteTheme(site);
    });

    effect(() => {
      this.currentUrl();
      this.syncHostedRouteConfig();
    });

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        )
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects || event.url || '/');
      });

    if (isPlatformBrowser(this.platformId)) {
      const hasStoredPersonalityTheme = !!this.readStoredTheme();

      if (!hasStoredPersonalityTheme) {
        this.applySiteTheme(this.site().theme);
        return;
      }

      this.themeService.setTheme(this.themeService.getTheme());
      this.currentTheme.set(this.themeService.getTheme());
    }
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.currentTheme.set(this.themeService.getTheme());
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/']);
  }

  signOutClient(): void {
    this.auth.logoutClient();
    void this.router.navigate(['/']);
  }

  private pageTitleForUrl(url: string): string {
    const businessName = this.site().brand.businessName?.trim();
    const tagline = this.site().brand.tagline?.trim();
    const brandTitle = businessName || 'Business';

    if (url.startsWith('/sites/') && url.includes('/book')) {
      return `${this.site().contact.consultationLabel} | ${brandTitle}`;
    }

    if (url.startsWith('/client/login') || url.includes('/client/login')) {
      return `Client Login | ${brandTitle}`;
    }

    if (
      url.startsWith('/client/register') ||
      url.includes('/client/register')
    ) {
      return `Client Registration | ${brandTitle}`;
    }

    if (url.startsWith('/client')) {
      return `Client Portal | ${brandTitle}`;
    }

    if (url.startsWith('/owner/register')) {
      return `Owner Registration | ${brandTitle}`;
    }

    if (url.startsWith('/auth') || url.startsWith('/owner/login')) {
      return `Owner Login | ${brandTitle}`;
    }

    if (url.startsWith('/owner')) {
      return `Owner Workspace | ${brandTitle}`;
    }

    return tagline ? `${brandTitle} | ${tagline}` : brandTitle;
  }

  brandTitle(): string {
    return this.isHostedBusinessRoute(this.currentUrl())
      ? this.site().brand.businessName
      : 'Business Site Platform';
  }

  brandSubtitle(): string {
    return this.isHostedBusinessRoute(this.currentUrl())
      ? this.site().brand.tagline
      : 'Hosted onboarding, editing, and client connection flows.';
  }

  brandMark(): string {
    return this.isHostedBusinessRoute(this.currentUrl())
      ? this.site().brand.monogram
      : 'BS';
  }

  brandHomeLink(): string[] {
    return this.hostedSiteBaseRoute() ?? ['/'];
  }

  topNavLinks(): TopNavLink[] {
    const hostedBaseRoute = this.hostedSiteBaseRoute();
    if (hostedBaseRoute) {
      const hostedLinks: TopNavLink[] = [
        { label: 'Overview', route: hostedBaseRoute, fragment: 'about' },
        { label: 'Results', route: hostedBaseRoute, fragment: 'results' },
        { label: 'Contact', route: hostedBaseRoute, fragment: 'contact' },
      ];

      if (this.site().features.booking.enabled) {
        hostedLinks.push({
          label: 'Book',
          route: [...hostedBaseRoute, 'book'],
        });
      }

      return hostedLinks;
    }

    return [
      { label: 'Home', route: ['/'] },
      { label: 'Owners', route: ['/auth'] },
      { label: 'Clients', route: ['/client/login'] },
    ];
  }

  hostedClientAuthLink(mode: 'login' | 'register'): string[] {
    const siteSlug = this.activeSiteSlug();
    return siteSlug ? ['/sites', siteSlug, 'client', mode] : ['/client', mode];
  }

  hostedOwnerAuthLink(mode: 'login' | 'register'): string[] {
    const siteSlug = this.activeSiteSlug();
    return siteSlug ? ['/sites', siteSlug, 'owner', mode] : ['/owner', mode];
  }

  clientPortalEntryLink(): string[] {
    return this.hostedClientAuthLink('login');
  }

  clientDashboardLink(): string[] {
    const siteSlug = this.activeSiteSlug();
    return siteSlug
      ? ['/sites', siteSlug, 'client', 'dashboard']
      : ['/client/dashboard'];
  }

  ownerDashboardLink(): string[] {
    const siteSlug = this.activeSiteSlug();
    return siteSlug
      ? ['/sites', siteSlug, 'owner', 'dashboard']
      : ['/owner/dashboard'];
  }
}
