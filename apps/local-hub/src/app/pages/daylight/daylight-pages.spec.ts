import { TestBed } from '@angular/core/testing';
import { ADEL, daylightProviders, http } from './daylight-testing';
import { DaylightContributorPage } from './contributor/daylight-contributor.page';
import { DaylightCopyrightPage } from './copyright/daylight-copyright.page';
import { DaylightWatchPage } from './watch/daylight-watch.page';

const API = '/api/local-hub';

describe('Daylight pages', () => {
  afterEach(() => http().verify());

  it('names the town on the watcher page, and links to its report form', async () => {
    TestBed.configureTestingModule({
      imports: [DaylightWatchPage],
      providers: daylightProviders({ params: { slug: 'adel-ga' }, city: ADEL }),
    });
    const fixture = TestBed.createComponent(DaylightWatchPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toBe('Watch Adel');
    expect(page.querySelector('a.start')?.getAttribute('href')).toBe(
      '/city/adel-ga/report'
    );
  });

  it("tells a contributor's record in a sentence, not a score", () => {
    TestBed.configureTestingModule({
      imports: [DaylightContributorPage],
      providers: daylightProviders({ params: { id: 'u1' } }),
    });
    const fixture = TestBed.createComponent(DaylightContributorPage);
    fixture.detectChanges();
    http()
      .expectOne(`${API}/contributors/u1`)
      .flush({
        data: {
          id: 'u1',
          handle: 'clerkwatcher',
          bio: 'I go to every meeting.',
          official: null,
          reports: [],
          corroborated: [],
          history: { confirmed: 2, contradicted: 1, pending: 0 },
        },
      });
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toBe('clerkwatcher');
    expect(page.querySelector('.history')?.textContent).toBe(
      'Of 3 reports, 2 have since been borne out by a record; 1 was contradicted by one.'
    );
  });

  it('says so when there is no such contributor', () => {
    TestBed.configureTestingModule({
      imports: [DaylightContributorPage],
      providers: daylightProviders({ params: { id: 'nobody' } }),
    });
    const fixture = TestBed.createComponent(DaylightContributorPage);
    fixture.detectChanges();
    http()
      .expectOne(`${API}/contributors/nobody`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent
    ).toBe('No such contributor');
  });

  it('files a copyright notice with one location per line', () => {
    TestBed.configureTestingModule({
      imports: [DaylightCopyrightPage],
      providers: daylightProviders({}),
    });
    const fixture = TestBed.createComponent(DaylightCopyrightPage);
    fixture.detectChanges();
    fixture.componentInstance['form'].patchValue({
      claimantName: 'Ann Owner',
      claimantEmail: 'ann@example.com',
      claimantAddress: '1 Main St',
      work: 'My photograph of the courthouse',
      locations: 'c1\nc2',
      goodFaith: true,
      accurateUnderPenalty: true,
      signature: 'Ann Owner',
    });
    const page = fixture.nativeElement as HTMLElement;
    (page.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit')
    );
    const request = http().expectOne(`${API}/copyright/notices`);
    expect(request.request.body.locations).toEqual(['c1', 'c2']);
    request.flush({ data: { id: 'n1', locatedContributions: 2 } });
    fixture.detectChanges();
    expect(page.querySelector('.done')?.textContent).toContain(
      'Its number is n1.'
    );
  });
});
