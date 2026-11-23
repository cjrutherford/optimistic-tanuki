import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { DirectoryAdminService } from './directory-admin.service';
import { ForumService } from './forum.service';
import {
  DIRECTORY_CONCURRENCY,
  ModerationItem,
  ModerationQueueService,
  TAKEDOWN_NOTICES_URL,
  actionsFor,
  filterModerationItems,
  sortModerationItems,
} from './moderation-queue.service';
import { SocialGovernanceService } from './social-governance.service';
import { TownContextService } from './town-context.service';

interface SocialStub {
  getReports: jest.Mock;
  updateReport: jest.Mock;
}
interface ForumStub {
  getReports: jest.Mock;
  updateReport: jest.Mock;
}
interface DirectoryStub {
  listListingReports: jest.Mock;
  actOnListingReport: jest.Mock;
}
interface TownsStub {
  towns: ReturnType<typeof signal<{ id: string; name: string }[]>>;
  status: ReturnType<typeof signal<string>>;
}

const social = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  reporterId: 'u',
  contentType: 'post',
  contentId: 'p9',
  reason: 'spam',
  description: 'Looks like an ad',
  status: 'pending',
  createdAt: '2026-11-01T10:00:00.000Z',
  ...over,
});
const forum = (over: Record<string, unknown> = {}) => ({
  id: 'f1',
  reporterId: 'u',
  contentType: 'thread',
  contentId: 't3',
  reason: 'abuse',
  status: 'pending',
  createdAt: '2026-11-02T10:00:00.000Z',
  ...over,
});
const listing = (over: Record<string, unknown> = {}) => ({
  reportId: 'r1',
  listingId: 'l1',
  listingName: 'Joe Plumbing',
  reasonCode: 'wrong-address',
  status: 'received',
  createdAt: '2026-11-03T10:00:00.000Z',
  ...over,
});
const notice = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  claimantName: 'Acme',
  work: 'Photo of the bridge',
  state: 'received',
  receivedAt: '2026-11-04T10:00:00.000Z',
  ...over,
});

