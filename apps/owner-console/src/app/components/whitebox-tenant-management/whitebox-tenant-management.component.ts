import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  WhiteboxBrandConfigService,
  WhiteboxBrandProfile,
  WhiteboxServiceOffering,
  WhiteboxVertical,
  WhiteboxHardwareTier,
} from '@optimistic-tanuki/whitebox-brand-config';
import { BusinessSiteAdminService } from '../../services/business-site-admin.service';

@Component({
  selector: 'app-whitebox-tenant-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './whitebox-tenant-management.component.html',
  styleUrl: './whitebox-tenant-management.component.scss',
})
export class WhiteboxTenantManagementComponent implements OnInit {
  private readonly brandConfig = inject(WhiteboxBrandConfigService);
  private readonly adminService = inject(BusinessSiteAdminService);

  readonly selectedVertical = signal<string>('all');
  readonly selectedTenant = signal<WhiteboxBrandProfile | null>(null);
  readonly statusMessage = signal<string | null>(null);
  readonly isSaving = signal<boolean>(false);

  readonly allTenants = computed(() => this.brandConfig.availableProfiles());

  readonly filteredTenants = computed(() => {
    const vertical = this.selectedVertical();
    const list = this.allTenants();
    if (vertical === 'all') {
      return list;
    }
    return list.filter((t) => t.vertical === vertical);
  });

  ngOnInit(): void {
    const list = this.allTenants();
    if (list.length > 0) {
      this.selectedTenant.set(JSON.parse(JSON.stringify(list[0])));
    }
  }

  selectVertical(vertical: string): void {
    this.selectedVertical.set(vertical);
    const filtered = this.filteredTenants();
    if (filtered.length > 0) {
      this.selectedTenant.set(JSON.parse(JSON.stringify(filtered[0])));
    } else {
      this.selectedTenant.set(null);
    }
  }

  selectTenant(tenant: WhiteboxBrandProfile): void {
    this.selectedTenant.set(JSON.parse(JSON.stringify(tenant)));
    this.statusMessage.set(null);
  }

  addService(): void {
    const tenant = this.selectedTenant();
    if (!tenant) return;

    const newService: WhiteboxServiceOffering = {
      id: `svc_${Date.now()}`,
      name: 'New Trade Service',
      description: 'Standard service description and scope.',
      basePrice: 150,
      durationHours: 2,
      features: ['Standard service delivery', 'Inspection report'],
    };

    tenant.services = [...(tenant.services || []), newService];
    this.selectedTenant.set({ ...tenant });
  }

  removeService(serviceId: string): void {
    const tenant = this.selectedTenant();
    if (!tenant || !tenant.services) return;

    tenant.services = tenant.services.filter((s) => s.id !== serviceId);
    this.selectedTenant.set({ ...tenant });
  }

  saveTenant(): void {
    const tenant = this.selectedTenant();
    if (!tenant) return;

    this.isSaving.set(true);
    this.statusMessage.set(null);

    // Update in shared brand config service
    this.brandConfig.updateProfile(tenant);

    // Save to gateway store microservice
    const siteConfigPayload = {
      businessType: tenant.tradeCategory,
      site: {
        slug: tenant.id,
        status: 'published',
      },
      brand: {
        businessName: tenant.businessName,
        tagline: `${tenant.tradeCategory} for ${tenant.serviceArea}`,
      },
      contact: {
        phone: tenant.phone,
        email: tenant.email,
        location: tenant.serviceArea,
      },
      services: (tenant.services || []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        price: s.basePrice,
      })),
      features: {
        booking: { enabled: true, allowOnlinePayment: true },
      },
    };

    this.adminService
      .updateSiteConfig(null, siteConfigPayload, tenant.id)
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.statusMessage.set(
            `Successfully saved configuration for ${tenant.businessName}.`
          );
        },
        error: () => {
          // Graceful fallback for offline / test environments
          this.isSaving.set(false);
          this.statusMessage.set(
            `Configuration updated locally for ${tenant.businessName}.`
          );
        },
      });
  }

  activateTenantBrand(tenant: WhiteboxBrandProfile): void {
    this.brandConfig.setBrandProfile(tenant.id);
    this.statusMessage.set(
      `Switched active platform brand to ${tenant.businessName}.`
    );
  }
}
