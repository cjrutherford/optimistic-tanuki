import { CommonModule } from '@angular/common';
import {
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
  Type,
} from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import type {
  AppConfiguration,
  PublishedAppConfiguration,
  RouteConfig,
} from '@optimistic-tanuki/app-config-models';
import { getConfigurableCapability } from '@optimistic-tanuki/configurable-plugin-contracts';
import type { PublishedFeatureContext } from '@optimistic-tanuki/configurable-plugin-contracts';
import { ConfigurableLandingPageComponent } from './configurable-landing-page.component';

export interface PublishedFeatureRegistryEntry {
  capabilityId: string;
  featureName?: RouteConfig['featureName'];
  load: () => Promise<Type<unknown>>;
  inputs?: (context: PublishedFeatureContext) => Record<string, unknown>;
}

type FeatureState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'error'
  | 'unsupported'
  | 'access-required';

const FEATURE_CAPABILITIES: Partial<
  Record<NonNullable<RouteConfig['featureName']>, string>
> = {
  social: 'social.feed',
  tasks: 'tasks',
  blogging: 'blogging.posts',
  projectPlanning: 'project-planning',
};

function pathForRoute(path: string): string {
  const normalized = path.trim();
  if (!normalized || normalized === '/') {
    return '/';
  }
  return `/${normalized.replace(/^\/+|\/+$/g, '')}`;
}