describe('ModerationQueueService', () => {
  let service: ModerationQueueService;
  let http: HttpTestingController;
  let socialStub: SocialStub;
  let forumStub: ForumStub;
  let directoryStub: DirectoryStub;
  let townsStub: TownsStub;

  const answerNotices = (body: object) =>
    http.expectOne(TAKEDOWN_NOTICES_URL).flush(body);

  beforeEach(() => {
    socialStub = {
      getReports: jest.fn(() => of([social()])),
      updateReport: jest.fn(() => of({})),
    };
    forumStub = {
      getReports: jest.fn(() => of([forum()])),
      updateReport: jest.fn(() => of({})),
    };
    directoryStub = {
      listListingReports: jest.fn(() => of({ reports: [listing()] })),
      actOnListingReport: jest.fn(() => of({})),
    };
    townsStub = {
      towns: signal([
        { id: 't1', name: 'Aspen' },
        { id: 't2', name: 'Bayside' },
      ]),
      status: signal('ready'),
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: SocialGovernanceService, useValue: socialStub },
        { provide: ForumService, useValue: forumStub },
        { provide: DirectoryAdminService, useValue: directoryStub },
        {
          provide: TownContextService,
          useValue: {
            towns: townsStub.towns,
            status: townsStub.status,
            selectedId: signal(null),
          },
        },
      ],
    });
    service = TestBed.inject(ModerationQueueService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const bySource = (source: string) =>
    service.items().filter((item) => item.source === source);

  describe('normalisation', () => {
    it('maps every source into one shape with its link target', () => {
      service.load({ townId: null, includeClosed: false });
      answerNotices({ data: [notice()] });

      const s = bySource('social')[0];
      expect(s).toMatchObject({
        key: 'social:s1',
        sourceLabel: 'Social',
        townId: null,
        subject: 'Post p9: Looks like an ad',
        reason: 'Spam',
        reportedAt: '2026-11-01T10:00:00.000Z',
        statusLabel: 'Pending',
        open: true,
      });
      expect(s.link).toEqual({
        commands: ['/dashboard/social-governance'],
        queryParams: { focus: 's1' },
      });

      expect(bySource('forum')[0].link).toEqual({
        commands: ['/dashboard/forum-governance'],
        queryParams: { focus: 'f1' },
      });

      const d = bySource('directory');
      expect(d).toHaveLength(2);
      expect(d[0]).toMatchObject({
        townId: 't1',
        townName: 'Aspen',
        subject: 'Joe Plumbing',
        reason: 'Wrong address',
        statusLabel: 'Received',
        open: true,
      });
      expect(d[0].link).toEqual({
        commands: ['/dashboard/towns', 't1', 'directory-listing-reports'],
        queryParams: { focus: 'r1' },
      });

      expect(bySource('daylight')[0]).toMatchObject({
        sourceLabel: 'Daylight takedown',
        subject: 'Photo of the bridge',
        reason: 'Copyright notice from Acme',
        open: true,
        link: { commands: ['/dashboard/daylight'], queryParams: {} },
      });
    });

    it('treats only pending content reports and received notices as open', () => {
      socialStub.getReports.mockReturnValue(
        of([social({ status: 'actioned' }), social({ id: 's2' })])
      );
      service.load({ townId: null, includeClosed: false });
      answerNotices({ data: [notice({ state: 'upheld' })] });
      expect(bySource('social').map((i) => i.open)).toEqual([false, true]);
      expect(bySource('daylight')[0].open).toBe(false);
    });

    it('points a handled directory report at its own status', () => {
      directoryStub.listListingReports.mockReturnValue(
        of({ reports: [listing({ status: 'resolved' })] })
      );
      service.load({ townId: 't1', includeClosed: true });
      answerNotices({ data: [] });
      expect(bySource('directory')[0].link?.queryParams).toEqual({
        focus: 'r1',
        status: 'resolved',
      });
    });
  });

  describe('directory fetching', () => {
    it('asks every town, or only the chosen one', () => {
      service.load({ townId: null, includeClosed: false });
      answerNotices({ data: [] });
      expect(
        directoryStub.listListingReports.mock.calls.map((c) => c[0])
      ).toEqual(['t1', 't2']);

      directoryStub.listListingReports.mockClear();
      service.load({ townId: 't2', includeClosed: false });
      answerNotices({ data: [] });
      expect(directoryStub.listListingReports).toHaveBeenCalledTimes(1);
      expect(directoryStub.listListingReports).toHaveBeenCalledWith(
        't2',
        'open'
      );
    });

    it('also asks for handled reports when including closed ones', () => {
      service.load({ townId: 't1', includeClosed: true });
      answerNotices({ data: [] });
      expect(
        directoryStub.listListingReports.mock.calls.map((c) => c[1])
      ).toEqual(['open', 'resolved', 'declined']);
    });

    it('limits how many town calls run at once', () => {
      townsStub.towns.set(
        Array.from({ length: 10 }, (_, i) => ({ id: `t${i}`, name: `T${i}` }))
      );
      let running = 0;
      let peak = 0;
      const pending: (() => void)[] = [];
      directoryStub.listListingReports.mockImplementation(
        () =>
          new Observable((subscriber) => {
            running++;
            peak = Math.max(peak, running);
            pending.push(() => {
              running--;
              subscriber.next({ reports: [] });
              subscriber.complete();
            });
          })
      );
      service.load({ townId: null, includeClosed: false });
      answerNotices({ data: [] });
      while (pending.length) pending.shift()?.();
      expect(peak).toBe(DIRECTORY_CONCURRENCY);
      expect(service.states().directory.status).toBe('ready');
    });

    it('marks the source capped when a town returns a full page', () => {
      directoryStub.listListingReports.mockReturnValue(
        of({
          reports: Array.from({ length: 100 }, (_, i) =>
            listing({ reportId: `r${i}` })
          ),
        })
      );
      service.load({ townId: 't1', includeClosed: false });
      answerNotices({ data: [] });
      expect(service.states().directory.capped).toBe(true);
      expect(service.states().social.capped).toBe(false);
    });

    it('is unavailable when the town list is not loaded', () => {
      townsStub.status.set('error');
      service.load({ townId: null, includeClosed: false });
      answerNotices({ data: [] });
      expect(service.states().directory.status).toBe('unavailable');
      expect(bySource('directory')).toEqual([]);
    });

    it('keeps reports from towns that answered when one town fails', () => {
      directoryStub.listListingReports.mockImplementation((town: string) =>
        town === 't1'
          ? throwError(() => new Error('down'))
          : of({ reports: [listing()] })
      );
      service.load({ townId: null, includeClosed: false });
      answerNotices({ data: [] });
      expect(service.states().directory).toMatchObject({
        status: 'unavailable',
        failedTowns: ['t1'],
      });
      expect(bySource('directory').map((i) => i.townId)).toEqual(['t2']);
    });
  });

  describe('partial failure', () => {
    it('keeps the other sources and marks the failed one unavailable', () => {
      socialStub.getReports.mockReturnValue(throwError(() => new Error('x')));
      service.load({ townId: null, includeClosed: false });
      http
        .expectOne(TAKEDOWN_NOTICES_URL)
        .flush('no', { status: 503, statusText: 'Unavailable' });

      expect(service.states().social.status).toBe('unavailable');
      expect(service.states().daylight.status).toBe('unavailable');
      expect(service.states().forum.status).toBe('ready');
      expect(service.states().directory.status).toBe('ready');
      expect(
        service
          .items()
          .map((i) => i.source)
          .sort()
      ).toEqual(['directory', 'directory', 'forum']);
      expect(service.settled()).toBe(true);
    });

    it('does not read a malformed reply as an empty list', () => {
      forumStub.getReports.mockReturnValue(of({ nope: true }));
      service.load({ townId: null, includeClosed: false });
      answerNotices({ data: [] });
      expect(service.states().forum.status).toBe('unavailable');
    });

    it('retries one source without touching the others', () => {
      socialStub.getReports.mockReturnValueOnce(
        throwError(() => new Error('x'))
      );
      service.load({ townId: null, includeClosed: false });
      answerNotices({ data: [] });
      expect(service.states().social.status).toBe('unavailable');
      forumStub.getReports.mockClear();

      service.retry('social');
      expect(service.states().social.status).toBe('ready');
      expect(bySource('social')).toHaveLength(1);
      expect(forumStub.getReports).not.toHaveBeenCalled();
    });
  });

  describe('quick actions', () => {
    const load = () => {
      service.load({ townId: 't1', includeClosed: false });
      answerNotices({ data: [notice()] });
    };

    it('offers an action only where an endpoint exists and the item is open', () => {
      load();
      const labels = (source: string) =>
        actionsFor(bySource(source)[0]).map((a) => a.id);
      expect(labels('social')).toEqual(['dismiss']);
      expect(labels('forum')).toEqual(['dismiss']);
      expect(labels('directory')).toEqual(['decline']);
      expect(labels('daylight')).toEqual(['decline', 'uphold']);
      expect(actionsFor({ ...bySource('social')[0], open: false })).toEqual([]);
    });

    it('dismisses a social report and marks it handled', () => {
      load();
      service.act(bySource('social')[0], 'dismiss').subscribe();
      expect(socialStub.updateReport).toHaveBeenCalledWith('s1', {
        status: 'dismissed',
      });
      expect(bySource('social')[0]).toMatchObject({
        open: false,
        statusLabel: 'Dismissed',
      });
    });

    it('declines a directory report with the note', () => {
      load();
      service
        .act(bySource('directory')[0], 'decline', 'not a fault')
        .subscribe();
      expect(directoryStub.actOnListingReport).toHaveBeenCalledWith(
        't1',
        'r1',
        'decline',
        { note: 'not a fault' }
      );
      expect(bySource('directory')[0].open).toBe(false);
    });

    it('upholds a takedown notice through the operations route', () => {
      load();
      service.act(bySource('daylight')[0], 'uphold', 'valid claim').subscribe();
      const req = http.expectOne(`${TAKEDOWN_NOTICES_URL}/n1/act`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        action: 'upheld',
        note: 'valid claim',
      });
      req.flush({ data: {} });
      expect(bySource('daylight')[0].statusLabel).toBe('Upheld');
    });

    it('leaves the item open when the action fails', () => {
      load();
      socialStub.updateReport.mockReturnValue(throwError(() => new Error('x')));
      let failed = false;
      service
        .act(bySource('social')[0], 'dismiss')
        .subscribe({ error: () => (failed = true) });
      expect(failed).toBe(true);
      expect(bySource('social')[0].open).toBe(true);
    });
  });
});

