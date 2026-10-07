import { BadRequestException } from '@nestjs/common';
import {
  MAX_SITE_ANALYTICS_KEYS,
  SiteAnalyticsService,
} from './site-analytics.service';

describe('SiteAnalyticsService', () => {
  let service: SiteAnalyticsService;
  const event = {
    appId: 'hai',
    name: 'page_view',
    path: '/private-cloud',
    utmSource: 'print',
    utmMedium: 'flyer',
    utmCampaign: 'private_cloud',
  };

  beforeEach(() => {
    service = new SiteAnalyticsService();
  });

  it('counts identical events under one aggregate key', () => {
    service.record(event);
    service.record(event);
    service.record({
      ...event,
      utmSource: undefined,
      utmMedium: '',
      utmCampaign: null,
    });

    expect(service.summary('hai')).toEqual([
      {
        appId: 'hai',
        name: 'page_view',
        path: '/private-cloud',
        detail: null,
        utmSource: 'print',
        utmMedium: 'flyer',
        utmCampaign: 'private_cloud',
        count: 2,
      },
      expect.objectContaining({ utmSource: null, count: 1 }),
    ]);
  });

  it('accepts every event the HAI site sends', () => {
    for (const [name, detail] of [
      ['page_view', undefined],
      ['cta_click', 'assessment'],
      ['cta_click', 'contact'],
      ['audience_interest', 'home'],
      ['audience_interest', 'organization'],
      ['assessment_start', undefined],
      ['assessment_submit', 'home'],
      ['assessment_submit', 'organization'],
      ['phone_click', undefined],
      ['email_click', undefined],
    ]) {
      expect(() =>
        service.record({
          ...event,
          path: '/private-cloud/assessment',
          name,
          detail,
        })
      ).not.toThrow();
    }
  });

  it('stores nothing about the visitor', () => {
    service.record({
      ...event,
      // Extra fields a client might send are dropped, never stored.
      ...({ email: 'ada@example.com', ip: '10.0.0.1' } as object),
    });

    expect(Object.keys(service.summary()[0]).sort()).toEqual(
      [
        'appId',
        'count',
        'detail',
        'name',
        'path',
        'utmCampaign',
        'utmMedium',
        'utmSource',
      ].sort()
    );
  });

  it.each([
    ['an unknown event', { ...event, name: 'session_replay' }],
    ['a path with a query string', { ...event, path: '/contact?email=a@b.c' }],
    ['a path that is not a path', { ...event, path: 'https://evil.example' }],
    [
      'a free-text detail',
      { ...event, detail: 'Ada Lovelace <ada@example.com>' },
    ],
    ['an oversized UTM value', { ...event, utmCampaign: 'x'.repeat(65) }],
    ['a UTM value with an email', { ...event, utmSource: 'ada@example.com' }],
    ['a bad app id', { ...event, appId: 'HAI APP' }],
  ])('rejects %s', (_label, input) => {
    expect(() => service.record(input)).toThrow(BadRequestException);
    expect(service.summary()).toEqual([]);
  });

  it('caps the number of distinct counters', () => {
    for (let i = 0; i < MAX_SITE_ANALYTICS_KEYS; i += 1) {
      service.record({ ...event, detail: `d${i}` });
    }

    expect(() => service.record({ ...event, detail: 'one-more' })).toThrow(
      'Analytics capacity reached.'
    );
    // Existing counters still increment.
    service.record({ ...event, detail: 'd0' });
    expect(
      service.summary().find((entry) => entry.detail === 'd0')?.count
    ).toBe(2);
  });

  it('filters the summary by app and sorts by count', () => {
    service.record({ ...event, appId: 'other' });
    service.record({ ...event, name: 'phone_click' });
    service.record({ ...event, name: 'phone_click' });
    service.record(event);

    expect(service.summary('hai').map((entry) => entry.name)).toEqual([
      'phone_click',
      'page_view',
    ]);
  });
});
