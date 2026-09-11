import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { normalizeAuthReturnTo } from '@optimistic-tanuki/auth-ui';
import type {
  AppConfiguration,
  PublishedAppConfiguration,
} from '@optimistic-tanuki/app-config-models';
import { Subscription } from 'rxjs';
import { ConfigurationService } from '../services/configuration.service';
import { AuthSessionService } from '../services/auth-session.service';
import { TenantThemeService } from '../services/tenant-theme.service';
import { LandingStatusComponent } from '@optimistic-tanuki/common-ui';
import { ConfigurableClientPublicLandingComponent } from './configurable-client-public-landing.component';

export function isLocalDevelopmentHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost')
  );
}

export type AppResolutionOutcome =
  | 'loading'
  | 'discovery'
  | 'authenticated-discovery'
  | 'resolved'
  | 'auth-required'
  | 'unknown'
  | 'unavailable'
  | 'misconfigured'
  | 'transient-failure';

export type RootMode = 'loading' | 'anonymous' | 'authenticated';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Guards the renderer boundary. The configurable landing renderer assumes
 * these containers exist, so malformed server data becomes a recoverable
 * outcome instead of a runtime template exception.
 */
export function isRenderableAppConfiguration(
  value: unknown
): value is AppConfiguration {
  if (!isRecord(value)) {
    return false;
  }

  const landingPage = value['landingPage'];
  return (
    typeof value['id'] === 'string' &&
    value['id'].trim().length > 0 &&
    typeof value['name'] === 'string' &&
    value['name'].trim().length > 0 &&
    typeof value['active'] === 'boolean' &&
    isRecord(landingPage) &&
    ['single-column', 'sidebar', 'wide'].includes(
      landingPage['layout'] as string
    ) &&
    Array.isArray(landingPage['sections']) &&
    Array.isArray(value['routes']) &&
    isRecord(value['features']) &&
    isRecord(value['theme'])
  );
}

export function isRenderablePublishedAppConfiguration(
  value: unknown
): value is PublishedAppConfiguration {
  return (
    isRenderableAppConfiguration(value) &&
    typeof (value as PublishedAppConfiguration).publishedVersion === 'number' &&
    Number.isInteger((value as PublishedAppConfiguration).publishedVersion) &&
    (value as PublishedAppConfiguration).publishedVersion > 0
  );
}

