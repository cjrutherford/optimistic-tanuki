import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import {
  DirectoryRequestError,
  DirectoryService,
  SNAPSHOT_TTL_MS,
} from './directory.service';

const first = { q: '', category: '', adult: false, cursor: '' };

describe('DirectoryService', () => {
  let service: DirectoryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    service = TestBed.inject(DirectoryService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('asks for cursor pagination and sends only the filters that are set', async () => {
    const result = service.getPage('t 1', {
      q: 'pie',
      category: 'bakery',
      adult: true,
      cursor: 'abc',
    });
    const req = http.expectOne((r) =>
      r.url.startsWith('/api/directory/towns/t%201/')
    );
    const url = new URL(req.request.urlWithParams, 'http://x');
    expect(url.searchParams.get('pagination')).toBe('cursor');
    expect(url.searchParams.get('cursor')).toBe('abc');
    expect(url.searchParams.get('q')).toBe('pie');
    expect(url.searchParams.get('category')).toBe('bakery');
    expect(url.searchParams.get('adult')).toBe('1');
    req.flush({
      listings: [
        {
          name: 'A',
          category: 'bakery',
          attribution: ['x'],
          notices: [],
          reference: 'r1',
        },
        { nope: true },
      ],
      hasMore: true,
      nextCursor: 'next',
    });
    const page = await result;
    expect(page.listings.map((l) => l.name)).toEqual(['A']);
    expect(page.nextCursor).toBe('next');
    expect(page.hasMore).toBe(true);
  });

  it('omits empty filters on the first page', async () => {
    const result = service.getPage('t1', first);
    const req = http.expectOne((r) => r.url.includes('/directory/towns/t1/'));
    expect(req.request.urlWithParams).toBe(
      '/api/directory/towns/t1/local-evaluation-listings?pagination=cursor'
    );
    req.flush({ listings: [], hasMore: false });
    expect((await result).listings).toEqual([]);
  });

  it('reports the status of a failed page without server detail', async () => {
    const result = service.getPage('t1', { ...first, cursor: 'bad' });
    http
      .expectOne(() => true)
      .flush('secret detail', { status: 400, statusText: 'Bad' });
    await expect(result).rejects.toEqual(expect.any(DirectoryRequestError));
    await result.catch((e: DirectoryRequestError) => {
      expect(e.status).toBe(400);
      expect(e.message).not.toContain('secret');
    });
  });

  it('treats a 404 on a listing as expired and other failures as errors', async () => {
    const gone = service.getListing('t1', 'old', false);
    http
      .expectOne((r) => r.url.endsWith('/old'))
      .flush('', { status: 404, statusText: 'NF' });
    expect(await gone).toBeNull();

    const down = service.getListing('t1', 'r1', true);
    const req = http.expectOne((r) => r.url.includes('/r1'));
    expect(req.request.urlWithParams).toContain('adult=1');
    req.flush('', { status: 503, statusText: 'Down' });
    await expect(down).rejects.toMatchObject({ status: 503 });
  });

  it('keeps only the most recent snapshots', () => {
    const snap = {
      listings: [],
      hasMore: false,
      nextCursor: null,
      sourceFreshness: null,
      coverage: null,
    };
    for (let i = 0; i < 25; i++) service.saveSnapshot(`k${i}`, snap);
    expect(service.getSnapshot('k0')).toBeUndefined();
    expect(service.getSnapshot('k24')).toBe(snap);
  });

  describe('snapshot freshness', () => {
    const page = (refs: string[]) => ({
      listings: refs.map((reference, i) => ({
        name: reference,
        category: 'other',
        attribution: [],
        notices: [],
        reference,
        id: `00000000-0000-4000-8000-00000000000${i}`,
      })),
      hasMore: false,
      nextCursor: null,
      sourceFreshness: null,
      coverage: null,
    });

    afterEach(() => jest.restoreAllMocks());

    it('serves a snapshot inside the TTL and drops it after', () => {
      const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
      const snap = page(['a']);
      service.saveSnapshot('k', snap);
      now.mockReturnValue(1_000 + SNAPSHOT_TTL_MS - 1);
      expect(service.getSnapshot('k')).toBe(snap);
      now.mockReturnValue(1_000 + SNAPSHOT_TTL_MS);
      expect(service.getSnapshot('k')).toBeUndefined();
      expect(service.getSnapshot('k')).toBeUndefined();
    });

    it('drops a listing from every snapshot of the town when its lookup is a 404', async () => {
      const k1 = service.snapshotKey('t1', { ...first, q: 'x' });
      const k2 = service.snapshotKey('t1', { ...first, cursor: 'c' });
      const other = service.snapshotKey('t2', first);
      const adultKey = service.snapshotKey('t1', { ...first, adult: true });
      service.saveSnapshot(k1, page(['a', 'b']));
      service.saveSnapshot(k2, page(['b', 'c']));
      service.saveSnapshot(other, page(['b']));
      service.saveSnapshot(adultKey, page(['b']));

      const gone = service.getListing('t1', 'b', false);
      http
        .expectOne((r) => r.url.endsWith('/b'))
        .flush('', { status: 404, statusText: 'NF' });
      expect(await gone).toBeNull();

      const refs = (key: string) =>
        service.getSnapshot(key)?.listings.map((l) => l.reference);
      expect(refs(k1)).toEqual(['a']);
      expect(refs(k2)).toEqual(['c']);
      // Another town, and the adult setting a reference was not issued under, are untouched.
      expect(refs(other)).toEqual(['b']);
      expect(refs(adultKey)).toEqual(['b']);
    });

    it('keeps snapshots when a lookup fails for any reason other than 404', async () => {
      const key = service.snapshotKey('t1', first);
      service.saveSnapshot(key, page(['a']));
      const down = service.getListing('t1', 'a', false);
      http
        .expectOne((r) => r.url.endsWith('/a'))
        .flush('', { status: 503, statusText: 'Down' });
      await expect(down).rejects.toMatchObject({ status: 503 });
      expect(service.getSnapshot(key)?.listings).toHaveLength(1);
    });

    it('does not read a detail view from any snapshot', async () => {
      service.saveSnapshot(service.snapshotKey('t1', first), page(['a']));
      const detail = service.getListing('t1', 'a', false);
      http
        .expectOne((r) => r.url.endsWith('/a'))
        .flush({ name: 'A', category: 'other', attribution: [], notices: [] });
      expect((await detail)?.name).toBe('A');
    });
  });

  it('posts a report to the town and returns the receipt', async () => {
    const result = service.createReport('t 1', {
      listingId: 'l1',
      reasonCode: 'safety',
      website: '',
    });
    const req = http.expectOne('/api/directory/towns/t%201/listing-reports');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      listingId: 'l1',
      reasonCode: 'safety',
      website: '',
    });
    req.flush({ receipt: 'R-1' }, { status: 201, statusText: 'Created' });
    await expect(result).resolves.toBe('R-1');
  });

  it('reports a failed report post by status only', async () => {
    const result = service.createReport('t', {
      listingId: 'l',
      reasonCode: 'other',
      website: '',
    });
    http
      .expectOne('/api/directory/towns/t/listing-reports')
      .flush({ message: 'secret detail' }, { status: 429, statusText: 'x' });
    await expect(result).rejects.toMatchObject({ status: 429 });
  });

  it('reads a report status, and returns null for an unknown receipt', async () => {
    const ok = service.getReportStatus('A/B');
    http.expectOne('/api/directory/listing-reports/A%2FB').flush({
      status: 'resolved',
      reasonCode: 'other',
      createdAt: '2026-11-01T00:00:00Z',
    });
    await expect(ok).resolves.toMatchObject({ status: 'resolved' });
    const missing = service.getReportStatus('X');
    http
      .expectOne('/api/directory/listing-reports/X')
      .flush('', { status: 404, statusText: 'Not Found' });
    await expect(missing).resolves.toBeNull();
  });
});
