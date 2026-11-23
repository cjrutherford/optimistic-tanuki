import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { DaylightSourcesComponent } from './daylight-sources.component';

const OPS = '/api/local-hub/operations';
const http = () => TestBed.inject(HttpTestingController);

const source = (overrides: Record<string, unknown> = {}) => ({
  sourceKey: 'civic-core-adel',
  name: 'Adel Agendas',
  adapter: 'civic-core',
  enabled: true,
  status: 'healthy',
  lastAttemptAt: '2026-10-01T12:00:00.000Z',
  lastSuccessAt: '2026-10-01T12:00:00.000Z',
  consecutiveFailures: 0,
  items7d: 4,
  errors7d: 0,
  override: null,
  ...overrides,
});

const override = () => ({
  id: 'o1',
  slug: 'adel-ga',
  sourceKey: 'civic-core-old',
  kind: 'block',
  reason: 'Dead feed',
  actor: 'owner',
  createdAt: '2026-10-02T12:00:00.000Z',
});

const request = () => ({
  id: 'r1',
  slug: 'adel-ga',
  townName: 'Adel',
  note: 'Please add the paper',
  status: 'pending',
  createdAt: '2026-10-03T12:00:00.000Z',
  decidedBy: null,
  decidedAt: null,
  decisionReason: null,
});

const decision = () => ({
  id: 'd1',
  decision: 'blocked',
  sourceKey: 'civic-core-old',
  url: null,
  via: 'operator owner',
  reason: 'Dead feed',
  decidedAt: '2026-10-02T12:00:00.000Z',
});

