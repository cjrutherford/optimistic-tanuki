import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { HttpClient, LocalityConfig } from './types.js';

/**
 * Official directories: where a place's own website is written down.
 *
 * Finding a town's government sites is a lookup, not a search. Two free,
 * public directories answer it:
 *
 * - The .gov domain list (CISA, cisagov/dotgov-data): every .gov domain with
 *   its type — city, county, school district — its organisation and state.
 *   Authoritative, but many small places are not on .gov.
 * - Wikidata's "official website" (P856), with coordinates, which covers the
 *   places on .com, .org, .us and .net.
 *
 * A match must name the place and sit in its state. The .gov list is matched
 * on the organisation's name, never its city column: Morgan County, Georgia
 * lists its city as Madison, which is not Madison, Florida. Wikidata answers
 * are disambiguated by distance from the place's own coordinates. The .gov
 * list carries a security contact address per domain; it is never read.
 *
 * What these return are starting points for the crawl. Adoption is decided,
 * as for anything else, by reading what is there.
 */

const DOTGOV_URL =
  'https://raw.githubusercontent.com/cisagov/dotgov-data/main/current-full.csv';
const WIKIDATA_URL = 'https://query.wikidata.org/sparql';
/** Wikidata asks for an agent that says who is asking. */
const USER_AGENT =
  'civic-pipeline/0.1 (Daylight civic briefing; https://github.com/cjrutherford)';
const CACHE_DAYS = 30;
const DAY_MS = 86_400_000;

export interface OfficialSite {
  url: string;
  /** The locality the site belongs to. */
  ownerSlug: string;
  /** Which directory said so, and what it said. */
  via: string;
}

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
};

/** Kinds of place a directory is asked about: local governments, not regions or states. */
const LOCAL_KINDS = new Set(['town', 'city', 'village', 'county']);

export interface DotgovRow {
  domain: string;
  type: string;
  organization: string;
  state: string;
}

