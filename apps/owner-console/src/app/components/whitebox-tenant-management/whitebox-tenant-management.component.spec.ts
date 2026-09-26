import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { WhiteboxTenantManagementComponent } from './whitebox-tenant-management.component';
import { WhiteboxBrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';
import { BusinessSiteAdminService } from '../../services/business-site-admin.service';

describe('WhiteboxTenantManagementComponent', () => {
  let component: WhiteboxTenantManagementComponent;
  let fixture: ComponentFixture<WhiteboxTenantManagementComponent>;
  let brandConfig: WhiteboxBrandConfigService;
  let adminService: BusinessSiteAdminService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WhiteboxTenantManagementComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        WhiteboxBrandConfigService,
        BusinessSiteAdminService,
      ],
    }).compileComponents();

    brandConfig = TestBed.inject(WhiteboxBrandConfigService);
    adminService = TestBed.inject(BusinessSiteAdminService);

    fixture = TestBed.createComponent(WhiteboxTenantManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders tenant management page with registered tenants', () => {
    expect(component).toBeTruthy();
    expect(component.filteredTenants().length).toBeGreaterThan(0);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Tenant management');
    expect(element.textContent).toContain('Apex Mobile Detailing');
  });

  it('filters tenants by industry vertical', () => {
    component.selectVertical('cpa_tax');
    fixture.detectChanges();

    const filtered = component.filteredTenants();
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((t) => t.vertical === 'cpa_tax')).toBe(true);
    expect(component.selectedTenant()?.businessName).toContain('Tax');
  });

  it('allows adding and removing trade service offerings', () => {
    component.selectVertical('trade_field');
    fixture.detectChanges();

    const initialCount = component.selectedTenant()?.services?.length || 0;
    component.addService();
    expect(component.selectedTenant()?.services?.length).toBe(initialCount + 1);

    const added = component.selectedTenant()?.services?.slice(-1)[0];
    expect(added).toBeDefined();
    if (added) {
      component.removeService(added.id);
      expect(component.selectedTenant()?.services?.length).toBe(initialCount);
    }
  });

  it('saves tenant configuration to brand service and backend gateway', () => {
    const updateSpy = jest
      .spyOn(adminService, 'updateSiteConfig')
      .mockReturnValue(of({ success: true }));

    const tenant = component.selectedTenant();
    expect(tenant).toBeDefined();
    if (tenant) {
      tenant.fixedDeposit = 125;
      component.saveTenant();

      expect(updateSpy).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          site: expect.objectContaining({ slug: tenant.id }),
        }),
        tenant.id
      );
      expect(component.statusMessage()).toContain('Successfully saved');
    }
  });

  it('activates brand profile for global application preview', () => {
    const target = component
      .allTenants()
      .find((t) => t.id === 'summit-roofing');
    expect(target).toBeDefined();
    if (target) {
      component.activateTenantBrand(target);
      expect(brandConfig.currentBrand().id).toBe('summit-roofing');
      expect(component.statusMessage()).toContain('Summit Roofing');
    }
  });
});
