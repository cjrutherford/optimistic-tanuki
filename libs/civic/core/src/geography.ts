import type { CivicKind, LocalityConfig, SourceConfig } from './types.js';
import type { LocalityRegistry } from './locality-registry.js';

export interface GeographyEvidence {
  decision: 'include' | 'withhold' | 'uncertain';
  confidence: 'high' | 'medium' | 'low';
  matchedSlugs: string[];
  reason: string;
}

export interface ScopeResolution {
  scopeSlug: string | null;
  scopeKind: string | null;
  reason: string;
}

/** The item fields inclusion depends on. */
export interface InclusionItem {
  sourceId: string;
  kind: CivicKind;
  title: string;
  body: string;
  /** Alert area names (for example, NWS `areaDesc` entries). */
  topics?: readonly string[];
  jurisdictionSlug?: string | null;
}

const STATE_NAMES: Record<string, { name: string; ap?: string }> = {
  AL: { name: 'Alabama', ap: 'Ala.' },
  AK: { name: 'Alaska' },
  AZ: { name: 'Arizona', ap: 'Ariz.' },
  AR: { name: 'Arkansas', ap: 'Ark.' },
  CA: { name: 'California', ap: 'Calif.' },
  CO: { name: 'Colorado', ap: 'Colo.' },
  CT: { name: 'Connecticut', ap: 'Conn.' },
  DE: { name: 'Delaware', ap: 'Del.' },
  DC: { name: 'District of Columbia', ap: 'D.C.' },
  FL: { name: 'Florida', ap: 'Fla.' },
  GA: { name: 'Georgia', ap: 'Ga.' },
  HI: { name: 'Hawaii' },
  ID: { name: 'Idaho' },
  IL: { name: 'Illinois', ap: 'Ill.' },
  IN: { name: 'Indiana', ap: 'Ind.' },
  IA: { name: 'Iowa' },
  KS: { name: 'Kansas', ap: 'Kan.' },
  KY: { name: 'Kentucky', ap: 'Ky.' },
  LA: { name: 'Louisiana', ap: 'La.' },
  ME: { name: 'Maine' },
  MD: { name: 'Maryland', ap: 'Md.' },
  MA: { name: 'Massachusetts', ap: 'Mass.' },
  MI: { name: 'Michigan', ap: 'Mich.' },
  MN: { name: 'Minnesota', ap: 'Minn.' },
  MS: { name: 'Mississippi', ap: 'Miss.' },
  MO: { name: 'Missouri', ap: 'Mo.' },
  MT: { name: 'Montana', ap: 'Mont.' },
  NE: { name: 'Nebraska', ap: 'Neb.' },
  NV: { name: 'Nevada', ap: 'Nev.' },
  NH: { name: 'New Hampshire', ap: 'N.H.' },
  NJ: { name: 'New Jersey', ap: 'N.J.' },
  NM: { name: 'New Mexico', ap: 'N.M.' },
  NY: { name: 'New York', ap: 'N.Y.' },
  NC: { name: 'North Carolina', ap: 'N.C.' },
  ND: { name: 'North Dakota', ap: 'N.D.' },
  OH: { name: 'Ohio' },
  OK: { name: 'Oklahoma', ap: 'Okla.' },
  OR: { name: 'Oregon', ap: 'Ore.' },
  PA: { name: 'Pennsylvania', ap: 'Pa.' },
  RI: { name: 'Rhode Island', ap: 'R.I.' },
  SC: { name: 'South Carolina', ap: 'S.C.' },
  SD: { name: 'South Dakota', ap: 'S.D.' },
  TN: { name: 'Tennessee', ap: 'Tenn.' },
  TX: { name: 'Texas' },
  UT: { name: 'Utah' },
  VT: { name: 'Vermont', ap: 'Vt.' },
  VA: { name: 'Virginia', ap: 'Va.' },
  WA: { name: 'Washington', ap: 'Wash.' },
  WV: { name: 'West Virginia', ap: 'W.Va.' },
  WI: { name: 'Wisconsin', ap: 'Wis.' },
  WY: { name: 'Wyoming', ap: 'Wyo.' },
};

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en-US');
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&').replace(/ /gu, '\\s+');
}