describe('DaylightSourcesComponent', () => {
  function render(canManage: boolean, slug: string | null = 'adel-ga') {
    TestBed.configureTestingModule({
      imports: [DaylightSourcesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(DaylightSourcesComponent);
    fixture.componentRef.setInput('slug', slug);
    fixture.componentRef.setInput('canManage', canManage);
    fixture.detectChanges();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  const loadAll = (
    options: {
      health?: unknown;
      requests?: unknown[];
      skipRequests?: boolean;
    } = {}
  ) => {
    http()
      .expectOne(`${OPS}/sources/adel-ga/health`)
      .flush({ data: { sources: options.health ?? [source()] } });
    http()
      .expectOne(`${OPS}/sources/adel-ga/overrides`)
      .flush({ data: [override()] });
    http()
      .expectOne((req) => req.url === `${OPS}/sources/adel-ga/decisions`)
      .flush({ data: { items: [decision()], total: 60 } });
    if (options.skipRequests) return;
    const requests = options.requests ?? [request()];
    http()
      .expectOne((req) => req.url === `${OPS}/source-requests`)
      .flush({ data: { items: requests, total: requests.length } });
  };

  const text = (page: HTMLElement) => page.textContent ?? '';
  const button = (page: HTMLElement, label: string) =>
    Array.from(page.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').trim().startsWith(label)
    ) as HTMLButtonElement | undefined;

  afterEach(() => http().verify());

  it('shows health, overrides, the log and the queue', async () => {
    const { fixture, page } = render(false);
    loadAll();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text(page)).toContain('Adel Agendas');
    expect(text(page)).toContain('civic-core-old');
    expect(text(page)).toContain('by owner');
    expect(text(page)).toContain('Please add the paper');
    expect(text(page)).toContain('1–1');
  });

  it('hides every control without manage permission', async () => {
    const { fixture, page } = render(false);
    loadAll();
    fixture.detectChanges();
    expect(button(page, 'Block')).toBeUndefined();
    expect(button(page, 'Approve')).toBeUndefined();
    expect(button(page, 'Remove')).toBeUndefined();
  });

  it('says Unavailable with a Retry, never an empty list', async () => {
    const { fixture, page } = render(false);
    http()
      .expectOne(`${OPS}/sources/adel-ga/health`)
      .flush('nope', { status: 503, statusText: 'Unavailable' });
    http().expectOne(`${OPS}/sources/adel-ga/overrides`).flush({ data: [] });
    http()
      .expectOne((req) => req.url === `${OPS}/sources/adel-ga/decisions`)
      .flush({ data: { items: [], total: 0 } });
    http()
      .expectOne((req) => req.url === `${OPS}/source-requests`)
      .flush({ data: { items: [], total: 0 } });
    fixture.detectChanges();
    expect(text(page)).toContain('Unavailable.');
    expect(text(page)).not.toContain('This town has no sources yet');

    button(page, 'Retry')?.click();
    http()
      .expectOne(`${OPS}/sources/adel-ga/health`)
      .flush({ data: { sources: [source()] } });
    fixture.detectChanges();
    expect(text(page)).not.toContain('Unavailable.');
    expect(text(page)).toContain('Adel Agendas');
  });

  it('will not block without a reason, then blocks with one', async () => {
    const { fixture, page } = render(true);
    loadAll();
    fixture.detectChanges();
    button(page, 'Block')?.click();
    fixture.detectChanges();
    button(page, 'Confirm')?.click();
    fixture.detectChanges();
    http().expectNone(`${OPS}/sources/adel-ga/overrides`);
    expect(text(page)).toContain('Give a reason.');

    const box = page.querySelector('textarea') as HTMLTextAreaElement;
    box.value = 'Feed is dead';
    box.dispatchEvent(new Event('input'));
    button(page, 'Confirm')?.click();
    const req = http().expectOne(
      (r) => r.method === 'POST' && r.url === `${OPS}/sources/adel-ga/overrides`
    );
    expect(req.request.body).toEqual({
      sourceKey: 'civic-core-adel',
      kind: 'block',
      reason: 'Feed is dead',
    });
    req.flush({ data: override() });
    loadAll({ skipRequests: true });
    fixture.detectChanges();
    expect(text(page)).toContain('civic-core-adel is blocked.');
  });

  it('removes an override with a reason', async () => {
    const { fixture, page } = render(true);
    loadAll();
    fixture.detectChanges();
    button(page, 'Remove block')?.click();
    fixture.detectChanges();
    const box = page.querySelector('textarea') as HTMLTextAreaElement;
    box.value = 'Back online';
    box.dispatchEvent(new Event('input'));
    button(page, 'Confirm')?.click();
    const req = http().expectOne(
      `${OPS}/sources/adel-ga/overrides/civic-core-old/clear`
    );
    expect(req.request.body).toEqual({ reason: 'Back online' });
    req.flush({ data: null });
    loadAll({ skipRequests: true });
  });

  it('approves and rejects requests with a reason', async () => {
    const { fixture, page } = render(true);
    loadAll();
    fixture.detectChanges();
    button(page, 'Reject')?.click();
    fixture.detectChanges();
    button(page, 'Confirm')?.click();
    fixture.detectChanges();
    http().expectNone('/api/local-hub/operations/source-requests/r1/decide');
    expect(text(page)).toContain('Give a reason.');
    const box = page.querySelector('textarea') as HTMLTextAreaElement;
    box.value = 'Out of area';
    box.dispatchEvent(new Event('input'));
    button(page, 'Confirm')?.click();
    const req = http().expectOne(`${OPS}/source-requests/r1/decide`);
    expect(req.request.body).toEqual({
      decision: 'rejected',
      reason: 'Out of area',
    });
    req.flush({ data: request() });
    http()
      .expectOne((r) => r.url === `${OPS}/source-requests`)
      .flush({ data: { items: [], total: 0 } });
  });

  it('keeps the dialog open and shows the failure when a change fails', async () => {
    const { fixture, page } = render(true);
    loadAll();
    fixture.detectChanges();
    button(page, 'Approve')?.click();
    fixture.detectChanges();
    const box = page.querySelector('textarea') as HTMLTextAreaElement;
    box.value = 'Fine';
    box.dispatchEvent(new Event('input'));
    button(page, 'Confirm')?.click();
    http()
      .expectOne(`${OPS}/source-requests/r1/decide`)
      .flush(
        { message: 'Already decided' },
        { status: 409, statusText: 'Conflict' }
      );
    fixture.detectChanges();
    expect(page.querySelector('.confirm [role="alert"]')).not.toBeNull();
  });

  it('pages the decision log', async () => {
    const { fixture, page } = render(false);
    loadAll();
    fixture.detectChanges();
    button(page, 'Older')?.click();
    const req = http().expectOne(
      (r) => r.url === `${OPS}/sources/adel-ga/decisions`
    );
    expect(req.request.params.get('offset')).toBe('25');
    req.flush({ data: { items: [decision()], total: 60 } });
  });

  it('offers a town picker when no town is chosen', async () => {
    TestBed.configureTestingModule({
      imports: [DaylightSourcesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(DaylightSourcesComponent);
    fixture.componentRef.setInput('towns', [
      { slug: 'adel-ga', name: 'Adel' },
      { slug: 'tifton-ga', name: 'Tifton' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('select')).not.toBeNull();
    http().match(() => true);
  });
});
