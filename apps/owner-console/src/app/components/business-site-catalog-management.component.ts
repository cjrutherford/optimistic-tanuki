import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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

type CatalogMode = 'manual' | 'store';
const REQUIRED_PERMISSION = 'business-site.catalog.update';
const REQUIRED_SCOPE = 'business-site';

@Component({
  selector: 'app-business-site-catalog-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <h2>Store service products</h2>
          <p>
            These products determine what can safely power the public
            business-site offer section.
          </p>
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
            rgba(45, 212, 191, 0.09),
            transparent 28%
          ),
          linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.96),
            rgba(246, 248, 248, 0.92)
          );
        padding: 24px;
      }

      .hero-kicker {
        margin: 0 0 8px;
        color: #0f766e;
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
        margin-bottom: 16px;
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
        background: rgba(255, 255, 255, 0.92);
      }

      .mode-card {
        cursor: pointer;
      }

      .mode-card.is-selected {
        border-color: #0f766e;
        box-shadow: 0 0 0 1px rgba(15, 118, 110, 0.2);
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
        background: rgba(255, 255, 255, 0.92);
      }

      .storefront-toggle span {
        display: grid;
        gap: 6px;
      }

      .storefront-toggle small {
        color: #4b5563;
        line-height: 1.5;
      }

      .summary-label {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #4b5563;
      }

      .summary-card strong {
        font-size: 1.8rem;
        color: #0f172a;
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
        background: #0f766e;
        color: white;
      }

      .btn-secondary {
        background: rgba(15, 118, 110, 0.12);
        color: #115e59;
      }

      .status-msg {
        margin: 16px 0 0;
      }

      .status-msg.success {
        color: #0d6b2b;
      }

      .status-msg.error {
        color: #8b0000;
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
        color: #4b5563;
        font-size: 0.92rem;
      }

      .status-badge {
        width: fit-content;
        height: fit-content;
        border-radius: 999px;
        padding: 4px 10px;
        background: rgba(19, 125, 54, 0.14);
        color: #0d6b2b;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .status-badge.attention {
        background: rgba(196, 112, 0, 0.16);
        color: #8d4b00;
      }
    `,
  ],
})
export class BusinessSiteCatalogManagementComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly businessSiteAdminService = inject(BusinessSiteAdminService);
  private readonly rolesService = inject(RolesService);
  private readonly storeService = inject(StoreService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly canManageCatalog = signal(false);
  readonly accessMessage = signal('');
  readonly successMessage = signal('');
  readonly errorMessage = signal('');
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
    this.reload();
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
      const parsed = JSON.parse(decodedPayload) as { profileId?: string };
      return parsed.profileId ?? null;
    } catch {
      return null;
    }
  }
}