function phrasePattern(value: string, flags = 'iu'): RegExp {
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escape(normalize(value))}(?=$|[^\\p{L}\\p{N}])`,
    flags
  );
}

function containsPhrase(text: string, value: string): boolean {
  return Boolean(normalize(value)) && phrasePattern(value).test(text);
}

function localityNames(locality: LocalityConfig): string[] {
  return [locality.name, ...(locality.aliases ?? [])];
}

/** True when the text names the locality outside any of its exclude phrases (for example, "Nashville, Tennessee"). */
export function mentionsLocality(
  text: string,
  locality: LocalityConfig
): boolean {
  let remaining = normalize(text);
  for (const phrase of locality.excludePhrases ?? [])
    remaining = remaining.replace(phrasePattern(phrase, 'giu'), ' ');
  return localityNames(locality).some((name) =>
    containsPhrase(remaining, name)
  );
}

/** Alert areas list bare county names ("Berrien; Cook"), so compare against names with a trailing County/Parish removed. */
function matchesAlertArea(
  areas: readonly string[],
  locality: LocalityConfig
): boolean {
  const names = new Set(
    localityNames(locality).flatMap((name) => [
      normalize(name),
      normalize(name.replace(/\s+(?:county|parish|borough)$/iu, '')),
    ])
  );
  return areas
    .flatMap((area) => area.split(/[;,]/u))
    .some((area) => names.has(normalize(area)));
}

function hasStateContext(text: string, state: string): boolean {
  const entry = STATE_NAMES[state];
  if (!entry) return false;
  if (containsPhrase(text, entry.name)) return true;
  if (
    entry.ap &&
    new RegExp(`(?:^|[^\\p{L}])${escape(entry.ap.toLowerCase())}`, 'iu').test(
      text
    )
  )
    return true;
  return new RegExp(`,\\s*${state}\\b`, 'u').test(text);
}

/** The canonical scope of an item is its explicit jurisdiction when known, otherwise the source owner. */
export function resolveItemScope(
  source: Pick<SourceConfig, 'ownerSlug'>,
  jurisdictionSlug: string | null | undefined,
  registry: LocalityRegistry
): ScopeResolution {
  const slug = jurisdictionSlug ?? source.ownerSlug;
  try {
    const locality = registry.get(slug);
    return {
      scopeSlug: locality.slug,
      scopeKind: locality.kind,
      reason: jurisdictionSlug ? 'explicit jurisdiction' : 'source owner',
    };
  } catch {
    return {
      scopeSlug: null,
      scopeKind: null,
      reason: jurisdictionSlug
        ? 'unknown explicit jurisdiction'
        : 'unknown source owner',
    };
  }
}

/**
 * Decide whether an item belongs in an edition. One rule for every place:
 * 1. Sources owned by the edition or a place inside it are included.
 * 2. A containing place's `all`-coverage sources (government records) apply to everything inside it.
 * 3. A containing place's `mentions`-coverage sources must name the edition, a place inside it, or a
 *    non-broad place between the edition and the source owner (the owner included, so a county
 *    feed's county-wide story reaches its towns). Search aggregates and national sources also
 *    need same-state context, because place names repeat across states.
 */
export function decideEdition(
  item: InclusionItem,
  editionSlug: string,
  registry: LocalityRegistry
): GeographyEvidence {
  const edition = registry.get(editionSlug);
  const source = registry
    .sourcesForRun(editionSlug)
    .find((candidate) => candidate.sourceKey === item.sourceId);
  if (!source)
    return {
      decision: 'withhold',
      confidence: 'high',
      matchedSlugs: [],
      reason: 'source is not configured for this edition',
    };
  const ancestors = new Set(
    registry.ancestors(editionSlug).map((locality) => locality.slug)
  );
  const inside = registry.descendants(editionSlug);
  const insideSlugs = new Set(inside.map((locality) => locality.slug));

  if (item.jurisdictionSlug) {
    if (
      item.jurisdictionSlug === editionSlug ||
      insideSlugs.has(item.jurisdictionSlug)
    )
      return {
        decision: 'include',
        confidence: 'high',
        matchedSlugs: [item.jurisdictionSlug],
        reason: 'explicit jurisdiction within edition',
      };
    if (ancestors.has(item.jurisdictionSlug))
      return {
        decision: 'include',
        confidence: 'high',
        matchedSlugs: [item.jurisdictionSlug],
        reason: 'explicit jurisdiction contains edition',
      };
    return {
      decision: 'withhold',
      confidence: 'high',
      matchedSlugs: [item.jurisdictionSlug],
      reason: 'explicit jurisdiction names another locality',
    };
  }

  const owner = source.ownerSlug;
  if (owner === editionSlug)
    return {
      decision: 'include',
      confidence: 'high',
      matchedSlugs: [owner],
      reason: 'source owned by edition',
    };
  if (insideSlugs.has(owner))
    return {
      decision: 'include',
      confidence: 'high',
      matchedSlugs: [owner],
      reason: `source owned by ${owner} within edition`,
    };
  if (source.coverage === 'all')
    return {
      decision: 'include',
      confidence: 'medium',
      matchedSlugs: [owner],
      reason: `${owner} records apply to every place within it`,
    };

  const between = registry
    .ancestors(editionSlug)
    .filter(
      (locality) =>
        !locality.broad &&
        (locality.slug === owner ||
          registry
            .ancestors(locality.slug)
            .some((ancestor) => ancestor.slug === owner))
    );
  const candidates = [edition, ...inside, ...between];
  const text = `${item.title} ${item.body}`;
  const areas = item.kind === 'alert' ? item.topics ?? [] : [];
  const byArea = candidates.filter((locality) =>
    matchesAlertArea(areas, locality)
  );
  if (byArea.length)
    return {
      decision: 'include',
      confidence: 'high',
      matchedSlugs: byArea.map((locality) => locality.slug),
      reason: 'alert area names edition',
    };
  const matched = candidates.filter((locality) =>
    mentionsLocality(text, locality)
  );
  if (!matched.length)
    return {
      decision: 'withhold',
      confidence: 'medium',
      matchedSlugs: [],
      reason: `does not mention ${candidates
        .map((locality) => locality.name)
        .join(', ')}`,
    };
  const matchedSlugs = matched.map((locality) => locality.slug);
  const needsStateContext =
    source.aggregateDiscovery === true || registry.get(owner).state === 'US';
  if (needsStateContext) {
    const otherInState = registry
      .all()
      .some(
        (locality) =>
          locality.state === edition.state &&
          !matchedSlugs.includes(locality.slug) &&
          !ancestors.has(locality.slug) &&
          mentionsLocality(text, locality)
      );
    if (
      !hasStateContext(text, edition.state) &&
      matched.length < 2 &&
      !otherInState
    ) {
      return {
        decision: 'withhold',
        confidence: 'low',
        matchedSlugs,
        reason: `mentions ${matched[0]!.name} without ${edition.state} context`,
      };
    }
  }
  return {
    decision: 'include',
    confidence: needsStateContext ? 'medium' : 'high',
    matchedSlugs,
    reason: `mentions ${matched.map((locality) => locality.name).join(', ')}`,
  };
}