@Component({
  selector: 'app-resolver',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ConfigurableClientPublicLandingComponent,
    LandingStatusComponent,
  ],
  template: `
    @if (loading) {
    <otui-landing-status
      class="configurable-client-status"
      state="loading"
      headline="Finding a published experience"
      [body]="loadingMessage || 'Preparing the public doorway.'"
    />
    } @else if (error) {
    <otui-landing-status
      [attr.data-resolution-outcome]="outcome"
      state="error"
      [headline]="statusHeadline"
      [body]="statusBody"
    >
      @if (outcome === 'transient-failure') {
      <button
        slot="actions"
        class="status-action status-action--primary"
        type="button"
        (click)="retry()"
      >
        Try again
      </button>
      }
      <a slot="actions" class="status-action" href="/">Back to discovery</a>
      @if (showScopedDemoRecovery) {
      <a slot="actions" class="status-action" [href]="demoHref">
        Preview the demo
      </a>
      } @else if (outcome === 'misconfigured' || outcome === 'unavailable') {
      <a slot="actions" class="status-action" [href]="loginHref">
        Owner sign in
      </a>
      }
    </otui-landing-status>
    } @else if (publicRoot) {
    <app-configurable-client-public-landing
      [signedIn]="rootMode === 'authenticated'"
      [workspaceSlug]="workspaceSlug"
    />
    } @else {
    <router-outlet></router-outlet>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        --configurable-client-state-muted: var(
          --foreground,
          var(--ot-client-public-foreground)
        );
      }
      otui-landing-status.configurable-client-status {
        --muted-foreground: var(--configurable-client-state-muted);
      }
      .status-action {
        display: inline-flex;
        min-height: 2.75rem;
        align-items: center;
        justify-content: center;
        padding: 0.55rem 0.9rem;
        border: 1px solid var(--border);
        border-radius: 0.5rem;
        background: var(--surface);
        color: var(--foreground, var(--ot-client-public-foreground));
        font-weight: 750;
        text-decoration: none;
      }
      .status-action--primary {
        border-color: var(--primary, var(--ot-client-public-primary));
        background: var(--primary, var(--ot-client-public-primary));
        color: var(--primary-foreground, var(--ot-client-white));
        font: inherit;
        cursor: pointer;
      }
      .status-action:focus-visible {
        outline: 3px solid
          var(--focus-ring, var(--primary, var(--ot-client-public-primary)));
        outline-offset: 3px;
      }
    `,
  ],
})
export class AppResolverComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;
  loadingMessage = '';
  publicRoot = false;
  outcome: AppResolutionOutcome = 'loading';
  rootMode: RootMode | null = null;

  private retryHandler: (() => void) | null = null;
  private rootSessionSubscription: Subscription | null = null;
  private rootRestoreStarted = false;
  workspaceSlug: string | null = null;

  constructor(
    private readonly configService: ConfigurationService,
    private readonly tenantTheme: TenantThemeService,
    private readonly route: ActivatedRoute,
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly auth: AuthSessionService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      return;
    }

    void this.tenantTheme.applyDefaults();
    this.loadConfiguration();
  }

  ngOnDestroy(): void {
    this.rootSessionSubscription?.unsubscribe();
  }

  private loadConfiguration(): void {
    const routeSnapshot = this.route.snapshot;
    const appName = routeSnapshot.paramMap.get('appName');
    const configId = routeSnapshot.paramMap.get('configId');
    const workspaceSlug = routeSnapshot.queryParamMap.get('workspaceSlug');
    this.workspaceSlug = workspaceSlug;

    if (appName) {
      this.loadingMessage = `Loading app: ${appName}`;
      this.loadProtected(
        () =>
          this.configService.getConfigurationByName(
            appName,
            workspaceSlug ?? undefined
          ),
        `application configuration for "${appName}"`
      );
      return;
    }

    if (configId) {
      this.loadingMessage = `Loading configuration: ${configId}`;
      this.loadPublishedApp(configId);
      return;
    }

    const hostname = this.getHostname();
    if (!isLocalDevelopmentHost(hostname)) {
      this.loadingMessage = `Loading configuration for: ${hostname}`;
      this.loadByDomain(hostname);
      return;
    }

    const appNameQuery = routeSnapshot.queryParamMap.get('appName');
    if (appNameQuery) {
      this.loadingMessage = `Loading app: ${appNameQuery}`;
      this.loadProtected(
        () =>
          this.configService.getConfigurationByName(
            appNameQuery,
            workspaceSlug ?? undefined
          ),
        `application configuration for "${appNameQuery}"`
      );
      return;
    }

    this.resolveRoot();
  }

  private loadByDomain(domain: string): void {
    this.loading = true;
    this.error = null;
    this.publicRoot = false;
    this.rootMode = null;
    this.outcome = 'loading';
    this.configService.getConfigurationByDomain(domain).subscribe({
      next: (config) => this.applyPublicConfiguration(config),
      error: (err) => {
        const query = this.route.snapshot.queryParamMap;
        const appName = query.get('appName');
        if (err?.status === 404 && appName) {
          this.loadingMessage = `Loading app: ${appName}`;
          this.loadProtected(
            () =>
              this.configService.getConfigurationByName(
                appName,
                query.get('workspaceSlug') ?? undefined
              ),
            `application configuration for "${appName}"`
          );
          return;
        }
        if (err?.status === 404) {
          this.resolveRoot();
          return;
        }
        this.setFailure(
          'transient-failure',
          `We couldn't load the published experience right now. Try again.`,
          () => this.loadByDomain(domain)
        );
      },
    });
  }

  /** Shared app links are public only when the immutable release permits it. */
  private loadPublishedApp(id: string): void {
    this.loading = true;
    this.error = null;
    this.publicRoot = false;
    this.rootMode = null;
    this.outcome = 'loading';
    this.configService.getPublishedConfiguration(id).subscribe({
      next: (config) => this.applyPublicConfiguration(config),
      error: (err) => {
        if (err?.status === 404) {
          this.setFailure(
            'unknown',
            "We couldn't find a published experience at that link."
          );
          return;
        }
        this.setFailure(
          'transient-failure',
          "We couldn't load the published experience right now. Try again.",
          () => this.loadPublishedApp(id)
        );
      },
    });
  }

  private resolveRoot(): void {
    this.rootSessionSubscription?.unsubscribe();
    this.rootSessionSubscription = null;

    if (this.auth.status === 'loading') {
      this.loading = true;
      this.error = null;
      this.publicRoot = false;
      this.rootMode = 'loading';
      this.outcome = 'loading';
      this.rootSessionSubscription = this.auth.sessionState$.subscribe(
        (state) => {
          if (state.status === 'loading') {
            return;
          }
          this.showRoot(
            state.status === 'signed-in' ? 'authenticated' : 'anonymous'
          );
        }
      );
      if (!this.rootRestoreStarted) {
        this.rootRestoreStarted = true;
        void Promise.resolve(this.auth.restoreSession()).then(() => {
          if (this.loading && this.auth.status !== 'loading') {
            this.showRoot(
              this.auth.status === 'signed-in' ? 'authenticated' : 'anonymous'
            );
          }
        });
      }
      return;
    }

    this.showRoot(
      this.auth.status === 'signed-in' ? 'authenticated' : 'anonymous'
    );
  }

  private showRoot(mode: Exclude<RootMode, 'loading'>): void {
    this.error = null;
    this.publicRoot = true;
    this.loading = false;
    this.rootMode = mode;
    this.outcome =
      mode === 'authenticated' ? 'authenticated-discovery' : 'discovery';
    this.retryHandler = null;
  }

  private loadProtected(
    request: () => ReturnType<ConfigurationService['getConfiguration']>,
    description: string
  ): void {
    const load = (): void => {
      this.loading = true;
      this.error = null;
      this.publicRoot = false;
      this.rootMode = null;
      this.outcome = 'loading';

      if (this.auth.status !== 'signed-in') {
        this.redirectToLogin();
        return;
      }

      request().subscribe({
        next: (config) => this.applyProtectedConfiguration(config),
        error: (err) => {
          if (err?.status === 401) {
            this.auth.markExpired(this.safeReturnPath());
            this.redirectToLogin();
            return;
          }
          if (err?.status === 404) {
            this.setFailure(
              'unknown',
              `Failed to load ${description}. Configuration not found.`
            );
            return;
          }
          this.setFailure(
            err?.status === 403 || err?.status === 410
              ? 'unavailable'
              : 'transient-failure',
            err?.status === 403 || err?.status === 410
              ? `${description} is not currently available.`
              : `We couldn't load ${description} right now. Try again.`
          );
        },
      });
    };

    this.retryHandler = load;

    if (this.auth.status === 'loading') {
      void this.auth.restoreSession().then(() => load());
      return;
    }

    if (this.auth.status === 'signed-in') {
      load();
      return;
    }

    void this.auth.restoreSession().then(() => load());
  }

  retry(): void {
    this.retryHandler?.();
  }

  get statusHeadline(): string {
    switch (this.outcome) {
      case 'unknown':
        return "We couldn't find that experience";
      case 'misconfigured':
        return 'This experience needs setup';
      case 'unavailable':
        return "This experience isn't published";
      case 'transient-failure':
        return 'The doorway is taking a moment';
      default:
        return 'Configuration unavailable';
    }
  }

  get statusBody(): string {
    const message = this.error ?? 'Please return to discovery and try again.';
    switch (this.outcome) {
      case 'unknown':
        return `${message} Check the link or return to discovery.`;
      case 'misconfigured':
        return `${message} The owner can sign in to repair it.`;
      case 'unavailable':
        return `${message} Ask the owner for a current published link.`;
      case 'transient-failure':
        return `${message} Try again in a moment.`;
      default:
        return message;
    }
  }

  private getHostname(): string {
    return window.location.hostname;
  }

  private redirectToLogin(): void {
    this.loading = false;
    this.outcome = 'auth-required';
    this.router.navigate(['/login'], {
      queryParams: {
        returnTo: this.safeReturnPath(),
      },
    });
  }

  get loginHref(): string {
    const returnPath = this.safeReturnPath();
    return returnPath === '/'
      ? '/login'
      : `/login?returnTo=${encodeURIComponent(returnPath)}`;
  }

  get demoHref(): string {
    return `/app/demo-app?workspaceSlug=${encodeURIComponent(
      this.workspaceSlug ?? ''
    )}`;
  }

  get showScopedDemoRecovery(): boolean {
    return this.outcome === 'unknown' && this.workspaceSlug !== null;
  }

  private safeReturnPath(): string {
    const currentOrigin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'http://configurable-client.invalid';
    const returnTarget = normalizeAuthReturnTo(this.router.url, {
      currentOrigin,
    });
    return returnTarget?.isCurrentOrigin ? returnTarget.path : '/';
  }

  private applyPublicConfiguration(config: PublishedAppConfiguration): void {
    if (!isRenderablePublishedAppConfiguration(config)) {
      this.setFailure(
        'misconfigured',
        'This app has an invalid configuration and cannot be displayed.'
      );
      return;
    }
    this.applyRenderableConfiguration(config, false);
  }

  private applyProtectedConfiguration(config: AppConfiguration): void {
    if (!isRenderableAppConfiguration(config)) {
      this.setFailure(
        'misconfigured',
        'This app has an invalid configuration and cannot be displayed.'
      );
      return;
    }

    this.applyRenderableConfiguration(config, true);
  }

  private applyRenderableConfiguration(
    config: AppConfiguration,
    protectedConfiguration: boolean
  ): void {
    if (!config.active) {
      this.setFailure('unavailable', 'This app is not currently available.');
      return;
    }

    this.publicRoot = false;
    this.error = null;
    this.rootMode = null;
    if (protectedConfiguration) {
      this.configService.setProtectedConfiguration(config);
    } else {
      this.configService.setConfiguration(config as PublishedAppConfiguration);
    }
    void this.tenantTheme.apply(config.theme).then(
      () => {
        this.loading = false;
        this.outcome = 'resolved';
      },
      () => {
        this.setFailure(
          'transient-failure',
          'The app configuration could not be applied. Try again.'
        );
      }
    );
  }

  private setFailure(
    outcome: Exclude<
      AppResolutionOutcome,
      | 'loading'
      | 'discovery'
      | 'authenticated-discovery'
      | 'resolved'
      | 'auth-required'
    >,
    message: string,
    retryHandler?: () => void
  ): void {
    this.loading = false;
    this.publicRoot = false;
    this.rootMode = null;
    this.outcome = outcome;
    this.error = message;
    if (retryHandler) {
      this.retryHandler = retryHandler;
    }
  }
}
