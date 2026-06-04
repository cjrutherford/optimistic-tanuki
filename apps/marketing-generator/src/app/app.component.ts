import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { MarketingStateService } from './services/marketing-state.service';
import {
  AppBarComponent,
  NavItem,
  NavSidebarComponent,
} from '@optimistic-tanuki/navigation-ui';
import { MetricTileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    AppBarComponent,
    NavSidebarComponent,
    MetricTileComponent,
  ],
  template: `
    <div class="app-shell">
      <header class="shell-header">
        <otui-app-bar
          appTitle="Signal Foundry"
          [showThemeToggle]="true"
          [useTile]="true"
          density="compact"
          menuIcon="☰"
          (menuToggle)="toggleMenu()"
        ></otui-app-bar>
        <otui-nav-sidebar
          [isOpen]="menuOpen()"
          [navItems]="navItems()"
          heading="Navigate Signal Foundry"
          (close)="menuOpen.set(false)"
        ></otui-nav-sidebar>

        <div class="topbar">
          <a class="brand" routerLink="/">
            <span class="brand-mark">SF</span>
            <span class="brand-copy">
              <strong>Signal Foundry</strong>
              <small
                >Hybrid demo + workbench for campaign strategy, structured
                refinement, and export-ready outputs</small
              >
            </span>
          </a>

          <nav class="topnav">
            <a
              routerLink="/"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: true }"
            >
              Overview
            </a>
            <a routerLink="/create" routerLinkActive="active">Create</a>
            <a routerLink="/results" routerLinkActive="active">Results</a>
          </nav>
        </div>
      </header>

      <section class="ops-strip">
        <article class="ops-intro ops-card ops-primary">
          <span class="eyebrow">Operator lane</span>
          <strong>{{ workspaceStatus().currentWorkspaceName }}</strong>
          <small>{{ workspaceStatus().storageLabel }}</small>
        </article>
        <otui-metric-tile
          label="Active Planning Containers"
          [value]="workspaceStatus().workspaceCount"
          caption="workspaces in circulation"
        ></otui-metric-tile>
        <otui-metric-tile
          label="Versions In Focus"
          [value]="workspaceStatus().currentVersionCount"
          caption="saved revision points"
        ></otui-metric-tile>
        <otui-metric-tile
          label="Concepts In Run"
          [value]="workspaceStatus().conceptCount"
          caption="active generated directions"
        ></otui-metric-tile>
      </section>

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

      .shell-header {
        position: sticky;
        top: 0;
        z-index: 10;
        padding: 1rem 1rem 0;
        backdrop-filter: blur(18px);
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 78%,
          transparent
        );
      }

      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        padding: 1rem 0.5rem 1rem;
        border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.12));
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
        background: var(
          --primary-gradient,
          linear-gradient(135deg, #d97706, #2563eb)
        );
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

      .ops-strip {
        width: min(1280px, calc(100% - 2rem));
        margin: 1rem auto 0;
        display: grid;
        grid-template-columns: minmax(260px, 1.2fr) repeat(3, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .ops-card {
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 88%,
          transparent
        );
        border-radius: var(--border-radius-lg, 20px);
        padding: 1rem 1.1rem;
        box-shadow: var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25));
        display: grid;
        gap: 0.2rem;
      }

      .ops-intro {
        align-content: center;
      }

      .ops-primary {
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--primary, #d97706) 22%, transparent),
            transparent 55%
          ),
          color-mix(in srgb, var(--surface, #10151c) 90%, transparent);
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: var(--primary, #d97706);
        font-size: 0.72rem;
      }

      .ops-primary strong {
        font-size: 1.4rem;
        font-weight: 700;
      }

      .ops-card small,
      .ops-label {
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      otui-metric-tile {
        display: block;
      }

      @media (max-width: 820px) {
        .topbar {
          flex-direction: column;
          align-items: flex-start;
        }

        .ops-strip {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 580px) {
        .ops-strip {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AppComponent {
  private readonly themeService = inject(ThemeService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly state = inject(MarketingStateService);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);
  protected readonly workspaceStatus = this.state.workspaceStatus;
  protected readonly navItems = computed<NavItem[]>(() => [
    {
      label: 'Overview',
      isActive: this.router.url === '/',
      action: () => void this.router.navigateByUrl('/'),
    },
    {
      label: 'Create',
      isActive: this.router.url.startsWith('/create'),
      action: () => void this.router.navigateByUrl('/create'),
    },
    {
      label: 'Results',
      isActive: this.router.url.startsWith('/results'),
      action: () => void this.router.navigateByUrl('/results'),
    },
  ]);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.themeService.setTheme('dark');
      this.themeService.setPersonality('control-center');
      this.themeService.setPrimaryColor('#d97706');
    }
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
