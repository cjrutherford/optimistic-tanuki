/** A US state (or DC): its root locality and the fallbacks for its towns. */
export interface UsState {
  code: string;
  name: string;
  /** The AP-style abbreviation ("Tenn."); absent for states AP does not abbreviate. */
  ap?: string;
  /** The state's primary IANA timezone, used when a town has no coordinates. */
  timezone: string;
  /** Approximate geographic centre. */
  lat: number;
  lon: number;
}

const NY = 'America/New_York';
const CH = 'America/Chicago';
const DEN = 'America/Denver';
const LA = 'America/Los_Angeles';

export const US_STATES: readonly UsState[] = [
  {
    code: 'AL',
    ap: 'Ala.',
    name: 'Alabama',
    timezone: CH,
    lat: 32.8,
    lon: -86.8,
  },
  {
    code: 'AK',
    name: 'Alaska',
    timezone: 'America/Anchorage',
    lat: 64.2,
    lon: -152.5,
  },
  {
    code: 'AZ',
    ap: 'Ariz.',
    name: 'Arizona',
    timezone: 'America/Phoenix',
    lat: 34.2,
    lon: -111.7,
  },
  {
    code: 'AR',
    ap: 'Ark.',
    name: 'Arkansas',
    timezone: CH,
    lat: 34.9,
    lon: -92.4,
  },
  {
    code: 'CA',
    ap: 'Calif.',
    name: 'California',
    timezone: LA,
    lat: 37.3,
    lon: -119.7,
  },
  {
    code: 'CO',
    ap: 'Colo.',
    name: 'Colorado',
    timezone: DEN,
    lat: 39.0,
    lon: -105.5,
  },
  {
    code: 'CT',
    ap: 'Conn.',
    name: 'Connecticut',
    timezone: NY,
    lat: 41.6,
    lon: -72.7,
  },
  {
    code: 'DE',
    ap: 'Del.',
    name: 'Delaware',
    timezone: NY,
    lat: 39.0,
    lon: -75.5,
  },
  {
    code: 'DC',
    ap: 'D.C.',
    name: 'District of Columbia',
    timezone: NY,
    lat: 38.9,
    lon: -77.0,
  },
  {
    code: 'FL',
    ap: 'Fla.',
    name: 'Florida',
    timezone: NY,
    lat: 28.6,
    lon: -82.4,
  },
  {
    code: 'GA',
    ap: 'Ga.',
    name: 'Georgia',
    timezone: NY,
    lat: 32.7,
    lon: -83.3,
  },
  {
    code: 'HI',
    name: 'Hawaii',
    timezone: 'Pacific/Honolulu',
    lat: 20.8,
    lon: -156.3,
  },
  {
    code: 'ID',
    name: 'Idaho',
    timezone: 'America/Boise',
    lat: 44.4,
    lon: -114.6,
  },
  {
    code: 'IL',
    ap: 'Ill.',
    name: 'Illinois',
    timezone: CH,
    lat: 40.0,
    lon: -89.2,
  },
  {
    code: 'IN',
    ap: 'Ind.',
    name: 'Indiana',
    timezone: 'America/Indiana/Indianapolis',
    lat: 39.9,
    lon: -86.3,
  },
  { code: 'IA', name: 'Iowa', timezone: CH, lat: 42.1, lon: -93.5 },
  {
    code: 'KS',
    ap: 'Kan.',
    name: 'Kansas',
    timezone: CH,
    lat: 38.5,
    lon: -98.4,
  },
  {
    code: 'KY',
    ap: 'Ky.',
    name: 'Kentucky',
    timezone: NY,
    lat: 37.5,
    lon: -85.3,
  },
  {
    code: 'LA',
    ap: 'La.',
    name: 'Louisiana',
    timezone: CH,
    lat: 31.1,
    lon: -92.0,
  },
  { code: 'ME', name: 'Maine', timezone: NY, lat: 45.4, lon: -69.2 },
  {
    code: 'MD',
    ap: 'Md.',
    name: 'Maryland',
    timezone: NY,
    lat: 39.0,
    lon: -76.8,
  },
  {
    code: 'MA',
    ap: 'Mass.',
    name: 'Massachusetts',
    timezone: NY,
    lat: 42.3,
    lon: -71.8,
  },
  {
    code: 'MI',
    ap: 'Mich.',
    name: 'Michigan',
    timezone: 'America/Detroit',
    lat: 44.3,
    lon: -85.4,
  },
  {
    code: 'MN',
    ap: 'Minn.',
    name: 'Minnesota',
    timezone: CH,
    lat: 46.3,
    lon: -94.3,
  },
  {
    code: 'MS',
    ap: 'Miss.',
    name: 'Mississippi',
    timezone: CH,
    lat: 32.7,
    lon: -89.7,
  },
  {
    code: 'MO',
    ap: 'Mo.',
    name: 'Missouri',
    timezone: CH,
    lat: 38.4,
    lon: -92.5,
  },
  {
    code: 'MT',
    ap: 'Mont.',
    name: 'Montana',
    timezone: DEN,
    lat: 47.0,
    lon: -109.6,
  },
  {
    code: 'NE',
    ap: 'Neb.',
    name: 'Nebraska',
    timezone: CH,
    lat: 41.5,
    lon: -99.8,
  },
  {
    code: 'NV',
    ap: 'Nev.',
    name: 'Nevada',
    timezone: LA,
    lat: 39.3,
    lon: -116.6,
  },
  {
    code: 'NH',
    ap: 'N.H.',
    name: 'New Hampshire',
    timezone: NY,
    lat: 43.7,
    lon: -71.6,
  },
  {
    code: 'NJ',
    ap: 'N.J.',
    name: 'New Jersey',
    timezone: NY,
    lat: 40.2,
    lon: -74.7,
  },
  {
    code: 'NM',
    ap: 'N.M.',
    name: 'New Mexico',
    timezone: DEN,
    lat: 34.4,
    lon: -106.1,
  },
  {
    code: 'NY',
    ap: 'N.Y.',
    name: 'New York',
    timezone: NY,
    lat: 42.9,
    lon: -75.5,
  },
  {
    code: 'NC',
    ap: 'N.C.',
    name: 'North Carolina',
    timezone: NY,
    lat: 35.6,
    lon: -79.4,
  },
  {
    code: 'ND',
    ap: 'N.D.',
    name: 'North Dakota',
    timezone: CH,
    lat: 47.5,
    lon: -100.5,
  },
  { code: 'OH', name: 'Ohio', timezone: NY, lat: 40.3, lon: -82.8 },
  {
    code: 'OK',
    ap: 'Okla.',
    name: 'Oklahoma',
    timezone: CH,
    lat: 35.6,
    lon: -97.5,
  },
  {
    code: 'OR',
    ap: 'Ore.',
    name: 'Oregon',
    timezone: LA,
    lat: 43.9,
    lon: -120.6,
  },
  {
    code: 'PA',
    ap: 'Pa.',
    name: 'Pennsylvania',
    timezone: NY,
    lat: 40.9,
    lon: -77.8,
  },
  {
    code: 'RI',
    ap: 'R.I.',
    name: 'Rhode Island',
    timezone: NY,
    lat: 41.7,
    lon: -71.5,
  },
  {
    code: 'SC',
    ap: 'S.C.',
    name: 'South Carolina',
    timezone: NY,
    lat: 33.9,
    lon: -80.9,
  },
  {
    code: 'SD',
    ap: 'S.D.',
    name: 'South Dakota',
    timezone: CH,
    lat: 44.4,
    lon: -100.2,
  },
  {
    code: 'TN',
    ap: 'Tenn.',
    name: 'Tennessee',
    timezone: CH,
    lat: 35.9,
    lon: -86.4,
  },
  { code: 'TX', name: 'Texas', timezone: CH, lat: 31.5, lon: -99.3 },
  { code: 'UT', name: 'Utah', timezone: DEN, lat: 39.3, lon: -111.7 },
  {
    code: 'VT',
    ap: 'Vt.',
    name: 'Vermont',
    timezone: NY,
    lat: 44.0,
    lon: -72.7,
  },
  {
    code: 'VA',
    ap: 'Va.',
    name: 'Virginia',
    timezone: NY,
    lat: 37.5,
    lon: -78.8,
  },
  {
    code: 'WA',
    ap: 'Wash.',
    name: 'Washington',
    timezone: LA,
    lat: 47.4,
    lon: -120.5,
  },
  {
    code: 'WV',
    ap: 'W.Va.',
    name: 'West Virginia',
    timezone: NY,
    lat: 38.6,
    lon: -80.6,
  },
  {
    code: 'WI',
    ap: 'Wis.',
    name: 'Wisconsin',
    timezone: CH,
    lat: 44.6,
    lon: -89.7,
  },
  {
    code: 'WY',
    ap: 'Wyo.',
    name: 'Wyoming',
    timezone: DEN,
    lat: 43.0,
    lon: -107.5,
  },
];

const BY_CODE = new Map(US_STATES.map((state) => [state.code, state]));
const BY_NAME = new Map(
  US_STATES.map((state) => [normalizeName(state.name), state])
);
BY_NAME.set('washington dc', BY_CODE.get('DC') as UsState);
BY_NAME.set('washington d c', BY_CODE.get('DC') as UsState);

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

/** A state from a two-letter code or a full name ("GA", "Georgia", "D.C."); undefined when it is neither. */
export function resolveState(adminArea: unknown): UsState | undefined {
  if (typeof adminArea !== 'string') return undefined;
  const trimmed = adminArea.trim();
  if (!trimmed) return undefined;
  if (/^[A-Za-z]{2}$/.test(trimmed)) return BY_CODE.get(trimmed.toUpperCase());
  const name = normalizeName(trimmed);
  return BY_NAME.get(name) ?? BY_CODE.get(name.replace(/ /g, '').toUpperCase());
}

/** The slug of a state's root locality: the lowercase full name ("georgia", "district-of-columbia"). */
export function stateRootSlug(state: UsState): string {
  return normalizeName(state.name).replace(/ /g, '-');
}

export const US_ROOT_SLUG = 'us';
