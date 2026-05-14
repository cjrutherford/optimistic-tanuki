import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { OperationsWorkspaceComponent } from './operations-workspace.component';
import { UsersService } from '../services/users.service';
import { AppScopesService } from '../services/app-scopes.service';
import { AppConfigService } from '../services/app-config.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import { CommunityService } from '../services/community.service';
import { StoreService } from '../services/store.service';

describe('OperationsWorkspaceComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperationsWorkspaceComponent, RouterTestingModule],
      providers: [
        {
          provide: UsersService,
          useValue: { getProfiles: jest.fn().mockReturnValue(of([])) },
        },
        {
          provide: AppScopesService,
          useValue: { getAppScopes: jest.fn().mockReturnValue(of([])) },
        },
        {
          provide: AppConfigService,
          useValue: { getConfigurations: jest.fn().mockReturnValue(of([])) },
        },
        {
          provide: BusinessSiteAdminService,
          useValue: {
            getSiteConfig: jest.fn().mockReturnValue(
              of({
                configId: 'cfg-1',
                config: {
                  serviceCatalog: { source: 'store' },
                },
              })
            ),
          },
        },
        {
          provide: CommunityService,
          useValue: {
            getCommunities: jest.fn().mockReturnValue(of([])),
            getCities: jest.fn().mockReturnValue(of([])),
          },
        },
        {
          provide: StoreService,
          useValue: {
            getProducts: jest.fn().mockReturnValue(of([])),
            getOrders: jest.fn().mockReturnValue(of([])),
            getAppointments: jest.fn().mockReturnValue(of([])),
          },
        },
      ],
    }).compileComponents();
  });

  it('summarizes mutation coverage counts and exposes incomplete flows', () => {
    const fixture = TestBed.createComponent(OperationsWorkspaceComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.matrixStatusCards).toEqual([
      expect.objectContaining({
        label: 'Complete flows',
        count: 28,
        tone: 'complete',
      }),
      expect.objectContaining({
        label: 'Partial flows',
        count: 12,
        tone: 'partial',
      }),
      expect.objectContaining({
        label: 'Missing flows',
        count: 5,
        tone: 'missing',
      }),
    ]);

    expect(
      fixture.componentInstance.incompleteMatrixEntries.some(
        (entry) => entry.feature === 'Theme persistence'
      )
    ).toBe(true);
    expect(
      fixture.componentInstance.incompleteMatrixEntries.some(
        (entry) => entry.feature === 'Community manager appoint'
      )
    ).toBe(true);
  });

  it('surfaces the business-site catalog mode for central commerce auditing', () => {
    const fixture = TestBed.createComponent(OperationsWorkspaceComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.businessSiteCatalogStatus).toEqual(
      expect.objectContaining({
        mode: 'store',
        status: 'Healthy',
      })
    );
    expect(
      fixture.componentInstance.businessSiteCatalogStatus.detail
    ).toContain('Store-backed');
  });
});
