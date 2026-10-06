import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import type {
  OfficialsConfig,
  CivicKind,
  EditorialDesk,
  LocalityConfig,
  SourceAccessMode,
  SourceConfig,
  SourceCoverageCapabilities,
} from './types.js';
import type { SourceCoverage } from './foundation-types.js';
import { findRestrictedPublisher } from './restricted-publishers.js';

const KINDS: readonly CivicKind[] = [
  'meeting',
  'legislation',
  'permit',
  'alert',
  'news',
  'open-data',
];
const DESKS: readonly EditorialDesk[] = [
  'government',
  'schools',
  'public-safety',
  'weather',
  'planning-permits',
  'community-news',
  'local-reporting',
];
const ACCESS_MODES: readonly SourceAccessMode[] = ['full', 'snippet-only'];
const COVERAGE_MODES: readonly SourceCoverage[] = ['all', 'mentions'];
const LOCALITY_KEYS = new Set([
  'slug',
  'name',
  'state',
  'timezone',
  'lat',
  'lon',
  'kind',
  'parents',
  'edition',
  'broad',
  'aliases',
  'excludePhrases',
  'topics',
  'cadence',
  'sources',
  'officials',
  'websites',
]);
const SOURCE_KEYS = new Set([
  'sourceKey',
  'coverage',
  'adapter',
  'name',
  'url',
  'kind',
  'enabled',
  'config',
  'desk',
  'accessMode',
  'accessRestrictionReason',
  'restrictionPolicyUrl',
  'aggregateDiscovery',
  'aggregateUrl',
  'coverageCapabilities',
]);
const REPLACED_LOCALITY_KEYS: Record<string, string> = {
  tier: 'use kind (descriptive) and parents',
  parentSlug: 'use parents: [slug, ...]',
  rulesFile:
    'county rule files were removed; inclusion is derived from the locality graph',
  ruleVersion: 'rule versions are computed from the locality graph',
};

export class LocalityConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocalityConfigError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '')
    throw new LocalityConfigError(`${path} must be a non-empty string`);
  return value;
}

function canonicalKey(value: unknown, path: string): string {
  const key = requiredString(value, path);
  if (
    key !== key.trim() ||
    key !== key.toLowerCase() ||
    !/^[a-z0-9]+(?:[-_.:][a-z0-9]+)*$/.test(key)
  ) {
    throw new LocalityConfigError(`${path} must be trimmed and canonical`);
  }
  return key;
}

function httpUrl(value: unknown, path: string): string {
  const input = requiredString(value, path);
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      throw new Error('unsupported protocol');
  } catch {
    throw new LocalityConfigError(`${path} must be a valid http or https URL`);
  }
  return input;
}

function validTimezone(value: unknown): string {
  const timezone = requiredString(value, 'timezone');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    throw new LocalityConfigError('timezone must be a valid IANA timezone');
  }
  return timezone;
}

