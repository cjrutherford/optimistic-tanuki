import { describeDirectoryState, humanizeCategory } from './state';
import type { LocalDirectoryCoverage } from './models';

const cov = (
  state: LocalDirectoryCoverage['state'],
  reason?: LocalDirectoryCoverage['reason'],
  withheld = 0
): LocalDirectoryCoverage => ({
  state,
  ...(reason ? { reason } : {}),
  withheldReviewedDetails: withheld,
});

describe('describeDirectoryState', () => {
  const ready = (
    coverage: LocalDirectoryCoverage | null,
    listingsShown = 0,
    filtersActive = false
  ) =>
    describeDirectoryState({
      status: 'ready',
      coverage,
      listingsShown,
      filtersActive,
    });

  it.each([
    [
      'loading copy',
      { status: 'loading' as const, listingsShown: 0, filtersActive: false },
      'loading',
      'Loading businesses…',
      '',
    ],
    [
      'failed copy',
      { status: 'failed' as const, listingsShown: 0, filtersActive: false },
      'failed',
      'Business directory is temporarily unavailable',
      'Please try again.',
    ],
  ])('%s', (_n, input, kind, title, message) => {
    expect(describeDirectoryState(input)).toMatchObject({
      kind,
      title,
      message,
    });
  });

  it('maps every coverage state to its kind and copy', () => {
    expect(ready(cov('available'), 3).kind).toBe('available');
    expect(ready(cov('empty'))).toMatchObject({
      kind: 'empty',
      title: 'No businesses listed',
    });
    expect(ready(cov('acquiring'))).toMatchObject({
      kind: 'acquiring',
      title: 'Gathering listings',
    });
    expect(ready(cov('partial'), 2)).toMatchObject({
      kind: 'partial',
      title: 'Listings still arriving',
    });
    expect(ready(cov('blocked', 'town-ineligible'))).toMatchObject({
      kind: 'blocked-town-ineligible',
      title: 'Directory not available',
    });
    expect(ready(cov('blocked', 'policy-withdrawn'))).toMatchObject({
      kind: 'blocked-policy-withdrawn',
      title: 'Listings withdrawn',
    });
    expect(ready(cov('unknown'))).toMatchObject({
      kind: 'unknown',
      title: 'Coverage unknown',
    });
    expect(ready(null)).toMatchObject({ kind: 'unknown' });
    expect(ready(cov('unconfigured'))).toMatchObject({
      kind: 'unconfigured',
      title: 'Directory not available yet',
    });
  });

  it('reports zero results for a filter without claiming the town is empty', () => {
    expect(ready(cov('available'), 0, true)).toMatchObject({
      kind: 'no-match',
      title: 'No results',
    });
  });

  it('carries the withheld note', () => {
    expect(ready(cov('available', undefined, 2), 1).withheldNote).toContain(
      're-checked'
    );
  });
});

describe('humanizeCategory', () => {
  it('title-cases source identifiers', () => {
    expect(humanizeCategory('convenience_store')).toBe('Convenience Store');
  });
});
