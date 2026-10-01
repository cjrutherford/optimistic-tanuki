import {
  buildCoverageRange,
  coverageGapForRange,
  matchesConfiguredPublisherIdentity,
} from '../src/coverage.js';
import { renderCoverageGapMarkdown } from '../src/pipeline.js';

describe('coverage ranges', () => {
  it('uses exact half-open local dates and reports missing days', () => {
    const result = buildCoverageRange({
      requestedStart: '2026-09-10',
      requestedEnd: '2026-09-13',
      observedDates: ['2026-09-10', '2026-09-12'],
    });
    expect(result).toStrictEqual({
      requestedStart: '2026-09-10',
      requestedEnd: '2026-09-13',
      observedStart: '2026-09-10',
      observedEnd: '2026-09-13',
      missingDays: ['2026-09-11'],
      reason: 'partial-range',
    });
  });

  it('distinguishes empty, failed, and unsupported coverage', () => {
    expect(
      buildCoverageRange({
        requestedStart: '2026-09-10',
        requestedEnd: '2026-09-12',
        observedDates: [],
      }).reason
    ).toBe('no-dated-items');
    expect(
      buildCoverageRange({
        requestedStart: '2026-09-10',
        requestedEnd: '2026-09-12',
        observedDates: [],
        sourceFailed: true,
      }).reason
    ).toBe('source-failed');
    expect(
      buildCoverageRange({
        requestedStart: '2026-09-10',
        requestedEnd: '2026-09-12',
        observedDates: [],
        capabilitySupported: false,
      }).reason
    ).toBe('unsupported-capability');
  });

  it('gives a zero-result restricted aggregate source the scoped no-result diagnostic before capability checks', () => {
    expect(
      buildCoverageRange({
        requestedStart: '2026-09-10',
        requestedEnd: '2026-09-12',
        observedDates: [],
        capabilitySupported: false,
        source: {
          adapter: 'news-discover',
          kind: 'news',
          accessMode: 'snippet-only',
          aggregateDiscovery: true,
        },
        currentRecordCount: 0,
      }).reason
    ).toBe('no-dated-items');
    expect(
      buildCoverageRange({
        requestedStart: '2026-09-10',
        requestedEnd: '2026-09-12',
        observedDates: [],
        capabilitySupported: false,
        source: {
          adapter: 'news-discover',
          kind: 'news',
          accessMode: 'snippet-only',
          aggregateDiscovery: true,
        },
        currentRecordCount: 1,
      }).reason
    ).toBe('unsupported-capability');
    expect(
      buildCoverageRange({
        requestedStart: '2026-09-10',
        requestedEnd: '2026-09-12',
        observedDates: [],
        capabilitySupported: false,
        source: {
          adapter: 'news-discover',
          kind: 'news',
          accessMode: 'full',
          aggregateDiscovery: true,
        },
        currentRecordCount: 0,
      }).reason
    ).toBe('unsupported-capability');
  });

  it('renders restricted zero-result metadata as a diagnostic, never an article citation', () => {
    const markdown = renderCoverageGapMarkdown({
      sourceKey: 'adel-news',
      sourceName: 'Adel News-Tribune',
      stage: 'gather',
      reason: 'no recent aggregate result',
      accessRestrictionReason:
        'Publisher crawler policy blocks automated AI retrieval',
      restrictionPolicyUrl: 'https://adelnews.example/robots.txt',
      aggregateUrl: 'https://news.google.com/search?q=adel',
    });
    expect(markdown).toMatch(/Adel News-Tribune.*no recent aggregate result/);
    expect(markdown).toMatch(/publisher access policy/);
    expect(markdown).toMatch(/Diagnostic-only aggregate/);
    expect(markdown).not.toMatch(/\[source\]\(https:\/\/news\.google\.com/);
    expect(markdown).not.toMatch(/adel-news/u);
  });

  it('exposes the no-result enum and diagnostic message for an Adel-shaped source', () => {
    const range = buildCoverageRange({
      requestedStart: '2026-09-10',
      requestedEnd: '2026-09-12',
      observedDates: [],
      capabilitySupported: false,
      source: {
        adapter: 'news-discover',
        kind: 'news',
        accessMode: 'snippet-only',
        aggregateDiscovery: true,
      },
      currentRecordCount: 0,
    });
    expect(range.reason).toBe('no-dated-items');
    expect(coverageGapForRange('adel-news', range)).toStrictEqual({
      sourceKey: 'adel-news',
      reason: 'no recent aggregate result',
    });
  });

  it('requires publisher or configured domain identity for aggregate items', () => {
    const source = {
      name: 'Adel News-Tribune',
      config: { matchNames: ['Adel News-Tribune', 'Adel'] },
      restrictionPolicyUrl: 'https://www.adelnewstribune.com/robots.txt',
    };
    expect(
      matchesConfiguredPublisherIdentity(
        {
          publisher: 'WALB',
          canonicalUrl: 'https://www.walb.com/adel-update',
          uris: null,
        },
        source
      )
    ).toBe(false);
    expect(
      matchesConfiguredPublisherIdentity(
        {
          publisher: 'Adel County Ledger',
          canonicalUrl: 'https://news.google.com/adel-update',
          uris: null,
        },
        source
      )
    ).toBe(false);
    expect(
      matchesConfiguredPublisherIdentity(
        {
          publisher: 'Adel News-Tribune',
          canonicalUrl: 'https://news.google.com/search?q=adel',
          uris: null,
        },
        source
      )
    ).toBe(true);
    expect(
      matchesConfiguredPublisherIdentity(
        {
          publisher: null,
          canonicalUrl: 'https://www.adelnewstribune.com/local/story',
          uris: null,
        },
        source
      )
    ).toBe(true);
    expect(
      matchesConfiguredPublisherIdentity(
        {
          publisher: 'The Ledger',
          canonicalUrl: 'https://news.google.com/berrien-update',
          uris: null,
        },
        {
          name: 'The Berrien Press',
          config: { matchNames: ['Berrien Press', 'Berrien'] },
          restrictionPolicyUrl: 'https://www.theberrienpress.com/robots.txt',
        }
      )
    ).toBe(false);
  });

  it('does not treat an end date as observed when it is outside the interval', () => {
    const result = buildCoverageRange({
      requestedStart: '2026-09-10',
      requestedEnd: '2026-09-12',
      observedDates: ['2026-09-12'],
    });
    expect(result.missingDays).toStrictEqual(['2026-09-10', '2026-09-11']);
    expect(result.observedStart).toBe(null);
    expect(result.observedEnd).toBe(null);
  });

  it('rejects impossible Gregorian dates while accepting leap-day dates', () => {
    for (const value of [
      '2026-02-29',
      '2026-02-30',
      '2026-04-31',
      '2026-13-01',
      '2026-00-01',
    ]) {
      expect(() =>
        buildCoverageRange({
          requestedStart: value,
          requestedEnd: '2027-01-01',
          observedDates: [],
        })
      ).toThrow(/invalid|date/i);
    }
    expect(() =>
      buildCoverageRange({
        requestedStart: '2028-02-29',
        requestedEnd: '2028-03-01',
        observedDates: ['2028-02-29'],
      })
    ).not.toThrow();
  });
});