function parseCoverageCapabilities(
  value: unknown,
  path: string
): SourceCoverageCapabilities {
  if (!isRecord(value))
    throw new LocalityConfigError(`${path} must be an object`);
  for (const key of Object.keys(value)) {
    if (key !== 'dateQuery' && key !== 'pagination')
      throw new LocalityConfigError(`${path} contains unknown key ${key}`);
  }
  let dateQuery: SourceCoverageCapabilities['dateQuery'];
  if (value['dateQuery'] !== undefined) {
    if (!isRecord(value['dateQuery']))
      throw new LocalityConfigError(`${path}.dateQuery must be an object`);
    for (const key of Object.keys(value['dateQuery'])) {
      if (key !== 'parameter' && key !== 'format')
        throw new LocalityConfigError(
          `${path}.dateQuery contains unknown key ${key}`
        );
    }
    const format = value['dateQuery']['format'];
    if (format !== 'YYYY-MM-DD' && format !== 'RFC3339')
      throw new LocalityConfigError(`${path}.dateQuery.format is invalid`);
    dateQuery = {
      parameter: requiredString(
        value['dateQuery']['parameter'],
        `${path}.dateQuery.parameter`
      ),
      format,
    };
  }
  let pagination: SourceCoverageCapabilities['pagination'];
  if (value['pagination'] !== undefined) {
    if (!isRecord(value['pagination']))
      throw new LocalityConfigError(`${path}.pagination must be an object`);
    for (const key of Object.keys(value['pagination'])) {
      if (
        key !== 'mode' &&
        key !== 'maxPages' &&
        key !== 'parameter' &&
        key !== 'untilCovered'
      )
        throw new LocalityConfigError(
          `${path}.pagination contains unknown key ${key}`
        );
    }
    const mode = value['pagination']['mode'];
    if (mode !== 'page' && mode !== 'cursor' && mode !== 'next-link')
      throw new LocalityConfigError(`${path}.pagination.mode is invalid`);
    if (
      typeof value['pagination']['maxPages'] !== 'number' ||
      !Number.isInteger(value['pagination']['maxPages']) ||
      value['pagination']['maxPages'] < 1
    ) {
      throw new LocalityConfigError(
        `${path}.pagination.maxPages must be a positive integer`
      );
    }
    const parameter =
      value['pagination']['parameter'] === undefined
        ? undefined
        : requiredString(
            value['pagination']['parameter'],
            `${path}.pagination.parameter`
          );
    if (
      value['pagination']['untilCovered'] !== undefined &&
      typeof value['pagination']['untilCovered'] !== 'boolean'
    ) {
      throw new LocalityConfigError(
        `${path}.pagination.untilCovered must be true or false`
      );
    }
    pagination = {
      mode,
      maxPages: value['pagination']['maxPages'],
      ...(parameter ? { parameter } : {}),
      ...(value['pagination']['untilCovered'] ? { untilCovered: true } : {}),
    };
  }
  return {
    ...(dateQuery ? { dateQuery } : {}),
    ...(pagination ? { pagination } : {}),
  };
}

function validateNewsDiscoverConfig(value: unknown, path: string): void {
  if (!isRecord(value))
    throw new LocalityConfigError(`${path} must be an object`);
  if (
    typeof value['query'] !== 'string' ||
    value['query'].trim() === '' ||
    value['query'] !== value['query'].trim()
  ) {
    throw new LocalityConfigError(
      `${path}.query must be a nonempty trimmed string`
    );
  }
  if (!Array.isArray(value['matchNames']) || value['matchNames'].length === 0) {
    throw new LocalityConfigError(
      `${path}.matchNames must be a nonempty array of trimmed strings`
    );
  }
  if (
    !value['matchNames'].every(
      (name) =>
        typeof name === 'string' && name.trim() !== '' && name === name.trim()
    )
  ) {
    throw new LocalityConfigError(
      `${path}.matchNames must contain only nonempty trimmed strings`
    );
  }
}

function isLikelyArticleUrl(value: string): boolean {
  const parsed = new URL(value);
  if (parsed.pathname === '/' || parsed.search) return false;
  return /\/(?:article|story|stories|posts?|news|local-news)(?:\/|$)/iu.test(
    parsed.pathname
  );
}

function isLikelyAggregateUrl(value: string): boolean {
  const parsed = new URL(value);
  return (
    Boolean(parsed.search) ||
    /\/(?:feed|rss|search|api)(?:\/|$)/iu.test(parsed.pathname)
  );
}

/**
 * Defensive intake guard for callers that construct SourceConfig objects
 * without going through the registry. It runs before an adapter is invoked,
 * so a configured restricted publisher can never be fetched directly.
 */
export function assertSourceRuntimeAccess(
  source: Pick<SourceConfig, 'adapter' | 'url' | 'aggregateUrl'>
): void {
  if (
    source.aggregateUrl !== undefined &&
    findRestrictedPublisher(null, source.aggregateUrl)
  ) {
    throw new LocalityConfigError(
      'aggregateUrl must target an aggregate host, not a restricted publisher domain'
    );
  }
  if (findRestrictedPublisher(null, source.url)) {
    throw new LocalityConfigError(
      'restricted publisher source cannot be fetched directly; use news-discover aggregate ingestion'
    );
  }
}

function defaultCoverage(kind: CivicKind): SourceCoverage {
  return kind === 'meeting' || kind === 'permit' ? 'all' : 'mentions';
}

