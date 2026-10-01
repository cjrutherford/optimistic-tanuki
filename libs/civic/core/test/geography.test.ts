import { join } from 'node:path';
import { loadLocalityRegistry } from '../src/locality-registry.js';
import {
  decideEdition,
  resolveItemScope,
  type InclusionItem,
} from '../src/geography.js';

const fixtures = loadLocalityRegistry(
  join(__dirname, 'fixtures', 'locality-graph')
);
const production = loadLocalityRegistry(
  join(__dirname, 'fixtures', 'localities')
);

function item(
  sourceId: string,
  title: string,
  overrides: Partial<InclusionItem> = {}
): InclusionItem {
  return { sourceId, kind: 'news', title, body: '', ...overrides };
}

function decide(
  registry: typeof fixtures,
  edition: string,
  value: InclusionItem
): string {
  return decideEdition(value, edition, registry).decision;
}

describe('edition inclusion', () => {
  it('includes sources owned by the edition or a place inside it', () => {
    expect(
      decide(fixtures, 'town-a', item('town-a-news', 'Routine update'))
    ).toBe('include');
    const nested = decideEdition(
      item('city-of-groton-council', 'Council minutes', { kind: 'meeting' }),
      'groton-ct',
      fixtures
    );
    expect(nested.decision).toBe('include');
    expect(nested.reason).toMatch(/city-of-groton-ct within edition/);
  });

  it("applies a containing place's government records to every place inside it", () => {
    for (const edition of ['town-a', 'town-b', 'sibling-town']) {
      expect(
        decide(
          fixtures,
          edition,
          item('county-minutes', 'Commission minutes', { kind: 'meeting' })
        )
      ).toBe('include');
    }
  });

  it('requires containing-place news to name the edition or a non-broad place between', () => {
    expect(
      decide(
        fixtures,
        'town-a',
        item('county-news', 'Alpha County approves road budget')
      )
    ).toBe('include');
    expect(
      decide(
        fixtures,
        'town-a',
        item('county-news', 'Aville library expands hours')
      )
    ).toBe('include');
    expect(
      decide(
        fixtures,
        'town-a',
        item('county-news', 'Cburg library expands hours')
      )
    ).toBe('withhold');
    expect(
      decide(fixtures, 'town-a', item('county-news', 'Road budget approved'))
    ).toBe('withhold');
    expect(
      decide(
        fixtures,
        'town-a',
        item('region-news', 'South Region hospitals report capacity')
      )
    ).toBe('withhold');
    expect(
      decide(
        fixtures,
        'town-a',
        item('region-news', 'South Region clinic opens in Aville')
      )
    ).toBe('include');
    expect(
      decide(
        fixtures,
        'town-a',
        item('state-news', 'Alpha County receives state grant')
      )
    ).toBe('include');
  });

  it('honors exclude phrases', () => {
    expect(
      decide(
        fixtures,
        'town-a',
        item('county-news', 'Aville, Tennessee mayor resigns')
      )
    ).toBe('withhold');
    expect(
      decide(
        fixtures,
        'town-a',
        item('county-news', 'Alpha County, Illinois flooding')
      )
    ).toBe('withhold');
    expect(
      decide(
        production,
        'nashville-ga',
        item('georgia-recorder', 'Nashville, Tenn. music festival')
      )
    ).toBe('withhold');
    expect(
      decide(
        production,
        'nashville-ga',
        item('georgia-recorder', 'Nashville council meets on water rates')
      )
    ).toBe('include');
  });

  it('requires same-state context for search aggregates', () => {
    expect(
      decide(
        fixtures,
        'groton-ct',
        item('se-ct-news-discover', 'Mystic seaport exhibit opens')
      )
    ).toBe('withhold');
    expect(
      decide(
        fixtures,
        'groton-ct',
        item('se-ct-news-discover', 'Mystic, Conn. seaport exhibit opens')
      )
    ).toBe('include');
    expect(
      decide(
        fixtures,
        'groton-ct',
        item('se-ct-news-discover', 'Groton and Stonington share a harbor plan')
      )
    ).toBe('include');
    expect(
      decide(
        fixtures,
        'groton-ct',
        item('se-ct-news-discover', 'Groton, Mass. select board meets')
      )
    ).toBe('withhold');
    expect(
      decide(
        fixtures,
        'stonington-ct',
        item('se-ct-news-discover', 'Mystic, CT drawbridge repairs')
      )
    ).toBe('include');
  });

  it('matches alert areas against county names without the County suffix', () => {
    const alert = (areas: string[]) =>
      item('nws-alerts-ga', 'Heat Advisory', { kind: 'alert', topics: areas });
    expect(
      decide(production, 'adel-ga', alert(['Cook; Berrien; Lanier']))
    ).toBe('include');
    expect(decide(production, 'adel-ga', alert(['Tift; Worth']))).toBe(
      'withhold'
    );
  });

  it('uses an explicit jurisdiction before source ownership', () => {
    expect(
      decide(
        fixtures,
        'town-a',
        item('county-news', 'Routine update', { jurisdictionSlug: 'town-a' })
      )
    ).toBe('include');
    expect(
      decide(
        fixtures,
        'town-a',
        item('county-news', 'Routine update', { jurisdictionSlug: 'county-a' })
      )
    ).toBe('include');
    expect(
      decide(
        fixtures,
        'town-a',
        item('county-news', 'Aville update', {
          jurisdictionSlug: 'sibling-town',
        })
      )
    ).toBe('withhold');
  });

  it('withholds sources that are not configured for the edition', () => {
    const result = decideEdition(
      item('sibling-news', 'Aville update'),
      'town-a',
      fixtures
    );
    expect(result.decision).toBe('withhold');
    expect(result.reason).toMatch(/not configured/);
  });

  it('resolves canonical scope from jurisdiction or owner', () => {
    expect(
      resolveItemScope({ ownerSlug: 'county-a' }, null, fixtures)
    ).toStrictEqual({
      scopeSlug: 'county-a',
      scopeKind: 'county',
      reason: 'source owner',
    });
    expect(
      resolveItemScope({ ownerSlug: 'county-a' }, 'town-b', fixtures)
    ).toStrictEqual({
      scopeSlug: 'town-b',
      scopeKind: 'city',
      reason: 'explicit jurisdiction',
    });
    expect(
      resolveItemScope({ ownerSlug: 'missing' }, null, fixtures).scopeSlug
    ).toBe(null);
  });
});
