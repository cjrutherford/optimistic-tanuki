import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { firstValueFrom } from 'rxjs';
import { CommunityService, type Submission } from './community.service';
import { EditionsService } from './editions.service';
import { problem, problemCode } from './errors';
import { MembershipService } from './membership.service';
import { OperationsService } from './operations.service';

describe('civic briefing clients', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Starts the call, answers the one request it made, and returns both. */
  async function answer<T>(
    call: Promise<T>,
    method: string,
    url: string,
    data: unknown
  ) {
    const request = http.expectOne(
      (r) => r.method === method && r.urlWithParams === url
    );
    request.flush({ data });
    return { result: await call, request: request.request };
  }

  describe('EditionsService', () => {
    it('lists editions and unwraps the reply', async () => {
      const editions = TestBed.inject(EditionsService);
      const { result } = await answer(
        firstValueFrom(editions.editions()),
        'GET',
        '/api/local-hub/editions',
        [{ slug: 'adel-ga', name: 'Adel', state: 'GA', latest: null }]
      );
      expect(result).toEqual([
        { slug: 'adel-ga', name: 'Adel', state: 'GA', latest: null },
      ]);
    });

    it('asks for the latest briefing without a date, and that date with one', async () => {
      const editions = TestBed.inject(EditionsService);
      await answer(
        firstValueFrom(editions.briefing('adel-ga')),
        'GET',
        '/api/local-hub/editions/adel-ga/briefings/latest',
        {}
      );
      await answer(
        firstValueFrom(editions.briefing('adel-ga', '2026-10-01')),
        'GET',
        '/api/local-hub/editions/adel-ga/briefings/2026-10-01',
        {}
      );
    });

    it('encodes the slug so it stays one path segment', async () => {
      const editions = TestBed.inject(EditionsService);
      await answer(
        firstValueFrom(editions.history('a/b')),
        'GET',
        '/api/local-hub/editions/a%2Fb',
        {}
      );
    });
  });

  describe('CommunityService', () => {
    const submission: Submission = {
      localitySlug: 'adel-ga',
      kind: 'account',
      subject: { kind: 'meeting', ref: 'm1', text: 'Council' },
      occurredOn: '2026-10-01',
      body: 'The council voted.',
      links: [],
      disclosedInterest: null,
      representations: { witnessed: true, ownWords: true },
    };

    it('submits as multipart with the idempotency key', async () => {
      const community = TestBed.inject(CommunityService);
      const file = new File(['%PDF'], 'minutes.pdf', {
        type: 'application/pdf',
      });
      const { result, request } = await answer(
        firstValueFrom(community.submit(submission, file, 'key-1')),
        'POST',
        '/api/local-hub/contributions',
        { id: 'c1' }
      );
      expect(result).toEqual({ id: 'c1' });
      expect(request.headers.get('Idempotency-Key')).toBe('key-1');
      const form = request.body as FormData;
      expect(JSON.parse(form.get('submission') as string)).toEqual(submission);
      expect((form.get('attachment') as File).name).toBe('minutes.pdf');
    });

    it('sends no attachment field when there is none', async () => {
      const community = TestBed.inject(CommunityService);
      const { request } = await answer(
        firstValueFrom(community.submit(submission, null, 'key-2')),
        'POST',
        '/api/local-hub/contributions',
        {}
      );
      expect((request.body as FormData).has('attachment')).toBe(false);
    });

    it('reaches the surface, contributor, subject and own-contribution routes', async () => {
      const community = TestBed.inject(CommunityService);
      await answer(
        firstValueFrom(community.surface('adel-ga')),
        'GET',
        '/api/local-hub/editions/adel-ga/community',
        { items: [], official: [] }
      );
      await answer(
        firstValueFrom(community.subjects('adel-ga')),
        'GET',
        '/api/local-hub/editions/adel-ga/subjects',
        []
      );
      await answer(
        firstValueFrom(community.contributor('u1')),
        'GET',
        '/api/local-hub/contributors/u1',
        {}
      );
      await answer(
        firstValueFrom(community.mine()),
        'GET',
        '/api/local-hub/contributions/mine',
        []
      );
      expect(community.artifactUrl('ab12')).toBe(
        '/api/local-hub/artifacts/ab12'
      );
    });

    it('withdraws, applies as an official, and files notices', async () => {
      const community = TestBed.inject(CommunityService);
      await answer(
        firstValueFrom(community.withdraw('c1')),
        'POST',
        '/api/local-hub/contributions/c1/withdraw',
        {}
      );
      const { request } = await answer(
        firstValueFrom(community.applyOfficial('adel-ga')),
        'POST',
        '/api/local-hub/officials/apply',
        {}
      );
      expect(request.body).toEqual({ localitySlug: 'adel-ga' });
      await answer(
        firstValueFrom(
          community.fileNotice({
            claimantName: 'A',
            claimantEmail: 'a@example.com',
            claimantAddress: '1 Main St',
            work: 'A photo',
            locations: ['c1'],
            goodFaith: true,
            accurateUnderPenalty: true,
            signature: 'A',
          })
        ),
        'POST',
        '/api/local-hub/copyright/notices',
        { id: 'n1', locatedContributions: 1 }
      );
      await answer(
        firstValueFrom(
          community.counterNotice('c1', {
            noticeId: 'n1',
            statement: 'It is my own photograph.',
            consentToJurisdiction: true,
            underPenalty: true,
            signature: 'B',
          })
        ),
        'POST',
        '/api/local-hub/contributions/c1/counter-notice',
        { id: 'k1' }
      );
    });
  });

  it('MembershipService reads the account standing', async () => {
    const membership = TestBed.inject(MembershipService);
    const { result } = await answer(
      firstValueFrom(membership.me()),
      'GET',
      '/api/local-hub/me',
      { roles: ['local_hub_member'] }
    );
    expect(result).toEqual({ roles: ['local_hub_member'] });
  });

  describe('OperationsService', () => {
    it('unwraps density rows', async () => {
      const operations = TestBed.inject(OperationsService);
      const { result } = await answer(
        firstValueFrom(operations.density()),
        'GET',
        '/api/local-hub/operations/density',
        { rows: [{ localitySlug: 'adel-ga' }] }
      );
      expect(result).toEqual([{ localitySlug: 'adel-ga' }]);
    });

    it('filters takedown notices by state only when one is given', async () => {
      const operations = TestBed.inject(OperationsService);
      await answer(
        firstValueFrom(operations.takedownNotices()),
        'GET',
        '/api/local-hub/operations/takedown-notices',
        []
      );
      await answer(
        firstValueFrom(operations.takedownNotices('open')),
        'GET',
        '/api/local-hub/operations/takedown-notices?state=open',
        []
      );
    });

    it('triggers the maintenance runs', async () => {
      const operations = TestBed.inject(OperationsService);
      await answer(
        firstValueFrom(operations.rereview()),
        'POST',
        '/api/local-hub/operations/rereview',
        { changed: 0 }
      );
      await answer(
        firstValueFrom(operations.sweepOutcomes()),
        'POST',
        '/api/local-hub/operations/outcomes/sweep',
        {}
      );
      await answer(
        firstValueFrom(operations.exportPromotions()),
        'POST',
        '/api/local-hub/operations/promotions/export',
        { towns: [] }
      );
      await answer(
        firstValueFrom(
          operations.actOnTakedownNotice('n1', { action: 'upheld', note: 'x' })
        ),
        'POST',
        '/api/local-hub/operations/takedown-notices/n1/act',
        { contributions: [], suspended: [] }
      );
      await answer(
        firstValueFrom(
          operations.confirmOfficialCallback({
            userId: 'u1',
            localitySlug: 'adel-ga',
            note: 'Called the clerk.',
          })
        ),
        'POST',
        '/api/local-hub/operations/officials/confirm-callback',
        { standing: 'official-record' }
      );
    });
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
