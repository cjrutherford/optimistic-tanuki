import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  AttentionService,
  OwnerAttentionItem,
  OwnerAttentionReport,
} from './attention.service';

const item = (over: Partial<OwnerAttentionItem>): OwnerAttentionItem => ({
  source: 'commerce.orders',
  label: 'Orders',
  count: 0,
  oldest: null,
  link: '/dashboard/store/orders',
  status: 'ok',
  ...over,
});

describe('AttentionService', () => {
  let service: AttentionService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AttentionService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const respond = (
    report: OwnerAttentionReport,
    configs: unknown[] | 'fail'
  ) => {
    http.expectOne('/api/owner/attention').flush(report);
    const req = http.expectOne('/api/app-config');
    if (configs === 'fail') {
      req.flush('nope', { status: 500, statusText: 'err' });
    } else {
      req.flush(configs);
    }
  };

  it('calls /api/owner/attention and adds draft configurations', () => {
    let result: OwnerAttentionReport | undefined;
    service.fetchAttention().subscribe((r) => (result = r));
    respond({ generatedAt: 't', items: [item({ count: 2 })] }, [
      { active: true },
      { active: false },
      { active: false },
    ]);
    expect(result?.items).toHaveLength(2);
    expect(result?.items[1]).toMatchObject({
      source: 'experience.configs',
      count: 2,
      status: 'ok',
    });
  });

  it('reports configurations it could not read as unavailable, not zero', () => {
    let result: OwnerAttentionReport | undefined;
    service.fetchAttention().subscribe((r) => (result = r));
    respond({ generatedAt: 't', items: [] }, 'fail');
    expect(result?.items[0]).toMatchObject({
      source: 'experience.configs',
      status: 'unavailable',
      count: null,
    });
  });

  it('load() moves through loading to ready and exposes badges', () => {
    service.load();
    expect(service.state()).toBe('loading');
    respond({ generatedAt: 't', items: [item({ count: 3 })] }, []);
    expect(service.state()).toBe('ready');
    expect(service.badges()['commerce.orders']).toMatchObject({
      kind: 'count',
      count: 3,
    });
  });

  it('load() records an error when the gateway fails', () => {
    service.load();
    http.expectOne('/api/app-config').flush([]);
    http
      .expectOne('/api/owner/attention')
      .flush('x', { status: 403, statusText: 'Forbidden' });
    expect(service.state()).toBe('error');
  });

  it('loads health from /api/owner/health', () => {
    service.loadHealth();
    http
      .expectOne('/api/owner/health')
      .flush([{ name: 'social', status: 'up', latencyMs: 3, checkedAt: 't' }]);
    expect(service.healthLoad()).toBe('ready');
    expect(service.health()).toHaveLength(1);
  });

  describe('badgesFor', () => {
    it('shows nothing for zero', () => {
      expect(service.badgesFor([item({ count: 0 })], null)).toEqual({});
    });

    it('shows "unavailable" for a failed read, never zero', () => {
      const badges = service.badgesFor(
        [item({ status: 'unavailable', count: null })],
        null
      );
      expect(badges['commerce.orders']).toMatchObject({
        kind: 'unavailable',
      });
    });

    it('sums towns, and narrows to the selected town', () => {
      const rows = [
        item({ source: 'directory.address', townId: 'a', count: 2 }),
        item({ source: 'directory.address', townId: 'b', count: 5 }),
      ];
      expect(service.badgesFor(rows, null)['directory.address']).toMatchObject({
        count: 7,
      });
      expect(service.badgesFor(rows, 'b')['directory.address']).toMatchObject({
        count: 5,
      });
    });

    it('marks a capped count as a lower bound', () => {
      const badge = service.badgesFor(
        [item({ count: 100, capped: true })],
        null
      )['commerce.orders'];
      expect(badge).toMatchObject({ kind: 'count', capped: true });
      expect(badge?.label).toContain('or more');
    });
  });
});
