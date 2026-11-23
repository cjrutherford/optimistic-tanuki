import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { DAYLIGHT_OPS_ACCESS } from './daylight-ops-access';
import { DaylightOperationsComponent } from './daylight-operations.component';

const http = () => TestBed.inject(HttpTestingController);

const API = '/api/local-hub';

const town = (name: string, active: number) => ({
  localitySlug: `${name.toLowerCase()}-ga`,
  town: name,
  active,
  everContributed: active,
  reports: 0,
  corroborations: 0,
  corroborated: 0,
  quotable: 0,
  confirmed: 1,
  contradicted: 0,
  meetings: 4,
  meetingsWithContributions: 1,
  officials: 0,
});

const candidate = (overrides: Record<string, unknown> = {}) => ({
  id: '0b5f1c28-5b0e-4c61-9f27-5a3c1d4e8f10',
  slug: 'adel-ga',
  townName: 'Adel',
  name: 'Jane Doe',
  role: 'Mayor',
  sourceAgendaId: '11111111-1111-4111-8111-111111111111',
  firstSeen: '2026-09-01T00:00:00.000Z',
  lastSeen: '2026-10-01T12:00:00.000Z',
  status: 'pending',
  decidedBy: null,
  decidedAt: null,
  townHasOfficials: false,
  ...overrides,
});

const idle = {
  running: false,
  configured: true,
  towns: [],
  days: null,
  startedAt: null,
  finishedAt: null,
  steps: [],
  problem: null,
};

