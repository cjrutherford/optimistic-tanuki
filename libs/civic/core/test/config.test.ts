import { join } from 'node:path';
import {
  assertSourceRuntimeAccess,
  parseLocalityConfig,
  validateLocalityConfig,
} from '../src/config.js';
import { LocalityConfigError } from '../src/config.js';
import {
  createLocalityRegistry,
  loadLocalityRegistry,
  resolveSourceIdentity,
} from '../src/locality-registry.js';
import { setRestrictedPublishers } from '../src/restricted-publishers.js';

const base = {
  slug: 'town-a',
  name: 'Town A',
  state: 'GA',
  timezone: 'America/New_York',
  lat: 31,
  lon: -83,
  topics: [],
  cadence: ['daily'],
  kind: 'town',
  parents: ['county-a'],
  edition: true,
  aliases: ['Town A'],
  sources: [],
};

describe('foundation locality config', () => {
  it('parses access, desk, aggregate, and coverage metadata while keeping observedAt runtime-only', () => {
    const locality = parseLocalityConfig({
      ...base,
      sources: [
        {
          sourceKey: 'town-news',
          coverage: 'mentions',
          adapter: 'news-discover',
          name: 'Town News',
          url: 'https://news.google.com/rss/search?q=Town',
          kind: 'news',
          desk: 'community-news',
          accessMode: 'snippet-only',
          accessRestrictionReason:
            'The publisher blocks automated AI crawler body retrieval.',
          restrictionPolicyUrl: 'https://example.test/robots.txt',
          aggregateDiscovery: true,
          aggregateUrl: 'https://news.google.com/rss/search?q=Town',
          config: { query: 'Town news', matchNames: ['Town'] },
          coverageCapabilities: {
            dateQuery: { parameter: 'when', format: 'YYYY-MM-DD' },
            pagination: { mode: 'next-link', maxPages: 3 },
          },
        },
      ],
    });

    expect(locality.sources[0]?.desk).toBe('community-news');
    expect(locality.sources[0]?.accessMode).toBe('snippet-only');
    expect(locality.sources[0]?.aggregateDiscovery).toBe(true);
    expect(
      locality.sources[0]?.coverageCapabilities?.pagination?.maxPages
    ).toBe(3);
    expect('observedAt' in locality.sources[0]!).toBe(false);
  });

  it('rejects observedAt and invalid desk/capability metadata at config ingress', () => {
    const source = {
      sourceKey: 'town-news',
      coverage: 'mentions',
      adapter: 'rss',
      name: 'Town News',
      url: 'https://example.test/feed',
      kind: 'news',
      desk: 'community-news',
    };
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, observedAt: '2026-09-13T00:00:00Z' }],
      })
    ).toThrow(/unknown.*observedAt/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, desk: 'priority-news' }],
      })
    ).toThrow(/desk/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [
          {
            ...source,
            coverageCapabilities: {
              pagination: { mode: 'offset', maxPages: 2 },
            },
          },
        ],
      })
    ).toThrow(/pagination|mode/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [
          {
            ...source,
            coverageCapabilities: { pagination: { mode: 'page', maxPages: 0 } },
          },
        ],
      })
    ).toThrow(/maxPages/i);
  });

  it('requires restricted sources to use aggregate snippet-only access with policy metadata', () => {
    const source = {
      sourceKey: 'restricted-news',
      coverage: 'mentions',
      adapter: 'news-discover',
      name: 'Restricted News',
      url: 'https://news.google.com/rss/search?q=Town',
      kind: 'news',
      desk: 'community-news',
      aggregateDiscovery: true,
      aggregateUrl: 'https://news.google.com/rss/search?q=Town',
      accessRestrictionReason: 'blocked',
      restrictionPolicyUrl: 'https://example.test/robots.txt',
      config: { query: 'Restricted news', matchNames: ['Town'] },
    };
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, accessMode: 'full' }],
      })
    ).toThrow(/snippet-only|restricted/i);
    const {
      accessRestrictionReason: _reason,
      restrictionPolicyUrl: _policy,
      ...withoutPolicy
    } = source;
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...withoutPolicy, accessMode: 'snippet-only' }],
      })
    ).toThrow(/restriction|policy/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [
          {
            ...source,
            accessMode: 'snippet-only',
            accessRestrictionReason: 'blocked',
            restrictionPolicyUrl: 'https://example.test/robots.txt',
            aggregateDiscovery: false,
          },
        ],
      })
    ).toThrow(/aggregate/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [
          {
            ...source,
            accessMode: 'snippet-only',
            accessRestrictionReason: 'blocked',
            restrictionPolicyUrl: 'https://example.test/robots.txt',
            aggregateDiscovery: true,
            aggregateUrl: 'https://publisher.example/article/1',
          },
        ],
      })
    ).toThrow(/aggregateUrl|article/i);
  });

  it('rejects direct sources that target a configured restricted publisher', () => {
    const publisherFile = (sources: object[]) => ({
      ...base,
      slug: 'county-a',
      kind: 'county',
      parents: [],
      edition: false,
      cadence: [],
      sources,
    });
    const paper = {
      sourceKey: 'county-paper',
      adapter: 'news-discover',
      name: 'The Berrien Press',
      url: 'https://news.google.com/rss/search?q=Berrien+Press',
      kind: 'news',
      accessMode: 'snippet-only',
      accessRestrictionReason: 'blocked',
      restrictionPolicyUrl: 'https://www.theberrienpress.com/robots.txt',
      aggregateDiscovery: true,
      aggregateUrl: 'https://news.google.com/rss/search?q=Berrien+Press',
      config: { query: 'Berrien Press', matchNames: ['Berrien'] },
    };
    const direct = {
      sourceKey: 'direct-news',
      adapter: 'rss',
      name: 'Direct news',
      url: 'https://example.test/feed',
      kind: 'news',
    };
    const graph = (source: object) => [
      validateLocalityConfig(publisherFile([paper])),
      validateLocalityConfig({
        ...base,
        parents: ['county-a'],
        sources: [source],
      }),
    ];
    expect(() => createLocalityRegistry(graph(direct))).not.toThrow();
    for (const adapter of [
      'rss',
      'http-scrape',
      'document',
      'open-data',
      'apptegy',
      'granicus',
      'civicclerk',
      'legistar',
      'future-generic',
    ]) {
      expect(() =>
        createLocalityRegistry(
          graph({
            ...direct,
            adapter,
            url: 'https://WWW.TheBerrienPress.com:443/story/1',
          })
        )
      ).toThrow(/restricted publisher/);
    }
    expect(() =>
      createLocalityRegistry(
        graph({ ...direct, url: 'https://edge.theberrienpress.com:8443/feed' })
      )
    ).toThrow(/restricted publisher/);
  });

  it('rejects runtime source objects that bypass config parsing before adapter fetch', () => {
    setRestrictedPublishers([
      { domain: 'theberrienpress.com', names: ['The Berrien Press'] },
      { domain: 'adelnewstribune.com', names: ['Adel News-Tribune'] },
    ]);
    try {
      expect(() =>
        assertSourceRuntimeAccess({
          adapter: 'rss',
          url: 'https://theberrienpress.com/feed',
          aggregateUrl: 'https://news.google.com/rss/search?q=x',
        })
      ).toThrow(/restricted|news-discover|aggregate/i);
      expect(() =>
        assertSourceRuntimeAccess({
          adapter: 'future-adapter',
          url: 'https://adelnewstribune.com/feed',
          aggregateUrl: 'https://news.google.com/rss/search?q=x',
        })
      ).toThrow(/restricted|aggregate/i);
      expect(() =>
        assertSourceRuntimeAccess({
          adapter: 'news-discover',
          url: 'https://news.google.com/rss/search?q=x',
          aggregateUrl: 'https://adelnewstribune.com/story/1',
        })
      ).toThrow(/restricted|aggregate/i);
      expect(() =>
        assertSourceRuntimeAccess({
          adapter: 'rss',
          url: 'https://georgiarecorder.com/feed/',
        })
      ).not.toThrow();
    } finally {
      setRestrictedPublishers([]);
    }
  });

  it('requires a nonempty news-discover query and locality match names', () => {
    const source = {
      sourceKey: 'discover-news',
      coverage: 'mentions',
      adapter: 'news-discover',
      name: 'Discovery',
      url: 'https://news.google.com/rss/search?q=Town',
      kind: 'news',
      config: { query: 'Town news', matchNames: ['Town'] },
    };
    expect(() =>
      validateLocalityConfig({ ...base, sources: [source] })
    ).not.toThrow();
    for (const config of [
      { query: '', matchNames: ['Town'] },
      { query: '   ', matchNames: ['Town'] },
      { query: 'Town news', matchNames: [] },
      { query: 'Town news', matchNames: [''] },
      { query: 'Town news', matchNames: [' Town'] },
      { query: 'Town news', matchNames: ['Town', '   '] },
      { query: undefined, matchNames: ['Town'] },
    ]) {
      expect(() =>
        validateLocalityConfig({ ...base, sources: [{ ...source, config }] })
      ).toThrow(/query|matchNames|discovery/i);
    }
  });

  it('loads every checked-in locality manifest with valid discovery filters', () => {
    for (const locality of loadLocalityRegistry(
      join(__dirname, 'fixtures', 'localities')
    ).all()) {
      for (const source of locality.sources.filter(
        (item) => item.adapter === 'news-discover'
      )) {
        const config = source.config as {
          query?: unknown;
          matchNames?: unknown;
        };
        expect(
          typeof config.query === 'string' && config.query.trim()
        ).toBeTruthy();
        expect(
          Array.isArray(config.matchNames) && config.matchNames.length > 0
        ).toBeTruthy();
      }
    }
  });

  it('parses a locality and preserves source ownership metadata', () => {
    const locality = parseLocalityConfig({
      ...base,
      sources: [
        {
          sourceKey: 'town-news',
          coverage: 'mentions',
          adapter: 'rss',
          name: 'Town News',
          url: 'https://example.test/feed/',
          kind: 'news',
        },
      ],
    });

    expect(locality.slug).toBe('town-a');
    expect(locality.sources[0]?.ownerSlug).toBe('town-a');
  });

  it('rejects malformed locality configuration before registry use', () => {
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...base.sources, sourceKey: 'bad' }],
      })
    ).toThrow(/sources/i);
  });

  it('rejects child-local rule blocks', () => {
    expect(() =>
      validateLocalityConfig({ ...base, rules: { withholdOnUncertain: true } })
    ).toThrow(/rule/i);
  });

  it('rejects a town-owned rules file at config ingress', () => {
    expect(() =>
      validateLocalityConfig({
        ...base,
        rulesFile: 'rules/cook-county.v1.yaml',
      })
    ).toThrow(/rulesFile was removed/);
  });

  it('rejects child-local top-level enablement and source override fields', () => {
    expect(() => validateLocalityConfig({ ...base, enabled: false })).toThrow(
      /unknown key enabled/
    );
    expect(() => validateLocalityConfig({ ...base, disabled: true })).toThrow(
      /unknown key disabled/
    );
    expect(() =>
      validateLocalityConfig({ ...base, sourceOverrides: {} })
    ).toThrow(/unknown key sourceOverrides/);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [
          {
            sourceKey: 'x',
            ownerSlug: 'county-a',
            adapter: 'rss',
            name: 'X',
            url: 'https://example.test/feed',
            kind: 'news',
          },
        ],
      })
    ).toThrow(/unknown key ownerSlug/);
  });

  it('rejects unknown locality keys and source keys outside adapter config', () => {
    expect(() => validateLocalityConfig({ ...base, typo: true })).toThrow(
      /unknown.*typo/i
    );
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [
          {
            sourceKey: 'town-news',
            coverage: 'mentions',
            adapter: 'rss',
            name: 'Town News',
            url: 'https://example.test/feed',
            kind: 'news',
            enabeld: true,
          },
        ],
      })
    ).toThrow(/unknown.*enabeld/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [
          {
            sourceKey: 'town-news',
            coverage: 'mentions',
            adapter: 'rss',
            name: 'Town News',
            url: 'https://example.test/feed',
            kind: 'news',
            config: { enabeld: true },
          },
        ],
      })
    ).not.toThrow();
  });

  it('rejects malformed or non-http source URLs', () => {
    const source = {
      sourceKey: 'town-news',
      coverage: 'mentions',
      adapter: 'rss',
      name: 'Town News',
      kind: 'news',
    };
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, url: 'ftp://example.test/feed' }],
      })
    ).toThrow(/http.*https|URL/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, url: 'not a URL' }],
      })
    ).toThrow(/URL/i);
  });

  it('rejects invalid coordinates and IANA timezones', () => {
    expect(() => validateLocalityConfig({ ...base, lat: Number.NaN })).toThrow(
      /lat/i
    );
    expect(() =>
      validateLocalityConfig({ ...base, lon: Number.POSITIVE_INFINITY })
    ).toThrow(/lon/i);
    expect(() => validateLocalityConfig({ ...base, lat: 91 })).toThrow(/lat/i);
    expect(() => validateLocalityConfig({ ...base, lon: -181 })).toThrow(
      /lon/i
    );
    expect(() =>
      validateLocalityConfig({ ...base, timezone: 'Mars/Olympus' })
    ).toThrow(/timezone/i);
  });

  it('rejects untrimmed, empty, and non-canonical slug/source identities', () => {
    expect(() => validateLocalityConfig({ ...base, slug: ' town-a' })).toThrow(
      /slug/i
    );
    expect(() => validateLocalityConfig({ ...base, slug: '' })).toThrow(
      /slug/i
    );
    const source = {
      sourceKey: 'town-news',
      coverage: 'mentions',
      adapter: 'rss',
      name: 'Town News',
      url: 'https://example.test/feed',
      kind: 'news',
    };
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, sourceKey: ' town-news' }],
      })
    ).toThrow(/sourceKey/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, sourceKey: '' }],
      })
    ).toThrow(/sourceKey/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, sourceKey: 'Town-News' }],
      })
    ).toThrow(/sourceKey/i);
    expect(() =>
      validateLocalityConfig({
        ...base,
        sources: [{ ...source, sourceKey: '' }],
      })
    ).toThrow(/sourceKey/i);
  });

  it('throws LocalityConfigError for malformed identity URLs and normalizes explicit keys', () => {
    expect(() =>
      resolveSourceIdentity({ adapter: 'rss', url: 'not a URL' })
    ).toThrow(LocalityConfigError);
    expect(
      resolveSourceIdentity({
        sourceKey: ' Town-News ',
        adapter: 'rss',
        url: 'https://example.test/feed',
      })
    ).toBe('town-news');
    expect(
      resolveSourceIdentity({
        sourceKey: 'TOWN-NEWS',
        adapter: 'rss',
        url: 'https://example.test/feed',
      })
    ).toBe('town-news');
  });
});

