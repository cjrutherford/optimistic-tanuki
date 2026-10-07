import { BadRequestException } from '@nestjs/common';
import {
  MAX_SITE_ANALYTICS_KEYS,
  SiteAnalyticsService,
} from './site-analytics.service';
import { MemorySiteAnalyticsStore } from './site-analytics.store';

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
    service = new SiteAnalyticsService(new MemorySiteAnalyticsStore());
  });

  it('counts identical events under one aggregate key', async () => {
    await service.record(event);
    await service.record(event);
    await service.record({
      ...event,
      utmSource: undefined,
      utmMedium: '',
      utmCampaign: null,
    });

    expect(await service.summary('hai')).toEqual([
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

  it('accepts every event the HAI site sends', async () => {
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
      await expect(
        service.record({
          ...event,
          path: '/private-cloud/assessment',
          name,
          detail,
        })
      ).resolves.toBeUndefined();
    }
  });

  it('stores nothing about the visitor', async () => {
    await service.record({
      ...event,
      // Extra fields a client might send are dropped, never stored.
      ...({ email: 'ada@example.com', ip: '10.0.0.1' } as object),
    });

    expect(Object.keys((await service.summary())[0]).sort()).toEqual(
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
  ])('rejects %s', async (_label, input) => {
    await expect(service.record(input)).rejects.toThrow(BadRequestException);
    expect(await service.summary()).toEqual([]);
  });

  it('caps the number of distinct counters', async () => {
    for (let i = 0; i < MAX_SITE_ANALYTICS_KEYS; i += 1) {
      await service.record({ ...event, detail: `d${i}` });
    }

    await expect(
      service.record({ ...event, detail: 'one-more' })
    ).rejects.toThrow('Analytics capacity reached.');
    // Existing counters still increment.
    await service.record({ ...event, detail: 'd0' });
    expect(
      (await service.summary()).find((entry) => entry.detail === 'd0')?.count
    ).toBe(2);
  });

  it('filters the summary by app and sorts by count', async () => {
    await service.record({ ...event, appId: 'other' });
    await service.record({ ...event, name: 'phone_click' });
    await service.record({ ...event, name: 'phone_click' });
    await service.record(event);

    expect((await service.summary('hai')).map((entry) => entry.name)).toEqual([
      'phone_click',
      'page_view',
    ]);
  });

  it('exposes counters to Prometheus with every label', async () => {
    await service.record(event);
    await service.record(event);
    await service.record({ ...event, name: 'cta_click', detail: 'assessment' });

    const exposition = await service.prometheus();

    expect(exposition).toContain('# TYPE ot_site_events_total counter');
    expect(exposition).toContain(
      'ot_site_events_total{app="hai",event="page_view",path="/private-cloud",detail="",utm_source="print",utm_medium="flyer",utm_campaign="private_cloud"} 2'
    );
    expect(exposition).toContain(
      'event="cta_click",path="/private-cloud",detail="assessment"'
    );
  });
});
