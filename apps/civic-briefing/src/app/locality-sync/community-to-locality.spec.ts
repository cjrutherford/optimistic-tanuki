import {
  communityToLocality,
  localityDefaultsFromEnv,
  type LocalityDefaults,
  type SocialCommunity,
} from './community-to-locality';
import { resolveState, stateRootSlug } from './us-states';

const defaults: LocalityDefaults = {
  topics: ['council', 'weather'],
  cadence: ['daily', 'weekly'],
};

function community(over: Partial<SocialCommunity> = {}): SocialCommunity {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Adel',
    slug: 'adel-ga',
    localitySlug: null,
    localityType: 'town',
    adminArea: 'GA',
    lat: 31.1376,
    lng: -83.4258,
    ...over,
  };
}

function mapped(c: SocialCommunity) {
  const result = communityToLocality(c, defaults);
  if (!result.ok) throw new Error(result.reason);
  return result.row;
}

describe('edition rule and exclude phrases', () => {
  const edition = (localityType?: string) =>
    mapped(community({ localityType })).edition;

  it('gives editions to cities and towns only', () => {
    expect(edition('city')).toBe(true);
    expect(edition('town')).toBe(true);
    expect(edition(undefined)).toBe(true);
    expect(edition('neighborhood')).toBe(false);
    expect(edition('county')).toBe(false);
    expect(edition('region')).toBe(false);
    expect(edition('district')).toBe(false);
  });

  it('derives exclude phrases from the notable list', () => {
    const nashville = community({ name: 'Nashville', slug: 'nashville-ga' });
    expect(mapped(nashville).excludePhrases).toBe(
      JSON.stringify([
        'Nashville, Tennessee',
        'Nashville, Tenn.',
        'Nashville, TN',
      ])
    );
    // Nashville TN itself has no namesake in the list.
    expect(
      mapped(
        community({ name: 'Nashville', slug: 'nashville-tn', adminArea: 'TN' })
      ).excludePhrases
    ).toBeUndefined();
  });

  it('reads the town name past a trailing state ("Nashville, GA")', () => {
    expect(
      mapped(community({ name: 'Nashville, GA', slug: 'nashville-ga' }))
        .excludePhrases
    ).toContain('Nashville, Tennessee');
  });

  it('derives exclude phrases from the batch, with and without an AP abbreviation', () => {
    const result = communityToLocality(
      community({ name: 'Springfield', slug: 'springfield-ga' }),
      defaults,
      {
        notablePlaces: [],
        peers: [
          { name: 'Springfield', state: 'GA' },
          { name: 'Springfield', state: 'OH' },
          { name: 'Springfield', state: 'IA' },
          { name: 'Springfield', state: 'IA' },
        ],
      }
    );
    if (!result.ok) throw new Error(result.reason);
    expect(JSON.parse(result.row.excludePhrases ?? '[]')).toEqual([
      'Springfield, Iowa',
      'Springfield, IA',
      'Springfield, Ohio',
      'Springfield, OH',
    ]);
  });

  it('gives a unique name and non-edition rows no phrases', () => {
    expect(mapped(community()).excludePhrases).toBeUndefined();
    expect(
      mapped(
        community({
          name: 'Nashville',
          slug: 'nashville-ga',
          localityType: 'neighborhood',
        })
      ).excludePhrases
    ).toBeUndefined();
  });
});