function parseSource(
  value: unknown,
  index: number,
  ownerSlug: string
): SourceConfig {
  const path = `sources[${index}]`;
  if (!isRecord(value))
    throw new LocalityConfigError(`${path} must be an object`);
  for (const key of Object.keys(value)) {
    if (key === 'ownerScope')
      throw new LocalityConfigError(
        `${path}.ownerScope was removed; a source belongs to the locality file that declares it`
      );
    if (!SOURCE_KEYS.has(key))
      throw new LocalityConfigError(`${path} contains unknown key ${key}`);
  }
  const kind = value['kind'];
  if (!KINDS.includes(kind as CivicKind))
    throw new LocalityConfigError(`${path}.kind is invalid`);
  if (value['enabled'] !== undefined && typeof value['enabled'] !== 'boolean') {
    throw new LocalityConfigError(`${path}.enabled must be boolean`);
  }
  if (
    value['coverage'] !== undefined &&
    !COVERAGE_MODES.includes(value['coverage'] as SourceCoverage)
  )
    throw new LocalityConfigError(`${path}.coverage must be all or mentions`);
  if (
    value['desk'] !== undefined &&
    !DESKS.includes(value['desk'] as EditorialDesk)
  )
    throw new LocalityConfigError(`${path}.desk is invalid`);
  if (
    value['accessMode'] !== undefined &&
    !ACCESS_MODES.includes(value['accessMode'] as SourceAccessMode)
  )
    throw new LocalityConfigError(`${path}.accessMode is invalid`);
  if (value['accessRestrictionReason'] !== undefined)
    requiredString(
      value['accessRestrictionReason'],
      `${path}.accessRestrictionReason`
    );
  if (value['restrictionPolicyUrl'] !== undefined)
    httpUrl(value['restrictionPolicyUrl'], `${path}.restrictionPolicyUrl`);
  if (
    value['aggregateDiscovery'] !== undefined &&
    typeof value['aggregateDiscovery'] !== 'boolean'
  )
    throw new LocalityConfigError(`${path}.aggregateDiscovery must be boolean`);
  if (value['aggregateUrl'] !== undefined)
    httpUrl(value['aggregateUrl'], `${path}.aggregateUrl`);
  if (value['coverageCapabilities'] !== undefined)
    parseCoverageCapabilities(
      value['coverageCapabilities'],
      `${path}.coverageCapabilities`
    );
  const adapter = requiredString(value['adapter'], `${path}.adapter`);
  const name = requiredString(value['name'], `${path}.name`);
  const sourceUrl = httpUrl(value['url'], `${path}.url`);
  if (adapter === 'news-discover')
    validateNewsDiscoverConfig(value['config'], `${path}.config`);
  const restricted =
    value['accessMode'] === 'snippet-only' ||
    value['accessRestrictionReason'] !== undefined ||
    value['restrictionPolicyUrl'] !== undefined;
  if (restricted) {
    if (adapter !== 'news-discover')
      throw new LocalityConfigError(
        `${path} restricted publisher sources must use news-discover aggregate ingestion`
      );
    if (value['accessMode'] !== 'snippet-only')
      throw new LocalityConfigError(
        `${path} restricted sources must use snippet-only accessMode`
      );
    if (value['aggregateDiscovery'] !== true)
      throw new LocalityConfigError(
        `${path} restricted sources require aggregateDiscovery: true`
      );
    requiredString(
      value['accessRestrictionReason'],
      `${path}.accessRestrictionReason`
    );
    httpUrl(value['restrictionPolicyUrl'], `${path}.restrictionPolicyUrl`);
    if (value['aggregateUrl'] === undefined)
      throw new LocalityConfigError(
        `${path}.aggregateUrl is required for restricted sources`
      );
    if (isLikelyArticleUrl(value['aggregateUrl'] as string))
      throw new LocalityConfigError(
        `${path}.aggregateUrl must be an aggregate URL, not an article URL`
      );
  }
  if (
    value['aggregateUrl'] !== undefined &&
    (isLikelyArticleUrl(value['aggregateUrl'] as string) ||
      (value['url'] === value['aggregateUrl'] &&
        !isLikelyAggregateUrl(value['aggregateUrl'] as string)))
  )
    throw new LocalityConfigError(
      `${path}.aggregateUrl must not be an article URL`
    );
  if (
    value['aggregateDiscovery'] === true &&
    value['aggregateUrl'] === undefined
  )
    throw new LocalityConfigError(
      `${path}.aggregateUrl is required when aggregateDiscovery is enabled`
    );
  const sourceKey = canonicalKey(value['sourceKey'], `${path}.sourceKey`);
  return {
    sourceKey,
    ownerSlug,
    coverage:
      (value['coverage'] as SourceCoverage | undefined) ??
      defaultCoverage(kind as CivicKind),
    adapter,
    name,
    url: sourceUrl,
    kind: kind as CivicKind,
    ...(value['enabled'] === undefined ? {} : { enabled: value['enabled'] }),
    ...(value['config'] === undefined
      ? {}
      : {
          config: isRecord(value['config'])
            ? value['config']
            : (() => {
                throw new LocalityConfigError(
                  `${path}.config must be an object`
                );
              })(),
        }),
    ...(value['desk'] === undefined
      ? {}
      : { desk: value['desk'] as EditorialDesk }),
    ...(value['accessMode'] === undefined
      ? {}
      : { accessMode: value['accessMode'] as SourceAccessMode }),
    ...(value['accessRestrictionReason'] === undefined
      ? {}
      : {
          accessRestrictionReason: value['accessRestrictionReason'] as string,
        }),
    ...(value['restrictionPolicyUrl'] === undefined
      ? {}
      : { restrictionPolicyUrl: value['restrictionPolicyUrl'] as string }),
    ...(value['aggregateDiscovery'] === undefined
      ? {}
      : { aggregateDiscovery: value['aggregateDiscovery'] as boolean }),
    ...(value['aggregateUrl'] === undefined
      ? {}
      : { aggregateUrl: value['aggregateUrl'] as string }),
    ...(value['coverageCapabilities'] === undefined
      ? {}
      : {
          coverageCapabilities: parseCoverageCapabilities(
            value['coverageCapabilities'],
            `${path}.coverageCapabilities`
          ),
        }),
  };
}

