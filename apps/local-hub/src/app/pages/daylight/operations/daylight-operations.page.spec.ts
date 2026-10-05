import { TestBed } from '@angular/core/testing';
import { daylightProviders, http } from '../daylight-testing';
import { DaylightOperationsPage } from './daylight-operations.page';

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

describe('DaylightOperationsPage', () => {
  async function render(permissions: string[]) {
    TestBed.configureTestingModule({
      imports: [DaylightOperationsPage],
      providers: daylightProviders({}),
    });
    const fixture = TestBed.createComponent(DaylightOperationsPage);
    fixture.detectChanges();
    http()
      .expectOne(`${API}/me`)
      .flush({ data: { permissions, roles: [] } });
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, page: fixture.nativeElement as HTMLElement };
  }

  afterEach(() => http().verify());

  it('turns away an account without operator permissions', async () => {
    const { page } = await render(['contribution.create']);
    expect(page.textContent).toContain('This page is for Daylight operators.');
    expect(page.querySelector('section')).toBeNull();
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
});
