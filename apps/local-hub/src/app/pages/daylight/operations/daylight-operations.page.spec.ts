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
