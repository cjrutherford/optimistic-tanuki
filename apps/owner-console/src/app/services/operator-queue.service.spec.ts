import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AppConfigService } from './app-config.service';
import { BusinessSiteAdminService } from './business-site-admin.service';
import { ContactLeadsService } from './contact-leads.service';
import { ForumService } from './forum.service';
import {
  OperatorQueueItem,
  OperatorQueueService,
} from './operator-queue.service';
import { SocialGovernanceService } from './social-governance.service';
import { StoreService } from './store.service';

interface Fetchers {
  getAppointments: jest.Mock;
  getOrders: jest.Mock;
  getProducts: jest.Mock;
  getLeads: jest.Mock;
  getSocial: jest.Mock;
  getForum: jest.Mock;
  getConfigs: jest.Mock;
  getSiteConfig: jest.Mock;
}

describe('OperatorQueueService', () => {
  let f: Fetchers;
  let service: OperatorQueueService;

  beforeEach(() => {
    f = {
      getAppointments: jest.fn(() => of([])),
      getOrders: jest.fn(() => of([])),
      getProducts: jest.fn(() => of([])),
      getLeads: jest.fn(() => of([])),
      getSocial: jest.fn(() => of([])),
      getForum: jest.fn(() => of([])),
      getConfigs: jest.fn(() => of([])),
      getSiteConfig: jest.fn(() => of(null)),
    };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: StoreService,
          useValue: {
            getAppointments: f.getAppointments,
            getOrders: f.getOrders,
            getProducts: f.getProducts,
          },
        },
        { provide: ContactLeadsService, useValue: { getLeads: f.getLeads } },
        {
          provide: SocialGovernanceService,
          useValue: { getReports: f.getSocial },
        },
        { provide: ForumService, useValue: { getReports: f.getForum } },
        {
          provide: AppConfigService,
          useValue: { getConfigurations: f.getConfigs },
        },
        {
          provide: BusinessSiteAdminService,
          useValue: { getSiteConfig: f.getSiteConfig },
        },
      ],
    });
    service = TestBed.inject(OperatorQueueService);
  });

  const queue = (): OperatorQueueItem[] => {
    let items: OperatorQueueItem[] = [];
    service.getOperatorQueue().subscribe((r) => (items = r));
    return items;
  };

  it('is empty when every source answers and nothing waits', () => {
    expect(queue()).toEqual([]);
  });

  it('reports a failed source as unavailable, not as an empty queue', () => {
    f.getOrders.mockReturnValue(throwError(() => new Error('boom')));
    const items = queue();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'commerce-orders-unavailable',
      kind: 'source-unavailable',
      status: 'unavailable',
      domain: 'Commerce',
      route: '/dashboard/store/orders',
    });
    expect(items[0].detail).toContain('not an empty queue');
  });

  it('keeps reading the other sources when one fails', () => {
    f.getLeads.mockReturnValue(throwError(() => new Error('down')));
    f.getAppointments.mockReturnValue(
      of([{ status: 'pending', startTime: '2026-01-01T00:00:00Z' }])
    );
    const kinds = queue().map((i) => i.kind);
    expect(kinds).toContain('appointment-approval');
    expect(kinds).toContain('source-unavailable');
  });

  it('reports social and forum failures separately and flags a partial count', () => {
    f.getSocial.mockReturnValue(throwError(() => new Error('x')));
    f.getForum.mockReturnValue(
      of([{ status: 'pending', createdAt: '2026-01-01T00:00:00Z' }])
    );
    const items = queue();
    const ids = items.map((i) => i.id);
    expect(ids).toContain('community-social-reports-unavailable');
    expect(ids).not.toContain('community-forum-reports-unavailable');
    const moderation = items.find((i) => i.kind === 'moderation-review');
    expect(moderation?.detail).toContain('another source could not be read');
  });

  it('reports store products unavailable only when store mode needs them', () => {
    f.getProducts.mockReturnValue(throwError(() => new Error('x')));
    expect(queue()).toEqual([]);
    f.getSiteConfig.mockReturnValue(
      of({ config: { serviceCatalog: { source: 'store' } } })
    );
    expect(queue().map((i) => i.id)).toContain(
      'experience-business-site-products-unavailable'
    );
  });

  it('filters unavailable items by domain like any other item', () => {
    f.getLeads.mockReturnValue(throwError(() => new Error('x')));
    let crm: OperatorQueueItem[] = [];
    service.getQueueByDomain('CRM').subscribe((r) => (crm = r));
    expect(crm.map((i) => i.id)).toEqual(['crm-leads-unavailable']);
  });
});