describe('filterModerationItems and sortModerationItems', () => {
  const item = (over: Partial<ModerationItem>): ModerationItem => ({
    key: 'k',
    id: 'i',
    source: 'social',
    sourceLabel: 'Social',
    townId: null,
    townName: '',
    subject: 'Subject',
    reason: 'Spam',
    reportedAt: '2026-11-01T00:00:00.000Z',
    status: 'pending',
    statusLabel: 'Pending',
    open: true,
    link: null,
    ...over,
  });
  const base: Parameters<typeof filterModerationItems>[1] = {
    sources: [],
    townId: null,
    status: 'all',
    text: '',
  };
  const items = [
    item({ key: 'a', source: 'social', subject: 'Bridge photo' }),
    item({ key: 'b', source: 'forum', sourceLabel: 'Forum', open: false }),
    item({
      key: 'c',
      source: 'directory',
      sourceLabel: 'Directory listing',
      townId: 't1',
      townName: 'Aspen',
      subject: 'Joe Plumbing',
    }),
    item({
      key: 'd',
      source: 'directory',
      sourceLabel: 'Directory listing',
      townId: 't2',
      townName: 'Bayside',
    }),
  ];
  const keys = (filters: Partial<typeof base>) =>
    filterModerationItems(items, { ...base, ...filters }).map((i) => i.key);

  it('filters by one or more sources', () => {
    expect(keys({ sources: ['forum'] })).toEqual(['b']);
    expect(keys({ sources: ['forum', 'social'] })).toEqual(['a', 'b']);
  });

  it('filters by town, keeping only that town directory reports', () => {
    expect(keys({ townId: 't1' })).toEqual(['a', 'b', 'c']);
  });

  it('filters by status', () => {
    expect(keys({ status: 'open' })).toEqual(['a', 'c', 'd']);
  });

  it('filters by free text across columns', () => {
    expect(keys({ text: 'plumb' })).toEqual(['c']);
    expect(keys({ text: 'bayside' })).toEqual(['d']);
    expect(keys({ text: 'zzz' })).toEqual([]);
  });

  it('sorts oldest open first, then handled, with undated last', () => {
    const sorted = sortModerationItems([
      item({
        key: 'closed-old',
        open: false,
        reportedAt: '2026-01-01T00:00:00Z',
      }),
      item({ key: 'open-new', reportedAt: '2026-11-09T00:00:00Z' }),
      item({ key: 'open-undated', reportedAt: null }),
      item({ key: 'open-old', reportedAt: '2026-11-01T00:00:00Z' }),
    ]);
    expect(sorted.map((i) => i.key)).toEqual([
      'open-old',
      'open-new',
      'open-undated',
      'closed-old',
    ]);
  });
});
