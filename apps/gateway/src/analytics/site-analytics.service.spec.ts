import { BadRequestException } from '@nestjs/common';
import {
  MAX_SITE_ANALYTICS_CAMPAIGN_KEYS,
  MAX_SITE_ANALYTICS_PAGE_KEYS,
  SITE_ANALYTICS_OVERFLOW,
  SiteAnalyticsService,
  siteAnalyticsAppsFromEnv,
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
    ['an app that is not allowlisted', { ...event, appId: 'someone-else' }],
  ])('rejects %s', async (_label, input) => {
    await expect(service.record(input)).rejects.toThrow(BadRequestException);
    expect(await service.summary()).toEqual([]);
  });

  it('counts into a fixed overflow once the campaign budget is full', async () => {
    for (let i = 0; i < MAX_SITE_ANALYTICS_CAMPAIGN_KEYS; i += 1) {
      await service.record({ ...event, utmCampaign: `junk-${i}` });
    }

    // A new campaign no longer gets its own counter, but it is still counted,
    // under labels the caller cannot choose.
    await service.record({ ...event, path: '/contact', utmCampaign: 'late' });
    await service.record({ ...event, path: '/partners', utmCampaign: 'later' });
    const summary = await service.summary();
    expect(summary.find((entry) => entry.utmCampaign === 'late')).toBe(
      undefined
    );
    expect(
      summary.find((entry) => entry.path === SITE_ANALYTICS_OVERFLOW)
    ).toEqual(
      expect.objectContaining({
        name: 'page_view',
        utmCampaign: SITE_ANALYTICS_OVERFLOW,
        count: 2,
      })
    );
    // Existing campaign counters still increment.
    await service.record({ ...event, utmCampaign: 'junk-0' });
    expect(
      (await service.summary()).find((entry) => entry.utmCampaign === 'junk-0')
        ?.count
    ).toBe(2);
  });

  it('keeps room for pages when campaign values are flooded', async () => {
    for (let i = 0; i < MAX_SITE_ANALYTICS_CAMPAIGN_KEYS + 50; i += 1) {
      await service.record({ ...event, utmCampaign: `junk-${i}` });
    }
    const page = {
      appId: 'hai',
      name: 'page_view',
      path: '/how-we-work',
    };

    await service.record(page);

    expect(
      (await service.summary()).find((entry) => entry.path === '/how-we-work')
    ).toEqual(expect.objectContaining({ utmCampaign: null, count: 1 }));
  });

  it('bounds page counters the same way', async () => {
    for (let i = 0; i < MAX_SITE_ANALYTICS_PAGE_KEYS; i += 1) {
      await service.record({
        appId: 'hai',
        name: 'page_view',
        path: `/p${i}`,
      });
    }

    await service.record({ appId: 'hai', name: 'page_view', path: '/new' });

    const summary = await service.summary();
    expect(summary).toHaveLength(MAX_SITE_ANALYTICS_PAGE_KEYS + 1);
    expect(
      summary.find((entry) => entry.path === SITE_ANALYTICS_OVERFLOW)
    ).toEqual(expect.objectContaining({ utmSource: null, count: 1 }));
  });

  it('reads the app allowlist from the environment', () => {
    expect(siteAnalyticsAppsFromEnv(undefined)).toEqual(['hai']);
    expect(siteAnalyticsAppsFromEnv('hai, forge ,BAD APP')).toEqual([
      'hai',
      'forge',
    ]);
  });

  it('filters the summary by app and sorts by count', async () => {
    service = new SiteAnalyticsService(new MemorySiteAnalyticsStore(), [
      'hai',
      'other',
    ]);
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
