import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { LeadStatus } from '@optimistic-tanuki/ui-models';
import { OperatorOverviewComponent } from './operator-overview.component';
import { AppConfigService } from '../services/app-config.service';
import { AppScopesService } from '../services/app-scopes.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import { CommunityService } from '../services/community.service';
import { ContactLeadsService } from '../services/contact-leads.service';
import { ForumService } from '../services/forum.service';
import { SocialGovernanceService } from '../services/social-governance.service';
import { OperatorQueueService } from '../services/operator-queue.service';
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
                  priceCents: 0,
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

  const tileFor = (root: HTMLElement, label: string): HTMLElement => {
    const tile = Array.from(
      root.querySelectorAll<HTMLElement>('.metric-card')
    ).find((card) => card.querySelector('h2')?.textContent?.trim() === label);
    if (!tile) throw new Error(`No tile labelled ${label}`);
    return tile;
  };

  it('shows a failed source as Unavailable with a retry, never as zero', () => {
    const store = TestBed.inject(StoreService) as unknown as {
      getOrders: jest.Mock;
    };
    store.getOrders.mockReturnValueOnce(throwError(() => new Error('down')));
    const fixture = TestBed.createComponent(OperatorOverviewComponent);

    fixture.detectChanges();

    const failed = tileFor(fixture.nativeElement, 'Commerce Surfaces');
    expect(failed.textContent).toContain('Unavailable');
    expect(failed.textContent).not.toMatch(/\b0 orders/);
    expect(failed.querySelector('button.retry')).not.toBeNull();

    const healthy = tileFor(fixture.nativeElement, 'Governed Profiles');
    expect(healthy.textContent).not.toContain('Unavailable');
    expect(healthy.querySelector('button.retry')).toBeNull();
  });

  it('retries only the failed tile sources', () => {
    const users = TestBed.inject(UsersService) as unknown as {
      getProfiles: jest.Mock;
    };
    const store = TestBed.inject(StoreService) as unknown as {
      getOrders: jest.Mock;
      getProducts: jest.Mock;
    };
    store.getOrders.mockReturnValueOnce(throwError(() => new Error('down')));
    const fixture = TestBed.createComponent(OperatorOverviewComponent);
    fixture.detectChanges();
    const usersBefore = users.getProfiles.mock.calls.length;
    const productsBefore = store.getProducts.mock.calls.length;
    const ordersBefore = store.getOrders.mock.calls.length;

    tileFor(fixture.nativeElement, 'Commerce Surfaces')
      .querySelector<HTMLButtonElement>('button.retry')
      ?.click();
    fixture.detectChanges();

    const recovered = tileFor(fixture.nativeElement, 'Commerce Surfaces');
    expect(recovered.textContent).not.toContain('Unavailable');
    expect(recovered.textContent).toContain('1 orders');
    expect(store.getOrders.mock.calls.length).toBe(ordersBefore + 1);
    expect(store.getProducts.mock.calls.length).toBe(productsBefore);
    expect(users.getProfiles.mock.calls.length).toBe(usersBefore);
  });

  it('shows an unavailable state with retry when the operator queue fails', () => {
    const fixture = TestBed.createComponent(OperatorOverviewComponent);
    const queue = fixture.debugElement.injector.get(OperatorQueueService);
    jest
      .spyOn(queue, 'getOverviewQueue')
      .mockReturnValueOnce(throwError(() => new Error('down')));

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('The work queue could not be loaded');
    expect(text).not.toContain('Appointments awaiting approval');

    fixture.nativeElement.querySelector('.queue-error button.retry').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'Appointments awaiting approval'
    );
  });
});
