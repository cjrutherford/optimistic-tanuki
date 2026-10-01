import {
  dotgovSitesFor,
  parseDotgov,
  wikidataSiteFor,
  type WikidataPlace,
} from '../src/directories.js';
import type { LocalityConfig } from '../src/types.js';

const place = (overrides: Partial<LocalityConfig>): LocalityConfig => ({
  slug: 'x',
  name: 'X',
  state: 'GA',
  timezone: 'America/New_York',
  lat: 31,
  lon: -83,
  kind: 'town',
  parents: [],
  edition: false,
  topics: [],
  cadence: [],
  sources: [],
  ...overrides,
});

const CSV = [
  'Domain name,Domain type,Organization name,Suborganization name,City,State,Security contact email',
  'tiftonga.gov,City,City of Tifton,,Tifton,GA,admins@example.net',
  'groton-ct.gov,City,Town of Groton,,Groton,CT,(blank)',
  'cityofgroton-ct.gov,City,City of Groton,,Groton,CT,someone@example.com',
  'tiftcounty.gov,County,Tift County,,Tifton,GA,(blank)',
  'berriencountyga.gov,County,Berrien County Government,,Nashville,GA,support@example.com',
  'morgancountyga.gov,County,Morgan County,,Madison,GA,person@example.com',
  '"quoted,name.gov",City,"Town of Quote, Inc",,Quote,GA,(blank)',
  'cityofadelga.gov,City,"City of Adel, GA",,Adel,GA,(blank)',
  'adeliowa.gov,City,City of Adel,,Adel,IA,(blank)',
  'moultriega.gov,City,"City of Moultrie, Georgia",,Moultrie,GA,(blank)',
].join('\n');

describe('official directories', () => {
  const rows = parseDotgov(CSV);

  it('keeps only what it uses from the .gov list — never the contact address', () => {
    expect(rows.length).toBe(10);
    expect(
      rows.every((row) => !JSON.stringify(row).includes('@'))
    ).toBeTruthy();
    expect(rows[6]!.organization).toBe('Town of Quote, Inc');
  });

  it("finds a town by its government's name and state", () => {
    expect(
      dotgovSitesFor(place({ slug: 'tifton-ga', name: 'Tifton' }), rows).map(
        (site) => site.url
      )
    ).toStrictEqual(['https://tiftonga.gov/']);
    expect(
      dotgovSitesFor(
        place({ slug: 'groton-ct', name: 'Groton', state: 'CT' }),
        rows
      )
        .map((site) => site.url)
        .sort()
    ).toStrictEqual(['https://cityofgroton-ct.gov/', 'https://groton-ct.gov/']);
  });

  it('matches a government registered with its state after its name', () => {
    // The .gov list has "City of Adel, GA"; Adel, Iowa must not match.
    expect(
      dotgovSitesFor(place({ slug: 'adel-ga', name: 'Adel' }), rows).map(
        (site) => site.url
      )
    ).toStrictEqual(['https://cityofadelga.gov/']);
    expect(
      dotgovSitesFor(
        place({ slug: 'moultrie-ga', name: 'Moultrie' }),
        rows
      ).map((site) => site.url)
    ).toStrictEqual(['https://moultriega.gov/']);
  });

  it('matches "City of Groton" to that government only', () => {
    expect(
      dotgovSitesFor(
        place({
          slug: 'city-of-groton-ct',
          name: 'City of Groton',
          kind: 'city',
          state: 'CT',
        }),
        rows
      ).map((site) => site.url)
    ).toStrictEqual(['https://cityofgroton-ct.gov/']);
  });

  it('finds a county by name, however its organisation is styled', () => {
    expect(
      dotgovSitesFor(
        place({ name: 'Berrien County', kind: 'county' }),
        rows
      ).map((site) => site.url)
    ).toStrictEqual(['https://berriencountyga.gov/']);
  });

  it('never matches on the city column: Morgan County lists Madison, which is not Madison, Florida', () => {
    expect(
      dotgovSitesFor(
        place({ name: 'Madison', kind: 'city', state: 'FL' }),
        rows
      )
    ).toStrictEqual([]);
    expect(
      dotgovSitesFor(
        place({ name: 'Madison', kind: 'city', state: 'GA' }),
        rows
      )
    ).toStrictEqual([]);
  });

  it('asks nothing about states and regions', () => {
    expect(
      dotgovSitesFor(place({ name: 'Georgia', kind: 'state' }), rows)
    ).toStrictEqual([]);
    expect(
      wikidataSiteFor(place({ name: 'South Georgia', kind: 'region' }), [])
    ).toBe(null);
  });

  it('takes the nearest same-named place in the state from Wikidata, and nothing too far away', () => {
    const answers: WikidataPlace[] = [
      {
        label: 'Madison',
        site: 'https://madisonct.example',
        lat: 41.28,
        lon: -72.6,
        state: 'Connecticut',
      },
      {
        label: 'Madison',
        site: 'https://cityofmadisonfl.example',
        lat: 30.47,
        lon: -83.41,
        state: 'Florida',
      },
      {
        label: 'Madison',
        site: 'https://far-madison.example',
        lat: 28.0,
        lon: -82.0,
        state: 'Florida',
      },
    ];
    const site = wikidataSiteFor(
      place({
        slug: 'madison-fl',
        name: 'Madison',
        kind: 'city',
        state: 'FL',
        lat: 30.47,
        lon: -83.41,
      }),
      answers
    );
    expect(site?.url).toBe('https://cityofmadisonfl.example');
    expect(site!.via).toMatch(/0 km from Madison/u);
    expect(
      wikidataSiteFor(
        place({
          name: 'Madison',
          kind: 'city',
          state: 'FL',
          lat: 25,
          lon: -80,
        }),
        answers
      )
    ).toBe(null);
  });
});
