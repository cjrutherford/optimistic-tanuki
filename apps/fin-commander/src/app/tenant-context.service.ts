import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  FinanceAccountType,
  FinanceService,
  FinanceTenant,
} from '@optimistic-tanuki/finance-ui';
import { FinCommanderPlanStore } from '@optimistic-tanuki/fin-commander-data-access';
import { ProfileContext } from './profile.context';

@Injectable({
  providedIn: 'root',
})
export class TenantContextService {
  private static readonly activeTenantStorageKey =
    'fin-commander-active-tenant-id';
  private readonly financeService = inject(FinanceService);
  private readonly profileContext = inject(ProfileContext);
  private readonly planStore = inject(FinCommanderPlanStore);
  private loadVersion = 0;

  readonly activeTenant = signal<FinanceTenant | null>(null);
  readonly availableTenants = signal<FinanceTenant[]>([]);
  readonly activeTenantId = computed(() => this.activeTenant()?.id ?? null);

  private isMissingCurrentTenantError(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 404;
  }

  constructor() {
    effect(() => {
      const isAuthenticated = this.profileContext.isAuthenticated();
      const profileId = this.profileContext.currentProfileId();

      if (!isAuthenticated || !profileId) {
        this.resetContext();
        return;
      }

      const loadVersion = ++this.loadVersion;
      this.activeTenant.set(null);
      this.availableTenants.set([]);
      this.planStore.setScope(null);

      void this.loadTenantContext(loadVersion).catch(() => {
        if (loadVersion !== this.loadVersion) {
          return;
        }

        this.resetContext();
      });
    });
  }

  async loadTenantContext(
    expectedLoadVersion = this.loadVersion,
  ): Promise<void> {
    const tenants = await this.financeService.getTenants();

    if (expectedLoadVersion !== this.loadVersion) {
      return;
    }

    if (tenants.length === 0) {
      this.availableTenants.set([]);
      this.activeTenant.set(null);
      this.planStore.setScope(null);
      return;
    }

    let tenant: FinanceTenant | null = null;
    try {
      tenant = await this.financeService.getCurrentTenant();
    } catch (error) {
      if (!this.isMissingCurrentTenantError(error)) {
        throw error;
      }
    }

    if (expectedLoadVersion !== this.loadVersion) {
      return;
    }

    this.availableTenants.set(tenants);
    this.activeTenant.set(this.resolveActiveTenant(tenants, tenant));

    const profileId = this.profileContext.currentProfileId();
    this.planStore.setScope(
      this.activeTenant() && profileId
        ? {
            tenantId: this.activeTenant()!.id,
            profileId,
          }
        : null,
    );
  }

  selectTenant(tenantId: string): void {
    const tenant =
      this.availableTenants().find((entry) => entry.id === tenantId) ?? null;

    if (!tenant) {
      return;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(
        TenantContextService.activeTenantStorageKey,
        tenant.id,
      );
    }
    this.activeTenant.set(tenant);

    const profileId = this.profileContext.currentProfileId();
    this.planStore.setScope(
      profileId
        ? {
            tenantId: tenant.id,
            profileId,
          }
        : null,
    );
  }

  async createTenant(input: {
    name: string;
    type?: FinanceAccountType;
  }): Promise<FinanceTenant> {
    const createdTenant = await this.financeService.createTenant(input);
    await this.loadTenantContext();
    this.selectTenant(createdTenant.id);
    return createdTenant;
  }

  private resolveActiveTenant(
    tenants: FinanceTenant[],
    fallbackTenant: FinanceTenant | null,
  ): FinanceTenant | null {
    const persistedId =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(TenantContextService.activeTenantStorageKey)
        : null;
    const persistedTenant =
      tenants.find((tenant) => tenant.id === persistedId) ?? null;
    const typedPersistedTenant =
      persistedTenant && persistedTenant.type ? persistedTenant : null;
    const typedFallbackTenant =
      fallbackTenant && fallbackTenant.type ? fallbackTenant : null;

    return (
      typedPersistedTenant ??
      typedFallbackTenant ??
      tenants.find((tenant) => tenant.type) ??
      persistedTenant ??
      fallbackTenant ??
      tenants[0] ??
      null
    );
  }

  private resetContext(): void {
    this.loadVersion += 1;
    this.activeTenant.set(null);
    this.availableTenants.set([]);
    this.planStore.setScope(null);
  }
}