function stringArray(value: unknown, path: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string' && item.trim() !== '')
  )
    throw new LocalityConfigError(
      `${path} must be an array of non-empty strings`
    );
  return value as string[];
}

export function validateLocalityConfig(value: unknown): LocalityConfig {
  if (!isRecord(value))
    throw new LocalityConfigError('locality must be an object');
  for (const key of Object.keys(value)) {
    if (REPLACED_LOCALITY_KEYS[key])
      throw new LocalityConfigError(
        `locality key ${key} was removed: ${REPLACED_LOCALITY_KEYS[key]}`
      );
    if (!LOCALITY_KEYS.has(key))
      throw new LocalityConfigError(`locality contains unknown key ${key}`);
  }
  const slug = canonicalKey(value['slug'], 'slug');
  const cadence = value['cadence'] ?? [];
  if (
    !Array.isArray(cadence) ||
    !cadence.every((item) => item === 'daily' || item === 'weekly')
  )
    throw new LocalityConfigError('cadence must contain daily or weekly');
  if (value['edition'] !== undefined && typeof value['edition'] !== 'boolean')
    throw new LocalityConfigError('edition must be boolean');
  const edition = value['edition'] === true;
  if (value['broad'] !== undefined && typeof value['broad'] !== 'boolean')
    throw new LocalityConfigError('broad must be boolean');
  if (edition && cadence.length === 0)
    throw new LocalityConfigError('an edition locality requires a cadence');
  const parents =
    value['parents'] === undefined
      ? []
      : stringArray(value['parents'], 'parents').map((parent, index) =>
          canonicalKey(parent, `parents[${index}]`)
        );
  if (new Set(parents).size !== parents.length)
    throw new LocalityConfigError('parents must not repeat');
  if (parents.includes(slug))
    throw new LocalityConfigError('a locality cannot be its own parent');
  const sources = value['sources'] ?? [];
  if (!Array.isArray(sources))
    throw new LocalityConfigError('sources must be an array');
  const state = requiredString(value['state'], 'state');
  if (!/^[A-Z]{2}$/u.test(state))
    throw new LocalityConfigError(
      'state must be a two-letter uppercase code (US for national roots)'
    );
  return {
    slug,
    name: requiredString(value['name'], 'name'),
    state,
    timezone: validTimezone(value['timezone']),
    lat:
      typeof value['lat'] === 'number' &&
      Number.isFinite(value['lat']) &&
      value['lat'] >= -90 &&
      value['lat'] <= 90
        ? value['lat']
        : (() => {
            throw new LocalityConfigError(
              'lat must be a finite number from -90 to 90'
            );
          })(),
    lon:
      typeof value['lon'] === 'number' &&
      Number.isFinite(value['lon']) &&
      value['lon'] >= -180 &&
      value['lon'] <= 180
        ? value['lon']
        : (() => {
            throw new LocalityConfigError(
              'lon must be a finite number from -180 to 180'
            );
          })(),
    kind: requiredString(value['kind'], 'kind'),
    parents,
    edition,
    ...(value['broad'] === true ? { broad: true } : {}),
    ...(value['aliases'] === undefined
      ? {}
      : { aliases: stringArray(value['aliases'], 'aliases') }),
    ...(value['excludePhrases'] === undefined
      ? {}
      : {
          excludePhrases: stringArray(
            value['excludePhrases'],
            'excludePhrases'
          ),
        }),
    topics:
      value['topics'] === undefined
        ? []
        : stringArray(value['topics'], 'topics'),
    cadence: cadence as LocalityConfig['cadence'],
    sources: sources.map((source, index) => parseSource(source, index, slug)),
    ...(value['officials'] === undefined
      ? {}
      : { officials: parseOfficials(value['officials']) }),
    ...(value['websites'] === undefined
      ? {}
      : {
          websites: stringArray(value['websites'], 'websites').map(
            (site, index) => httpsUrl(site, `websites[${index}]`)
          ),
        }),
  };
}