describe('communityToLocality', () => {
  it('maps a town with its state root as parent and an edition', () => {
    expect(mapped(community())).toEqual({
      slug: 'adel-ga',
      name: 'Adel',
      state: 'GA',
      timezone: 'America/New_York',
      lat: 31.1376,
      lon: -83.4258,
      kind: 'town',
      parents: '["georgia"]',
      edition: true,
      communityId: '11111111-1111-4111-8111-111111111111',
      active: true,
      topics: '["council","weather"]',
      cadence: '["daily","weekly"]',
    });
  });

  it('keeps same-name towns in different states distinct', () => {
    const ga = mapped(
      community({ id: 'a', name: 'Nashville', slug: 'nashville-ga' })
    );
    const tn = mapped(
      community({
        id: 'b',
        name: 'Nashville',
        slug: 'nashville-tn',
        adminArea: 'TN',
        lat: 36.16,
        lng: -86.78,
        localityType: 'city',
      })
    );
    expect([ga.slug, tn.slug]).toEqual(['nashville-ga', 'nashville-tn']);
    expect([ga.parents, tn.parents]).toEqual(['["georgia"]', '["tennessee"]']);
    expect([ga.timezone, tn.timezone]).toEqual([
      'America/New_York',
      'America/Chicago',
    ]);
    expect(tn.kind).toBe('city');
  });

  it('prefers localitySlug over slug', () => {
    expect(
      mapped(
        community({ slug: 'tifton-ga-community', localitySlug: 'tifton-ga' })
      ).slug
    ).toBe('tifton-ga');
  });

  it('falls back to the state zone and centre without coordinates', () => {
    const row = mapped(
      community({ adminArea: 'Texas', lat: null, lng: undefined })
    );
    expect(row).toMatchObject({
      state: 'TX',
      timezone: 'America/Chicago',
      lat: 31.5,
      lon: -99.3,
    });
    expect(mapped(community({ lat: 'x', lng: 500 })).timezone).toBe(
      'America/New_York'
    );
  });

  it('reads a zone from the coordinates, not the state', () => {
    // El Paso, TX is on Mountain time.
    expect(
      mapped(community({ adminArea: 'TX', lat: 31.76, lng: -106.49 })).timezone
    ).toBe('America/Denver');
  });

  it('accepts string coordinates from the database', () => {
    expect(mapped(community({ lat: '31.1', lng: '-83.4' }))).toMatchObject({
      lat: 31.1,
      lon: -83.4,
    });
  });

  it.each([null, undefined, '', 'Narnia', 'ZZ', 'Ontario', 42])(
    'rejects adminArea %p with a reason',
    (adminArea) => {
      const result = communityToLocality(
        community({ adminArea: adminArea as never }),
        defaults
      );
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toMatch(/adminArea/);
    }
  );

  it('rejects a community with no slug or name', () => {
    expect(
      communityToLocality(
        community({ slug: null, localitySlug: null }),
        defaults
      )
    ).toEqual({ ok: false, reason: 'no slug' });
    expect(communityToLocality(community({ name: ' ' }), defaults)).toEqual({
      ok: false,
      reason: 'no name',
    });
  });

  it('defaults the kind to town when social has none', () => {
    expect(mapped(community({ localityType: null })).kind).toBe('town');
    expect(mapped(community({ localityType: 'county' })).kind).toBe('county');
  });
});

describe('state resolution', () => {
  it('reads codes, full names and DC spellings', () => {
    expect(resolveState(' ga ')?.code).toBe('GA');
    expect(resolveState('North Carolina')?.code).toBe('NC');
    expect(resolveState('D.C.')?.code).toBe('DC');
    expect(resolveState('Washington, D.C.')?.code).toBe('DC');
    expect(resolveState('Washington')?.code).toBe('WA');
    expect(resolveState('Puerto Rico')).toBeUndefined();
  });

  it('names state roots by full name', () => {
    expect(stateRootSlug(resolveState('DC') as never)).toBe(
      'district-of-columbia'
    );
    expect(stateRootSlug(resolveState('NY') as never)).toBe('new-york');
  });
});

describe('localityDefaultsFromEnv', () => {
  it('uses the fixture-town defaults, and the environment when set', () => {
    expect(localityDefaultsFromEnv({})).toEqual({
      topics: ['council', 'planning', 'water', 'roads', 'weather', 'schools'],
      cadence: ['daily', 'weekly'],
    });
    expect(
      localityDefaultsFromEnv({
        LOCALITY_DEFAULT_TOPICS: 'a, b',
        LOCALITY_DEFAULT_CADENCE: 'weekly,hourly',
      })
    ).toEqual({ topics: ['a', 'b'], cadence: ['weekly'] });
  });
});
