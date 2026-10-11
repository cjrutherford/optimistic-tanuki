import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  ANALYTICS_TRANSPORT,
  AnalyticsEvent,
  AnalyticsService,
} from './analytics.service';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('AnalyticsService', () => {
  let sent: AnalyticsEvent[];
  let service: AnalyticsService;
  let router: Router;

  const link = (href: string) => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', href);
    anchor.textContent = 'link';
    document.body.appendChild(anchor);
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    anchor.remove();
  };

  beforeEach(async () => {
    sent = [];
    sessionStorage.clear();
    Object.defineProperty(navigator, 'doNotTrack', {
      value: null,
      configurable: true,
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: BlankComponent }]),
        {
          provide: ANALYTICS_TRANSPORT,
          useValue: (event: AnalyticsEvent) => sent.push(event),
        },
      ],
    });
    router = TestBed.inject(Router);
    await router.navigateByUrl('/private-cloud?utm_source=print');
    service = TestBed.inject(AnalyticsService);
  });

  it('records one page view per navigation, not one on start', async () => {
    service.start();
    service.start();
    await router.navigateByUrl('/private-cloud/home');
    await router.navigateByUrl('/private-cloud/open-source-stack');

    expect(sent.map((event) => [event.name, event.path])).toEqual([
      ['page_view', '/private-cloud/home'],
      ['page_view', '/private-cloud/open-source-stack'],
    ]);
  });

  it('never sends the query string or anything personal in the path', async () => {
    service.start();
    await router.navigateByUrl('/contact?email=ada@example.com#form');

    expect(sent.at(-1)?.path).toBe('/contact');
    expect(JSON.stringify(sent)).not.toContain('ada@example.com');
  });

  it('keeps a cleaned campaign for the session and attaches it to events', () => {
    service.captureCampaign(
      '?utm_source=Print&utm_medium=flyer&utm_campaign=private_cloud&utm_term=x'
    );
    service.track('page_view');

    expect(sent[0]).toMatchObject({
      utmSource: 'print',
      utmMedium: 'flyer',
      utmCampaign: 'private_cloud',
    });
    expect(service.campaignQuery()).toBe(
      '?utm_source=print&utm_medium=flyer&utm_campaign=private_cloud'
    );
  });

  it('ignores malformed campaign values and keeps the earlier campaign', () => {
    service.captureCampaign('?utm_source=print&utm_campaign=private_cloud');
    service.captureCampaign('?utm_source=ada%40example.com');

    expect(service.campaign()).toEqual({
      utmSource: 'print',
      utmCampaign: 'private_cloud',
    });
  });

  it('classifies phone, email, call-to-action, and audience clicks', () => {
    service.start();
    sent.length = 0;
    link('tel:+19125217314');
    link('mailto:chris@hopefulaspirationsindustries.com');
    link('/private-cloud/assessment');
    link('/contact');
    link('/private-cloud/home');
    link('/private-cloud/organizations');
    link('/partners');

    expect(sent.map((event) => [event.name, event.detail])).toEqual([
      ['phone_click', undefined],
      ['email_click', undefined],
      ['cta_click', 'assessment'],
      ['cta_click', 'contact'],
      ['audience_interest', 'home'],
      ['audience_interest', 'organization'],
    ]);
    expect(JSON.stringify(sent)).not.toMatch(/9125217314|chris@/);
  });

  it('fires once-only events once until the next navigation', async () => {
    service.start();
    service.trackOnce('assessment_start');
    service.trackOnce('assessment_start');
    await router.navigateByUrl('/private-cloud/assessment');
    service.trackOnce('assessment_start');

    expect(
      sent.filter((event) => event.name === 'assessment_start')
    ).toHaveLength(2);
  });

  it('sends nothing when the visitor has Do Not Track or Global Privacy Control on', () => {
    Object.defineProperty(navigator, 'doNotTrack', {
      value: '1',
      configurable: true,
    });
    service.track('page_view');
    Object.defineProperty(navigator, 'doNotTrack', {
      value: null,
      configurable: true,
    });
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: true,
      configurable: true,
    });
    service.track('page_view');
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      value: undefined,
      configurable: true,
    });

    expect(sent).toEqual([]);
  });
});
