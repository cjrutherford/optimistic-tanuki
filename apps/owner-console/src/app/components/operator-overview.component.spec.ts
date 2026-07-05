import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { LeadStatus } from '@optimistic-tanuki/ui-models';
import { OperatorOverviewComponent } from './operator-overview.component';
import { AppConfigService } from '../services/app-config.service';
import { AppScopesService } from '../services/app-scopes.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import { CommunityService } from '../services/community.service';
import { ContactLeadsService } from '../services/contact-leads.service';
import { ForumService } from '../services/forum.service';
import { SocialGovernanceService } from '../services/social-governance.service';
import { StoreService } from '../services/store.service';
import { UsersService } from '../services/users.service';

describe('OperatorOverviewComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorOverviewComponent, RouterTestingModule],
      providers: [
        {
          provide: UsersService,
          useValue: { getProfiles: jest.fn().mockReturnValue(of([{}, {}])) },
        },
        {
          provide: AppScopesService,
          useValue: { getAppScopes: jest.fn().mockReturnValue(of([{}, {}])) },
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
          provide: CommunityService,
          useValue: {
            getCommunities: jest
              .fn()
              .mockReturnValue(of([{ id: 'community-1' }])),
            getCities: jest.fn().mockReturnValue(of([{ id: 'city-1' }])),
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
          provide: BusinessSiteAdminService,
          useValue: {
            getSiteConfig: jest.fn().mockReturnValue(
              of({
                configId: 'cfg-business-site',
                config: {
                  serviceCatalog: { source: 'store' },
                  features: { store: { enabled: true } },
                },
              })
            ),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders an overview-first operator queue with cross-domain work items', () => {
    const fixture = TestBed.createComponent(OperatorOverviewComponent);

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Operator Queue');
    expect(text).toContain('Appointments awaiting approval');
    expect(text).toContain('New leads need first response');
    expect(text).toContain('Business-site catalog readiness');
    expect(text).toContain('Moderation reports pending review');
  });
});
