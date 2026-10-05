import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { OptomisitcTanukiAPIService } from '../generated/civic';
import { artifactUrl, submissionKey } from './community';
import { problem, problemCode } from './errors';

/**
 * Guards against the tag filter or the alias transformer in orval.config.ts
 * silently dropping or duplicating a local-hub route. Lives outside
 * src/generated/ because orval `clean: true` wipes that directory.
 */
const METHODS = [
  'actOnTakedownNotice',
  'applyOfficial',
  'artifact',
  'briefing',
  'confirmCallback',
  'contributor',
  'counterNotice',
  'density',
  'edition',
  'editions',
  'exportPromotions',
  'fileNotice',
  'latest',
  'me',
  'mine',
  'pipelineHealth',
  'rereview',
  'signUpAsContributor',
  'subjects',
  'submit',
  'surface',
  'sweepOutcomes',
  'takedownNotices',
  'withdraw',
] as const;

describe('generated civic client', () => {
  let http: HttpTestingController;
  let api: OptomisitcTanukiAPIService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(OptomisitcTanukiAPIService);
  });

  afterEach(() => http.verify());

  it('exposes every local-hub route once', () => {
    const own = Object.getOwnPropertyNames(
      OptomisitcTanukiAPIService.prototype
    ).filter((name) => name !== 'constructor');
    expect(own.sort()).toEqual([...METHODS]);
  });

  it('calls the unprefixed routes, not the v1 aliases', async () => {
    const reply = firstValueFrom(api.latest('adel-ga'));
    http
      .expectOne('/api/local-hub/editions/adel-ga/briefings/latest')
      .flush({ data: { slug: 'adel-ga' } });
    expect(await reply).toEqual({ data: { slug: 'adel-ga' } });
  });

  it('submits the form as multipart, the submission as one JSON part', async () => {
    const submission = {
      localitySlug: 'adel-ga',
      kind: 'account' as const,
      subject: { kind: 'meeting' as const, ref: 'm1', text: 'Council' },
      occurredOn: '2026-10-01',
      body: 'The council voted.',
      links: [],
      disclosedInterest: null,
      representations: { witnessed: true, ownWords: true },
    };
    const file = new File(['%PDF'], 'minutes.pdf', {
      type: 'application/pdf',
    });
    const reply = firstValueFrom(
      api.submit(
        { submission, attachment: file },
        { headers: { 'Idempotency-Key': 'key-1' } }
      )
    );
    const request = http.expectOne('/api/local-hub/contributions');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    const form = request.request.body as FormData;
    expect(JSON.parse(form.get('submission') as string)).toEqual(submission);
    expect((form.get('attachment') as File).name).toBe('minutes.pdf');
    request.flush({ data: { id: 'c1' } });
    expect(await reply).toEqual({ data: { id: 'c1' } });
  });

  it('filters takedown notices by state only when one is given', async () => {
    const all = firstValueFrom(api.takedownNotices());
    http.expectOne('/api/local-hub/operations/takedown-notices').flush({
      data: [],
    });
    await all;
    const open = firstValueFrom(api.takedownNotices({ state: 'received' }));
    http
      .expectOne('/api/local-hub/operations/takedown-notices?state=received')
      .flush({ data: [] });
    await open;
  });

  it('links attachments as downloads', () => {
    expect(artifactUrl('ab12')).toBe('/api/local-hub/artifacts/ab12');
  });
});

describe('submissionKey', () => {
  it('builds a version 4 UUID where randomUUID is missing (plain HTTP)', () => {
    const keys = new Set(Array.from({ length: 50 }, () => submissionKey()));
    expect(keys.size).toBe(50);
    for (const key of keys)
      expect(key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      );
  });
});

describe('problem', () => {
  const failure = (status: number, error: unknown) =>
    new HttpErrorResponse({ status, error });

  it('shows the gateway message as written', () => {
    expect(problem(failure(400, { message: 'No such town.' }))).toBe(
      'No such town.'
    );
  });

  it('joins validation messages into sentences', () => {
    expect(
      problem(failure(400, { message: ['body is too long', 'links: bad.'] }))
    ).toBe('Body is too long. Links: bad.');
  });

  it('names an unreachable service and rate limiting', () => {
    expect(problem(failure(0, null))).toMatch(/could not be reached/u);
    expect(problem(failure(429, null))).toMatch(/Too many attempts/u);
  });

  it('falls back for anything else', () => {
    expect(problem(new Error('x'), 'Nope.')).toBe('Nope.');
    expect(problem(failure(500, null), 'Nope.')).toBe('Nope.');
  });

  it('reads the machine code only when it is a string', () => {
    expect(problemCode(failure(409, { code: 'duplicate' }))).toBe('duplicate');
    expect(problemCode(failure(409, { code: 7 }))).toBeUndefined();
    expect(problemCode(new Error('x'))).toBeUndefined();
  });
});