@Component({
  selector: 'otui-published-app-shell',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, ConfigurableLandingPageComponent],
  template: `
    <a class="skip-link" href="#published-main">Skip to main content</a>
    <header class="published-header">
      <a
        class="identity"
        data-published-app-identity
        [href]="basePath || '/'"
        [attr.aria-label]="config.name + ' home'"
      >
        <span class="identity__mark" aria-hidden="true">{{
          identityMark
        }}</span>
        <span>
          <strong>{{ config.name }}</strong>
          @if (config.description) { <small>{{ config.description }}</small> }
        </span>
      </a>
      <button
        class="nav-toggle"
        type="button"
        data-nav-toggle
        aria-controls="published-app-navigation"
        [attr.aria-expanded]="navOpen"
        (click)="navOpen = !navOpen"
      >
        <span class="sr-only">{{ navOpen ? 'Close' : 'Open' }} navigation</span>
        <span aria-hidden="true">☰</span>
      </button>
      <nav
        id="published-app-navigation"
        aria-label="Published app navigation"
        [attr.data-published-nav-drawer]="navOpen ? '' : null"
        [class.nav-drawer-open]="navOpen"
      >
        @for (route of navigationRoutes; track route.id) {
        <a
          data-published-nav-link
          [attr.data-nav-link]="route.name"
          [href]="routeHref(route)"
          [attr.aria-current]="isActive(route) ? 'page' : null"
          (click)="navOpen = false"
          >{{ route.name }}</a
        >
        }
      </nav>
      <div class="header-actions">
        @if (activeAccessRequired && !signedIn) {
        <a class="header-action" [href]="loginHref">Sign in to continue</a>
        } @else if (activeAccessRequired && signedIn) {
        <span class="access-note" data-access-required
          >App membership required</span
        >
        }
      </div>
    </header>

    @if (activeAccessRequired) {
    <div class="membership-banner" role="status" data-membership-banner>
      <strong>App access is separate from platform sign-in.</strong>
      @if (!signedIn) {
      <span
        >Sign in first; an owner may still need to grant app membership.</span
      >
      } @else {
      <span
        >Your platform identity is recognized, but this app requires
        membership.</span
      >
      }
    </div>
    }

    <main id="published-main" tabindex="-1">
      @if (activePath === '/' || !activeRoute) {
      <app-landing-page
        [config]="config"
        [embeddedPreview]="false"
      ></app-landing-page>
      } @else if (activeAccessRequired) {
      <section
        class="feature-panel"
        data-feature-access-required
        aria-labelledby="access-title"
      >
        <p class="panel-eyebrow">Access required</p>
        <h1 id="access-title">This feature is available to app members.</h1>
        <p>
          Platform sign-in and app membership are separate. Ask the owner for
          access.
        </p>
        @if (!signedIn) {
        <a class="panel-action" [href]="loginHref">Sign in</a> }
      </section>
      } @else if (featureState === 'loading') {
      <section class="feature-panel" aria-busy="true">
        <p>Loading feature…</p>
      </section>
      } @else if (featureState === 'error' || featureState === 'unsupported') {
      <section
        class="feature-panel feature-panel--error"
        role="alert"
        data-feature-failure
        aria-labelledby="feature-failure-title"
      >
        <p class="panel-eyebrow">Feature unavailable</p>
        <h1 id="feature-failure-title">
          This feature is temporarily unavailable.
        </h1>
        <p>{{ featureError }}</p>
        <button
          class="panel-action"
          type="button"
          (click)="loadActiveFeature()"
        >
          Try again
        </button>
      </section>
      } @else if (activeFeatureComponent) {
      <section class="published-feature" [attr.aria-label]="activeRoute.name">
        <ng-container
          *ngComponentOutlet="activeFeatureComponent; inputs: featureInputs"
        />
      </section>
      }
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        color: var(--foreground);
        background: var(--background);
      }
      .skip-link {
        position: absolute;
        top: 0.5rem;
        left: 0.75rem;
        z-index: 20;
        transform: translateY(-180%);
        padding: 0.65rem 0.9rem;
        border-radius: 0.45rem;
        background: var(--primary);
        color: var(--primary-foreground);
        font-weight: 750;
      }
      .skip-link:focus {
        transform: translateY(0);
      }
      .published-header {
        position: relative;
        z-index: 5;
        display: flex;
        align-items: center;
        gap: clamp(0.65rem, 2vw, 1.5rem);
        padding: 1rem clamp(1rem, 4vw, 3rem);
        border-bottom: 1px solid var(--border);
        background: color-mix(in srgb, var(--background) 92%, transparent);
      }
      .identity {
        display: inline-flex;
        align-items: center;
        gap: 0.7rem;
        min-width: max-content;
        color: inherit;
        text-decoration: none;
      }
      .identity strong,
      .identity small {
        display: block;
      }
      .identity small {
        max-width: 28rem;
        margin-top: 0.15rem;
        opacity: 0.72;
        font-size: 0.78rem;
      }
      .identity__mark {
        display: grid;
        width: 2.25rem;
        height: 2.25rem;
        place-items: center;
        border-radius: 0.65rem;
        background: var(--primary);
        color: var(--primary-foreground);
        font-weight: 850;
      }
      nav {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        gap: 0.25rem;
      }
      nav a,
      .header-action {
        min-height: 2.5rem;
        display: inline-flex;
        align-items: center;
        padding: 0.5rem 0.7rem;
        border-radius: 0.45rem;
        color: inherit;
        font-weight: 700;
        text-decoration: none;
      }
      nav a:hover,
      nav a[aria-current='page'] {
        background: color-mix(in srgb, var(--primary) 12%, transparent);
      }
      .header-actions {
        min-width: max-content;
      }
      .header-action,
      .panel-action {
        border: 1px solid var(--primary);
        background: var(--primary);
        color: var(--primary-foreground);
      }
      .access-note {
        font-size: 0.8rem;
        font-weight: 700;
        opacity: 0.78;
      }
      .nav-toggle {
        display: none;
        border: 1px solid var(--border);
        border-radius: 0.45rem;
        background: var(--background);
        color: inherit;
        padding: 0.55rem 0.7rem;
      }
      .membership-banner {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.7rem;
        padding: 0.7rem clamp(1rem, 4vw, 3rem);
        border-bottom: 1px solid var(--border);
        background: color-mix(in srgb, var(--primary) 9%, var(--background));
        font-size: 0.88rem;
      }
      .membership-banner span {
        opacity: 0.8;
      }
      main {
        width: min(100% - 2rem, 90rem);
        margin: 0 auto;
        padding: clamp(1rem, 3vw, 2.5rem) 0 4rem;
      }
      .feature-panel {
        max-width: 50rem;
        margin: 3rem auto;
        padding: clamp(1.25rem, 4vw, 2.5rem);
        border: 1px solid var(--border);
        border-radius: 1rem;
        background: var(--surface);
        box-shadow: 0 0.75rem 2rem
          color-mix(in srgb, var(--foreground) 8%, transparent);
      }
      .feature-panel--error {
        border-color: color-mix(in srgb, var(--error) 50%, var(--border));
      }
      .panel-eyebrow {
        margin: 0;
        color: var(--primary);
        font-size: 0.76rem;
        font-weight: 850;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .feature-panel h1 {
        margin: 0.45rem 0 0.8rem;
        font-size: clamp(1.5rem, 4vw, 2.4rem);
      }
      .panel-action {
        display: inline-flex;
        margin-top: 0.8rem;
        min-height: 2.65rem;
        align-items: center;
        padding: 0.55rem 0.9rem;
        border-radius: 0.45rem;
        font: inherit;
        font-weight: 750;
        text-decoration: none;
        cursor: pointer;
      }
      :where(a, button):focus-visible {
        outline: 3px solid var(--focus-ring, var(--primary));
        outline-offset: 3px;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
      }
      @media (max-width: 48rem) {
        .published-header {
          flex-wrap: wrap;
        }
        .nav-toggle {
          display: inline-flex;
          margin-left: auto;
        }
        nav {
          display: none;
          order: 4;
          flex-basis: 100%;
          flex-direction: column;
          align-items: stretch;
          padding-top: 0.65rem;
        }
        nav.nav-drawer-open {
          display: flex;
        }
        nav a {
          width: 100%;
        }
        .header-actions {
          order: 3;
          margin-left: auto;
        }
        .header-action {
          padding-inline: 0.5rem;
          font-size: 0.82rem;
        }
        .identity small {
          display: none;
        }
        .membership-banner {
          font-size: 0.8rem;
        }
      }
    `,
  ],
})
export class PublishedAppShellComponent implements OnChanges {
  @Input({ required: true }) config!: PublishedAppConfiguration;
  @Input() signedIn = false;
  @Input() activePath = '/';
  @Input() basePath = '';
  @Input() featureRegistry: readonly PublishedFeatureRegistryEntry[] = [];

