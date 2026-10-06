import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DaylightAccountComponent } from './daylight-account.component';
import { DaylightMyReportsComponent } from './daylight-my-reports.component';
import { DaylightOfficialApplicationComponent } from './daylight-official-application.component';

const API = '/api/local-hub';

const report = (id: string, state: string) => ({
  id,
  localitySlug: 'adel-ga',
  kind: 'account',
  subject: { kind: 'other', ref: null, text: `Report ${id}` },
  occurredOn: null,
  body: 'x',
  links: [],
  disclosedInterest: null,
  artifact: null,
  state,
  review: [],
  submittedAt: '2026-09-23T14:00:00Z',
});

function render<T>(component: Type<T>) {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  });
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return {
    fixture,
    page: fixture.nativeElement as HTMLElement,
    http: TestBed.inject(HttpTestingController),
  };
}

describe('Daylight on the account page', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('lists your reports only when the account may read them', () => {
    const { fixture, page, http } = render(DaylightAccountComponent);
    http.expectOne(`${API}/me`).flush({ data: { permissions: [], roles: [] } });
    http.expectOne(`${API}/editions`).flush({ data: [] });
    fixture.detectChanges();
    expect(page.querySelector('app-daylight-my-reports')).toBeNull();
    expect(
      page.querySelector('app-daylight-official-application')
    ).not.toBeNull();
  });

  it('offers withdrawal while a report is live, and a counter-notice once taken down', () => {
    const { fixture, page, http } = render(DaylightMyReportsComponent);
    http
      .expectOne(`${API}/contributions/mine`)
      .flush({ data: [report('a', 'held'), report('b', 'taken-down')] });
    fixture.detectChanges();
    const [held, takenDown] = Array.from(page.querySelectorAll('.report'));
    expect(held?.querySelector('button')?.textContent?.trim()).toBe(
      'Withdraw this report'
    );
    expect(takenDown?.querySelector('button')?.textContent?.trim()).toBe(
      'Answer with a counter-notice'
    );

    (held?.querySelector('button') as HTMLButtonElement).click();
    http.expectOne(`${API}/contributions/a/withdraw`).flush({ data: {} });
    http.expectOne(`${API}/contributions/mine`).flush({ data: [] });
    fixture.detectChanges();
    expect(page.textContent).toContain('Withdrawn.');
  });

  it('shows every reason the official check gave', () => {
    const { fixture, page, http } = render(
      DaylightOfficialApplicationComponent
    );
    http.expectOne(`${API}/editions`).flush({
      data: [{ slug: 'adel-ga', name: 'Adel', state: 'GA', latest: null }],
    });
    fixture.detectChanges();
    fixture.componentInstance['town'] = 'adel-ga';
    fixture.componentInstance['apply']();
    const request = http.expectOne(`${API}/officials/apply`);
    expect(request.request.body).toEqual({ localitySlug: 'adel-ga' });
    request.flush({
      data: {
        granted: false,
        standing: 'none',
        office: null,
        reasons: ['Your address is not on the town roster.'],
      },
    });
    fixture.detectChanges();
    expect(page.querySelector('.outcome')?.textContent?.trim()).toBe(
      'Your address is not on the town roster.'
    );
  });
});