describe('DaylightOperationsComponent', () => {
  async function render(permissions: string[]) {
    TestBed.configureTestingModule({
      imports: [DaylightOperationsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(DaylightOperationsComponent);
    fixture.detectChanges();
    http()
      .expectOne(`${API}/me`)
      .flush({ data: { permissions, roles: [] } });
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http().verify());

  const flushCandidates = (list: unknown[] = []) =>
    http()
      .expectOne(`${API}/operations/official-candidates`)
      .flush({ data: list });

  it('turns away an account without operator permissions', async () => {
    const { page } = await render(['contribution.create']);
    expect(page.textContent).toContain('This page is for Daylight operators.');
    expect(page.querySelector('section')).toBeNull();
  });

  it('shows the sources panels only with the sources permission', async () => {
    const { fixture, page } = await render(['sources.read']);
    http().match(() => true);
    fixture.detectChanges();
    expect(page.querySelector('ot-daylight-sources')).not.toBeNull();
    expect(page.textContent).toContain('Source requests');
    expect(page.textContent).not.toContain('Not available');
  });

  it('lists towns thinnest first and says where to recruit', async () => {
    const { fixture, page } = await render(['density.read']);
    http()
      .expectOne(`${API}/operations/density`)
      .flush({ data: { rows: [town('Tifton', 9), town('Adel', 2)] } });
    fixture.detectChanges();
    const towns = Array.from(page.querySelectorAll('tbody th')).map(
      (th) => th.textContent
    );
    expect(towns).toEqual(['Adel', 'Tifton']);
    expect(page.querySelector('li')?.textContent).toContain(
      'Adel needs 6 more to reach the band'
    );
    expect(page.querySelectorAll('section').length).toBe(1);
  });

  it('decides a copyright notice only with a recorded reason', async () => {
    const { fixture, page } = await render(['takedown.manage']);
    http()
      .expectOne(`${API}/operations/takedown-notices?state=received`)
      .flush({
        data: [
          {
            id: 'n1',
            claimantName: 'Ann Owner',
            claimantEmail: 'ann@example.com',
            claimantAddress: '1 Main St',
            work: 'My photograph',
            locations: ['c1'],
            goodFaith: true,
            accurateUnderPenalty: true,
            signature: 'Ann Owner',
            state: 'received',
            receivedAt: '2026-09-30T10:00:00Z',
            contributionIds: ['c1'],
          },
        ],
      });
    fixture.detectChanges();
    const uphold = page.querySelector(
      '.notice .actions button'
    ) as HTMLButtonElement;
    uphold.click();
    fixture.detectChanges();
    expect(page.textContent).toContain(
      'Record the reason for the decision first.'
    );

    const note = page.querySelector('.notice textarea') as HTMLTextAreaElement;
    note.value = 'The photograph is hers.';
    note.dispatchEvent(new Event('input'));
    uphold.click();
    const decision = http().expectOne(
      `${API}/operations/takedown-notices/n1/act`
    );
    expect(decision.request.body).toEqual({
      action: 'upheld',
      note: 'The photograph is hers.',
    });
    decision.flush({ data: { contributions: ['c1'], suspended: [] } });
    http()
      .expectOne(`${API}/operations/takedown-notices?state=received`)
      .flush({ data: [] });
    fixture.detectChanges();
    expect(page.textContent).toContain(
      'Notice upheld: 1 contribution affected.'
    );
  });

  it("shows each town's last run and the sources needing attention", async () => {
    const { fixture, page } = await render(['town.configure']);
    flushCandidates();
    http()
      .expectOne(`${API}/operations/pipeline-health`)
      .flush({
        data: {
          configured: true,
          checkedAt: '2026-10-05T12:00:00.000Z',
          towns: [
            {
              slug: 'adel-ga',
              name: 'Adel',
              lastRun: {
                runId: 7,
                status: 'failed',
                cadence: 'daily',
                startedAt: '2026-10-05T06:00:00.000Z',
                completedAt: null,
                currentStage: 'briefing',
                error: 'model timed out',
              },
              problems: [
                {
                  sourceId: 'adel-agendas',
                  adapter: 'civicplus',
                  status: 'failing',
                  stalenessDays: null,
                  consecutiveFailures: 4,
                  lastSuccessAt: null,
                },
              ],
            },
          ],
        },
      });
    http().expectOne(`${API}/operations/backfill`).flush({ data: idle });
    fixture.detectChanges();
    const row = page.querySelector('#pipeline-heading')?.closest('section');
    expect(row?.querySelector('.run')?.textContent?.trim()).toBe('Failed');
    expect(row?.querySelector('.run-error')?.textContent).toBe(
      'model timed out'
    );
    expect(row?.querySelector('.source-problem')?.textContent?.trim()).toBe(
      'adel-agendas: failing, 4 attempts in a row'
    );
  });

  it('starts a pull and backfill and shows its progress', async () => {
    const { fixture, page } = await render(['town.configure']);
    flushCandidates();
    http()
      .expectOne(`${API}/operations/pipeline-health`)
      .flush({
        data: {
          configured: true,
          checkedAt: '2026-10-05T12:00:00Z',
          towns: [],
        },
      });
    http().expectOne(`${API}/operations/backfill`).flush({ data: idle });
    fixture.detectChanges();

    const days = page.querySelector('.days input') as HTMLInputElement;
    days.value = '30';
    days.dispatchEvent(new Event('input'));
    const start = Array.from(page.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Pull and backfill every town'
    ) as HTMLButtonElement;
    start.click();
    const request = http().expectOne(`${API}/operations/backfill`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ days: 30 });
    request.flush({
      data: {
        ...idle,
        running: true,
        towns: ['adel-ga', 'moultrie-ga'],
        days: 30,
        startedAt: '2026-10-05T12:00:00Z',
        steps: [
          { town: 'adel-ga', action: 'pulled' },
          {
            town: 'adel-ga',
            action: 'backfill of 30 days: 4 edition(s) written',
          },
        ],
      },
    });
    fixture.detectChanges();
    expect(page.textContent).toContain('Backfilling 2 towns since');
    expect(page.textContent).toContain('2 steps done.');
    expect(
      Array.from(page.querySelectorAll('.backfill-steps li')).map((li) =>
        li.textContent?.trim()
      )
    ).toEqual([
      'adel-ga: pulled',
      'adel-ga: backfill of 30 days: 4 edition(s) written',
    ]);
    expect(start.disabled).toBe(true);
  });

  it('runs the re-review now and reports what changed', async () => {
    const { fixture, page } = await render(['community.maintain']);
    (page.querySelector('.actions button') as HTMLButtonElement).click();
    http()
      .expectOne(`${API}/operations/rereview`)
      .flush({ data: { changed: 3 } });
    fixture.detectChanges();
    expect(page.textContent).toContain(
      'Re-review finished: 3 contributions changed.'
    );
  });

  describe('official candidates', () => {
    const URL = `${API}/operations/official-candidates`;
    const ID = candidate().id;

    async function open(list: unknown[] = [candidate()]) {
      const view = await render(['town.configure']);
      http()
        .expectOne(`${API}/operations/pipeline-health`)
        .flush({ data: { configured: false, checkedAt: '', towns: [] } });
      http().expectOne(`${API}/operations/backfill`).flush({ data: idle });
      flushCandidates(list);
      view.fixture.detectChanges();
      return view;
    }

    const button = (page: HTMLElement, label: string) =>
      page.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
    const type = (page: HTMLElement, label: string, value: string) => {
      const input = Array.from(page.querySelectorAll('label.field'))
        .find((field) => field.textContent?.includes(label))
        ?.querySelector('input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };

    it('lists pending names by town with role and last seen', async () => {
      const { page } = await open([
        candidate(),
        candidate({ id: 'b', name: 'John Roe', role: 'Clerk' }),
        candidate({
          id: 'c',
          slug: 'tifton-ga',
          townName: 'Tifton',
          name: 'Ann Poe',
          townHasOfficials: true,
        }),
      ]);
      expect(
        Array.from(page.querySelectorAll('.candidate-town h3')).map(
          (h) => h.textContent
        )
      ).toEqual(['Adel', 'Tifton']);
      const first = page.querySelector('.candidate') as HTMLElement;
      expect(first.textContent).toContain('Jane Doe');
      expect(first.textContent).toContain('Mayor');
      expect(first.textContent).toContain('Last seen Oct 1, 2026');
      expect(first.textContent).toContain('Named in agenda 11111111');
      expect(page.textContent).toContain('This town has no officials list yet');
    });

    it('says so when nothing waits', async () => {
      const { page } = await open([]);
      expect(page.textContent).toContain('No names are waiting for review.');
    });

    it('accepts with the role prefilled, and asks for domains and a callback source for a new town', async () => {
      const { fixture, page } = await open();
      button(page, 'Accept Jane Doe').click();
      fixture.detectChanges();
      const office = page.querySelector(
        '.candidate-form input'
      ) as HTMLInputElement;
      expect(office.value).toBe('Mayor');

      // Nothing is sent while the form is incomplete; errors show inline.
      (
        page.querySelector(
          '.candidate-form button[type="submit"]'
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      expect(
        Array.from(page.querySelectorAll('.candidate-form .problem')).map((e) =>
          e.textContent?.trim()
        )
      ).toEqual([
        "Give an https address, such as the town's council page.",
        'List at least one domain, separated by commas.',
        'Give the https page where the town publishes its number.',
      ]);
      expect(page.querySelector('input[aria-invalid="true"]')).not.toBeNull();

      type(page, 'Source', 'http://adel.example/council');
      fixture.detectChanges();
      expect(page.textContent).toContain('Give an https address');

      type(page, 'Source', 'https://adel.example/council');
      type(page, 'Government email domains', 'Adel.example, adel.ga.gov');
      type(page, 'Callback number source', 'https://adel.example/contact');
      (
        page.querySelector(
          '.candidate-form button[type="submit"]'
        ) as HTMLButtonElement
      ).click();
      const accept = http().expectOne(`${URL}/${ID}/accept`);
      expect(accept.request.body).toEqual({
        office: 'Mayor',
        source: 'https://adel.example/council',
        domains: ['adel.example', 'adel.ga.gov'],
        callbackNumberSource: 'https://adel.example/contact',
      });
      accept.flush({ data: candidate({ status: 'accepted' }) });
      flushCandidates([]);
      fixture.detectChanges();
      expect(page.textContent).toContain(
        "Jane Doe was added to Adel's roster."
      );
      expect(page.querySelector('.candidate-form')).toBeNull();
    });

    it('asks only for office and source when the town already has officials', async () => {
      const { fixture, page } = await open([
        candidate({ townHasOfficials: true }),
      ]);
      button(page, 'Accept Jane Doe').click();
      fixture.detectChanges();
      expect(page.textContent).not.toContain('Government email domains');
      type(page, 'Source', 'https://adel.example/council');
      (
        page.querySelector(
          '.candidate-form button[type="submit"]'
        ) as HTMLButtonElement
      ).click();
      const accept = http().expectOne(`${URL}/${ID}/accept`);
      expect(accept.request.body).toEqual({
        office: 'Mayor',
        source: 'https://adel.example/council',
      });
      accept.flush({ data: candidate({ status: 'accepted' }) });
      flushCandidates([]);
    });

    it('shows the server refusal inside the form and keeps it open', async () => {
      const { fixture, page } = await open([
        candidate({ townHasOfficials: true }),
      ]);
      button(page, 'Accept Jane Doe').click();
      fixture.detectChanges();
      type(page, 'Source', 'https://adel.example/council');
      (
        page.querySelector(
          '.candidate-form button[type="submit"]'
        ) as HTMLButtonElement
      ).click();
      http()
        .expectOne(`${URL}/${ID}/accept`)
        .flush(
          { message: 'Jane Doe is already on the roster.' },
          { status: 400, statusText: 'Bad Request' }
        );
      fixture.detectChanges();
      expect(
        page.querySelector('.candidate-form .problem')?.textContent
      ).toContain('already on the roster');
    });

    it('rejects only after confirmation', async () => {
      const { fixture, page } = await open();
      button(page, 'Reject Jane Doe').click();
      fixture.detectChanges();
      expect(page.textContent).toContain('Reject Jane Doe?');
      http().expectNone(`${URL}/${ID}/reject`);

      const confirm = Array.from(
        page.querySelectorAll('.candidate-form button')
      ).find(
        (b) => b.textContent?.trim() === 'Yes, reject'
      ) as HTMLButtonElement;
      confirm.click();
      const reject = http().expectOne(`${URL}/${ID}/reject`);
      expect(reject.request.method).toBe('POST');
      reject.flush({ data: candidate({ status: 'rejected' }) });
      flushCandidates([]);
      fixture.detectChanges();
      expect(page.textContent).toContain('Jane Doe was rejected');
    });

    it('can back out of a rejection', async () => {
      const { fixture, page } = await open();
      button(page, 'Reject Jane Doe').click();
      fixture.detectChanges();
      Array.from(page.querySelectorAll('.candidate-form button'))
        .find((b) => b.textContent?.trim() === 'Cancel')
        ?.dispatchEvent(new Event('click'));
      fixture.detectChanges();
      expect(page.querySelector('.candidate-form')).toBeNull();
    });
  });
});

describe('DaylightOperationsComponent in another app', () => {
  async function render(options: {
    permissions: string[];
    town?: { slug?: string; name?: string };
    showHeading?: boolean;
  }) {
    TestBed.configureTestingModule({
      imports: [DaylightOperationsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: DAYLIGHT_OPS_ACCESS,
          useValue: () => of(options.permissions),
        },
      ],
    });
    const fixture = TestBed.createComponent(DaylightOperationsComponent);
    if (options.town) fixture.componentRef.setInput('town', options.town);
    if (options.showHeading !== undefined)
      fixture.componentRef.setInput('showHeading', options.showHeading);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http().verify());

  it('takes its permissions from the app that hosts it, not /me', async () => {
    const { page } = await render({ permissions: ['density.read'] });
    http()
      .expectOne(`${API}/operations/density`)
      .flush({ data: { rows: [] } });
    expect(page.querySelector('#density-heading')).not.toBeNull();
    expect(page.querySelector('#pipeline-heading')).toBeNull();
  });

  it('hides its own heading when the host page has one', async () => {
    const { page } = await render({ permissions: [], showHeading: false });
    expect(page.querySelector('h1')).toBeNull();
    expect(page.querySelector('.embedded')).not.toBeNull();
  });

  it('narrows towns to the one it is given and backfills only that town', async () => {
    const { fixture, page } = await render({
      permissions: ['density.read', 'town.configure'],
      town: { name: 'adel' },
    });
    http()
      .expectOne(`${API}/operations/pipeline-health`)
      .flush({
        data: {
          configured: true,
          checkedAt: '2026-10-01T00:00:00.000Z',
          towns: [
            { slug: 'adel-ga', name: 'Adel', lastRun: null, problems: [] },
            { slug: 'tifton-ga', name: 'Tifton', lastRun: null, problems: [] },
          ],
        },
      });
    http()
      .expectOne(`${API}/operations/official-candidates`)
      .flush({ data: [] });
    http().expectOne(`${API}/operations/backfill`).flush({ data: idle });
    http()
      .expectOne(`${API}/operations/density`)
      .flush({
        data: {
          rows: [town('Adel', 3), town('Tifton', 9)],
        },
      });
    fixture.detectChanges();
    const rows = Array.from(page.querySelectorAll('tbody th[scope="row"]')).map(
      (t) => t.textContent?.trim()
    );
    expect(rows).toEqual(['Adel', 'Adel']);
    const button = Array.from(page.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Pull and backfill')
    ) as HTMLButtonElement;
    expect(button.textContent).toContain('Pull and backfill adel');
    button.click();
    const request = http().expectOne(`${API}/operations/backfill`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ days: 180, towns: ['adel-ga'] });
    request.flush({ data: { ...idle, running: false } });
  });

  describe('a panel that cannot load', () => {
    const cases: [string, string, string, unknown][] = [
      [
        'pipeline health',
        'town.configure',
        'operations/pipeline-health',
        { configured: false, towns: [], checkedAt: '2026-10-01T00:00:00.000Z' },
      ],
      [
        'official candidates',
        'town.configure',
        'operations/official-candidates',
        [],
      ],
      [
        'contributor density',
        'density.read',
        'operations/density',
        { rows: [] },
      ],
      [
        'copyright notices',
        'takedown.manage',
        'operations/takedown-notices?state=received',
        [],
      ],
    ];

    it.each(cases)(
      'shows %s as unavailable and retries it',
      async (_name, permission, path, recovered) => {
        const { fixture, page } = await render({ permissions: [permission] });
        const pending = http().match((r) =>
          r.urlWithParams.startsWith(`${API}/${path.split('?')[0]}`)
        );
        expect(pending.length).toBe(1);
        // Other panels of the same permission load alongside; settle them.
        for (const other of http().match(() => true))
          other.flush({
            data: other.request.url.includes('candidates') ? [] : idle,
          });
        pending[0].flush(
          { message: 'down' },
          { status: 503, statusText: 'Service Unavailable' }
        );
        fixture.detectChanges();
        const alert = Array.from(
          page.querySelectorAll('.problem[role="alert"]')
        ).find((el) => el.textContent?.includes('Unavailable.'));
        expect(alert).toBeDefined();
        const retry = alert?.querySelector('button') as HTMLButtonElement;
        expect(retry.textContent?.trim()).toBe('Retry');
        retry.click();
        const again = http().match((r) =>
          r.urlWithParams.startsWith(`${API}/${path.split('?')[0]}`)
        );
        expect(again.length).toBe(1);
        again[0].flush({ data: recovered });
        fixture.detectChanges();
        expect(
          Array.from(page.querySelectorAll('.problem[role="alert"]')).some(
            (el) => el.textContent?.includes('Unavailable.')
          )
        ).toBe(false);
      }
    );
  });

  describe('replies with missing or null fields', () => {
    const ALL = [
      'town.configure',
      'density.read',
      'takedown.manage',
      'official.verify',
      'community.maintain',
    ];

    it('shows a failed load, not a TypeError, for empty 200 bodies', async () => {
      const { fixture, page } = await render({ permissions: ALL });
      for (const path of [
        'pipeline-health',
        'official-candidates',
        'density',
        'takedown-notices?state=received',
      ]) {
        http().expectOne(`${API}/operations/${path}`).flush({});
      }
      http().expectOne(`${API}/operations/backfill`).flush(null);
      expect(() => fixture.detectChanges()).not.toThrow();
      expect(page.textContent).toContain('could not be loaded');
    });

    it('renders a backfill and notices that omit their lists', async () => {
      const { fixture, page } = await render({ permissions: ALL });
      http()
        .expectOne(`${API}/operations/pipeline-health`)
        .flush({ data: { configured: true, checkedAt: null } });
      http()
        .expectOne(`${API}/operations/official-candidates`)
        .flush({ data: [] });
      http()
        .expectOne(`${API}/operations/density`)
        .flush({ data: { rows: null } });
      http()
        .expectOne(`${API}/operations/takedown-notices?state=received`)
        .flush({
          data: [
            {
              id: 'n1',
              work: 'A work',
              claimantName: 'C',
              claimantEmail: 'c@example.test',
              state: 'received',
              contributionIds: null,
            },
          ],
        });
      http()
        .expectOne(`${API}/operations/backfill`)
        .flush({ data: { running: true, startedAt: null } });

      expect(() => fixture.detectChanges()).not.toThrow();
      expect(page.textContent).toContain('Locates 0 contributions: none');
    });
  });
});