  navOpen = false;
  featureState: FeatureState = 'idle';
  featureError = '';
  activeFeatureComponent: Type<unknown> | null = null;
  featureInputs: Record<string, unknown> = {};

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.navOpen) {
      this.navOpen = false;
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['activePath'] ||
      changes['config'] ||
      changes['featureRegistry']
    ) {
      void this.loadActiveFeature();
    }
  }

  get identityMark(): string {
    return this.config?.name?.trim().slice(0, 2).toUpperCase() || 'AP';
  }

  get navigationRoutes(): RouteConfig[] {
    const routes = this.config?.routes ?? [];
    return routes
      .filter((route) => route.showInNav && this.isPublishedRouteEnabled(route))
      .sort((a, b) => a.order - b.order);
  }

  get activeRoute(): RouteConfig | undefined {
    const active = pathForRoute(this.activePath);
    return (this.config?.routes ?? []).find(
      (route) => pathForRoute(route.path) === active
    );
  }

  get activeAccessRequired(): boolean {
    const route = this.activeRoute;
    if (!route) return false;
    const capabilityId = this.capabilityId(route);
    const manifestEntry = capabilityId
      ? this.config.manifest?.capabilities?.[capabilityId]
      : undefined;
    const catalogEntry = capabilityId
      ? getConfigurableCapability(capabilityId)
      : undefined;
    return Boolean(
      catalogEntry?.eligibility.authenticated ||
        (catalogEntry?.eligibility.requiredAppScopes?.length ?? 0) > 0 ||
        Boolean(manifestEntry?.settings?.['accessRequired'])
    );
  }

  get loginHref(): string {
    const returnPath = this.routeHref({
      id: 'active',
      path: this.activePath || '/',
      name: 'active',
      componentType: 'custom',
      order: 0,
      showInNav: false,
    });
    return `/login?returnTo=${encodeURIComponent(returnPath)}`;
  }

  isActive(route: RouteConfig): boolean {
    return pathForRoute(route.path) === pathForRoute(this.activePath);
  }

  routeHref(route: RouteConfig): string {
    const path = pathForRoute(route.path);
    const base = this.basePath.replace(/\/$/, '');
    return path === '/' ? base || '/' : `${base}${path}`;
  }

  async loadActiveFeature(): Promise<void> {
    this.activeFeatureComponent = null;
    this.featureInputs = {};
    this.featureError = '';
    const route = this.activeRoute;
    if (!route || pathForRoute(this.activePath) === '/') {
      this.featureState = 'idle';
      return;
    }

    if (this.activeAccessRequired) {
      this.featureState = 'access-required';
      return;
    }

    const capabilityId = this.capabilityId(route);
    const entry = this.featureRegistry.find(
      (candidate) =>
        candidate.capabilityId === capabilityId &&
        (!candidate.featureName || candidate.featureName === route.featureName)
    );
    if (!entry || !this.isPublishedRouteEnabled(route)) {
      this.featureState = 'unsupported';
      this.featureError =
        'The published route is not available in this client.';
      return;
    }

    this.featureState = 'loading';
    try {
      this.activeFeatureComponent = await entry.load();
      const context = this.featureContext(route);
      this.featureInputs = {
        publishedContext: context,
        ...(entry.inputs?.(context) ?? {}),
      };
      this.featureState = 'loaded';
    } catch {
      this.featureState = 'error';
      this.featureError =
        'The published feature could not be loaded. Your app is still available.';
    }
  }

  private capabilityId(route: RouteConfig): string | undefined {
    return route.featureName
      ? FEATURE_CAPABILITIES[route.featureName]
      : undefined;
  }

  private isPublishedRouteEnabled(route: RouteConfig): boolean {
    if (route.componentType === 'landing') return true;
    const featureName = route.featureName;
    const featureConfig = featureName
      ? (
          this.config?.features as
            | Record<string, { enabled?: boolean }>
            | undefined
        )?.[featureName]
      : undefined;
    if (!featureName || featureConfig?.enabled !== true) {
      return false;
    }
    const capabilityId = this.capabilityId(route);
    if (this.config?.manifest && capabilityId) {
      const capability = this.config.manifest.capabilities?.[capabilityId];
      const catalogEntry = getConfigurableCapability(capabilityId);
      const allowedPublicPlacement =
        capability?.placement === 'public-content' ||
        capability?.placement === 'public-navigation';
      return (
        capability?.enabled === true &&
        (!catalogEntry || allowedPublicPlacement)
      );
    }
    return true;
  }

  private featureContext(route: RouteConfig): PublishedFeatureContext {
    const capabilityId =
      this.capabilityId(route) ?? route.featureName ?? route.id;
    const capability = this.config.manifest?.capabilities?.[capabilityId];
    return {
      capabilityId,
      resourceRef: capability?.resourceRef
        ? { ...capability.resourceRef }
        : null,
      permissions: Object.freeze([
        ...new Set([
          ...(route.permissions ?? []),
          ...(capability?.permissions ?? []),
        ]),
      ]),
      access: this.activeAccessRequired ? 'access-required' : 'public',
      settings: Object.freeze({ ...(capability?.settings ?? {}) }),
      domain: this.config.domain?.trim() || null,
    };
  }
}
