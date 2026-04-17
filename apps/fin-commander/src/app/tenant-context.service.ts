import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  FinanceService,
  FinanceTenant,
  FinanceTenantMember,
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
  readonly tenantMembers = signal<FinanceTenantMember[]>([]);
  readonly activeTenantId = computed(() => this.activeTenant()?.id ?? null);

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
      this.tenantMembers.set([]);
      this.planStore.setScope(null);

      void this.loadTenantContext(loadVersion);
    });
  }

  async loadTenantContext(
    expectedLoadVersion = this.loadVersion
  ): Promise<void> {
    const tenant = await this.financeService.getCurrentTenant();

    if (expectedLoadVersion !== this.loadVersion) {
      return;
    }

    const [tenants, members] = await Promise.all([
      this.financeService.getTenants(),
      this.financeService.getTenantMembers(),
    ]);

    if (expectedLoadVersion !== this.loadVersion) {
      return;
    }

    this.availableTenants.set(tenants);
    this.activeTenant.set(this.resolveActiveTenant(tenants, tenant));
    this.tenantMembers.set(members);

    const profileId = this.profileContext.currentProfileId();
    this.planStore.setScope(
      this.activeTenant() && profileId
        ? {
            tenantId: this.activeTenant()!.id,
            profileId,
          }
        : null
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
        tenant.id
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
        : null
    );

    void this.financeService
      .getTenantMembers()
      .then((members) => this.tenantMembers.set(members))
      .catch(() => undefined);
  }

  private resolveActiveTenant(
    tenants: FinanceTenant[],
    fallbackTenant: FinanceTenant | null
  ): FinanceTenant | null {
    const persistedId =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(TenantContextService.activeTenantStorageKey)
        : null;
    return (
      tenants.find((tenant) => tenant.id === persistedId) ??
      fallbackTenant ??
      tenants[0] ??
      null
    );
  }

  private resetContext(): void {
    this.loadVersion += 1;
    this.activeTenant.set(null);
    this.availableTenants.set([]);
    this.tenantMembers.set([]);
    this.planStore.setScope(null);
  }
}
