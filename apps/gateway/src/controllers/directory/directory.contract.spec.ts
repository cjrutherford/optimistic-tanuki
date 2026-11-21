import 'reflect-metadata';
import { ClientProxy } from '@nestjs/microservices';
import type {
  LocalDirectoryCoverageState,
  LocalDirectoryCursorPage,
  LocalDirectorySourceFreshness,
} from '@optimistic-tanuki/social-contracts';
import golden from './__fixtures__/local-directory-page.golden.json';
import { DirectoryController } from './directory.controller';

const town = '33333333-3333-4333-8333-333333333333';

interface Projection {
  projectCoverage(value: unknown): { coverage?: Record<string, unknown> };
  projectPolicyVersion(value: unknown): { policyVersion?: string };
}

/** What Directory's internal route returns: the golden page plus fields the gateway must never forward. */
function upstreamPage(): Record<string, unknown> {
  return {
    ...golden,
    internalOnly: 'must-drop',
    exportEligible: true,
    listings: golden.listings.map((l, i) => ({
      ...l,
      location: {
        type: 'Point',
        coordinates: [l.coordinates?.lng ?? -1, l.coordinates?.lat ?? 1],
      },
      ownerId: 'owner-secret',
      exportEligible: true,
      sourceRowId: i,
    })),
    sourceFreshness: { ...golden.sourceFreshness, scanId: 'drop-me' },
    coverage: { ...golden.coverage, reasonDetail: 'drop-me' },
  };
}

/** Sorted key list plus value type per key, so a rename, removal, addition or type change all show up. */
function shape(value: object): string[] {
  return Object.entries(value)
    .map(([k, v]) => `${k}:${v === null ? 'null' : typeof v}`)
    .sort();
}

describe('public local directory contract', () => {
  const controller = new DirectoryController({} as ClientProxy);
  const projection = controller as unknown as Projection;
  const saved = { ...process.env };
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env['DIRECTORY_INTERNAL_URL'] = 'http://directory.invalid';
    process.env['DIRECTORY_LOCAL_EVALUATION'] = 'true';
    process.env['DIRECTORY_LOCAL_EVALUATION_SECRET'] = 'x'.repeat(40);
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => upstreamPage(),
    } as Response);
  });
  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = { ...saved };
  });

  it('fixture satisfies the shared LocalDirectoryCursorPage type', () => {
    // Only the string-literal unions are asserted; every other field is checked structurally by tsc.
    const typed: LocalDirectoryCursorPage = {
      ...golden,
      sourceFreshness: {
        ...golden.sourceFreshness,
        state: golden.sourceFreshness
          .state as LocalDirectorySourceFreshness['state'],
      },
      coverage: {
        ...golden.coverage,
        state: golden.coverage.state as LocalDirectoryCoverageState,
      },
    };
    expect(typed.listings).toHaveLength(2);
  });

  it('cursor page matches the golden fixture exactly and drops unknown fields', async () => {
    const page = (await controller.localListings(
      town,
      undefined,
      undefined,
      undefined,
      undefined,
      'cursor'
    )) as unknown as Record<string, unknown>;
    expect(page).toEqual(golden);
    expect(shape(page)).toEqual(shape(golden));
    expect(Object.keys(page).sort()).toEqual(Object.keys(golden).sort());
    const listings = page['listings'] as object[];
    expect(listings.map((l) => shape(l))).toEqual(
      golden.listings.map((l) => shape(l))
    );
    expect(JSON.stringify(page)).not.toMatch(
      /must-drop|owner-secret|exportEligible|sourceRowId|scanId|drop-me|"location"/
    );
  });

  it('sourceFreshness, coverage and policyVersion key sets and types are pinned', () => {
    expect(shape(golden.sourceFreshness)).toEqual([
      'acquiredAt:string',
      'releaseId:string',
      'sourcePublishedAt:string',
      'state:string',
      'thresholds:object',
    ]);
    expect(Object.keys(golden.sourceFreshness.thresholds).sort()).toEqual([
      'freshDays',
      'staleDays',
    ]);
    expect(shape(golden.coverage)).toEqual([
      'state:string',
      'withheldReviewedDetails:number',
    ]);
    expect(golden.policyVersion).toMatch(/^[0-9a-f]{16}$/);
  });

  const states: LocalDirectoryCoverageState[] = [
    'available',
    'empty',
    'acquiring',
    'partial',
    'blocked',
    'unknown',
    'unconfigured',
  ];

  it.each(states)(
    'coverage state %s round-trips through projectCoverage',
    (state) => {
      const input =
        state === 'blocked'
          ? { state, reason: 'town-ineligible', withheldReviewedDetails: 0 }
          : { state, withheldReviewedDetails: 2 };
      expect(
        projection.projectCoverage({ ...input, extra: 'drop-me' })
      ).toEqual({ coverage: input });
    }
  );

  it('covers every member of LocalDirectoryCoverageState', () => {
    // A new union member must be added to `states` above; this record fails to compile until it is.
    const all: Record<LocalDirectoryCoverageState, true> = {
      available: true,
      empty: true,
      acquiring: true,
      partial: true,
      blocked: true,
      unknown: true,
      unconfigured: true,
    };
    expect(Object.keys(all).sort()).toEqual([...states].sort());
  });

  it('rejects malformed coverage and policyVersion instead of forwarding them', () => {
    expect(
      projection.projectCoverage({
        state: 'mystery',
        withheldReviewedDetails: 0,
      })
    ).toEqual({});
    expect(
      projection.projectCoverage({
        state: 'blocked',
        withheldReviewedDetails: 0,
      })
    ).toEqual({});
    expect(
      projection.projectCoverage({
        state: 'available',
        reason: 'town-ineligible',
        withheldReviewedDetails: 0,
      })
    ).toEqual({});
    expect(projection.projectPolicyVersion('574205e24da3cddc')).toEqual({
      policyVersion: '574205e24da3cddc',
    });
    expect(projection.projectPolicyVersion('NOT-HEX')).toEqual({});
    expect(projection.projectPolicyVersion(42)).toEqual({});
  });
});