describe('locality officials', () => {
  const officials = {
    domains: ['groton-ct.gov'],
    roster: [
      {
        name: 'Jane Doe',
        office: 'Town Clerk',
        source: 'https://www.groton-ct.gov/town-register',
      },
    ],
    callbackNumberSource: 'https://www.groton-ct.gov/contact',
  };

  it('reads the operator-kept roster and the domains it applies to', () => {
    const locality = validateLocalityConfig({ ...base, officials });
    expect(locality.officials).toStrictEqual(officials);
  });

  it('leaves the inclusion rule version alone, so editions are unaffected', () => {
    const county = validateLocalityConfig({
      ...base,
      slug: 'county-a',
      name: 'County A',
      kind: 'county',
      parents: [],
      edition: false,
      aliases: [],
    });
    const without = createLocalityRegistry([
      county,
      validateLocalityConfig(base),
    ]);
    const withOfficials = createLocalityRegistry([
      county,
      validateLocalityConfig({ ...base, officials }),
    ]);
    expect(withOfficials.ruleVersion('town-a')).toBe(
      without.ruleVersion('town-a')
    );
  });

  it('refuses a domain that is not a plain hostname, an unknown key, or a roster without its source', () => {
    expect(() =>
      validateLocalityConfig({
        ...base,
        officials: { ...officials, domains: ['@groton-ct.gov'] },
      })
    ).toThrow(/hostname/u);
    expect(() =>
      validateLocalityConfig({
        ...base,
        officials: { ...officials, phone: '555-0100' },
      })
    ).toThrow(/unknown key phone/u);
    expect(() =>
      validateLocalityConfig({
        ...base,
        officials: {
          ...officials,
          roster: [{ name: 'Jane Doe', office: 'Clerk' }],
        },
      })
    ).toThrow(/source/u);
  });
});
