import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { LeadStatus } from '@optimistic-tanuki/ui-models';
import { OperationsWorkspaceComponent } from './operations-workspace.component';
import { UsersService } from '../services/users.service';
import { AppScopesService } from '../services/app-scopes.service';
import { AppConfigService } from '../services/app-config.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import { CommunityService } from '../services/community.service';
import { ContactLeadsService } from '../services/contact-leads.service';
import { ForumService } from '../services/forum.service';
import { SocialGovernanceService } from '../services/social-governance.service';
import { StoreService } from '../services/store.service';
import { OWNER_CONSOLE_MUTATION_MATRIX } from '../owner-console-mutation-matrix';
import { ControlCenterService } from '../services/control-center.service';

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
          useValue: {
            getConfigurations: jest.fn().mockReturnValue(
              of([
                {
                  id: 'cfg-1',
                  name: 'storefront',
                  active: false,
                  landingPage: { sections: [], layout: 'single-column' },
                  routes: [],
                  features: {},
                },
              ])
            ),
          },
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
            getProducts: jest.fn().mockReturnValue(
              of([
                {
                  id: 'product-1',
                  type: 'service',
                  active: true,
                  description: '',
                  price: 0,
                },
              ])
            ),
            getOrders: jest.fn().mockReturnValue(
              of([
                {
                  id: 'order-1',
                  status: 'processing',
                  items: [],
                  createdAt: '2026-07-02T09:00:00.000Z',
                },
              ])
            ),
            getAppointments: jest.fn().mockReturnValue(
              of([
                {
                  id: 'appointment-1',
                  status: 'pending',
                  startTime: '2026-07-01T10:00:00.000Z',
                  endTime: '2026-07-01T11:00:00.000Z',
                },
              ])
            ),
          },
        },
        {
          provide: ContactLeadsService,
          useValue: {
            getLeads: jest.fn().mockReturnValue(
              of([
                {
                  id: 'lead-1',
                  name: 'Acme Co',
                  source: 'local',
                  status: LeadStatus.NEW,
                  value: 0,
                  notes: '',
                  isAutoDiscovered: false,
                  appScope: 'business-site',
                  createdAt: '2026-07-01T09:00:00.000Z',
                  updatedAt: '2026-07-01T09:00:00.000Z',
                },
              ])
            ),
          },
        },
        {
          provide: SocialGovernanceService,
          useValue: {
            getReports: jest.fn().mockReturnValue(
              of([
                {
                  id: 'social-report-1',
                  contentType: 'post',
                  contentId: 'post-1',
                  reason: 'spam',
                  reporterId: 'user-1',
                  status: 'pending',
                  createdAt: '2026-07-01T08:00:00.000Z',
                },
              ])
            ),
          },
        },
        {
          provide: ForumService,
          useValue: {
            getReports: jest.fn().mockReturnValue(
              of([
                {
                  id: 'forum-report-1',
                  contentType: 'thread',
                  contentId: 'thread-1',
                  reason: 'abuse',
                  reporterId: 'user-2',
                  status: 'pending',
                  createdAt: '2026-07-01T07:00:00.000Z',
                },
              ])
            ),
          },
        },
        {
          provide: ControlCenterService,
          useValue: {
            getDeploymentHealth: jest.fn().mockReturnValue(
              of({
                configStatus: 'current',
                infrastructure: 'compose-up',
                databaseReadiness: 'all-slots-ready',
                secretsHealth: 'all-keys-present',
              })
            ),
            getImages: jest.fn().mockReturnValue(of([])),
            getOAuthProviders: jest.fn().mockReturnValue(of({ providers: [] })),
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
        count: OWNER_CONSOLE_MUTATION_MATRIX.filter(
          (entry) => entry.status === 'complete'
        ).length,
        tone: 'complete',
      }),
      expect.objectContaining({
        label: 'Partial flows',
        count: OWNER_CONSOLE_MUTATION_MATRIX.filter(
          (entry) => entry.status === 'partial'
        ).length,
        tone: 'partial',
      }),
      expect.objectContaining({
        label: 'Missing flows',
        count: OWNER_CONSOLE_MUTATION_MATRIX.filter(
          (entry) => entry.status === 'missing'
        ).length,
        tone: 'missing',
      }),
    ]);

    expect(
      fixture.componentInstance.incompleteMatrixEntries.some(
        (entry) => entry.feature === 'Theme persistence'
      )
    ).toBe(false);
    expect(fixture.componentInstance.incompleteMatrixEntries).toHaveLength(
      OWNER_CONSOLE_MUTATION_MATRIX.filter(
        (entry) => entry.status !== 'complete'
      ).length
    );
    expect(fixture.componentInstance.matrixWorkspaceCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workspace: 'CRM',
          route: '/dashboard/crm',
          completionPercent: 100,
          status: 'Healthy',
        }),
        expect.objectContaining({
          workspace: 'Community Ops',
          route: '/dashboard/community-ops',
          completionPercent: 100,
          status: 'Healthy',
        }),
      ])
    );
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

  it('reuses the operator queue in operations with cross-domain action items', () => {
    const fixture = TestBed.createComponent(OperationsWorkspaceComponent);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Operator queue');
    expect(text).toContain('Appointments awaiting approval');
    expect(text).toContain('New leads need first response');
    expect(text).toContain('Moderation reports pending review');
    expect(text).toContain('Business-site catalog readiness');
  });

  it('includes crm in domain status monitoring', () => {
    const fixture = TestBed.createComponent(OperationsWorkspaceComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.statusCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'CRM pipeline',
          status: 'Healthy',
          route: '/dashboard/crm',
        }),
      ])
    );
  });

  it('surfaces slice progress and projected score impact for the roadmap', () => {
    const fixture = TestBed.createComponent(OperationsWorkspaceComponent);

    fixture.detectChanges();

    expect(fixture.componentInstance.sliceTrackerCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slice: '0',
          status: 'complete',
          primaryDomains: ['All'],
        }),
        expect.objectContaining({
          slice: '7',
          status: 'complete',
          primaryDomains: ['All'],
        }),
        expect.objectContaining({
          slice: '8',
          status: 'complete',
          primaryDomains: ['Governance'],
        }),
        expect.objectContaining({
          slice: '9',
          status: 'complete',
          primaryDomains: ['Experience'],
        }),
      ])
    );
    expect(fixture.componentInstance.projectedScoreImpactCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          domain: 'CRM',
          uxDelta: 0.2,
          completenessDelta: 0.7,
          practicalityDelta: 0.3,
        }),
        expect.objectContaining({
          domain: 'Community Ops',
          uxDelta: 0.1,
          completenessDelta: 0.2,
          practicalityDelta: 0.2,
        }),
      ])
    );

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Slice tracker');
    expect(text).toContain('Operational Confidence and Coverage Tracking');
    expect(text).toContain('Projected score impact');
    expect(text).toContain('CRM');
  });
});
