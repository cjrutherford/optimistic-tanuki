import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { BusinessSiteCatalogManagementComponent } from './business-site-catalog-management.component';
import { AuthService } from '../services/auth.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import { RolesService } from '../services/roles.service';
import { StoreService } from '../services/store.service';

describe('BusinessSiteCatalogManagementComponent', () => {
  const businessSiteAdminService = {
    getSiteConfig: jest.fn(),
    updateCatalogSource: jest.fn(),
  };

  const storeService = {
    getProducts: jest.fn(),
  };

  const authService = {
    getToken: jest.fn(),
  };

  const rolesService = {
    getUserRoles: jest.fn(),
  };

  function createToken(payload: Record<string, unknown>): string {
    const encoded = Buffer.from(JSON.stringify(payload))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    return `header.${encoded}.signature`;
  }

  function createComponent() {
    const fixture = TestBed.createComponent(
      BusinessSiteCatalogManagementComponent
    );
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    authService.getToken.mockReturnValue(
      createToken({ profileId: 'profile-1' })
    );
    rolesService.getUserRoles.mockReturnValue(
      of([
        {
          id: 'assignment-1',
          profileId: 'profile-1',
          roleId: 'role-1',
          appScopeId: 'scope-1',
          appScope: {
            id: 'scope-1',
            name: 'business-site',
            description: '',
            active: true,
          },
          role: {
            id: 'role-1',
            name: 'Catalog manager',
            description: '',
            permissions: [
              {
                id: 'perm-1',
                name: 'business-site.catalog.update',
                description: '',
              },
            ],
          },
        },
      ])
    );
    businessSiteAdminService.getSiteConfig.mockReturnValue(
      of({
        configId: 'cfg-1',
        config: {
          serviceCatalog: { source: 'manual' },
          services: [],
        },
      })
    );
    businessSiteAdminService.updateCatalogSource.mockReturnValue(
      of({ id: 'cfg-1' })
    );
    storeService.getProducts.mockReturnValue(
      of([
        {
          id: 'product-1',
          name: 'Service Sprint',
          description: 'Publish-ready service',
          price: 120,
          type: 'service',
          stock: 0,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'product-2',
          name: 'Broken Service',
          description: '',
          price: 0,
          type: 'service',
          stock: 0,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );

    await TestBed.configureTestingModule({
      imports: [BusinessSiteCatalogManagementComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: BusinessSiteAdminService,
          useValue: businessSiteAdminService,
        },
        { provide: RolesService, useValue: rolesService },
        { provide: StoreService, useValue: storeService },
      ],
    }).compileComponents();
  });

  it('derives readiness issues from active store service products', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(component.catalogMode()).toBe('manual');
    expect(component.serviceProducts().length).toBe(2);
    expect(component.readinessIssues()).toEqual([
      'Every store service product should have a public-facing description.',
      'Every store service product should have a price greater than zero.',
    ]);
  });

  it('persists a catalog source change when store products are publish-ready', () => {
    storeService.getProducts.mockReturnValue(
      of([
        {
          id: 'product-1',
          name: 'Service Sprint',
          description: 'Publish-ready service',
          price: 120,
          type: 'service',
          stock: 0,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );

    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.setCatalogMode('store');
    component.save();

    expect(businessSiteAdminService.updateCatalogSource).toHaveBeenCalledWith(
      'cfg-1',
      'store'
    );
    expect(component.successMessage()).toBe(
      'Business-site catalog mode updated.'
    );
  });

  it('blocks store mode when readiness issues remain', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.setCatalogMode('store');
    component.save();

    expect(businessSiteAdminService.updateCatalogSource).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain(
      'Resolve store service-product readiness issues'
    );
  });

  it('surfaces permission-denied errors from the catalog governance endpoint', () => {
    storeService.getProducts.mockReturnValue(
      of([
        {
          id: 'product-1',
          name: 'Service Sprint',
          description: 'Publish-ready service',
          price: 120,
          type: 'service',
          stock: 0,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );
    businessSiteAdminService.updateCatalogSource.mockReturnValue(
      throwError(() => ({
        error: {
          message:
            'Permission denied: business-site.catalog.update in app scope business-site',
        },
      }))
    );

    const fixture = createComponent();
    const component = fixture.componentInstance;
    component.setCatalogMode('store');
    component.save();

    expect(component.successMessage()).toBe('');
    expect(component.errorMessage()).toContain(
      'Permission denied: business-site.catalog.update in app scope business-site'
    );
  });

  it('renders the governance screen as read-only when the operator lacks catalog permission', () => {
    authService.getToken.mockReturnValue(
      createToken({ profileId: 'profile-2' })
    );
    rolesService.getUserRoles.mockReturnValue(
      of([
        {
          id: 'assignment-2',
          profileId: 'profile-2',
          roleId: 'role-2',
          appScopeId: 'scope-2',
          appScope: {
            id: 'scope-2',
            name: 'business-site',
            description: '',
            active: true,
          },
          role: {
            id: 'role-2',
            name: 'Viewer',
            description: '',
            permissions: [
              { id: 'perm-2', name: 'app-config.read', description: '' },
            ],
          },
        },
      ])
    );

    const fixture = createComponent();
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.canManageCatalog()).toBe(false);
    expect(component.accessMessage()).toContain('read-only');

    const saveButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.btn-primary');
    expect(saveButton.disabled).toBe(true);

    component.setCatalogMode('store');
    component.save();

    expect(businessSiteAdminService.updateCatalogSource).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('read-only');
  });

  it('accepts JWT payloads that need base64url padding before decoding', () => {
    authService.getToken.mockReturnValue(
      createToken({ profileId: 'profile-1', org: 'abcde' })
    );

    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(component.canManageCatalog()).toBe(true);
    expect(component.accessMessage()).toBe('');
  });
});
