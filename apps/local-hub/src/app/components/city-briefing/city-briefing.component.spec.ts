import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CityBriefingComponent } from './city-briefing.component';

const EDITION = '/api/local-hub/editions/adel-ga';

const history = {
  slug: 'adel-ga',
  name: 'Adel',
  state: 'GA',
  latest: '2026-09-24',
  briefings: [
    { cadence: 'daily', periodStart: '2026-09-23', periodEnd: '2026-09-24' },
    { cadence: 'daily', periodStart: '2026-09-22', periodEnd: '2026-09-23' },
  ],
};

function briefing(periodEnd: string) {
  return {
    slug: 'adel-ga',
    name: 'Adel',
    state: 'GA',
    cadence: 'daily',
    periodStart: periodEnd,
    periodEnd,
    createdAt: `${periodEnd}T06:00:00Z`,
    markdown: `# Adel, GA — daily briefing, ${periodEnd}\n\n## No new public business in Adel\n\nNothing dated this week.`,
  };
}

describe('CityBriefingComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CityBriefingComponent>;

  function render(date: string | null = null): HTMLElement {
    TestBed.configureTestingModule({
      imports: [CityBriefingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CityBriefingComponent);
    fixture.componentRef.setInput('citySlug', 'adel-ga');
    fixture.componentRef.setInput('localitySlug', 'adel-ga');
    fixture.componentRef.setInput('cityName', 'Adel');
    fixture.componentRef.setInput('date', date);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('shows the latest briefing with the edition strip', () => {
    const page = render();
    expect(page.textContent).toContain('Loading the briefing');
    http.expectOne(EDITION).flush({ data: history });
    http
      .expectOne(`${EDITION}/briefings/latest`)
      .flush({ data: briefing('2026-09-24') });
    fixture.detectChanges();

    expect(page.querySelector('time')?.textContent?.trim()).toBe(
      'Thursday, September 24, 2026'
    );
    expect(page.querySelector('civic-briefing-body h2')?.textContent).toBe(
      'No new public business in Adel'
    );
    const days = Array.from(page.querySelectorAll('civic-edition-strip a')).map(
      (a) => a.getAttribute('href')
    );
    expect(days).toEqual([
      '/city/adel-ga/briefing/2026-09-23',
      '/city/adel-ga/briefing/2026-09-24',
    ]);
  });

  it('asks for the edition of the given day', () => {
    const page = render('2026-09-23');
    http.expectOne(EDITION).flush({ data: history });
    http
      .expectOne(`${EDITION}/briefings/2026-09-23`)
      .flush({ data: briefing('2026-09-23') });
    fixture.detectChanges();
    expect(
      page
        .querySelector('civic-edition-strip [aria-current="page"]')
        ?.getAttribute('href')
    ).toBe('/city/adel-ga/briefing/2026-09-23');
  });

  it('says plainly when a town has no briefing yet', () => {
    const page = render();
    http
      .expectOne(EDITION)
      .flush(
        { message: 'No briefings' },
        { status: 404, statusText: 'Not Found' }
      );
    // forkJoin cancels the other request once one fails.
    http.match(`${EDITION}/briefings/latest`);
    fixture.detectChanges();
    expect(page.textContent).toContain(
      'No briefing has been published for Adel yet.'
    );
  });

  it('names the missing day', () => {
    const page = render('2026-09-01');
    http.expectOne(EDITION).flush({ data: history });
    http
      .expectOne(`${EDITION}/briefings/2026-09-01`)
      .flush(
        { message: 'No briefing' },
        { status: 404, statusText: 'Not Found' }
      );
    fixture.detectChanges();
    expect(page.textContent).toContain(
      'There is no Adel briefing for Tuesday, September 1, 2026.'
    );
  });

  it("shows the gateway's message when the service is down", () => {
    const page = render();
    http
      .expectOne(EDITION)
      .flush(
        { message: 'Briefings are unavailable right now.' },
        { status: 503, statusText: 'Service Unavailable' }
      );
    http.match(`${EDITION}/briefings/latest`);
    fixture.detectChanges();
    const status = page.querySelector('.briefing-status--failed');
    expect(status?.textContent?.trim()).toBe(
      'Briefings are unavailable right now.'
    );
  });
});