/** The .gov list's rows, keeping only the columns used. The contact column is dropped here. */
export function parseDotgov(csv: string): DotgovRow[] {
  const rows: DotgovRow[] = [];
  for (const line of csv.split(/\r?\n/u).slice(1)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    if (cells.length < 6) continue;
    rows.push({
      domain: cells[0]!.trim().toLowerCase(),
      type: cells[1]!.trim(),
      organization: cells[2]!.trim(),
      state: cells[5]!.trim().toUpperCase(),
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]!;
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else cell += char;
  }
  cells.push(cell);
  return cells;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

/**
 * The .gov domains that belong to a place: a city or town whose organisation
 * is the place (`City of Groton`, `Town of Groton`, `Tifton`), or a county
 * whose organisation names the county (`Tift County`, `Berrien County
 * Government`). A place named "City of Groton" matches exactly that.
 */
export function dotgovSitesFor(
  place: LocalityConfig,
  rows: readonly DotgovRow[]
): OfficialSite[] {
  if (!LOCAL_KINDS.has(place.kind)) return [];
  const name = normalize(place.name);
  const county = place.kind === 'county';
  const bare = name.replace(/^(city|town|village|borough) of /u, '');
  // Some governments register with their state after the name ("City of
  // Adel, GA"); rows are already this state's, so the suffix says nothing.
  const stateSuffix = new RegExp(
    ` (${[place.state, STATE_NAMES[place.state] ?? place.state]
      .map((label) => normalize(label))
      .join('|')})$`,
    'u'
  );
  return rows
    .filter((row) => row.state === place.state)
    .filter((row) => (county ? row.type === 'County' : row.type === 'City'))
    .filter((row) => {
      const organization = normalize(row.organization).replace(stateSuffix, '');
      if (county)
        return organization === name || organization.startsWith(`${name} `);
      if (name !== bare) return organization === name; // "City of Groton" means exactly that government
      return (
        organization === bare ||
        new RegExp(`^(city|town|village|borough) of ${bare}$`, 'u').test(
          organization
        ) ||
        organization === `${bare} city`
      );
    })
    .map((row) => ({
      url: `https://${row.domain}/`,
      ownerSlug: place.slug,
      via: `the .gov list (${row.organization}, ${row.state})`,
    }));
}

export interface WikidataPlace {
  label: string;
  site: string;
  lat: number;
  lon: number;
  state: string;
}

/** Wikidata's official website for a place: same name, same state, nearest to its coordinates and close enough. */
export function wikidataSiteFor(
  place: LocalityConfig,
  answers: readonly WikidataPlace[]
): OfficialSite | null {
  if (!LOCAL_KINDS.has(place.kind)) return null;
  const state = STATE_NAMES[place.state];
  const limitKm = place.kind === 'county' ? 50 : 20;
  const nearest = answers
    .filter((answer) => answer.state === state)
    .map((answer) => ({
      answer,
      km: distanceKm(place.lat, place.lon, answer.lat, answer.lon),
    }))
    .filter((entry) => entry.km <= limitKm)
    .sort((a, b) => a.km - b.km)[0];
  if (!nearest) return null;
  return {
    url: nearest.answer.site,
    ownerSlug: place.slug,
    via: `Wikidata (${nearest.answer.label}, ${Math.round(
      nearest.km
    )} km from ${place.name})`,
  };
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function wikidataQuery(name: string, state: string): string {
  const label = JSON.stringify(name);
  const stateLabel = JSON.stringify(state);
  return `SELECT ?itemLabel ?site ?coord WHERE {
    ?item rdfs:label ${label}@en; wdt:P17 wd:Q30; wdt:P856 ?site; wdt:P625 ?coord; wdt:P131+ ?state.
    ?state wdt:P31 wd:Q35657; rdfs:label ${stateLabel}@en.
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  } LIMIT 20`;
}

/**
 * The directories, fetched through the pipeline's outbound policy and cached
 * under `directory` for a month: the .gov list changes slowly, and a weekly
 * sourcing pass should not fetch 1.4 MB and query Wikidata every time.
 */
export class OfficialDirectories {
  constructor(
    private readonly directory: string,
    private readonly httpClient: HttpClient
  ) {}

  /**
   * Every official site the directories know for these places, and the whole
   * .gov list by domain — which government, in which state — so a namesake
   * elsewhere can be told apart. Failures leave the rest standing.
   */
  async sitesFor(places: readonly LocalityConfig[]): Promise<{
    sites: OfficialSite[];
    governmentDomains: Map<string, { organization: string; state: string }>;
    notes: string[];
  }> {
    const notes: string[] = [];
    const sites: OfficialSite[] = [];
    let rows: DotgovRow[] = [];
    try {
      rows = parseDotgov(
        await this.cached('dotgov.csv', async () =>
          this.text(DOTGOV_URL, { Accept: 'text/csv' })
        )
      );
    } catch (error) {
      notes.push(
        `the .gov list could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    const governmentDomains = new Map(
      rows.map((row) => [
        row.domain,
        { organization: row.organization, state: row.state },
      ])
    );
    for (const place of places) {
      sites.push(...dotgovSitesFor(place, rows));
      if (!LOCAL_KINDS.has(place.kind) || !STATE_NAMES[place.state]) continue;
      try {
        const answers = JSON.parse(
          await this.cached(`wikidata-${place.slug}.json`, async () =>
            JSON.stringify(await this.wikidata(place))
          )
        ) as WikidataPlace[];
        const site = wikidataSiteFor(place, answers);
        if (site) sites.push(site);
      } catch (error) {
        notes.push(
          `Wikidata could not be asked about ${place.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
    const unique = new Map<string, OfficialSite>();
    for (const site of sites) {
      const key = site.url
        .toLowerCase()
        .replace(/^https?:\/\/(www\.)?/u, '')
        .replace(/\/+$/u, '');
      if (!unique.has(key)) unique.set(key, site);
    }
    return { sites: [...unique.values()], governmentDomains, notes };
  }

  private async wikidata(place: LocalityConfig): Promise<WikidataPlace[]> {
    const state = STATE_NAMES[place.state]!;
    const url = `${WIKIDATA_URL}?query=${encodeURIComponent(
      wikidataQuery(place.name, state)
    )}`;
    const body = JSON.parse(
      await this.text(url, { Accept: 'application/sparql-results+json' })
    ) as {
      results: {
        bindings: {
          itemLabel?: { value: string };
          site?: { value: string };
          coord?: { value: string };
        }[];
      };
    };
    return body.results.bindings.flatMap((binding) => {
      const point = binding.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/u);
      if (!binding.site || !point) return [];
      return [
        {
          label: binding.itemLabel?.value ?? place.name,
          site: binding.site.value,
          lon: Number(point[1]),
          lat: Number(point[2]),
          state,
        },
      ];
    });
  }

  private async text(
    url: string,
    headers: Record<string, string>
  ): Promise<string> {
    const response = await this.httpClient.fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...headers },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  }

  private async cached(
    name: string,
    load: () => Promise<string>
  ): Promise<string> {
    const path = join(this.directory, name);
    if (
      existsSync(path) &&
      Date.now() - statSync(path).mtimeMs < CACHE_DAYS * DAY_MS
    )
      return readFileSync(path, 'utf8');
    const value = await load();
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(path, value);
    return value;
  }
}