/**
 * A source written by the sourcing engine rather than by hand, validated by
 * exactly the rules a hand-written one is. A discovered source that would be
 * refused in a locality file is refused here too.
 */
export function parseDiscoveredSource(
  value: unknown,
  ownerSlug: string
): SourceConfig {
  return parseSource(value, 0, ownerSlug);
}

const HOSTNAME =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u;

function httpsUrl(value: unknown, path: string): string {
  const text = requiredString(value, path);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new LocalityConfigError(`${path} must be a URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:')
    throw new LocalityConfigError(`${path} must be an http(s) URL`);
  return text;
}

function parseOfficials(value: unknown): OfficialsConfig {
  if (!isRecord(value))
    throw new LocalityConfigError('officials must be an object');
  for (const key of Object.keys(value)) {
    if (!['domains', 'roster', 'callbackNumberSource'].includes(key))
      throw new LocalityConfigError(`officials contains unknown key ${key}`);
  }
  const domains = stringArray(value['domains'], 'officials.domains');
  if (!domains.length)
    throw new LocalityConfigError(
      'officials.domains must list at least one domain'
    );
  for (const domain of domains) {
    if (!HOSTNAME.test(domain))
      throw new LocalityConfigError(
        `officials.domains entry ${domain} must be a lower-case hostname`
      );
  }
  if (!Array.isArray(value['roster']))
    throw new LocalityConfigError('officials.roster must be a list');
  const roster = value['roster'].map((entry, index) => {
    if (!isRecord(entry))
      throw new LocalityConfigError(
        `officials.roster[${index}] must be an object`
      );
    return {
      name: requiredString(entry['name'], `officials.roster[${index}].name`),
      office: requiredString(
        entry['office'],
        `officials.roster[${index}].office`
      ),
      source: httpsUrl(entry['source'], `officials.roster[${index}].source`),
    };
  });
  return {
    domains,
    roster,
    callbackNumberSource: httpsUrl(
      value['callbackNumberSource'],
      'officials.callbackNumberSource'
    ),
  };
}

export function parseLocalityConfig(value: unknown): LocalityConfig {
  return validateLocalityConfig(
    typeof value === 'string' ? YAML.parse(value) : value
  );
}

export function loadLocalityConfig(path: string): LocalityConfig {
  return parseLocalityConfig(readFileSync(path, 'utf8'));
}
