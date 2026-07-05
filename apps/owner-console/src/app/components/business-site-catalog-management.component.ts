import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  BusinessSiteConfig,
  BusinessStoreProduct,
  DEFAULT_BUSINESS_SITE_CONFIG,
  mergeBusinessSiteConfig,
} from '@optimistic-tanuki/business-data-access';
import { UserRoleDto } from '@optimistic-tanuki/ui-models';
import { AuthService } from '../services/auth.service';
import { RolesService } from '../services/roles.service';
import { StoreService } from '../services/store.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import { OperatorQueuePanelComponent } from './operator-queue-panel.component';
import {
  OperatorQueueItem,
  OperatorQueueService,
} from '../services/operator-queue.service';
import { CommerceWorkspaceNavComponent } from './commerce-workspace-nav.component';

type CatalogMode = 'manual' | 'store';
const REQUIRED_PERMISSION = 'business-site.catalog.update';
const REQUIRED_SCOPE = 'business-site';

@Component({
  selector: 'app-business-site-catalog-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    OperatorQueuePanelComponent,
    CommerceWorkspaceNavComponent,
  ],
  template: `
    <section class="catalog-page">
      <header class="hero">
        <p class="hero-kicker">Commerce Governance</p>
        <h1>Business-site catalog source</h1>
        <p>
          Control whether the public business site uses manual offers or the
          store service catalog, and validate the service products before
          switching modes.
        </p>
      </header>

      <app-operator-queue-panel
        [items]="queueItems()"
        heading="Experience Queue"
        description="Experience readiness work prioritized from the shared operator queue."
        emptyStateCopy="No experience queue items are currently prioritized."
      ></app-operator-queue-panel>

      <app-commerce-workspace-nav></app-commerce-workspace-nav>

      <section class="panel">
        <div class="panel-heading">
          <h2>Catalog mode</h2>
          <p>
            Store mode requires active service products with publish-ready
            pricing and descriptions.
          </p>
        </div>

        <div class="mode-grid">
          <label
            class="mode-card"
            [class.is-selected]="catalogMode() === 'manual'"
          >
            <input
              type="radio"
              name="catalogMode"
              [ngModel]="catalogMode()"
              value="manual"
              (ngModelChange)="setCatalogMode('manual')"
              [disabled]="!canManageCatalog()"
            />
            <strong>Manual</strong>
            <span
              >Business-site offers come from the business-site
              configuration.</span
            >
          </label>

          <label
            class="mode-card"
            [class.is-selected]="catalogMode() === 'store'"
          >
            <input
              type="radio"
              name="catalogMode"
              [ngModel]="catalogMode()"
              value="store"
              (ngModelChange)="setCatalogMode('store')"
              [disabled]="!canManageCatalog()"
            />
            <strong>Store</strong>
            <span
              >Public offers are sourced from active store products with type
              <code>service</code>.</span
            >
          </label>
        </div>

        <label class="storefront-toggle">
          <span>
            <strong>Storefront feature</strong>
            <small
              >Explicitly control whether the public business site and page
              editor expose storefront rendering.</small
            >
          </span>
          <input
            type="checkbox"
            [checked]="businessSiteConfig().features.store.enabled"
            (change)="setStorefrontEnabled($any($event.target).checked)"
            [disabled]="!canManageCatalog()"
          />
        </label>

        @if (accessMessage()) {
        <p class="status-msg">{{ accessMessage() }}</p>
        }

        <div class="status-row">
          <div class="summary-card">
            <span class="summary-label">Service products</span>
            <strong>{{ serviceProducts().length }}</strong>
          </div>
          <div class="summary-card">
            <span class="summary-label">Ready for publish</span>
            <strong>{{ publishReadyProducts().length }}</strong>
          </div>
          <div class="summary-card">
            <span class="summary-label">Catalog status</span>
            <strong>{{ readinessStatus() }}</strong>
          </div>
        </div>

        @if (readinessIssues().length > 0) {
        <div class="issues-card">
          <h3>Readiness issues</h3>
          <ul>
            @for (issue of readinessIssues(); track issue) {
            <li>{{ issue }}</li>
            }
          </ul>
        </div>
        } @if (successMessage()) {
        <p class="status-msg success">{{ successMessage() }}</p>
        } @if (errorMessage()) {
        <p class="status-msg error">{{ errorMessage() }}</p>
        }

        <div class="actions">
          <button
            class="btn btn-secondary"
            type="button"
            (click)="reload()"
            [disabled]="loading()"
          >
            Refresh
          </button>
          <button
            class="btn btn-primary"
            type="button"
            (click)="save()"
            [disabled]="
              saving() ||
              !canManageCatalog() ||
              (catalogMode() === 'store' && readinessIssues().length > 0)
            "
          >
            {{ saving() ? 'Saving…' : 'Save Catalog Mode' }}
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>Store service products</h2>
            <p>
              These products determine what can safely power the public
              business-site offer section.
            </p>
          </div>
          <a
            routerLink="/dashboard/store/products"
            class="manage-products-link"
          >
            Manage Store Service Products
          </a>
        </div>

        <div class="service-list">
          @for (product of serviceProducts(); track product.id) {
          <article class="service-card">
            <div class="service-header">
              <div>
                <h3>{{ product.name }}</h3>
                <p>{{ product.description || 'No description provided.' }}</p>
              </div>
              <span
                class="status-badge"
                [class.attention]="!isPublishReady(product)"
              >
                {{ isPublishReady(product) ? 'Ready' : 'Attention' }}
              </span>
            </div>
            <div class="service-meta">
              <span>Price: {{ product.price | currency }}</span>
              <span>Status: {{ product.active ? 'Active' : 'Inactive' }}</span>
              <span>Type: {{ product.type }}</span>
            </div>
          </article>
          } @empty {
          <p class="status-msg">
            No store service products are currently available.
          </p>
          }
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .catalog-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .panel {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--accent, #2563eb) 10%, transparent),
            transparent 28%
          ),
          linear-gradient(
            180deg,
            color-mix(
              in srgb,
              var(--surface, #ffffff) 96%,
              var(--background, #f3f4f6)
            ),
            color-mix(
              in srgb,
              var(--surface, #ffffff) 90%,
              var(--background, #f3f4f6)
            )
          );
        padding: 24px;
        color: var(--foreground, #111827);
      }

      .hero-kicker {
        margin: 0 0 8px;
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground, #111827)
        );
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .hero h1,
      .panel-heading h2,
      .service-header h3 {
        margin: 0;
      }

      .hero p,
      .panel-heading p,
      .service-header p {
        margin: 12px 0 0;
        line-height: 1.6;
      }

      .panel-heading {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 16px;
        margin-bottom: 16px;
      }

      .manage-products-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 999px;
        border: 1px solid
          color-mix(
            in srgb,
            var(--accent, #2563eb) 24%,
            var(--border-color, #d6d6d6)
          );
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f3f4f6)
        );
        color: var(--foreground, #111827);
        text-decoration: none;
        font-weight: 700;
      }

      .mode-grid,
      .status-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .mode-card,
      .summary-card,
      .issues-card,
      .service-card {
        display: grid;
        gap: 10px;
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f3f4f6)
        );
      }

      .mode-card {
        cursor: pointer;
      }

      .mode-card.is-selected {
        border-color: color-mix(
          in srgb,
          var(--accent, #2563eb) 48%,
          transparent
        );
        box-shadow: 0 0 0 1px
          color-mix(in srgb, var(--accent, #2563eb) 20%, transparent);
      }

      .mode-card input {
        margin: 0;
      }

      .storefront-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin: 18px 0;
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f3f4f6)
        );
      }

      .storefront-toggle span {
        display: grid;
        gap: 6px;
      }

      .storefront-toggle small {
        color: color-mix(in srgb, var(--foreground, #111827) 68%, transparent);
        line-height: 1.5;
      }

      .summary-label {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: color-mix(in srgb, var(--foreground, #111827) 68%, transparent);
      }

      .summary-card strong {
        font-size: 1.8rem;
        color: var(--foreground, #111827);
      }

      .issues-card ul {
        margin: 0;
        padding-left: 20px;
      }

      .actions {
        display: flex;
        gap: 12px;
        margin-top: 16px;
      }

      .btn {
        border: none;
        border-radius: 999px;
        padding: 10px 18px;
        font-weight: 700;
        cursor: pointer;
      }

      .btn:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }

      .btn-primary {
        background: var(--accent, #2563eb);
        color: var(--on-primary, var(--primary-foreground, #ffffff));
      }

      .btn-secondary {
        background: color-mix(
          in srgb,
          var(--accent, #2563eb) 12%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground, #111827)
        );
      }

      .status-msg {
        margin: 16px 0 0;
      }

      .status-msg.success {
        color: color-mix(
          in srgb,
          var(--success, #15803d) 82%,
          var(--foreground, #111827)
        );
      }

      .status-msg.error {
        color: color-mix(
          in srgb,
          var(--danger, #b91c1c) 82%,
          var(--foreground, #111827)
        );
      }

      .service-list {
        display: grid;
        gap: 16px;
      }

      .service-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      .service-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        color: color-mix(in srgb, var(--foreground, #111827) 68%, transparent);
        font-size: 0.92rem;
      }

      .status-badge {
        width: fit-content;
        height: fit-content;
        border-radius: 999px;
        padding: 4px 10px;
        background: color-mix(
          in srgb,
          var(--success, #15803d) 14%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--success, #15803d) 82%,
          var(--foreground, #111827)
        );
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .status-badge.attention {
        background: color-mix(
          in srgb,
          var(--warning, #b45309) 16%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--warning, #b45309) 82%,
          var(--foreground, #111827)
        );
      }
    `,
  ],
})
export class BusinessSiteCatalogManagementComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly businessSiteAdminService = inject(BusinessSiteAdminService);
  private readonly rolesService = inject(RolesService);
  private readonly storeService = inject(StoreService);
  private readonly operatorQueueService = inject(OperatorQueueService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly canManageCatalog = signal(false);
  readonly accessMessage = signal('');
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
  readonly queueItems = signal<OperatorQueueItem[]>([]);
  readonly serviceProducts = signal<BusinessStoreProduct[]>([]);
  readonly businessSiteConfig = signal<BusinessSiteConfig>(
    mergeBusinessSiteConfig(DEFAULT_BUSINESS_SITE_CONFIG)
  );

  private configId: string | null = null;

  readonly catalogMode = computed<CatalogMode>(
    () => this.businessSiteConfig().serviceCatalog.source
  );

  readonly publishReadyProducts = computed(() =>
    this.serviceProducts().filter((product) => this.isPublishReady(product))
  );

  readonly readinessIssues = computed(() => {
    const issues: string[] = [];
    const serviceProducts = this.serviceProducts();

    if (!serviceProducts.length) {
      issues.push(
        'At least one active store service product is required for store mode.'
      );
    }

    if (serviceProducts.some((product) => !product.description?.trim())) {
      issues.push(
        'Every store service product should have a public-facing description.'
      );
    }

    if (serviceProducts.some((product) => Number(product.price) <= 0)) {
      issues.push(
        'Every store service product should have a price greater than zero.'
      );
    }

    return issues;
  });

  readonly readinessStatus = computed(() =>
    this.readinessIssues().length === 0 ? 'Ready' : 'Attention'
  );

  ngOnInit(): void {
    this.loadCatalogAccess();
    this.loadQueue();
    this.reload();
  }

  loadQueue(): void {
    this.operatorQueueService.getQueueByDomain('Experience').subscribe({
      next: (items) => this.queueItems.set(items),
      error: () => this.queueItems.set([]),
    });
  }

  reload(): void {
    this.loading.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.businessSiteAdminService.getSiteConfig().subscribe({
      next: (siteConfigResponse) => {
        this.configId = siteConfigResponse.configId;
        this.businessSiteConfig.set(
          mergeBusinessSiteConfig(
            siteConfigResponse.config ?? DEFAULT_BUSINESS_SITE_CONFIG
          )
        );

        this.storeService.getProducts().subscribe({
          next: (products) => {
            this.serviceProducts.set(
              products.filter(
                (product) => product.type === 'service' && product.active
              ) as BusinessStoreProduct[]
            );
            this.loading.set(false);
          },
          error: (error) => {
            this.errorMessage.set(
              error?.error?.message ||
                error?.message ||
                'Failed to load store service products.'
            );
            this.loading.set(false);
          },
        });
      },
      error: (error) => {
        this.errorMessage.set(
          error?.error?.message ||
            error?.message ||
            'Failed to load business-site catalog settings.'
        );
        this.loading.set(false);
      },
    });
  }

  setCatalogMode(mode: CatalogMode): void {
    if (!this.canManageCatalog()) {
      return;
    }

    this.businessSiteConfig.update((config) => ({
      ...config,
      serviceCatalog: {
        ...config.serviceCatalog,
        source: mode,
      },
    }));
  }

  setStorefrontEnabled(enabled: boolean): void {
    if (!this.canManageCatalog()) {
      return;
    }

    this.businessSiteConfig.update((config) => ({
      ...config,
      features: {
        ...config.features,
        store: { enabled },
      },
    }));
  }

  isPublishReady(product: BusinessStoreProduct): boolean {
    return !!product.description?.trim() && Number(product.price) > 0;
  }

  save(): void {
    if (!this.canManageCatalog()) {
      this.errorMessage.set(
        'This catalog governance screen is read-only for the current operator.'
      );
      return;
    }

    const config = this.businessSiteConfig();
    if (
      config.serviceCatalog.source === 'store' &&
      this.readinessIssues().length > 0
    ) {
      this.errorMessage.set(
        'Resolve store service-product readiness issues before enabling store mode.'
      );
      return;
    }

    this.saving.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    this.businessSiteAdminService
      .updateCommerceSettings(this.configId, {
        source: config.serviceCatalog.source,
        storeEnabled: config.features.store.enabled,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Business-site catalog mode updated.');
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(
            error?.error?.message ||
              error?.message ||
              'Failed to update business-site catalog mode.'
          );
        },
      });
  }

  private loadCatalogAccess(): void {
    const profileId = this.getProfileIdFromToken();
    if (!profileId) {
      this.canManageCatalog.set(false);
      this.accessMessage.set(
        'This catalog governance screen is read-only because the operator profile could not be determined from the auth token.'
      );
      return;
    }

    this.rolesService.getUserRoles(profileId).subscribe({
      next: (assignments) => {
        const canManage = this.hasCatalogPermission(assignments);
        this.canManageCatalog.set(canManage);
        this.accessMessage.set(
          canManage
            ? ''
            : 'This catalog governance screen is read-only because the current operator lacks business-site catalog update permission.'
        );
      },
      error: () => {
        this.canManageCatalog.set(false);
        this.accessMessage.set(
          'This catalog governance screen is read-only because operator permissions could not be verified.'
        );
      },
    });
  }

  private hasCatalogPermission(
    assignments: UserRoleDto[] | null | undefined
  ): boolean {
    if (!Array.isArray(assignments)) {
      return false;
    }

    return assignments.some((assignment) => {
      if (assignment.appScope?.name !== REQUIRED_SCOPE) {
        return false;
      }

      return (
        assignment.role?.permissions?.some(
          (permission) => permission.name === REQUIRED_PERMISSION
        ) ?? false
      );
    });
  }

  private getProfileIdFromToken(): string | null {
    const token = this.authService.getToken();
    if (!token) {
      return null;
    }

    const [, payload] = token.split('.');
    if (!payload || typeof atob !== 'function') {
      return null;
    }

    try {
      const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padding = normalizedPayload.length % 4;
      const paddedPayload =
        padding === 0
          ? normalizedPayload
          : `${normalizedPayload}${'='.repeat(4 - padding)}`;
      const decodedPayload = atob(paddedPayload);
      const parsed = JSON.parse(decodedPayload) as {
        profileId?: string;
        userId?: string;
      };
      return parsed.profileId ?? parsed.userId ?? null;
    } catch {
      return null;
    }
  }
}
