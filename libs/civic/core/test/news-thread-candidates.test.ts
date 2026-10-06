import { buildNewsThreadCandidates } from '../src/story.js';

const base = (input: Partial<Record<string, unknown>> = {}) => ({
  id: 1,
  sourceId: 'tift-gazette',
  localitySlug: 'tifton-ga',
  scopeSlug: 'tift-county-ga',
  scopeKind: 'county',
  geographyDecision: 'include',
  title: 'Road project advances',
  body: 'The county road project received a public update and remains under review.',
  canonicalUrl: 'https://gazette.example/roads',
  uris: JSON.stringify(['https://gazette.example/roads']),
  publishedAt: '2026-09-05T12:00:00.000Z',
  eventDate: null,
  ...input,
});

describe('buildNewsThreadCandidates', () => {
  it('groups same scoped story evidence deterministically and retains exact item bindings', () => {
    const result = buildNewsThreadCandidates(
      [
        base(),
        base({
          id: 2,
          sourceId: 'tift-county',
          canonicalUrl: 'https://county.example/roads',
          uris: JSON.stringify(['https://county.example/roads']),
          publishedAt: '2026-09-08T12:00:00.000Z',
        }),
        base({
          id: 3,
          sourceId: 'nashville-wire',
          localitySlug: 'nashville-ga',
          scopeSlug: 'berrien-county-ga',
          title: 'Road project advances',
          canonicalUrl: 'https://wire.example/roads',
          uris: JSON.stringify(['https://wire.example/roads']),
        }),
      ] as never,
      {
        targetScopeSlug: 'tift-county-ga',
        ancestry: ['tifton-ga', 'tift-county-ga'],
        contextRange: { start: '2026-08-14', end: '2026-09-13' },
        timezone: 'America/New_York',
      }
    );
    expect(result.length).toBe(1);
    expect(result[0]?.scopeSlug).toBe('tift-county-ga');
    expect(
      result[0]?.items.map((item) => [
        item.sourceKey,
        item.civicItemId,
        item.date,
      ])
    ).toStrictEqual([
      ['tift-gazette', 1, '2026-09-05'],
      ['tift-county', 2, '2026-09-08'],
    ]);
    expect(result[0]?.candidateKey ?? '').toMatch(/tift-county-ga/);
  });

  it('does not merge conflicting counties or generic overlapping words', () => {
    const result = buildNewsThreadCandidates(
      [
        base(),
        base({
          id: 2,
          scopeSlug: 'cook-county-ga',
          localitySlug: 'adel-ga',
          title: 'Road project advances',
          canonicalUrl: 'https://cook.example/roads',
        }),
        base({
          id: 3,
          title: 'Meeting scheduled',
          body: 'A meeting is scheduled.',
          canonicalUrl: null,
          uris: JSON.stringify([]),
        }),
      ] as never,
      {
        targetScopeSlug: 'tift-county-ga',
        ancestry: ['tifton-ga', 'tift-county-ga'],
        contextRange: { start: '2026-08-14', end: '2026-09-13' },
        timezone: 'America/New_York',
      }
    );
    expect(result.length).toBe(0);
  });

  it('does not use crawler insertion time as an editorial story date', () => {
    const result = buildNewsThreadCandidates(
      [
        base({
          id: 40,
          publishedAt: null,
          eventDate: null,
          observedAt: null,
          createdAt: '2026-09-12T12:00:00.000Z',
        }),
        base({
          id: 41,
          publishedAt: null,
          eventDate: null,
          observedAt: null,
          createdAt: '2026-09-12T12:00:00.000Z',
          canonicalUrl: 'https://gazette.example/roads-2',
        }),
      ] as never,
      {
        targetScopeSlug: 'tift-county-ga',
        ancestry: ['tifton-ga', 'tift-county-ga'],
        contextRange: { start: '2026-08-14', end: '2026-09-13' },
        timezone: 'America/New_York',
      }
    );
    expect(result).toStrictEqual([]);
  });

  it('groups multi-date Tifton evidence while excluding Nashville and Adel foreign-scope overlap', () => {
    const inputs = [
      base({
        id: 10,
        sourceId: 'tifton-daily',
        publishedAt: '2026-08-20T12:00:00.000Z',
        canonicalUrl: 'https://tifton.example/roads-1',
      }),
      base({
        id: 11,
        sourceId: 'tifton-county-paper',
        publishedAt: '2026-09-05T12:00:00.000Z',
        canonicalUrl: 'https://county.example/roads-2',
      }),
      base({
        id: 12,
        sourceId: 'adel-news-tribune',
        publishedAt: '2026-09-06T12:00:00.000Z',
        canonicalUrl: 'https://adel.example/roads-3',
        accessMode: 'snippet-only',
      }),
      base({
        id: 13,
        sourceId: 'nashville-wire',
        localitySlug: 'nashville-ga',
        scopeSlug: 'berrien-county-ga',
        publishedAt: '2026-09-06T12:00:00.000Z',
        canonicalUrl: 'https://nashville.example/roads',
      }),
      base({
        id: 14,
        sourceId: 'adel-wire',
        localitySlug: 'adel-ga',
        scopeSlug: 'cook-county-ga',
        publishedAt: '2026-09-06T12:00:00.000Z',
        canonicalUrl: 'https://cook.example/roads',
      }),
    ];
    const options = {
      targetScopeSlug: 'tift-county-ga',
      ancestry: ['tifton-ga', 'tift-county-ga'],
      contextRange: { start: '2026-08-14', end: '2026-09-13' },
      timezone: 'America/New_York',
    } as const;
    const result = buildNewsThreadCandidates(inputs as never, options);
    const rerun = buildNewsThreadCandidates(
      [...inputs].reverse() as never,
      options
    );
    expect(result).toStrictEqual(rerun);
    expect(result.length).toBe(1);
    expect(
      result[0]?.items.map((item) => ({
        sourceKey: item.sourceKey,
        civicItemId: item.civicItemId,
        date: item.date,
        snippetOnly: item.snippetOnly === true,
      }))
    ).toStrictEqual([
      {
        sourceKey: 'tifton-daily',
        civicItemId: 10,
        date: '2026-08-20',
        snippetOnly: false,
      },
      {
        sourceKey: 'tifton-county-paper',
        civicItemId: 11,
        date: '2026-09-05',
        snippetOnly: false,
      },
      {
        sourceKey: 'adel-news-tribune',
        civicItemId: 12,
        date: '2026-09-06',
        snippetOnly: true,
      },
    ]);
    expect(result[0]?.candidateKey ?? '').toMatch(/^tift-county-ga\|/);
    expect(JSON.stringify(result)).not.toMatch(/nashville|cook-county/);
  });

  it('does not merge unrelated Tifton Gazette boilerplate topics', () => {
    const common = {
      sourceId: 'tifton-gazette',
      localitySlug: 'tifton-ga',
      scopeSlug: 'tift-county-ga',
      scopeKind: 'county',
      geographyDecision: 'include',
      publishedAt: '2026-09-06T12:00:00.000Z',
      body: 'Tifton Gazette local news update for Tifton County residents and the community.',
    };
    const result = buildNewsThreadCandidates(
      [
        {
          ...common,
          id: 21,
          title: 'Exchange Club announces fall fundraiser',
          canonicalUrl: 'https://gazette.example/exchange',
        },
        {
          ...common,
          id: 22,
          title: 'EV charging station proposed for downtown',
          canonicalUrl: 'https://gazette.example/charging',
        },
        {
          ...common,
          id: 23,
          title: 'Shae Tucker school schedule changes announced',
          canonicalUrl: 'https://gazette.example/shae-tucker',
        },
      ] as never,
      {
        targetScopeSlug: 'tift-county-ga',
        ancestry: ['tifton-ga', 'tift-county-ga'],
        contextRange: { start: '2026-08-14', end: '2026-09-13' },
        timezone: 'America/New_York',
      }
    );
    expect(result.length).toBe(0);
  });

  it('does not let repeated publisher navigation merge unrelated article titles', () => {
    const commonBody =
      'Subscribe Home News Obituaries Sports Classifieds E-Edition Contests Best of Tifton Home Subscriptions Newsletter Signup E-Edition News Sports Local Sports Obituaries Opinion Classifieds Public Notices Contests Best of Tifton Services Contact Us About Us Getting your Trinity Audio player ready Email newsletter signup You Might Like News Most Popular Sections Home News Obituaries Sports Classifieds Press releases Services Newsletter Signup e-Edition Subscriptions Our Company About Us ';
    const titles = [
      'Tift County Schools thanks retired principal for brief return to service',
      'Tift County Schools celebrates academic growth for 25-26 school year',
      'Exchange Club unveils Tomb of the Unknown Soldier replica at Tifton Mall',
      'School district celebrates teachers earning gifted endorsements',
      'Tift County Schools appoints Jennifer Howell as interim superintendent',
      'Keep Tift Beautiful names September Beauty Spots',
    ];
    const result = buildNewsThreadCandidates(
      titles.map((title, index) => ({
        ...base({
          id: 100 + index,
          title,
          canonicalUrl: `https://gazette.example/${index}`,
        }),
        body: `${commonBody} TIFTON — ${title}. The local report provides details specific to this separate matter.`,
      })) as never,
      {
        targetScopeSlug: 'tifton-ga',
        ancestry: ['tifton-ga', 'tift-county-ga'],
        contextRange: { start: '2026-08-14', end: '2026-09-13' },
        timezone: 'America/New_York',
      }
    );
    expect(result.length).toBe(0);
  });

  it('keeps a strong canonical URL or external case ID as an identity override', () => {
    const result = buildNewsThreadCandidates(
      [
        base({
          id: 31,
          title: 'Public hearing for a rezoning case',
          canonicalUrl: 'https://gazette.example/rezoning',
          externalId: 'CASE-42',
        }),
        base({
          id: 32,
          title: 'Board votes on the rezoning request',
          canonicalUrl: 'https://gazette.example/rezoning',
          externalId: 'CASE-42',
        }),
      ] as never,
      {
        targetScopeSlug: 'tift-county-ga',
        ancestry: ['tifton-ga', 'tift-county-ga'],
        contextRange: { start: '2026-08-14', end: '2026-09-13' },
        timezone: 'America/New_York',
      }
    );
    expect(result.length).toBe(1);
    expect(result[0]?.items.length).toBe(2);
  });
});
