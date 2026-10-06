import type {
  LlmRejectedClaim,
  LlmBriefAnalysis,
  LlmBriefBullet,
  LlmBriefPlan,
  LlmCitation,
  LlmClaim,
  LlmClusterAnalysis,
  LlmEvidence,
  LlmStoryAnalysis,
} from './contracts.js';

/** Deterministic guards for strict model output. Source text is never interpreted as instructions. */

const MONTHS: [RegExp, string][] = [
  [/\bjanuary\b/gi, 'jan'],
  [/\bfebruary\b/gi, 'feb'],
  [/\bmarch\b/gi, 'mar'],
  [/\bapril\b/gi, 'apr'],
  [/\bmay\b/gi, 'may'],
  [/\bjune\b/gi, 'jun'],
  [/\bjuly\b/gi, 'jul'],
  [/\baugust\b/gi, 'aug'],
  [/\bseptember\b/gi, 'sep'],
  [/\bsept\b/gi, 'sep'],
  [/\boctober\b/gi, 'oct'],
  [/\bnovember\b/gi, 'nov'],
  [/\bdecember\b/gi, 'dec'],
];

/** Normalize only the private grounding view; caller prose remains raw. */
function normalizeGroundingText(text: string): string {
  // "$16M" and "$16 million" are one amount; headlines abbreviate, prose does not.
  return text
    .normalize('NFKC')
    .replace(
      /\$(\d+(?:\.\d+)?)\s?([KMB])\b/gu,
      (_whole, amount: string, unit: string) =>
        `$${amount} ${
          unit === 'K' ? 'thousand' : unit === 'M' ? 'million' : 'billion'
        }`
    );
}

export function normalizeDates(text: string): string {
  let out = text.toLowerCase().replace(/,/g, '');
  for (const [pattern, short] of MONTHS) out = out.replace(pattern, short);
  return out.replace(/\s+/g, ' ').trim();
}
export function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

export class LlmValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmValidationError';
  }
}

function parseStrictJson(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    if (/```/.test(raw))
      throw new LlmValidationError('fenced JSON is not accepted');
    if (!raw.trim()) throw new LlmValidationError('empty model output');
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error('expected object');
      return parsed as Record<string, unknown>;
    } catch (error) {
      throw new LlmValidationError(
        `malformed JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new LlmValidationError('analysis must be an object');
  return raw as Record<string, unknown>;
}

function assertAllowedFields(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length)
    throw new LlmValidationError(
      `${label} contains unknown field(s): ${unknown.join(', ')}`
    );
}

/**
 * `civicItem` appeared in one observed model wrapper, but it is not evidence.
 * Permit only JSON scalar values or plain object metadata and never inspect it
 * when binding citations. Arrays are rejected because they can masquerade as
 * a second evidence list; the metadata is otherwise deliberately discarded.
 */
function validateCivicItemMetadata(value: unknown, depth = 0): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new LlmValidationError(
      'civicItem metadata must be a JSON scalar or object'
    );
  if (depth >= 4)
    throw new LlmValidationError(
      'civicItem metadata object is too deeply nested'
    );
  for (const nested of Object.values(value as Record<string, unknown>))
    validateCivicItemMetadata(nested, depth + 1);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new LlmValidationError(`${field} is empty`);
  if (isRefusal(value))
    throw new LlmValidationError(`${field} contains refusal text`);
  if (
    /(?:retry\s+diagnostic|non[- ]authoritative\s+retry|machine[- ]only\s+citation|begin\s+untrusted\s+evidence|end\s+untrusted\s+evidence|\bcivicItemId\s*=|\bsourceKey\s*=)/iu.test(
      value
    )
  ) {
    throw new LlmValidationError(
      `internal-citation-marker: ${field} contains internal retry diagnostic or metadata prose`
    );
  }
  if (/(?:\.\.\.|…)/u.test(value)) {
    throw new LlmValidationError(
      `truncated-ellipsis: ${field} contains incomplete public prose`
    );
  }
  return value.trim();
}

function evidenceMap(
  evidence: readonly LlmEvidence[]
): Map<string, LlmEvidence> {
  const map = new Map<string, LlmEvidence>();
  for (const [key, group] of evidenceGroups(evidence))
    map.set(key, mergeEvidenceGroup(key, group));
  return map;
}

function evidenceGroups(
  evidence: readonly LlmEvidence[]
): Map<string, LlmEvidence[]> {
  const groups = new Map<string, LlmEvidence[]>();
  for (const item of evidence) {
    const key = `${item.sourceKey}\u0000${item.civicItemId}\u0000${
      item.agendaItemId ?? ''
    }`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

type EvidenceMetadataField =
  | 'sourceName'
  | 'publisher'
  | 'localitySlug'
  | 'scopeSlug'
  | 'scopeKind'
  | 'accessMode'
  | 'articleUrl'
  | 'geographyDecision';
const EVIDENCE_METADATA_FIELDS: readonly EvidenceMetadataField[] = [
  'sourceName',
  'publisher',
  'localitySlug',
  'scopeSlug',
  'scopeKind',
  'accessMode',
  'articleUrl',
  'geographyDecision',
];

function metadataValue(
  item: LlmEvidence,
  field: EvidenceMetadataField
): string | undefined {
  if (field === 'accessMode') {
    const snippetMarker =
      item.snippetOnly === undefined
        ? undefined
        : item.snippetOnly
        ? 'snippet-only'
        : 'full';
    if (
      item.snippetOnly !== undefined &&
      typeof item.snippetOnly !== 'boolean'
    ) {
      throw new LlmValidationError(
        `evidence access metadata is invalid for ${item.sourceKey}/${item.civicItemId}`
      );
    }
    if (
      item.accessMode !== undefined &&
      item.accessMode !== 'full' &&
      item.accessMode !== 'snippet-only'
    ) {
      throw new LlmValidationError(
        `evidence access metadata is invalid for ${item.sourceKey}/${item.civicItemId}`
      );
    }
    const mode = item.accessMode;
    if (
      snippetMarker !== undefined &&
      mode !== undefined &&
      snippetMarker !== mode
    ) {
      throw new LlmValidationError(
        `evidence access metadata is internally contradictory for ${item.sourceKey}/${item.civicItemId}`
      );
    }
    // An omitted access marker is unknown, not an assertion of full access.
    // This permits a missing optional field to merge with an explicit marker,
    // while an explicit full marker can never mask a snippet-only duplicate.
    return snippetMarker ?? mode;
  }
  const value = item[field];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/**
 * Duplicate IDs are valid for agenda sections, but policy metadata must agree.
 * Missing optional metadata may be filled from another duplicate; an explicit
 * snippet marker always wins over omission, and never gets masked as full.
 */
function mergeEvidenceGroup(
  key: string,
  group: readonly LlmEvidence[]
): LlmEvidence {
  const first = group[0];
  if (!first)
    throw new LlmValidationError(`duplicate evidence group ${key} is empty`);
  for (const field of EVIDENCE_METADATA_FIELDS) {
    const values = new Set(
      group
        .map((item) => metadataValue(item, field))
        .filter((value): value is string => value !== undefined)
    );
    if (values.size > 1)
      throw new LlmValidationError(
        `duplicate evidence metadata conflict for ${key}: ${field}`
      );
  }
  const merged: LlmEvidence = { ...first };
  for (const field of EVIDENCE_METADATA_FIELDS) {
    if (field === 'accessMode') continue;
    if (metadataValue(merged, field) !== undefined) continue;
    const present = group
      .map((item) => item[field])
      .find(
        (value): value is string =>
          typeof value === 'string' && Boolean(value.trim())
      );
    if (present !== undefined)
      (merged as unknown as Record<string, unknown>)[field] = present;
  }
  const access = new Set(
    group
      .map((item) => metadataValue(item, 'accessMode'))
      .filter((value): value is string => value !== undefined)
  );
  if (access.has('snippet-only')) {
    merged.accessMode = 'snippet-only';
    merged.snippetOnly = true;
  } else if (access.has('full')) {
    merged.accessMode = 'full';
    merged.snippetOnly = false;
  }
  return merged;
}

function validatedEvidenceGroups(
  evidence: readonly LlmEvidence[]
): Map<string, LlmEvidence[]> {
  const groups = evidenceGroups(evidence);
  for (const [key, group] of groups) mergeEvidenceGroup(key, group);
  return groups;
}

/**
 * Ollama sometimes serializes database identifiers as JSON strings. Accept
 * only canonical decimal strings or safe positive integer JSON numbers, then
 * bind the normalized number to the supplied evidence below.
 */
function normalizeCitationId(value: unknown, requireNumeric = false): number {
  if (typeof value === 'number') {
    if (Number.isSafeInteger(value) && value > 0) return value;
  } else if (
    !requireNumeric &&
    typeof value === 'string' &&
    /^[1-9]\d*$/u.test(value)
  ) {
    const normalized = Number(value);
    if (Number.isSafeInteger(normalized) && normalized > 0) return normalized;
  }
  throw new LlmValidationError('citation must bind sourceKey and civicItemId');
}

function normalizeCitations(citations: readonly LlmCitation[]): LlmCitation[] {
  const byItem = new Map<string, LlmCitation>();
  for (const citation of citations) {
    const key = `${citation.civicItemId}\u0000${citation.agendaItemId ?? ''}`;
    const existing = byItem.get(key);
    if (!existing) {
      byItem.set(key, citation);
      continue;
    }
    if (existing.sourceKey !== citation.sourceKey)
      throw new LlmValidationError(
        `conflicting citation sourceKey for civic item ${citation.civicItemId}`
      );
    if (Boolean(existing.snippetOnly) !== Boolean(citation.snippetOnly))
      throw new LlmValidationError(
        `conflicting citation access metadata for civic item ${citation.civicItemId}`
      );
    if ((existing.articleUrl ?? '') !== (citation.articleUrl ?? ''))
      throw new LlmValidationError(
        `conflicting citation article URL for civic item ${citation.civicItemId}`
      );
  }
  return [...byItem.values()].sort(
    (left, right) =>
      left.civicItemId - right.civicItemId ||
      (left.agendaItemId ?? 0) - (right.agendaItemId ?? 0) ||
      left.sourceKey.localeCompare(right.sourceKey)
  );
}

function validateCitations(
  raw: unknown,
  evidence: readonly LlmEvidence[],
  options: { requireNumericIds?: boolean; rejectModelMetadata?: boolean } = {}
): LlmCitation[] {
  if (!Array.isArray(raw) || raw.length === 0)
    throw new LlmValidationError('at least one citation is required');
  const allowed = evidenceMap(evidence);
  const citations = raw.map((value) => {
    if (!value || typeof value !== 'object')
      throw new LlmValidationError('malformed citation');
    const c = value as Record<string, unknown>;
    assertAllowedFields(
      c,
      ['sourceKey', 'civicItemId', 'agendaItemId', 'articleUrl', 'snippetOnly'],
      'citation'
    );
    if (
      options.rejectModelMetadata &&
      (Object.prototype.hasOwnProperty.call(c, 'articleUrl') ||
        Object.prototype.hasOwnProperty.call(c, 'snippetOnly'))
    ) {
      throw new LlmValidationError(
        'citation access metadata must be derived from supplied evidence'
      );
    }
    if (typeof c['sourceKey'] !== 'string')
      throw new LlmValidationError(
        'citation must bind sourceKey and civicItemId'
      );
    const civicItemId = normalizeCitationId(
      c['civicItemId'],
      options.requireNumericIds
    );
    const agendaItemId =
      c['agendaItemId'] === undefined
        ? undefined
        : normalizeCitationId(c['agendaItemId'], options.requireNumericIds);
    const source = allowed.get(
      `${c['sourceKey']}\u0000${civicItemId}\u0000${agendaItemId ?? ''}`
    );
    if (!source)
      throw new LlmValidationError(
        `unknown or unbound citation ${c['sourceKey']}/${civicItemId}`
      );
    if (
      source.geographyDecision === 'withhold' ||
      source.geographyDecision === 'uncertain'
    )
      throw new LlmValidationError(
        `citation is ${
          source.geographyDecision === 'withhold' ? 'withheld' : 'uncertain'
        }`
      );
    const snippetOnly =
      source.snippetOnly === true || source.accessMode === 'snippet-only';
    if (c['snippetOnly'] !== undefined && typeof c['snippetOnly'] !== 'boolean')
      throw new LlmValidationError('citation snippetOnly must be boolean');
    if (c['articleUrl'] !== undefined && typeof c['articleUrl'] !== 'string')
      throw new LlmValidationError('citation articleUrl must be a string');
    if (c['snippetOnly'] === false && snippetOnly)
      throw new LlmValidationError(
        'restricted citation cannot claim full body access'
      );
    // URLs are authoritative source metadata, never model-provided data.
    return {
      sourceKey: c['sourceKey'],
      civicItemId,
      ...(agendaItemId === undefined ? {} : { agendaItemId }),
      ...(source.articleUrl ? { articleUrl: source.articleUrl } : {}),
      ...(snippetOnly ? { snippetOnly: true } : {}),
    };
  });
  return normalizeCitations(citations);
}

function applySnippetPolicy(
  citations: readonly LlmCitation[],
  limitation: unknown
): { limitation?: string; relegated?: boolean } {
  const normalizedLimitation = validateLimitation(limitation);
  const hasSnippet = citations.some((c) => c.snippetOnly === true);
  const hasFull = citations.some((c) => c.snippetOnly !== true);
  if (!hasSnippet)
    return normalizedLimitation ? { limitation: normalizedLimitation } : {};
  if (hasFull && !normalizedLimitation)
    throw new LlmValidationError(
      'mixed full and snippet citations require a limitation'
    );
  return {
    ...(normalizedLimitation ? { limitation: normalizedLimitation } : {}),
    ...(hasFull ? {} : { relegated: true }),
  };
}

/**
 * Models sometimes fill an optional limitation slot with a placeholder rather
 * than omitting the field. Keep this set deliberately narrow: only exact,
 * case-insensitive absence markers (plus common dash-shaped blank markers) are
 * removed. Phrases such as "No details were available" remain substantive
 * prose and are preserved.
 */
const LIMITATION_ABSENCE_SENTINELS = new Set([
  'none',
  'n/a',
  'not applicable',
  'optional',
  '-',
  '–',
  '—',
]);

/**
 * Limitations are model-authored prose. They are rendered as text and may not
 * become a second, unreviewed link channel. Keep this deliberately
 * conservative: reject explicit schemes, markdown/autolinks, HTML anchors,
 * domains, and common obfuscations while retaining ordinary limitation prose.
 */
function validateLimitation(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string')
    throw new LlmValidationError('limitation must be plain text');
  const text = value.trim();
  if (!text) return undefined;
  const linkLike = [
    // Explicit and lightly-spaced URI schemes, including hxxp obfuscation.
    /\b(?:https?|ftp|file|mailto|javascript|data|ssh|tel|hxxps?)\s*:/iu,
    /\b(?:https?|hxxps?)\s*(?:\[\s*:\s*\]|\(\s*:\s*\))\s*\/{1,2}/iu,
    /\b[a-z][a-z0-9+.-]{1,31}:(?:\/\/|(?=[^\s]))/iu,
    // Markdown links, reference links, and angle-bracket autolinks.
    /!?\[[^\]\n]+\]\(\s*[^)\n]+\)/u,
    /\[[^\]\n]+\]\[[^\]\n]*\]/u,
    /<\s*(?:[a-z][a-z0-9+.-]{1,31}:|www\.)[^>\n]+>/iu,
    // HTML anchors, even when their href is obfuscated or omitted.
    /<\/?a\b[^>]*>/iu,
    // Bare domains and www domains.
    /(?:^|[\s(<\[])\s*(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#][^\s)]*)?/iu,
    // Common textual/character obfuscations: example[.]com, example (dot) com.
    /\b[a-z0-9-]+(?:\[\s*(?:[.]|dot)\s*\]|\(\s*dot\s*\)|\s+dot\s+|\s+\.\s+)\s*[a-z]{2,}\b/iu,
  ];
  if (linkLike.some((pattern) => pattern.test(text)))
    throw new LlmValidationError(
      'limitation must not contain URLs or link-like markup'
    );
  const normalized = text.toLowerCase().replace(/\s+/gu, ' ');
  return !normalized || LIMITATION_ABSENCE_SENTINELS.has(normalized)
    ? undefined
    : text;
}

const GROUNDING_STOP_WORDS = new Set([
  'a',
  'about',
  'after',
  'against',
  'all',
  'also',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'for',
  'from',
  'has',
  'have',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'may',
  'more',
  'most',
  'new',
  'no',
  'not',
  'of',
  'on',
  'or',
  'our',
  'residents',
  'should',
  'that',
  'the',
  'their',
  'this',
  'to',
  'under',
  'was',
  'were',
  'what',
  'when',
  'which',
  'who',
  'will',
  'with',
  'would',
  'year',
  'years',
]);
const GENERIC_CONTEXT_WORDS = new Set([
  'around',
  'attention',
  'community',
  'details',
  'expect',
  'follow',
  'future',
  'important',
  'impact',
  'informed',
  'matter',
  'matters',
  'plan',
  'prepare',
  'residents',
  'source',
  'stay',
  'stored',
  'watch',
]);

/**
 * Proper-name grounding is intentionally contextual rather than capitalization
 * based. Model headlines title-case ordinary nouns (for example, "Meeting
 * Items Focus") and every sentence may capitalize its first word, so a title
 * word by itself is not an identifier. We only inspect names when a stable
 * entity shape makes the intent reasonably clear: an acronym, a mixed-token
 * identifier (handled by groundedNumericTokens), a name beside an entity type
 * such as "City Council", or a name following an explicit naming/person cue.
 * This is a gross mismatch guard, not a general-purpose NER implementation.
 */
const ENTITY_TYPE_WORDS = new Set([
  'agency',
  'avenue',
  'board',
  'borough',
  'boulevard',
  'center',
  'centre',
  'city',
  'clinic',
  'college',
  'commission',
  'company',
  'council',
  'county',
  'department',
  'district',
  'drive',
  'elementary',
  'foundation',
  'group',
  'hospital',
  'inc',
  'institute',
  'lane',
  'library',
  'llc',
  'office',
  'park',
  'road',
  'roads',
  'school',
  'state',
  'street',
  'town',
  'university',
  'village',
  'authority',
]);

/**
 * These are semantic modifiers, not proper-name stop words. They commonly
 * precede an entity type in model-authored headlines ("Upcoming City Council
 * Meetings", "Annual Department Updates"). Excluding them only in that
 * contextual shape prevents capitalization style from becoming an entity
 * signal while leaving unknown place/person names fail-closed.
 */
const ENTITY_MODIFIER_WORDS = new Set([
  'annual',
  'anticipated',
  'august',
  'current',
  'daily',
  'december',
  'expected',
  'february',
  'future',
  'important',
  'january',
  'july',
  'june',
  'latest',
  'local',
  'march',
  'may',
  'monthly',
  'municipal',
  'new',
  'next',
  'november',
  'october',
  'official',
  'ongoing',
  'planned',
  'possible',
  'previous',
  'prior',
  'proposed',
  'public',
  'recent',
  'regular',
  'scheduled',
  'september',
  'special',
  'temporary',
  'today',
  'tomorrow',
  'updated',
  'upcoming',
  'weekly',
  'yesterday',
]);

/**
 * A bounded set of unmistakable ordinary heading words. Longer all-caps
 * tokens are otherwise treated as possible acronyms, so words such as
 * "MEETINGS" and "UPDATES" must not become accidental identifiers. This is
 * deliberately about editorial vocabulary, not an ever-growing list of
 * entity names; unknown all-caps tokens remain strict.
 */
const ORDINARY_UPPERCASE_HEADING_WORDS = new Set([
  'agenda',
  'agendas',
  'announcement',
  'announcements',
  'approved',
  'approval',
  'change',
  'changes',
  'community',
  'comments',
  'development',
  'designations',
  'event',
  'events',
  'focus',
  'heading',
  'headings',
  'item',
  'items',
  'meeting',
  'meetings',
  'minutes',
  'news',
  'processing',
  'report',
  'reports',
  'summary',
  'update',
  'updates',
  'work',
  'works',
]);

const ENTITY_CUE_WORDS = new Set([
  'awarded',
  'called',
  'designated',
  'designating',
  'honored',
  'honoured',
  'introduced',
  'located',
  'named',
  'recognizing',
  'recognized',
  'recognises',
  'recognizes',
  'submitted',
  'sponsored',
  'written',
]);

/** USPS state codes are geographic qualifiers only with matching locality/scope metadata. */
const US_STATE_ABBREVIATIONS = new Set([
  'al',
  'ak',
  'az',
  'ar',
  'ca',
  'co',
  'ct',
  'de',
  'fl',
  'ga',
  'hi',
  'id',
  'il',
  'in',
  'ia',
  'ks',
  'ky',
  'la',
  'me',
  'md',
  'ma',
  'mi',
  'mn',
  'ms',
  'mo',
  'mt',
  'ne',
  'nv',
  'nh',
  'nj',
  'nm',
  'ny',
  'nc',
  'nd',
  'oh',
  'ok',
  'or',
  'pa',
  'ri',
  'sc',
  'sd',
  'tn',
  'tx',
  'ut',
  'vt',
  'va',
  'wa',
  'wv',
  'wi',
  'wy',
  'dc',
]);
const US_STATE_NAMES: Readonly<Record<string, string>> = {
  alabama: 'al',
  alaska: 'ak',
  arizona: 'az',
  arkansas: 'ar',
  california: 'ca',
  colorado: 'co',
  connecticut: 'ct',
  delaware: 'de',
  florida: 'fl',
  georgia: 'ga',
  hawaii: 'hi',
  idaho: 'id',
  illinois: 'il',
  indiana: 'in',
  iowa: 'ia',
  kansas: 'ks',
  kentucky: 'ky',
  louisiana: 'la',
  maine: 'me',
  maryland: 'md',
  massachusetts: 'ma',
  michigan: 'mi',
  minnesota: 'mn',
  mississippi: 'ms',
  missouri: 'mo',
  montana: 'mt',
  nebraska: 'ne',
  nevada: 'nv',
  'new hampshire': 'nh',
  'new jersey': 'nj',
  'new mexico': 'nm',
  'new york': 'ny',
  'north carolina': 'nc',
  'north dakota': 'nd',
  ohio: 'oh',
  oklahoma: 'ok',
  oregon: 'or',
  pennsylvania: 'pa',
  'rhode island': 'ri',
  'south carolina': 'sc',
  'south dakota': 'sd',
  tennessee: 'tn',
  texas: 'tx',
  utah: 'ut',
  vermont: 'vt',
  virginia: 'va',
  washington: 'wa',
  'west virginia': 'wv',
  wisconsin: 'wi',
  wyoming: 'wy',
  'district of columbia': 'dc',
};
const STATE_QUALIFIER_ENTITY_WORDS = new Set([
  'city',
  'council',
  'county',
  'department',
]);

type InstitutionalRole = 'council' | 'school-board' | 'commission';
const INSTITUTIONAL_ROLE_PATTERNS: Readonly<Record<InstitutionalRole, RegExp>> =
  {
    council: /\b(?:(?:city|town|municipal)\s+)?councils?\b/iu,
    'school-board': /\b(?:school\s+boards?|boards?\s+of\s+education)\b/iu,
    commission:
      /\b(?:(?:planning|zoning|city|town)\s+)?commission(?:s|ers?)?\b/iu,
  };

function institutionalRoles(text: string): Set<InstitutionalRole> {
  return new Set(
    (
      Object.entries(INSTITUTIONAL_ROLE_PATTERNS) as [
        InstitutionalRole,
        RegExp
      ][]
    )
      .filter(([, pattern]) => pattern.test(text))
      .map(([role]) => role)
  );
}

type CivicEventType = 'workshop' | 'town-hall' | 'public-hearing';
const CIVIC_EVENT_TYPE_PATTERNS: Readonly<Record<CivicEventType, RegExp>> = {
  workshop: /\bworkshops?\b/iu,
  'town-hall': /\btown[\s-]+halls?\b/iu,
  'public-hearing': /\bpublic[\s-]+hearings?\b/iu,
};

function civicEventTypes(text: string): Set<CivicEventType> {
  return new Set(
    (Object.entries(CIVIC_EVENT_TYPE_PATTERNS) as [CivicEventType, RegExp][])
      .filter(([, pattern]) => pattern.test(text))
      .map(([type]) => type)
  );
}

// Agenda language such as "Resolution Approving ..." describes a listed or
// proposed action.  Only finite outcome language is evidence that an action
// actually happened, so a model cannot silently turn an agenda into minutes.
const OUTCOME_PATTERNS: readonly RegExp[] = [
  /\bapproved\b/iu,
  /\bauthorized\b/iu,
  /\bpassed\b/iu,
  /\badopted\b/iu,
  /\bdenied\b/iu,
  /\btabled\b/iu,
  /\bcarried\b/iu,
  /\brejected\b/iu,
  /\bvoted\b/iu,
  /\bapproved\s+and\s+adopted\b/iu,
];

// These verbs describe a completed civic action even when they are not a
// formal disposition. On a derived agenda row they must be present in that
// row's own evidence (typically a minutes/outcome excerpt), never only in the
// parent document context.
const COMPLETED_ACTION_PATTERNS: readonly RegExp[] = [
  /\b(?:discussed|reviewed|considered|voted|awarded|adopted|approved|denied|authorized|decided|passed|tabled|carried|rejected|presented|introduced|reported|announced|explained)\b/iu,
];
// A listed person's name/role is not evidence that they submitted, requested,
// presented, led, or otherwise performed an agenda action. These verbs are
// checked against the row excerpt itself (never its restricted parent context)
// so a model cannot turn an attribution parenthesis into an action claim.
const AGENDA_ATTRIBUTION_ACTIONS: readonly [string, RegExp, RegExp][] = [
  ['submitted', /\bsubmit(?:ted|s|ting)?\b/iu, /\bsubmit(?:ted|s|ting)?\b/iu],
  ['requested', /\brequest(?:ed|s|ing)?\b/iu, /\brequest(?:ed|s|ing)?\b/iu],
  ['presented', /\bpresent(?:ed|s|ing)?\b/iu, /\bpresent(?:ed|s|ing)?\b/iu],
  [
    'introduced',
    /\bintroduc(?:ed|es|ing)?\b/iu,
    /\bintroduc(?:ed|es|ing)?\b/iu,
  ],
  ['sponsored', /\bsponsor(?:ed|s|ing)?\b/iu, /\bsponsor(?:ed|s|ing)?\b/iu],
  ['initiated', /\binitiat(?:ed|es|ing)?\b/iu, /\binitiat(?:ed|es|ing)?\b/iu],
  ['led', /\bled\b/iu, /\bled\b/iu],
  ['announced', /\bannounc(?:ed|es|ing)?\b/iu, /\bannounc(?:ed|es|ing)?\b/iu],
  ['explained', /\bexplain(?:ed|s|ing)?\b/iu, /\bexplain(?:ed|s|ing)?\b/iu],
  ['proposed', /\bpropos(?:ed|es|ing)?\b/iu, /\bpropos(?:ed|es|ing)?\b/iu],
  ['filed', /\bfil(?:ed|es|ing)?\b/iu, /\bfil(?:ed|es|ing)?\b/iu],
  [
    'recommended',
    /\brecommend(?:ed|s|ing)?\b/iu,
    /\brecommend(?:ed|s|ing)?\b/iu,
  ],
];
const FUTURE_ACTION =
  /\b(?:(?:will|shall)\s+(?:be\s+)?|(?:to be|scheduled to be|is expected to be)\s+)(?:discuss|discussed|review|reviewed|consider|considered|vote|voted|award|awarded|adopt|adopted|approve|approved|deny|denied|authorize|authorized|decide|decided|pass|passed|table|tabled|carry|carried|reject|rejected)\b/giu;

// Agenda rows may contain a proposal name, but they do not establish why an
// action is being proposed or what governance requirement applies.  These
// markers are intentionally semantic rather than source-specific: a marker
// in public prose must also occur in the cited row evidence.
const AGENDA_PURPOSE_PATTERNS: readonly RegExp[] = [
  /\b(?:seek(?:s|ing)?|aim(?:s|ed)?|intend(?:s|ed)?|designed|purpose|goal)\b/iu,
  /\bto\s+(?:ensure|improve|support|promote|reduce|increase|provide|allow|help)\b/iu,
];
const AGENDA_REQUIREMENT_PATTERN =
  /\b(?:must|shall|required|requires?|requirement|majority|quorum)\b/iu;

function agendaPurposeMarkers(text: string): Set<string> {
  const markers = new Set<string>();
  for (const match of text
    .toLocaleLowerCase()
    .matchAll(
      /\b(seek(?:s|ing)?|aim(?:s|ed)?|intend(?:s|ed)?|design(?:ed|s)?|purpose|goal)\b/giu
    )) {
    markers.add(match[1]!.replace(/(?:ing|ed|s)$/u, ''));
  }
  for (const match of text
    .toLocaleLowerCase()
    .matchAll(
      /\bto\s+(ensure|improve|support|promote|reduce|increase|provide|allow|help)\b/giu
    ))
    markers.add(`to-${match[1]!}`);
  return markers;
}

function agendaRequirementMarkers(text: string): Set<string> {
  return new Set(
    text
      .toLocaleLowerCase()
      .match(
        /\b(?:must|shall|required|requires?|requirement|majority|quorum)\b/giu
      ) ?? []
  );
}

function hasOutcomeEvidence(text: string): boolean {
  return OUTCOME_PATTERNS.some((pattern) => pattern.test(text));
}

function hasCompletedAction(text: string): boolean {
  return COMPLETED_ACTION_PATTERNS.some((pattern) =>
    pattern.test(text.replace(FUTURE_ACTION, ' '))
  );
}

const FUTURE_OCCURRENCE =
  /\b(?:(?:will|shall)\s+be|(?:to be|scheduled to be|is expected to be))\s+(?:held|conducted|convened)\b|\b(?:will|shall)\s+(?:hold|conduct|convene)\b/giu;
const PAST_OCCURRENCE =
  /\b(?:met|conducted|convened|occurred|took\s+place)\b|\b(?:meeting|session)\s+(?:was|were|has|have)\s+held\b|\b(?:meeting|session)\s+held\b|\b(?:council|board|commission|committee|agency|authority)\b[^.!?]{0,40}\b(?:met|held|conducted|convened)\b/iu;

function hasPastOccurrenceEvidence(text: string): boolean {
  return PAST_OCCURRENCE.test(text.replace(FUTURE_OCCURRENCE, ''));
}

/** "The proposed millage rate", "a requested variance": a participle used as an
 * adjective after a determiner names the item; nobody is said to have acted. */
const ADJECTIVAL_PARTICIPLE =
  /\b(?:the|a|an|its|this|that|these|those)\s+(?:proposed|requested|recommended|submitted|presented|filed|announced|introduced|sponsored)\b/giu;

function unsupportedAgendaAttributions(
  text: string,
  sourceText: string
): string[] {
  const claim = text.replace(ADJECTIVAL_PARTICIPLE, ' ');
  return AGENDA_ATTRIBUTION_ACTIONS.filter(
    ([, claimPattern, sourcePattern]) =>
      claimPattern.test(claim) && !sourcePattern.test(sourceText)
  ).map(([label]) => label);
}

/** Reject action/attribution verbs that are not explicitly present in the
 * cited agenda row. Parent-document context is intentionally excluded by the
 * caller because its role is limited to institution/event/logistics support. */
export function validateAgendaActionAttribution(
  text: string,
  sourceText: string,
  label = 'agenda'
): void {
  const unsupported = unsupportedAgendaAttributions(text, sourceText);
  if (unsupported.length)
    throw new LlmValidationError(
      `claim-grounding/unsupported-agenda-action: ${label} asserts unsupported action/attribution verb(s): ${unsupported.join(
        ', '
      )}`
    );
}

const HISTORICAL_PRESENT_FUTURE_MODALITY =
  /\b(?:will|shall)\s+(?:discuss|review|consider|vote|award|approve|deny|authorize|decide|pass|table|reject|hold|report|hear|be\s+(?:held|conducted|convened))\b|\b(?:is|are)\s+scheduled\b|\b(?:council|board|commission|committee|agency|authority|meeting|session)\b[^.!?]{0,40}\b(?:meets?|holds?|discusses?|reviews?|considers?)\b/iu;

const PAST_FRAMING =
  /\b(?:was|were)\s+(?:scheduled|set|slated|due|expected|listed)\s+to\s+\p{L}+/giu;

/** Historical agenda rows are descriptive records, not current/future
 * invitations. At/after-as-of future rows retain their prospective wording. */
export function validateAgendaTemporalModality(
  text: string,
  sources: readonly Pick<LlmEvidence, 'title' | 'body' | 'date'>[],
  asOf: string | undefined,
  label = 'agenda'
): void {
  if (!asOf || !/^\d{4}-\d{2}-\d{2}$/u.test(asOf)) return;
  const historicalAgenda = sources.some((source) => {
    const eventDate =
      typeof source.date === 'string' ? source.date.slice(0, 10) : '';
    const sourceText = `${source.title ?? ''} ${source.body ?? ''}`;
    return (
      /^\d{4}-\d{2}-\d{2}$/u.test(eventDate) &&
      eventDate < asOf &&
      /\b(?:agenda|listed|scheduled|proposed)\b/iu.test(sourceText) &&
      // Minutes are a record of what happened; an agenda's "Approval of
      // Minutes" line is not, so only the document's own title counts.
      !/\bminutes?\b/iu.test(source.title ?? '') &&
      !hasPastOccurrenceEvidence(sourceText) &&
      !hasOutcomeEvidence(sourceText)
    );
  });
  if (!historicalAgenda) return;
  // "was scheduled to consider" is the past framing this rule asks for; its
  // bare verb is not a present-tense claim.
  const unframed = text.replace(PAST_FRAMING, ' ');
  if (
    HISTORICAL_PRESENT_FUTURE_MODALITY.test(unframed) ||
    hasPastOccurrenceEvidence(text) ||
    hasOutcomeEvidence(text)
  ) {
    throw new LlmValidationError(
      `claim-grounding/unsupported-agenda-temporal-modality: ${label} uses present/future or occurrence/outcome wording for a historical agenda row; use agenda listed/was scheduled/no outcome record available wording`
    );
  }
}

export function validateAgendaSemantics(
  text: string,
  sourceText: string,
  label = 'agenda',
  parentContextText = ''
): void {
  validateEventTypes(text, sourceText, label, parentContextText);
  if (hasOutcomeEvidence(text) && !hasOutcomeEvidence(sourceText)) {
    throw new LlmValidationError(
      `claim-grounding/unsupported-outcome: ${label} asserts an agenda outcome absent from cited evidence`
    );
  }
  const hasRestrictedParentContext = Boolean(parentContextText.trim());
  const explicitAgendaListing =
    /\b(?:agenda\s+(?:lists?|includes?)|listed|scheduled|proposed)\b/iu.test(
      `${sourceText} ${parentContextText}`
    );
  if (
    (hasRestrictedParentContext || explicitAgendaListing) &&
    hasCompletedAction(text) &&
    !hasCompletedAction(sourceText)
  ) {
    throw new LlmValidationError(
      `claim-grounding/unsupported-agenda-action: ${label} asserts a completed action absent from the row evidence`
    );
  }
  if (hasRestrictedParentContext || explicitAgendaListing)
    validateAgendaActionAttribution(text, sourceText, label);
  const agendaOnly =
    /\bagenda\b|\blisted\b|\bscheduled\b|\bproposed\b/iu.test(
      `${sourceText} ${parentContextText}`
    ) && !hasPastOccurrenceEvidence(sourceText);
  if (agendaOnly) {
    const claimPurposeMarkers = agendaPurposeMarkers(text);
    const sourcePurposeMarkers = agendaPurposeMarkers(sourceText);
    if (
      AGENDA_PURPOSE_PATTERNS.some((pattern) => pattern.test(text)) &&
      [...claimPurposeMarkers].some(
        (marker) => !sourcePurposeMarkers.has(marker)
      )
    ) {
      throw new LlmValidationError(
        `claim-grounding/unsupported-agenda-purpose: ${label} asserts an unsupported purpose or intent absent from the row evidence`
      );
    }
    const claimRequirementMarkers = agendaRequirementMarkers(text);
    const sourceRequirementMarkers = agendaRequirementMarkers(sourceText);
    if (
      AGENDA_REQUIREMENT_PATTERN.test(text) &&
      [...claimRequirementMarkers].some(
        (marker) => !sourceRequirementMarkers.has(marker)
      )
    ) {
      throw new LlmValidationError(
        `claim-grounding/unsupported-agenda-requirement: ${label} asserts an unsupported requirement or governance condition absent from the row evidence`
      );
    }
  }
  // An agenda/listing establishes what was scheduled or proposed, not that
  // the meeting occurred. Minutes or explicit occurrence language in the
  // cited source are required before a claim may say "met" or "held".
  if (agendaOnly && hasPastOccurrenceEvidence(text)) {
    throw new LlmValidationError(
      `claim-grounding/unsupported-meeting-occurrence: ${label} asserts that an agenda-only meeting occurred`
    );
  }
}

const NAME_CONNECTORS = new Set([
  'and',
  'de',
  'del',
  'der',
  'la',
  'of',
  'the',
  'van',
  'von',
]);
const NAME_LEADING_DETERMINERS = new Set(['a', 'an', 'the']);

interface TitleCaseToken {
  end: number;
  normalized: string;
  raw: string;
  start: number;
}

function titleCaseTokens(text: string): TitleCaseToken[] {
  // Include dotted initials (J.T.) and all-caps words so an explicit entity
  // context remains strict across title and all-caps source styles.
  const pattern =
    /\b(?:(?:[A-Z]\.\s*)+[A-Z]\.?|[A-Z][a-z]+(?:['’][A-Za-z]+)?(?:[-][A-Za-z]+)*|[A-Z]{2,})\b/gu;
  return [...text.matchAll(pattern)].map((match) => ({
    raw: match[0],
    normalized: normalizedEntityToken(match[0]),
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
}

function addNameTokens(
  names: Set<string>,
  tokens: readonly TitleCaseToken[]
): void {
  for (const token of tokens) {
    if (token.normalized) names.add(token.normalized);
  }
}

function wordsBetween(
  text: string,
  left: TitleCaseToken,
  right: TitleCaseToken
): string[] {
  return (
    text
      .slice(left.end, right.start)
      .toLocaleLowerCase()
      .match(/[a-z]+/giu) ?? []
  );
}

function modifierHasEntityTypeAfter(text: string, start: number): boolean {
  const next = /^\s+([a-z]+)/iu.exec(text.slice(start));
  return Boolean(next && ENTITY_TYPE_WORDS.has(next[1]!.toLocaleLowerCase()));
}

function hasAdjacentEntityWord(
  text: string,
  start: number,
  end: number
): boolean {
  const before = /([a-z]+)\s*$/iu
    .exec(text.slice(0, start))?.[1]
    ?.toLocaleLowerCase();
  const after = /^\s*([a-z]+)/iu
    .exec(text.slice(end))?.[1]
    ?.toLocaleLowerCase();
  return (
    STATE_QUALIFIER_ENTITY_WORDS.has(before ?? '') ||
    STATE_QUALIFIER_ENTITY_WORDS.has(after ?? '')
  );
}

/** A comma immediately before a state name is an unambiguous locality
 * qualifier (for example, "Nashville, Tennessee"), even when the claim does
 * not repeat a civic-role word such as city or council. */
function hasGeographicStateQualifier(
  text: string,
  start: number,
  end: number
): boolean {
  return (
    hasAdjacentEntityWord(text, start, end) ||
    /,\s*$/u.test(text.slice(0, start))
  );
}

function hasAdjacentStateQualifierEntity(
  text: string,
  start: number,
  end: number,
  supportedStates: ReadonlySet<string>
): boolean {
  const state = text.slice(start, end).toLocaleLowerCase();
  return supportedStates.has(state) && hasAdjacentEntityWord(text, start, end);
}

function supportedStateAbbreviations(
  sources: readonly LlmEvidence[]
): Set<string> {
  const states = new Set<string>();
  for (const source of sources) {
    for (const metadata of [source.localitySlug, source.scopeSlug]) {
      if (typeof metadata !== 'string') continue;
      for (const token of metadata.toLocaleLowerCase().split(/[^a-z]+/u)) {
        if (US_STATE_ABBREVIATIONS.has(token)) states.add(token);
      }
    }
    if (typeof source.sourceName === 'string') {
      for (const [name, abbreviation] of Object.entries(US_STATE_NAMES)) {
        if (
          new RegExp(`\\b${name.replace(/\s+/gu, '\\s+')}\\b`, 'iu').test(
            source.sourceName
          )
        )
          states.add(abbreviation);
      }
    }
  }
  return states;
}

function unsupportedStateQualifierTokens(
  text: string,
  supportedStates: ReadonlySet<string>
): Set<string> {
  const unsupported = new Set<string>();
  for (const match of text.matchAll(/\b[A-Z]{2}\b/gu)) {
    const state = match[0]!.toLocaleLowerCase();
    if (
      US_STATE_ABBREVIATIONS.has(state) &&
      !supportedStates.has(state) &&
      hasGeographicStateQualifier(
        text,
        match.index ?? 0,
        (match.index ?? 0) + match[0]!.length
      )
    ) {
      unsupported.add(state);
    }
  }
  for (const [name, abbreviation] of Object.entries(US_STATE_NAMES)) {
    if (supportedStates.has(abbreviation)) continue;
    const pattern = new RegExp(`\\b${name.replace(/\s+/gu, '\\s+')}\\b`, 'giu');
    for (const match of text.matchAll(pattern)) {
      const start = match.index ?? 0;
      const end = start + match[0]!.length;
      if (hasGeographicStateQualifier(text, start, end))
        unsupported.add(abbreviation);
    }
  }
  return unsupported;
}

function collectContextualNameTokens(
  text: string,
  supportedStates: ReadonlySet<string> = new Set()
): Set<string> {
  const names = new Set<string>();
  const tokens = titleCaseTokens(text);
  const lowerWords = [...text.toLocaleLowerCase().matchAll(/[a-z]+/giu)].map(
    (match) => ({ word: match[0], index: match.index ?? 0 })
  );

  // A title/name immediately before a stable entity type is reliable enough
  // for this guard: "Atlantis City Council" or "Main Street". Generic type
  // words themselves are not returned as names ("School Board" stays benign).
  for (const [index, token] of tokens.entries()) {
    const nextWord = lowerWords.find((word) => word.index >= token.end);
    if (!nextWord || !ENTITY_TYPE_WORDS.has(nextWord.word)) continue;
    const group = [token];
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      const between = wordsBetween(text, tokens[previous]!, group[0]!);
      // A suffix binds only adjacent title words. Do not bridge "and" in a
      // title such as "Upcoming Municipal and School Board Meetings".
      if (
        between.length ||
        NAME_LEADING_DETERMINERS.has(tokens[previous]!.normalized)
      )
        break;
      group.unshift(tokens[previous]!);
    }
    // A sentence-initial function word can be title-cased and appear in the
    // same group after punctuation or a numeric date (for example, "On
    // September 12, Tift County"). Keep grammatical stop words out of the
    // contextual-name signal even when that grouping is otherwise useful.
    addNameTokens(
      names,
      group.filter(
        (candidate) =>
          !ENTITY_TYPE_WORDS.has(candidate.normalized) &&
          !ENTITY_MODIFIER_WORDS.has(candidate.normalized) &&
          !GROUNDING_STOP_WORDS.has(candidate.normalized) &&
          !NAME_LEADING_DETERMINERS.has(candidate.normalized) &&
          !hasAdjacentStateQualifierEntity(
            text,
            candidate.start,
            candidate.end,
            supportedStates
          )
      )
    );
  }

  // "City of Adel", "University of North Georgia", and similar forms have
  // an explicit type + of cue. Restrict the run to at most two title tokens
  // so a title-cased headline cannot turn its entire tail into an entity.
  for (const type of tokens) {
    if (!ENTITY_TYPE_WORDS.has(type.normalized)) continue;
    const afterType = text.slice(type.end);
    const ofMatch = /^\s+of\s+/iu.exec(afterType);
    if (!ofMatch) continue;
    const following = tokens
      .filter((token) => token.start >= type.end + ofMatch[0].length)
      .slice(0, 2);
    if (!following.length) continue;
    const contiguous = [following[0]!];
    for (let index = 1; index < following.length; index += 1) {
      const between = wordsBetween(
        text,
        following[index - 1]!,
        following[index]!
      );
      if (between.some((word) => !NAME_CONNECTORS.has(word))) break;
      contiguous.push(following[index]!);
    }
    addNameTokens(
      names,
      contiguous.filter(
        (candidate) =>
          !ENTITY_TYPE_WORDS.has(candidate.normalized) &&
          !ENTITY_MODIFIER_WORDS.has(candidate.normalized) &&
          !GROUNDING_STOP_WORDS.has(candidate.normalized) &&
          !hasAdjacentStateQualifierEntity(
            text,
            candidate.start,
            candidate.end,
            supportedStates
          )
      )
    );
  }

  // Verbs and phrases that explicitly introduce a person/place/org make a
  // following title-case run meaningful without treating every title phrase
  // as a proper name. This covers civic forms such as "honored Shae Tucker"
  // and "designating La Fiesta Del Pueblo".
  for (const cue of lowerWords.filter(({ word }) =>
    ENTITY_CUE_WORDS.has(word)
  )) {
    const following = tokens
      .filter((token) => token.start >= cue.index + cue.word.length)
      .slice(0, 5);
    if (!following.length) continue;
    const contiguous = [following[0]!];
    for (let index = 1; index < following.length; index += 1) {
      const between = wordsBetween(
        text,
        following[index - 1]!,
        following[index]!
      );
      if (between.some((word) => !NAME_CONNECTORS.has(word))) break;
      if (ENTITY_TYPE_WORDS.has(following[index - 1]!.normalized)) break;
      contiguous.push(following[index]!);
    }
    addNameTokens(
      names,
      contiguous.filter(
        (candidate) =>
          !ENTITY_TYPE_WORDS.has(candidate.normalized) &&
          !ENTITY_MODIFIER_WORDS.has(candidate.normalized) &&
          !GROUNDING_STOP_WORDS.has(candidate.normalized) &&
          !hasAdjacentStateQualifierEntity(
            text,
            candidate.start,
            candidate.end,
            supportedStates
          )
      )
    );
  }
  return names;
}

function groundingTokens(text: string): string[] {
  const normalizedText = normalizeGroundingText(text);
  return [
    ...new Set(
      normalizedText
        .toLocaleLowerCase()
        .match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/giu) ?? []
    ),
  ].filter((token) => token.length >= 3 && !GROUNDING_STOP_WORDS.has(token));
}

function normalizedEntityToken(token: string): string {
  // Treat only an uppercase dotted initial run as its compact equivalent so
  // J.T., J. T., and JT bind to the same exact evidence token. This is kept
  // separate from generic punctuation normalization to avoid weakening case,
  // number, date, or ordinary proper-name matching.
  if (/^(?:[A-Z]\.\s*)+[A-Z]\.?$/u.test(token))
    return token.replace(/[.\s]/gu, '').toLocaleLowerCase();
  // Preserve punctuation by default. The only grammatical exception is a
  // possessive suffix, which is explicitly reduced to its lexical name so
  // `Nashville` and `Nashville's` remain equivalent. Do not turn J-T/J/R or
  // other arbitrary punctuation into a supported identifier shape.
  return token
    .toLocaleLowerCase()
    .replace(/[‐‑‒–—−]/gu, '-')
    .replace(/[’']s$/u, '');
}

const CALENDAR_WORDS = new Set([
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

/**
 * Capitalized words after the first of a sentence: proper names, above all
 * people's, which the cue-based pass above does not see unless something
 * introduces them ("David Jones applied" has no cue). Each must occur
 * somewhere in the cited evidence. Dates are checked elsewhere.
 */
function capitalizedWordTokens(text: string): string[] {
  const out: string[] = [];
  const stateNames = new Set(
    Object.keys(US_STATE_NAMES).flatMap((name) => name.split(/\s+/u))
  );
  // Complete meeting logistics ("Council Chambers, 100 Main Street") are
  // checked as units elsewhere.
  // "Optical Character Recognition (OCR)" spells out an acronym, which is
  // itself checked; the spelled-out words are not names.
  const expanded = text.replace(
    /((?:[A-Z][a-z]+\s+){1,5}[A-Z][a-z]+)\s*\(([A-Z]{2,8})\)/gu,
    (whole, words: string, acronym: string) =>
      words
        .split(/\s+/u)
        .map((word) => word[0])
        .join('') === acronym
        ? `(${acronym})`
        : whole
  );
  for (const sentence of normalizeGroundingText(
    groundedLogisticsTokens(expanded).maskedText
  ).split(/(?<=[.!?:;])\s+/u)) {
    const words = [
      ...sentence.matchAll(/[A-Za-z][A-Za-z'’]*(?:-[A-Za-z][A-Za-z'’]*)*/gu),
    ];
    // A title-case line is a headline; its capitals are style, not names.
    const capitals = words.filter((match) => /^[A-Z]/u.test(match[0])).length;
    if (words.length && capitals / words.length > 0.5) continue;
    for (const match of words.slice(1)) {
      if (!/^[A-Z][a-z]/u.test(match[0])) continue;
      for (const token of groundingWordTokens(match[0])) {
        if (
          CALENDAR_WORDS.has(token) ||
          GROUNDING_STOP_WORDS.has(token) ||
          ENTITY_TYPE_WORDS.has(token) ||
          ENTITY_MODIFIER_WORDS.has(token) ||
          ORDINARY_UPPERCASE_HEADING_WORDS.has(token) ||
          GENERIC_CONTEXT_WORDS.has(token) ||
          stateNames.has(token)
        )
          continue;
        out.push(token);
      }
    }
  }
  return out;
}

function groundingWordTokens(text: string): Set<string> {
  const normalizedText = normalizeGroundingText(text);
  const tokens = new Set(
    (
      normalizedText
        .toLocaleLowerCase()
        .match(/[a-z0-9]+(?:['’_\-][a-z0-9]+)*/giu) ?? []
    )
      .map(normalizedEntityToken)
      .filter(Boolean)
  );
  // Slashed names ("GEMA/HS") are one identifier to the name check; give the
  // source side the same whole token.
  for (const match of normalizedText
    .toLocaleLowerCase()
    .matchAll(/[a-z0-9]+(?:\/[a-z0-9]+)+/gu)) {
    const normalized = normalizedEntityToken(match[0]);
    if (normalized) tokens.add(normalized);
  }
  // Word tokenization splits dotted initials at each period. Add the same
  // compact form used by titleCaseTokens so source and claim shapes agree.
  for (const match of normalizedText.matchAll(
    /(?<![A-Za-z])(?:[A-Z]\.\s*)+[A-Z]\.?(?![A-Za-z])/gu
  )) {
    const normalized = normalizedEntityToken(match[0].trim());
    if (normalized) tokens.add(normalized);
  }
  return tokens;
}

/**
 * Personal-name initials have a deliberately tiny equivalence relation:
 * dotted (`J.T.`), spaced-dotted (`J. T.`), and compact (`JT`) forms share a
 * token. Bare spaced initials are only accepted when the evidence itself uses
 * that form; hyphenated and slashed forms are never treated as equivalents.
 */
function groundedInitialNameTokens(
  text: string,
  supportedStates: ReadonlySet<string> = new Set()
): string[] {
  const names: string[] = [];
  const surname = `([A-Z][a-z]+(?:['’][A-Za-z]+)?(?:-[A-Za-z]+)*)`;
  const add = (
    kind: 'equivalent' | 'bare',
    initials: string,
    lastName: string
  ): void => {
    const letters = initials.replace(/[^A-Za-z]/gu, '').toLocaleLowerCase();
    names.push(
      `initial-name:${kind}:${letters}:${lastName
        .replace(/[’']/gu, '')
        .toLocaleLowerCase()}`
    );
  };
  for (const match of text.matchAll(
    new RegExp(`(?<![A-Za-z])((?:[A-Z]\\.\\s*)+[A-Z]\\.?)\\s+${surname}`, 'gu')
  )) {
    if (
      !hasAdjacentStateQualifierEntity(
        text,
        match.index ?? 0,
        (match.index ?? 0) + match[1]!.length,
        supportedStates
      )
    )
      add('equivalent', match[1]!, match[2]!);
  }
  for (const match of text.matchAll(
    new RegExp(`(?<![A-Za-z])([A-Z]{2})\\s+${surname}`, 'gu')
  )) {
    if (
      !hasAdjacentStateQualifierEntity(
        text,
        match.index ?? 0,
        (match.index ?? 0) + match[1]!.length,
        supportedStates
      )
    )
      add('equivalent', match[1]!, match[2]!);
  }
  for (const match of text.matchAll(
    new RegExp(`(?<![A-Za-z])([A-Z])\\s+([A-Z])\\s+${surname}`, 'gu')
  ))
    add('bare', `${match[1]}${match[2]}`, match[3]!);
  return names;
}

function isUnsupportedStateQualifierInitialToken(token: string): boolean {
  const [, kind, state, entity] = token.split(':');
  return (
    kind === 'equivalent' &&
    US_STATE_ABBREVIATIONS.has(state ?? '') &&
    STATE_QUALIFIER_ENTITY_WORDS.has(entity ?? '')
  );
}

function fiscalYearExpressionRanges(
  text: string
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const match of text.matchAll(
    /\b(?:fy|fiscal\s+year)\s*['’]?\s*(?:\d{2}|\d{4})\b/giu
  )) {
    if (match.index !== undefined)
      ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

/** Hyphen/slash initials are tracked only on the claim side and never added
 * to evidence tokens, so punctuation cannot be laundered into equivalence. */
function malformedInitialNameTokens(text: string): string[] {
  const surname = `([A-Z][a-z]+(?:['’][A-Za-z]+)?(?:-[A-Za-z]+)*)`;
  return [
    ...text.matchAll(
      new RegExp(`(?<![A-Za-z])([A-Z])([-/])([A-Z])\\s+${surname}`, 'gu')
    ),
  ].map(
    (match) =>
      `malformed-initial-name:${match[1]!.toLocaleLowerCase()}${
        match[2]
      }${match[3]!.toLocaleLowerCase()}:${match[4]!
        .replace(/[’']/gu, '')
        .toLocaleLowerCase()}`
  );
}

function groundedNamedIdentifiers(
  text: string,
  supportedStates: ReadonlySet<string> = new Set()
): string[] {
  const names = new Set<string>();
  // Complete, source-bound meeting logistics are compound identifiers. Mask
  // them before named-token extraction as well as numeric extraction so their
  // components (for example EAST or PM) cannot be mistaken for standalone
  // names. Partial or otherwise unbound words remain visible and strict.
  const logisticsText = groundedLogisticsTokens(text).maskedText;
  const fiscalYearRanges = fiscalYearExpressionRanges(logisticsText);
  // Acronyms are explicit identifier/entity signals. Numeric and mixed-token
  // IDs are checked separately, but keeping this branch exact preserves the
  // existing acronym binding behavior.
  for (const match of logisticsText.matchAll(
    /\b[A-Z]{2,}(?:[-/][A-Z0-9]+)*\b/g
  )) {
    const normalized = normalizedEntityToken(match[0]);
    // Bounded all-caps words are the reliable acronym shape in this POC (OCR,
    // PDF, FEMA, ADA, SPLOST, CCRPI). Very long all-caps blobs are usually
    // document headings; explicit names in those headings are still checked
    // by the contextual entity-shape pass below.
    const boundedAcronym = match[0].length <= 8;
    const contextualModifier =
      ENTITY_MODIFIER_WORDS.has(normalized) &&
      modifierHasEntityTypeAfter(
        logisticsText,
        (match.index ?? 0) + match[0].length
      );
    const fiscalYearMarker =
      normalized === 'fy' &&
      fiscalYearRanges.some(
        ({ start, end }) =>
          (match.index ?? 0) >= start &&
          (match.index ?? 0) + match[0].length <= end
      );
    if (
      normalized &&
      boundedAcronym &&
      !fiscalYearMarker &&
      !contextualModifier &&
      !hasAdjacentStateQualifierEntity(
        logisticsText,
        match.index ?? 0,
        (match.index ?? 0) + match[0].length,
        supportedStates
      ) &&
      !ENTITY_TYPE_WORDS.has(normalized) &&
      !ORDINARY_UPPERCASE_HEADING_WORDS.has(normalized) &&
      !GROUNDING_STOP_WORDS.has(normalized) &&
      !/^\d/u.test(normalized)
    )
      names.add(normalized);
  }
  // Dotted acronyms/initials are split by ordinary word tokenization, so
  // inspect the complete uppercase run and bind only its compact equivalent.
  for (const match of logisticsText.matchAll(
    /(?<![A-Za-z])(?:[A-Z]\.\s*)+[A-Z]\.?(?![A-Za-z])/gu
  )) {
    const normalized = normalizedEntityToken(match[0]);
    const boundedAcronym = normalized.length <= 8;
    const contextualModifier =
      ENTITY_MODIFIER_WORDS.has(normalized) &&
      modifierHasEntityTypeAfter(
        logisticsText,
        (match.index ?? 0) + match[0].length
      );
    if (
      normalized &&
      boundedAcronym &&
      !contextualModifier &&
      !hasAdjacentStateQualifierEntity(
        logisticsText,
        match.index ?? 0,
        (match.index ?? 0) + match[0].length,
        supportedStates
      ) &&
      !ENTITY_TYPE_WORDS.has(normalized) &&
      !ORDINARY_UPPERCASE_HEADING_WORDS.has(normalized) &&
      !GROUNDING_STOP_WORDS.has(normalized) &&
      !/^\d/u.test(normalized)
    )
      names.add(normalized);
  }
  for (const name of collectContextualNameTokens(
    logisticsText,
    supportedStates
  ))
    names.add(name);
  for (const name of groundedInitialNameTokens(logisticsText, supportedStates))
    names.add(name);
  for (const name of malformedInitialNameTokens(logisticsText)) names.add(name);
  return [...names].filter(Boolean);
}

// Measurements need their numeric value and unit bound together. Otherwise
// `42.49-acre` is seen as the identifier `42.49-acre` plus the standalone
// number `42`, while `42.49 acres` is seen as only `42.49`; that both rejects
// legitimate morphology and can accidentally make a different measurement
// look supported. Keep this vocabulary deliberately explicit so ordinary
// hyphenated prose is never treated as a measurement.
const NUMERIC_UNIT_ALIASES: Readonly<Record<string, string>> = {
  acre: 'acre',
  acres: 'acre',
  foot: 'foot',
  feet: 'foot',
  ft: 'foot',
  'square-foot': 'square-foot',
  'square-feet': 'square-foot',
  'sq-ft': 'square-foot',
  mile: 'mile',
  miles: 'mile',
  mi: 'mile',
  yard: 'yard',
  yards: 'yard',
  meter: 'meter',
  meters: 'meter',
  metre: 'meter',
  metres: 'meter',
  'square-meter': 'square-meter',
  'square-meters': 'square-meter',
  'square-metre': 'square-meter',
  'square-metres': 'square-meter',
  kilometer: 'kilometer',
  kilometers: 'kilometer',
  kilometre: 'kilometer',
  kilometres: 'kilometer',
  km: 'kilometer',
  inch: 'inch',
  inches: 'inch',
  pound: 'pound',
  pounds: 'pound',
  lb: 'pound',
  lbs: 'pound',
  ounce: 'ounce',
  ounces: 'ounce',
  oz: 'ounce',
  ton: 'ton',
  tons: 'ton',
  gallon: 'gallon',
  gallons: 'gallon',
  gal: 'gallon',
  liter: 'liter',
  liters: 'liter',
  litre: 'liter',
  litres: 'liter',
  percent: 'percent',
  percentage: 'percent',
};

/**
 * Meeting headers are kept in the parent document envelope while extracted
 * agenda rows carry only their row text.  Permit the two logistical values
 * that can legitimately live in that header, but bind the complete expression
 * rather than adding its component numbers to the general numeric set.  That
 * keeps an unrelated `999` (or a number copied from another parent field) from
 * becoming grounded merely because a header contains a different address.
 */
const STREET_ALIASES: Readonly<Record<string, string>> = {
  st: 'street',
  street: 'street',
  ave: 'avenue',
  avenue: 'avenue',
  blvd: 'boulevard',
  boulevard: 'boulevard',
  rd: 'road',
  road: 'road',
  dr: 'drive',
  drive: 'drive',
  ln: 'lane',
  lane: 'lane',
  ct: 'court',
  court: 'court',
  cir: 'circle',
  circle: 'circle',
  pkwy: 'parkway',
  parkway: 'parkway',
  hwy: 'highway',
  highway: 'highway',
};

function groundedLogisticsTokens(text: string): {
  tokens: string[];
  maskedText: string;
} {
  const found = new Set<string>();
  const ranges: Array<{ start: number; end: number }> = [];
  const normalizedText = normalizeGroundingText(text);
  for (const match of normalizedText.matchAll(
    /\b(0?[1-9]|1[0-2])\s*:\s*([0-5]\d)\s*(a\.?\s*m\.?|p\.?\s*m\.?)\b/giu
  )) {
    if (match.index === undefined) continue;
    found.add(
      `meeting-time:${Number(match[1])}:${match[2]}:${match[3]!
        .replace(/\s|\./gu, '')
        .toLocaleLowerCase()}`
    );
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  // This deliberately requires a street suffix and accepts only the common
  // directional street-address shape used by the meeting PDFs.  In
  // particular, arbitrary number pairs such as parcel/map identifiers cannot
  // be interpreted as an address.
  for (const match of normalizedText.matchAll(
    /\b(\d{1,6})\s+(?:(north|south|east|west|n|s|e|w)\.?\s+)?(\d{1,5})\s*(st|nd|rd|th)?\s+(street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|court|ct|circle|cir|parkway|pkwy|highway|hwy)\.?\b/giu
  )) {
    if (match.index === undefined) continue;
    const direction = match[2]
      ? match[2].slice(0, 1).toLocaleLowerCase()
      : 'none';
    const suffix = STREET_ALIASES[match[5]!.toLocaleLowerCase()];
    if (!suffix) continue;
    found.add(
      `meeting-address:${match[1]}:${direction}:${Number(match[3])}:${suffix}`
    );
    ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  const masked = normalizedText.split('');
  for (const range of ranges)
    for (let index = range.start; index < range.end; index += 1)
      masked[index] = ' ';
  return { tokens: [...found], maskedText: masked.join('') };
}

function numericUnitTokens(text: string): {
  tokens: string[];
  maskedText: string;
} {
  const found = new Set<string>();
  const normalizedText = normalizeGroundingText(text);
  const masked = normalizedText.split('');
  // Require either whitespace or a hyphen between the decimal and unit. This
  // avoids turning identifiers such as `PP26` into measurements.
  const pattern =
    /(?<![A-Za-z0-9./-])(\d[\d,]*(?:\.\d+)?)(?:\s*-\s*|\s+)([A-Za-z]+(?:-[A-Za-z]+)*)(?![A-Za-z0-9_-])/gu;
  for (const match of normalizedText.matchAll(pattern)) {
    const rawUnit = match[2]!.toLocaleLowerCase();
    const unit = NUMERIC_UNIT_ALIASES[rawUnit];
    if (!unit || match.index === undefined) continue;
    const number = match[1]!.replace(/,/g, '');
    found.add(`number-unit:${number}:${unit}`);
    for (
      let index = match.index;
      index < match.index + match[0].length;
      index += 1
    )
      masked[index] = ' ';
  }
  return { tokens: [...found], maskedText: masked.join('') };
}

/**
 * Fiscal-year labels are commonly formatted as `FY 27`, `FY27`, or
 * `fiscal year 2027`. Treat those forms as one exact fiscal-year identifier;
 * the `FY` marker is required, so an ordinary calendar year is not widened.
 */
function fiscalYearTokens(text: string): {
  tokens: string[];
  maskedText: string;
} {
  const found = new Set<string>();
  const masked = text.split('');
  for (const match of text.matchAll(
    /\b(?:fy|fiscal\s+year)\s*['’]?\s*(\d{2}|\d{4})\b/giu
  )) {
    if (match.index === undefined) continue;
    const rawYear = match[1]!;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    found.add(`fy${year}`);
    for (
      let index = match.index;
      index < match.index + match[0].length;
      index += 1
    )
      masked[index] = ' ';
  }
  return { tokens: [...found], maskedText: masked.join('') };
}

function groundedNumericTokens(text: string): string[] {
  const found = new Set<string>();
  const normalizedText = normalizeGroundingText(text);
  const numericUnits = numericUnitTokens(normalizedText);
  for (const token of numericUnits.tokens) found.add(token);
  // Mask recognized measurements before the older identifier/number passes,
  // so their decimal and integer fragments cannot be extracted separately.
  const logistics = groundedLogisticsTokens(numericUnits.maskedText);
  for (const token of logistics.tokens) found.add(token);
  // Mask recognized meeting logistics before the general number pass. Their
  // values remain bound as one expression instead of becoming reusable bare
  // numbers.
  const fiscalYears = fiscalYearTokens(logistics.maskedText);
  for (const token of fiscalYears.tokens) found.add(token);
  const numericText = fiscalYears.maskedText;
  // Mixed alpha-numeric tokens are common civic identifiers (FY27, RFP2026,
  // parcelA12). Keep the complete token exact; matching only its digits would
  // let a claim silently substitute a different identifier.
  for (const match of numericText.matchAll(
    /(?<![A-Za-z0-9])[A-Za-z]+[A-Za-z0-9]*\d[A-Za-z0-9]*(?![A-Za-z0-9])/gu
  )) {
    found.add(normalizedEntityToken(match[0]));
  }
  // Keep compound identifiers as one exact token. This prevents AB-123 from
  // matching AB-1234 and P-007 from matching P-008.
  for (const match of numericText.matchAll(
    /(?<![A-Za-z0-9])[A-Za-z0-9]+(?:[-/._][A-Za-z0-9]+)+(?![A-Za-z0-9])/gu
  )) {
    const raw = match[0];
    // Ordinary hyphenated prose ("image-only", "well-known") is not an
    // identifier. Compound tokens remain strict when they carry digits,
    // which is the reliable case/permit/parcel signal in civic records.
    if (!/\d/u.test(raw)) continue;
    const date = groundedDateSignatures(raw);
    if (date.length) {
      // Date equivalence is handled separately; retain components so a claim
      // that uses a month-name date can match an ISO evidence date.
      for (const component of raw.match(/\d+/gu) ?? [])
        found.add(String(Number(component)));
    } else {
      found.add(normalizedEntityToken(raw));
    }
  }
  // Standalone numbers normalize comma grouping and percent signs, but retain
  // leading zeroes because those are meaningful in parcel/permit identifiers.
  // A comma ends a number unless a digit follows it ("1,234"); otherwise
  // "11.777, down from" backtracks to a bare 11.
  for (const match of numericText.matchAll(
    /(?<![A-Za-z0-9./-])\d[\d,]*(?:\.\d+)?%?(?![A-Za-z0-9/-]|,\d)/gu
  )) {
    found.add(match[0].replace(/,/g, '').replace(/%$/u, ''));
  }
  // Month-name dates do not have a numeric lexeme for the month, but the
  // equivalent numeric date may. Include date components in the evidence set
  // so Sept 12 and 09/12 are treated as the same grounded date.
  for (const signature of groundedDateSignatures(normalizedText)) {
    const match = signature.match(/^(?:y(\d+)-)?m(\d+)-d(\d+)$/u);
    if (match) {
      if (match[1]) found.add(match[1]);
      found.add(match[2]!);
      found.add(match[3]!);
    }
  }
  return [...found].filter(Boolean);
}

function groundedDateSignatures(text: string): string[] {
  const signatures = new Set<string>();
  const normalizedText = normalizeGroundingText(text);
  // Only real month/day pairs are dates; "9-0" or "0-9" is a score.
  const valid = (month: number, day: number) =>
    month >= 1 && month <= 12 && day >= 1 && day <= 31;
  for (const match of normalizedText.matchAll(
    /\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/gu
  ))
    if (valid(Number(match[2]), Number(match[3])))
      signatures.add(`y${match[1]}-m${Number(match[2])}-d${Number(match[3])}`);
  // Also accept the common month/day/year spelling used by civic records.
  for (const match of normalizedText.matchAll(
    /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/gu
  ))
    if (valid(Number(match[1]), Number(match[2])))
      signatures.add(`y${match[3]}-m${Number(match[1])}-d${Number(match[2])}`);
  for (const match of normalizedText.matchAll(/\b(\d{1,2})[/-](\d{1,2})\b/gu))
    if (valid(Number(match[1]), Number(match[2])))
      signatures.add(`m${Number(match[1])}-d${Number(match[2])}`);
  const monthNumbers: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
  };
  // Civic prose writes ordinals ("April 20th"), which must count as dates.
  for (const match of normalizedText.matchAll(
    /\b(January|February|March|April|May|June|July|August|September|Sept|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/giu
  )) {
    const month = monthNumbers[match[1]!.toLowerCase()];
    if (month)
      signatures.add(
        `${match[3] ? `y${match[3]}-` : ''}m${month}-d${Number(match[2])}`
      );
  }
  return [...signatures];
}

function evidenceForCitations(
  citations: readonly LlmCitation[],
  evidence: readonly LlmEvidence[]
): LlmEvidence[] {
  const byIdentity = validatedEvidenceGroups(evidence);
  return citations.flatMap(
    (citation) =>
      byIdentity.get(
        `${citation.sourceKey}\u0000${citation.civicItemId}\u0000${
          citation.agendaItemId ?? ''
        }`
      ) ?? []
  );
}

/**
 * Citation identities are transport metadata, not resident-facing prose. Keep
 * this matcher tolerant of labels copied with ordinary formatting changes
 * (camelCase, spaces, underscores, hyphens, case, and common delimiters), but
 * require an assignment-shaped value so normal sentences such as “the source
 * key identifies the article” remain valid.
 */
const PUBLIC_PROSE_IDENTITY_MARKER = new RegExp(
  String.raw`(?:\bsource[\s_.-]*key\b)["'\x60]?\s*(?:=|:|[-–—#]|\(\s*)\s*(?:["'\x60][^"'\x60\r\n]{1,256}["'\x60]|[A-Za-z0-9][A-Za-z0-9._/-]*)(?:\s*\))?|(?:\bsource[\s_.-]*key\b)["'\x60]?\s+(?=[A-Za-z0-9._/-]*[-_./\d])(?:["'\x60][^"'\x60\r\n]{1,256}["'\x60]|[A-Za-z0-9][A-Za-z0-9._/-]*)|(?:\bcivic[\s_.-]*item[\s_.-]*id\b)["'\x60]?\s*(?:=|:|[-–—#]|\(\s*|\s+)\s*(?:["'\x60]?\s*\d+\s*["'\x60]?)`,
  'iu'
);

/**
 * Source metadata is citation-bound context, not a second citation channel.
 * Slugs are kept in their original form and also split on slug separators so
 * a locality such as `nashville-ga` can ground a prose locality name without
 * making numeric/date checks trust an internal identifier.
 */
function sourceMetadataText(source: LlmEvidence): string {
  return [
    source.sourceName,
    source.publisher,
    source.localitySlug,
    source.scopeSlug,
    source.scopeKind,
  ]
    .filter(
      (value): value is string =>
        typeof value === 'string' && Boolean(value.trim())
    )
    .join(' ');
}

function sourceMetadataWordTokens(source: LlmEvidence): Set<string> {
  const metadata = sourceMetadataText(source);
  const split = metadata.replace(/[\/_-]+/gu, ' ');
  return new Set(groundingWordTokens(`${metadata} ${split}`));
}

/**
 * Conservative gross-mismatch guard. It verifies that a claim shares at least
 * one substantive token with its cited evidence and that numeric/date/proper
 * identifier tokens are present in that evidence. It deliberately does not
 * claim semantic entailment.
 */
export function validateClaimGrounding(
  text: string,
  citations: readonly LlmCitation[],
  evidence: readonly LlmEvidence[],
  label = 'claim',
  options: { asOf?: string } = {}
): void {
  // Citation identities are transport metadata, never resident-facing prose.
  // Reject the explicit marker form even when its number happens to occur in
  // the cited source body; numeric grounding alone must not launder a leaked
  // internal ID into publication.
  if (PUBLIC_PROSE_IDENTITY_MARKER.test(text)) {
    throw new LlmValidationError(
      `claim-grounding/internal-citation-marker: ${label} contains citation identity metadata in public prose`
    );
  }
  const sources = evidenceForCitations(citations, evidence);
  const supportedStates = supportedStateAbbreviations(sources);
  if (!sources.length)
    throw new LlmValidationError(
      `claim-grounding/unbound-claim: ${label} has no cited stored evidence`
    );
  // Section/heading labels are navigation metadata generated by the agenda
  // parser, not source evidence. Never let a synthetic "Council Meetings"
  // heading support an institutional-role claim.
  const sourceText = sources
    .map((source) =>
      [source.title, source.date, source.body].filter(Boolean).join(' ')
    )
    .join(' ');
  const parentContextText = sources
    .map((source) =>
      [source.parentDocumentContext?.title, source.parentDocumentContext?.body]
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean)
    .join(' ');
  const claimTokens = groundingTokens(text);
  const sourceTokens = new Set(groundingTokens(sourceText));
  if (
    !claimTokens.some((token) => sourceTokens.has(token)) &&
    !claimTokens.every((token) => GENERIC_CONTEXT_WORDS.has(token))
  ) {
    throw new LlmValidationError(
      `claim-grounding/insufficient-evidence-overlap: ${label} has no substantive token overlap with cited evidence`
    );
  }
  const sourceNumeric = new Set(groundedNumericTokens(sourceText));
  // A derived agenda row does not repeat its meeting header. Only the
  // narrowly recognized time/address expressions from its authoritative
  // parent context may supplement numeric grounding; parent numbers outside
  // those expressions remain non-authoritative for row claims.
  for (const source of sources) {
    for (const token of groundedLogisticsTokens(
      [source.parentDocumentContext?.title, source.parentDocumentContext?.body]
        .filter(Boolean)
        .join(' ')
    ).tokens) {
      sourceNumeric.add(token);
    }
  }
  const missingNumeric = groundedNumericTokens(text).filter(
    (token) => !sourceNumeric.has(token)
  );
  if (missingNumeric.length)
    throw new LlmValidationError(
      `claim-grounding/unsupported-number-or-identifier: ${label} contains unsupported numeric identifier(s): ${missingNumeric.join(
        ', '
      )}`
    );
  const claimDates = groundedDateSignatures(text);
  const sourceDates = new Set(groundedDateSignatures(sourceText));
  for (const date of [...sourceDates])
    if (date.startsWith('y')) sourceDates.add(date.replace(/^y\d{4}-/u, ''));
  const missingDates = claimDates.filter((date) => {
    if (sourceDates.has(date)) return false;
    // A claim that omits the year may be grounded by an ISO/full-date source.
    return !sourceDates.has(date.replace(/^y\d{4}-/u, ''));
  });
  if (missingDates.length)
    throw new LlmValidationError(
      `claim-grounding/unsupported-date: ${label} contains date(s) absent from cited evidence: ${missingDates.join(
        ', '
      )}`
    );
  // A page that never says when it was written cannot place anything in time.
  // Its body may still list dates ("hearings on April 20th and May 11th") from
  // a cycle that has passed, which a briefing must not present as upcoming.
  if (
    claimDates.length &&
    sources.length &&
    sources.every((source) => source.undated === true)
  ) {
    throw new LlmValidationError(
      `claim-grounding/undated-evidence-date: ${label} states date(s) from evidence that carries no publication or event date: ${claimDates.join(
        ', '
      )}`
    );
  }
  const unsupportedStates = unsupportedStateQualifierTokens(
    text,
    supportedStates
  );
  if (unsupportedStates.size)
    throw new LlmValidationError(
      `claim-grounding/unsupported-named-state-qualifier: ${label} contains state qualifier(s) absent from configured locality metadata: ${[
        ...unsupportedStates,
      ]
        .sort()
        .join(', ')}`
    );
  const claimRoles = institutionalRoles(text);
  if (claimRoles.size) {
    const roleEvidenceText = sources
      .map((source) =>
        [
          source.title,
          source.body,
          source.sourceName,
          source.parentDocumentContext?.title,
          source.parentDocumentContext?.body,
        ]
          .filter(Boolean)
          .join(' ')
      )
      .join(' ');
    const supportedRoles = institutionalRoles(roleEvidenceText);
    const unsupportedRoles = [...claimRoles].filter(
      (role) => !supportedRoles.has(role)
    );
    if (unsupportedRoles.length)
      throw new LlmValidationError(
        `claim-grounding/unsupported-named-institutional-role: ${label} contains role(s) absent from item or authoritative source evidence: ${unsupportedRoles.join(
          ', '
        )}`
      );
  }
  // Keep source-side named grounding symmetric with the claim-side pass:
  // components of a recognized time/address are never reusable as standalone
  // names merely because the complete expression appeared in the row body.
  const sourceEntityText = groundedLogisticsTokens(sourceText).maskedText;
  const sourceEntityTokens = new Set(groundingWordTokens(sourceEntityText));
  for (const token of unsupportedStateQualifierTokens(
    sourceText,
    supportedStates
  ))
    sourceEntityTokens.delete(token);
  for (const source of sources) {
    for (const token of sourceMetadataWordTokens(source))
      sourceEntityTokens.add(token);
    for (const token of groundedInitialNameTokens(
      sourceEntityText,
      supportedStates
    )) {
      if (!isUnsupportedStateQualifierInitialToken(token))
        sourceEntityTokens.add(token);
    }
  }
  // An agenda row's context is its agenda's header (who meets, when, where),
  // so a place or body named there may be named in a claim about the row.
  // Its times and addresses are masked first: they bind only as whole units,
  // never as loose fragments such as a bare "PM".
  const headerTokens = new Set(
    sources.flatMap((source) => [
      ...groundingWordTokens(
        groundedLogisticsTokens(
          [
            source.parentDocumentContext?.title,
            source.parentDocumentContext?.body,
          ]
            .filter(Boolean)
            .join(' ')
        ).maskedText
      ),
    ])
  );
  const missingNames = [
    ...new Set([
      ...groundedNamedIdentifiers(text, supportedStates).filter(
        (name) => !sourceEntityTokens.has(name) && !headerTokens.has(name)
      ),
      ...capitalizedWordTokens(text).filter(
        (name) => !sourceEntityTokens.has(name) && !headerTokens.has(name)
      ),
    ]),
  ];
  if (missingNames.length)
    throw new LlmValidationError(
      `claim-grounding/unsupported-named-identifier: ${label} contains named identifier(s) absent from cited evidence: ${missingNames.join(
        ', '
      )}`
    );
  // Parent context may establish event type (workshop/town hall/hearing), but
  // never outcome or occurrence. The latter remain bound to the row body.
  // The agenda-only rules apply only when agenda evidence is cited: a news
  // article that says an event is "scheduled" or that it "took place" is
  // reporting, not an agenda listing.
  const agendaSources = sources.filter(isAgendaEvidence);
  if (agendaSources.length) {
    validateAgendaSemantics(text, sourceText, label, parentContextText);
    validateAgendaTemporalModality(text, agendaSources, options.asOf, label);
  } else {
    validateEventTypes(text, sourceText, label);
  }
}

/** Agenda rows, documents carried with their parent agenda, and records that call themselves an agenda. */
function isAgendaEvidence(source: LlmEvidence): boolean {
  return (
    source.evidenceKind === 'agenda-row' ||
    source.agendaItemId !== undefined ||
    Boolean(source.parentDocumentContext) ||
    /\bagenda\b/iu.test(`${source.title ?? ''} ${source.body ?? ''}`)
  );
}

function validateEventTypes(
  text: string,
  sourceText: string,
  label: string,
  parentContextText = ''
): void {
  const claimEventTypes = civicEventTypes(text);
  if (!claimEventTypes.size) return;
  const evidenceEventTypes = civicEventTypes(
    `${sourceText} ${parentContextText}`
  );
  const unsupported = [...claimEventTypes].filter(
    (type) => !evidenceEventTypes.has(type)
  );
  if (unsupported.length)
    throw new LlmValidationError(
      `claim-grounding/unsupported-event-type: ${label} contains event type(s) absent from cited evidence: ${unsupported.join(
        ', '
      )}`
    );
}

/** Keep the valid entries of a claim list, recording why each invalid entry was dropped. At least one must survive. */
function keepValidEntries<T>(
  entries: readonly unknown[],
  label: string,
  validate: (entry: unknown, index: number) => T,
  drop: boolean
): { kept: T[]; rejected: LlmRejectedClaim[] } {
  const kept: T[] = [];
  const rejected: LlmRejectedClaim[] = [];
  for (const [index, entry] of entries.entries()) {
    try {
      kept.push(validate(entry, index));
    } catch (error) {
      if (!drop || !(error instanceof LlmValidationError)) throw error;
      const record =
        entry && typeof entry === 'object'
          ? (entry as Record<string, unknown>)
          : {};
      const text = typeof record['text'] === 'string' ? record['text'] : '';
      rejected.push({
        index,
        text,
        reason: error.message,
        ...(record['citations'] !== undefined
          ? { citations: record['citations'] }
          : {}),
      });
    }
  }
  // Keep the first rejection's reason (with its grounding code) so a retry targets it.
  if (!kept.length)
    throw new LlmValidationError(
      rejected[0]
        ? `${label} has no valid entries; ${rejected[0].reason}`
        : `${label} requires non-empty entries`
    );
  return { kept, rejected };
}

function validateClaims(
  raw: unknown,
  evidence: readonly LlmEvidence[],
  label: string,
  options: {
    requireNumericIds?: boolean;
    rejectModelMetadata?: boolean;
    asOf?: string;
    dropInvalid?: boolean;
  } = {}
): {
  claims: LlmClaim[];
  citations: LlmCitation[];
  rejected: LlmRejectedClaim[];
} {
  if (!Array.isArray(raw) || raw.length === 0)
    throw new LlmValidationError(`${label} requires non-empty claims`);
  const { kept, rejected } = keepValidEntries(
    raw,
    `${label} claims`,
    (entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry))
        throw new LlmValidationError(
          `${label} claim ${index + 1} is malformed`
        );
      const claim = entry as Record<string, unknown>;
      assertAllowedFields(claim, ['text', 'citations'], `${label} claim`);
      const text = requiredText(claim['text'], `${label} claim text`);
      const citations = validateCitations(
        claim['citations'],
        evidence,
        options
      );
      validateClaimGrounding(
        text,
        citations,
        evidence,
        `${label} claim ${index + 1}`,
        { asOf: options.asOf }
      );
      return { text, citations };
    },
    options.dropInvalid === true
  );
  return {
    claims: kept,
    citations: normalizeCitations(kept.flatMap((claim) => claim.citations)),
    rejected,
  };
}

export interface AnalysisValidationOptions {
  /** Live strict calls enable claim grounding; compatibility callers do not. */
  requireGrounding?: boolean;
  /** Drop individual bullets or claims that fail validation instead of rejecting the whole output. */
  dropInvalidClaims?: boolean;
  /** JSON Schema responses carry IDs as JSON numbers, never decimal strings. */
  requireNumericCitationIds?: boolean;
  /** Strict transport schemas omit model-authored URL/access metadata. */
  rejectModelCitationMetadata?: boolean;
  /** The edition's local date; claims about agendas dated before it must not read as upcoming. */
  asOf?: string;
  /** Stands in for a rejected headline when the lead claim is too long: the plan's lead matter. */
  fallbackHeadline?: string;
  /** Citation sets an editor's plan bound to its facts; a claim that fails with its own may ground on one of these. */
  candidateCitations?: readonly (readonly LlmCitation[])[];
}

export function validateClusterAnalysis(
  raw: unknown,
  evidence: readonly LlmEvidence[],
  options: AnalysisValidationOptions = {}
): LlmClusterAnalysis {
  const value = parseStrictJson(raw);
  assertAllowedFields(
    value,
    ['headline', 'summary', 'whyItMatters', 'citations', 'limitation'],
    'cluster'
  );
  const headline = requiredText(value['headline'], 'headline');
  const summary = requiredText(value['summary'], 'summary');
  const whyItMatters = requiredText(
    value['whyItMatters'] ?? value['why_it_matters'],
    'whyItMatters'
  );
  const citations = validateCitations(value['citations'], evidence, {
    requireNumericIds: options.requireNumericCitationIds,
    rejectModelMetadata: options.rejectModelCitationMetadata,
  });
  if (options.requireGrounding) {
    validateClaimGrounding(headline, citations, evidence, 'cluster headline');
    validateClaimGrounding(summary, citations, evidence, 'cluster summary');
    validateClaimGrounding(
      whyItMatters,
      citations,
      evidence,
      'cluster whyItMatters'
    );
  }
  return {
    headline,
    summary,
    whyItMatters,
    citations,
    ...applySnippetPolicy(citations, value['limitation']),
    provenance: value['provenance'] as LlmClusterAnalysis['provenance'],
  };
}

/**
 * A date a reader can place: a month and day (Aug. 24, August 24), a month
 * and year, a numeric date, or a year on its own. Background has to carry one
 * so earlier events read as earlier, never as today's news.
 */
const PLACEABLE_DATE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:\s+\d{1,2}(?:st|nd|rd|th)?)?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b(?:19|20)\d{2}\b/iu;

/** A membership list or roll call: who sits on a body, not what it does. */
const ROSTER =
  /\b(?:members|commissioners|board|committee|council)\b[^.]{0,40}\b(?:include|includes|included|are|were|consist(?:s|ed)? of)\b[^.]*,[^.]*\band\b|\broll call\b|\b(?:members )?present(?: were)?:/iu;

const REPEAT_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'its',
  'his',
  'her',
  'their',
  'will',
  'was',
  'are',
  'has',
  'have',
  'from',
  'into',
  'about',
  'also',
  'year',
  'years',
]);

function contentWords(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/\p{L}{3,}|\d+/gu) ?? []).filter(
      (word) => !REPEAT_STOP_WORDS.has(word)
    )
  );
}

/** A small model restates a source it has little of; a claim that adds almost
 * nothing to what earlier claims from the same source said is a repeat. */
function repeatsEarlierClaim(
  text: string,
  citations: readonly LlmCitation[],
  earlier: readonly { text: string; citations: readonly LlmCitation[] }[]
): boolean {
  // Rows of one agenda share a document; each row is its own source here, or
  // "X was on the Sept. 14 agenda" would make every later row a repeat.
  const identity = (citation: LlmCitation) =>
    `${citation.civicItemId}:${citation.agendaItemId ?? ''}`;
  const cited = new Set(citations.map(identity));
  const said = new Set(
    earlier
      .filter((claim) =>
        claim.citations.some((citation) => cited.has(identity(citation)))
      )
      .flatMap((claim) => [...contentWords(claim.text)])
  );
  if (!said.size) return false;
  const words = [...contentWords(text)];
  return (
    words.length > 0 &&
    words.filter((word) => !said.has(word)).length / words.length <= 0.3
  );
}

/**
 * The edition as an article: a headline and paragraphs of claims. Every claim
 * is grounded exactly as a brief bullet is. Two rules are the article's own:
 * a claim resting only on background evidence must say when it happened, and
 * the article opens on something new — paragraphs are reordered so one that
 * cites news comes first, and an article that cites no news at all is refused.
 */
function validateArticle(
  value: Record<string, unknown>,
  evidence: readonly LlmEvidence[],
  options: AnalysisValidationOptions
): LlmBriefAnalysis & { relegated?: boolean } {
  assertAllowedFields(value, ['headline', 'paragraphs'], 'article');
  if (!Array.isArray(value['paragraphs']) || value['paragraphs'].length === 0)
    throw new LlmValidationError('article requires paragraphs');
  if (value['paragraphs'].length > 12)
    throw new LlmValidationError('article allows at most twelve paragraphs');
  const background = new Set(
    evidence
      .filter((item) => item.role === 'background')
      .map((item) => item.civicItemId)
  );
  const news = new Set(
    evidence
      .filter((item) => item.role !== 'background')
      .map((item) => item.civicItemId)
  );
  const rejected: NonNullable<LlmBriefAnalysis['rejected']> = [];
  let claimIndex = 0;
  const paragraphs: NonNullable<LlmBriefAnalysis['paragraphs']> = [];
  for (const entry of value['paragraphs']) {
    if (!entry || typeof entry !== 'object')
      throw new LlmValidationError('malformed article paragraph');
    const paragraph = entry as Record<string, unknown>;
    assertAllowedFields(paragraph, ['claims'], 'article paragraph');
    if (!Array.isArray(paragraph['claims']) || paragraph['claims'].length === 0)
      throw new LlmValidationError('article paragraph requires claims');
    // Claims are dropped one by one; a paragraph that loses them all is dropped
    // with them, rather than failing an article whose other paragraphs stand.
    const kept: LlmBriefAnalysis['bullets'] = [];
    for (const claimEntry of paragraph['claims']) {
      claimIndex += 1;
      try {
        if (!claimEntry || typeof claimEntry !== 'object')
          throw new LlmValidationError('malformed article claim');
        const claim = claimEntry as Record<string, unknown>;
        assertAllowedFields(
          claim,
          ['text', 'citations', 'limitation'],
          'article claim'
        );
        const text = requiredText(claim['text'], 'claim text');
        let citations = validateCitations(claim['citations'], evidence, {
          requireNumericIds: options.requireNumericCitationIds,
          rejectModelMetadata: options.rejectModelCitationMetadata,
        });
        if (options.requireGrounding) {
          try {
            validateClaimGrounding(
              text,
              citations,
              evidence,
              `article claim ${claimIndex}`,
              { asOf: options.asOf }
            );
          } catch (error) {
            // A writer working from an editor's plan often cites the wrong
            // block for a right fact. The plan bound each fact to its evidence;
            // a claim that grounds against one of those bindings keeps it.
            // Nothing passes here that would not pass with a correct citation.
            const rebound =
              error instanceof LlmValidationError
                ? options.candidateCitations?.find((candidate) => {
                    try {
                      validateClaimGrounding(
                        text,
                        candidate,
                        evidence,
                        `article claim ${claimIndex}`,
                        { asOf: options.asOf }
                      );
                      return true;
                    } catch {
                      return false;
                    }
                  })
                : undefined;
            if (!rebound) throw error;
            citations = [...rebound];
          }
        }
        if (ROSTER.test(text))
          throw new LlmValidationError(
            `article claim ${claimIndex} lists who sits on a body, which is not news`
          );
        if (
          repeatsEarlierClaim(text, citations, [
            ...paragraphs.flatMap((kept) => kept.claims),
            ...kept,
          ])
        )
          throw new LlmValidationError(
            `article claim ${claimIndex} repeats an earlier claim`
          );
        if (
          citations.length &&
          citations.every((citation) => background.has(citation.civicItemId)) &&
          !PLACEABLE_DATE.test(text)
        ) {
          throw new LlmValidationError(
            `article claim ${claimIndex} rests on earlier background but does not say when it happened`
          );
        }
        kept.push({
          text,
          citations,
          ...applySnippetPolicy(citations, claim['limitation']),
        });
      } catch (error) {
        if (
          options.dropInvalidClaims !== true ||
          !(error instanceof LlmValidationError)
        )
          throw error;
        const record =
          claimEntry && typeof claimEntry === 'object'
            ? (claimEntry as Record<string, unknown>)
            : {};
        rejected.push({
          index: claimIndex - 1,
          text: typeof record['text'] === 'string' ? record['text'] : '',
          reason: error.message,
          ...(record['citations'] !== undefined
            ? { citations: record['citations'] }
            : {}),
        });
      }
    }
    if (kept.length) paragraphs.push({ claims: kept });
  }
  if (!paragraphs.length)
    throw new LlmValidationError(
      rejected[0]
        ? `article has no valid claims; ${rejected[0].reason}`
        : 'article has no valid claims'
    );
  const citesNews = (paragraph: {
    claims: { citations: { civicItemId: number }[] }[];
  }) =>
    paragraph.claims.some((claim) =>
      claim.citations.some((citation) => news.has(citation.civicItemId))
    );
  if (news.size && !paragraphs.some(citesNews))
    throw new LlmValidationError(
      'article cites nothing new; it must open on the news'
    );
  const lead = paragraphs.findIndex(citesNews);
  if (lead > 0) paragraphs.unshift(...paragraphs.splice(lead, 1));
  // The headline is prose like any claim: it has to be grounded in what the
  // article cites. A headline may sum up several matters ("boards meet on
  // parks and wetlands"), so it answers to all of it, not the lead alone.
  const leadCitations = paragraphs[0]!.claims.flatMap(
    (claim) => claim.citations
  );
  const articleCitations = normalizeCitations(
    paragraphs.flatMap((paragraph) =>
      paragraph.claims.flatMap((claim) => claim.citations)
    )
  );
  const leadEvidence = evidence.find(
    (item) =>
      leadCitations.some(
        (citation) => citation.civicItemId === item.civicItemId
      ) && item.role !== 'background'
  );
  let headline =
    typeof value['headline'] === 'string' ? value['headline'].trim() : '';
  let headlineOrigin: 'model' | 'claim' | 'plan' | 'evidence' = 'model';
  try {
    if (!headline) throw new LlmValidationError('headline is empty');
    if (options.requireGrounding)
      validateClaimGrounding(
        headline,
        articleCitations,
        evidence,
        'article headline',
        { asOf: options.asOf }
      );
  } catch (error) {
    if (!(error instanceof LlmValidationError)) throw error;
    // The lead claim is already grounded and says what is new; a document's
    // own title ("Agenda 09/21/2026") usually does not. Short enough to head
    // the article, it stands in; otherwise the lead record's title.
    const leadClaim = paragraphs[0]!.claims[0]!.text.replace(/\.$/u, '');
    if (leadClaim.length <= 110) {
      headline = leadClaim;
      headlineOrigin = 'claim';
    }
    // An editor's plan names the lead matter: "Inland Wetlands Agency: Jones
    // Residence permit" says more than "Agenda 09/23/2026".
    else if (options.fallbackHeadline) {
      headline = options.fallbackHeadline;
      headlineOrigin = 'plan';
    } else if (leadEvidence?.title) {
      headline = leadEvidence.title;
      headlineOrigin = 'evidence';
    } else throw error;
  }
  const bullets = paragraphs.flatMap((paragraph) => paragraph.claims);
  return {
    headline,
    headlineOrigin,
    paragraphs,
    bullets,
    ...(rejected.length ? { rejected } : {}),
    provenance: value['provenance'] as LlmBriefAnalysis['provenance'],
    ...(bullets.every((bullet) => (bullet as { relegated?: boolean }).relegated)
      ? { relegated: true }
      : {}),
  };
}

export function validateBriefAnalysis(
  raw: unknown,
  evidence: readonly LlmEvidence[],
  options: AnalysisValidationOptions = {}
): LlmBriefAnalysis & { relegated?: boolean } {
  const value = parseStrictJson(raw);
  // The article shape is the edition's; bullets remain readable for outputs recorded before it.
  if (
    Object.prototype.hasOwnProperty.call(value, 'paragraphs') ||
    Object.prototype.hasOwnProperty.call(value, 'headline')
  ) {
    return validateArticle(value, evidence, options);
  }
  // qwen models observed in the live POC have returned two stable aliases for
  // the strict `bullets` array (`bulletPoints` and `briefing`).  Normalize
  // only those top-level array aliases; prose wrappers and empty arrays still
  // fail closed below.  We intentionally do not infer bullets from strings,
  // markdown, or arbitrary nested objects.
  const wrapperKeys = options.requireGrounding
    ? (['bullets'] as const)
    : (['bullets', 'bulletPoints', 'briefing'] as const);
  if (options.requireGrounding)
    assertAllowedFields(value, ['bullets'], 'brief');
  else assertAllowedFields(value, [...wrapperKeys, 'civicItem'], 'brief');
  if (Object.prototype.hasOwnProperty.call(value, 'civicItem'))
    validateCivicItemMetadata(value['civicItem']);
  const presentWrappers = wrapperKeys.filter((key) =>
    Object.prototype.hasOwnProperty.call(value, key)
  );
  if (presentWrappers.length !== 1)
    throw new LlmValidationError(
      presentWrappers.length
        ? 'ambiguous brief wrapper aliases'
        : 'brief requires bullets'
    );
  const bulletsValue = value[presentWrappers[0]];
  if (!Array.isArray(bulletsValue) || bulletsValue.length === 0)
    throw new LlmValidationError('brief requires bullets');
  if (
    (options.requireGrounding || options.requireNumericCitationIds) &&
    bulletsValue.length > 5
  )
    throw new LlmValidationError('brief allows at most five bullets');
  const { kept: bullets, rejected } = keepValidEntries(
    bulletsValue,
    'brief bullets',
    (entry, index) => {
      if (!entry || typeof entry !== 'object')
        throw new LlmValidationError('malformed brief bullet');
      const bullet = entry as Record<string, unknown>;
      assertAllowedFields(
        bullet,
        ['text', 'citations', 'limitation'],
        'brief bullet'
      );
      const text = requiredText(bullet['text'], 'bullet text');
      const citations = validateCitations(bullet['citations'], evidence, {
        requireNumericIds: options.requireNumericCitationIds,
        rejectModelMetadata: options.rejectModelCitationMetadata,
      });
      if (options.requireGrounding)
        validateClaimGrounding(
          text,
          citations,
          evidence,
          `brief bullet ${index + 1}`
        );
      return {
        text,
        citations,
        ...applySnippetPolicy(citations, bullet['limitation']),
      };
    },
    options.dropInvalidClaims === true
  );
  return {
    bullets,
    ...(rejected.length ? { rejected } : {}),
    provenance: value['provenance'] as LlmBriefAnalysis['provenance'],
    ...(bullets.every((b) => b.relegated) ? { relegated: true } : {}),
  };
}

export interface StoryAnalysisValidationOptions {
  /** A deterministic title already present in the candidate/evidence input. */
  fallbackTitle?: string;
  /** Required whenever fallbackTitle is supplied, so callers cannot hide its provenance. */
  fallbackTitleOrigin?: 'evidence';
  /** Live strict mode requires claim-level citations and disallows legacy narrative. */
  requireClaims?: boolean;
  allowLegacyNarrative?: boolean;
  /** JSON Schema responses carry IDs as JSON numbers, never decimal strings. */
  requireNumericCitationIds?: boolean;
  rejectModelCitationMetadata?: boolean;
  /** Local as-of boundary used to classify agenda event dates as historical. */
  asOf?: string;
  /** Drop claims that fail validation, fall back to the evidence title, and soften an unsupported decided status. */
  dropInvalidClaims?: boolean;
}

export function validateStoryAnalysis(
  raw: unknown,
  evidence: readonly LlmEvidence[],
  options: StoryAnalysisValidationOptions = {}
): LlmStoryAnalysis {
  const value = parseStrictJson(raw);
  const allowLegacyNarrative =
    options.allowLegacyNarrative !== false && options.requireClaims !== true;
  const strictClaims = options.requireClaims === true;
  assertAllowedFields(
    value,
    strictClaims
      ? ['title', 'claims', 'status', 'limitation']
      : [
          'title',
          'headline',
          'narrative',
          'claims',
          'status',
          'citations',
          'limitation',
        ],
    'story'
  );
  if (
    options.requireClaims &&
    (Object.prototype.hasOwnProperty.call(value, 'narrative') ||
      Object.prototype.hasOwnProperty.call(value, 'citations'))
  ) {
    throw new LlmValidationError(
      'strict story accepts claims only; narrative and top-level citations are legacy fields'
    );
  }
  const hasTitle = Object.prototype.hasOwnProperty.call(value, 'title');
  const hasHeadline = Object.prototype.hasOwnProperty.call(value, 'headline');
  if (hasTitle && hasHeadline)
    throw new LlmValidationError(
      'story contains ambiguous title/headline aliases'
    );
  const modelTitle = hasTitle
    ? value['title']
    : hasHeadline
    ? value['headline']
    : undefined;
  let titleOrigin: LlmStoryAnalysis['titleOrigin'] = 'model';
  let title: string;
  if (modelTitle !== undefined && typeof modelTitle !== 'string') {
    throw new LlmValidationError(
      `${hasHeadline ? 'headline' : 'title'} must be a string`
    );
  }
  if (typeof modelTitle === 'string' && modelTitle.trim()) {
    title = requiredText(modelTitle, hasHeadline ? 'headline' : 'title');
  } else {
    if (
      options.fallbackTitleOrigin !== 'evidence' ||
      options.fallbackTitle === undefined
    ) {
      throw new LlmValidationError('title is empty');
    }
    title = requiredText(options.fallbackTitle, 'fallback title');
    titleOrigin = 'evidence';
  }
  const status = value['status'];
  if (status !== 'decided' && status !== 'pending' && status !== 'ongoing')
    throw new LlmValidationError('status must be decided, pending, or ongoing');
  if (options.requireClaims) {
    const validated = validateClaims(value['claims'], evidence, 'story', {
      requireNumericIds: options.requireNumericCitationIds,
      rejectModelMetadata: options.rejectModelCitationMetadata,
      asOf: options.asOf,
      dropInvalid: options.dropInvalidClaims === true,
    });
    const rejected = [...validated.rejected];
    try {
      validateClaimGrounding(
        title,
        validated.citations,
        evidence,
        'story title',
        { asOf: options.asOf }
      );
    } catch (error) {
      // An ungrounded model title is replaced by the evidence title rather than discarding grounded claims.
      if (
        !(
          options.dropInvalidClaims &&
          error instanceof LlmValidationError &&
          options.fallbackTitle &&
          options.fallbackTitleOrigin === 'evidence'
        )
      )
        throw error;
      rejected.push({ index: -1, text: title, reason: error.message });
      title = requiredText(options.fallbackTitle, 'fallback title');
      titleOrigin = 'evidence';
    }
    if (typeof value['limitation'] === 'string' && value['limitation'].trim()) {
      const sources = evidenceForCitations(validated.citations, evidence);
      const sourceText = sources
        .map((source) =>
          [source.title, source.date, source.body].filter(Boolean).join(' ')
        )
        .join(' ');
      const parentContextText = sources
        .map((source) =>
          [
            source.parentDocumentContext?.title,
            source.parentDocumentContext?.body,
          ]
            .filter(Boolean)
            .join(' ')
        )
        .filter(Boolean)
        .join(' ');
      validateAgendaSemantics(
        value['limitation'],
        sourceText,
        'story limitation',
        parentContextText
      );
      validateAgendaTemporalModality(
        value['limitation'],
        sources,
        options.asOf,
        'story limitation'
      );
    }
    let finalStatus: 'decided' | 'pending' | 'ongoing' = status;
    if (status === 'decided') {
      const sources = evidenceForCitations(validated.citations, evidence);
      const sourceText = sources
        .map((source) =>
          [source.title, source.date, source.body].filter(Boolean).join(' ')
        )
        .join(' ');
      const parentContextText = sources
        .map((source) =>
          [
            source.parentDocumentContext?.title,
            source.parentDocumentContext?.body,
          ]
            .filter(Boolean)
            .join(' ')
        )
        .filter(Boolean)
        .join(' ');
      try {
        if (
          /\bagenda\b|\blisted\b|\bscheduled\b|\bproposed\b/iu.test(
            `${sourceText} ${parentContextText}`
          ) &&
          !hasOutcomeEvidence(sourceText)
        ) {
          throw new LlmValidationError(
            'claim-grounding/unsupported-agenda-status: story status decided is absent from the row evidence'
          );
        }
        validateAgendaSemantics(
          'decided',
          sourceText,
          'story status',
          parentContextText
        );
        validateAgendaTemporalModality(
          String(status),
          sources,
          options.asOf,
          'story status'
        );
      } catch (error) {
        // An unsupported "decided" becomes the neutral "ongoing" instead of discarding the story.
        if (!(options.dropInvalidClaims && error instanceof LlmValidationError))
          throw error;
        rejected.push({
          index: -1,
          text: 'status: decided',
          reason: error.message,
        });
        finalStatus = 'ongoing';
      }
    }
    return {
      title,
      titleOrigin,
      narrative: validated.claims.map((claim) => claim.text).join(' '),
      claims: validated.claims,
      ...(rejected.length ? { rejected } : {}),
      status: finalStatus,
      citations: validated.citations,
      ...applySnippetPolicy(validated.citations, value['limitation']),
      provenance: value['provenance'] as LlmStoryAnalysis['provenance'],
    };
  }
  if (!allowLegacyNarrative)
    throw new LlmValidationError('story requires claims in strict mode');
  const narrative = requiredText(value['narrative'], 'narrative');
  const citations = validateCitations(value['citations'], evidence, {
    requireNumericIds: options.requireNumericCitationIds,
    rejectModelMetadata: options.rejectModelCitationMetadata,
  });
  return {
    title,
    titleOrigin,
    narrative,
    status,
    citations,
    ...applySnippetPolicy(citations, value['limitation']),
    provenance: value['provenance'] as LlmStoryAnalysis['provenance'],
  };
}

/**
 * The editor's plan. It is never published, so its facts are not held to
 * claim grounding — the article written from it is — but every citation must
 * bind to supplied evidence, and a matter must rest on something new.
 */
/**
 * The longest prefix of a cut-off JSON document that ends on a complete
 * object, closed. A planner caught in a loop is stopped mid-object; what it
 * wrote before the loop is usually sound.
 */
export function salvageJson(text: string): unknown {
  const stack: string[] = [];
  const closes: { end: number; open: string[] }[] = [];
  let inString = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') {
      stack.pop();
      if (char === '}') closes.push({ end: index + 1, open: [...stack] });
    }
  }
  for (const close of closes.reverse()) {
    const closers = close.open
      .slice()
      .reverse()
      .map((open) => (open === '{' ? '}' : ']'))
      .join('');
    try {
      return JSON.parse(
        text.slice(0, close.end).replace(/,\s*$/u, '') + closers
      );
    } catch {
      /* an earlier close may parse */
    }
  }
  throw new LlmValidationError('malformed JSON with nothing to salvage');
}

export function validateBriefPlan(
  raw: unknown,
  evidence: readonly LlmEvidence[],
  options: {
    requireNumericCitationIds?: boolean;
    rejectModelCitationMetadata?: boolean;
  } = {}
): LlmBriefPlan {
  // The plan is internal: a cut-off plan is trimmed to what it completed and
  // its repeated facts dropped, rather than thrown away with its good part.
  let value: Record<string, unknown>;
  try {
    value = parseStrictJson(raw);
  } catch (error) {
    if (!(error instanceof LlmValidationError) || typeof raw !== 'string')
      throw error;
    const salvaged = salvageJson(stripFences(raw));
    if (!salvaged || typeof salvaged !== 'object' || Array.isArray(salvaged))
      throw error;
    value = salvaged as Record<string, unknown>;
  }
  assertAllowedFields(value, ['matters'], 'brief plan');
  if (!Array.isArray(value['matters']) || value['matters'].length === 0)
    throw new LlmValidationError('brief plan requires matters');
  const news = new Set(
    evidence
      .filter((item) => item.role !== 'background')
      .map((item) => item.civicItemId)
  );
  const matters: LlmBriefPlan['matters'] = [];
  for (const entry of value['matters'].slice(0, 12)) {
    if (!entry || typeof entry !== 'object') continue;
    const matter = entry as Record<string, unknown>;
    if (
      typeof matter['body'] !== 'string' ||
      !matter['body'].trim() ||
      typeof matter['subject'] !== 'string' ||
      !matter['subject'].trim() ||
      !Array.isArray(matter['facts'])
    )
      continue;
    const facts: LlmBriefPlan['matters'][number]['facts'] = [];
    for (const factEntry of matter['facts']) {
      if (!factEntry || typeof factEntry !== 'object') continue;
      const fact = factEntry as Record<string, unknown>;
      if (typeof fact['text'] !== 'string' || !fact['text'].trim()) continue;
      try {
        facts.push({
          text: fact['text'].trim(),
          citations: validateCitations(fact['citations'], evidence, {
            requireNumericIds: options.requireNumericCitationIds,
            rejectModelMetadata: options.rejectModelCitationMetadata,
          }),
        });
      } catch (error) {
        if (!(error instanceof LlmValidationError)) throw error;
      }
    }
    // A loop repeats a fact word for word; keep the first.
    const seenFacts = new Set<string>();
    const distinct = facts
      .filter((fact) => {
        const key = fact.text.toLowerCase().replace(/\s+/gu, ' ');
        if (seenFacts.has(key)) return false;
        seenFacts.add(key);
        return true;
      })
      .slice(0, 8);
    facts.splice(0, facts.length, ...distinct);
    if (!facts.length) continue;
    if (
      news.size &&
      !facts.some((fact) =>
        fact.citations.some((citation) => news.has(citation.civicItemId))
      )
    )
      continue;
    // A loop may repeat whole matters too.
    const matterKey = `${matter['body'].trim().toLowerCase()}|${matter[
      'subject'
    ]
      .trim()
      .toLowerCase()}`;
    if (
      matters.some(
        (kept) =>
          `${kept.body.toLowerCase()}|${kept.subject.toLowerCase()}` ===
          matterKey
      )
    )
      continue;
    matters.push({
      body: matter['body'].trim(),
      subject: matter['subject'].trim(),
      facts,
    });
  }
  if (!matters.length)
    throw new LlmValidationError(
      'brief plan has no matter resting on news evidence'
    );
  return { matters };
}

/**
 * A writer working from a plan still skips facts. Any planned fact whose
 * evidence the article never cites is added in the plan's own words, if it
 * grounds exactly as a claim must, into the paragraph of its matter (or a
 * new one). The article then reports everything the editor found.
 */
export function fillFromPlan(
  analysis: LlmBriefAnalysis,
  plan: LlmBriefPlan,
  evidence: readonly LlmEvidence[],
  options: { asOf?: string } = {}
): LlmBriefAnalysis {
  const identity = (citation: LlmCitation) =>
    `${citation.sourceKey}\u0000${citation.civicItemId}\u0000${
      citation.agendaItemId ?? ''
    }`;
  const paragraphs = (
    analysis.paragraphs ?? [{ claims: analysis.bullets }]
  ).map((paragraph) => ({ claims: [...paragraph.claims] }));
  const cited = new Set(
    paragraphs.flatMap((paragraph) =>
      paragraph.claims.flatMap((claim) => claim.citations.map(identity))
    )
  );
  for (const matter of plan.matters) {
    const matterKeys = new Set(
      matter.facts.flatMap((fact) => fact.citations.map(identity))
    );
    for (const fact of matter.facts) {
      // A planner may bind a right fact to a sibling row of the same matter;
      // it stands on whichever of the matter's citations it grounds on.
      const candidates = [
        fact.citations,
        ...matter.facts
          .filter((other) => other !== fact)
          .map((other) => other.citations),
      ];
      const citations = candidates.find((candidate) => {
        try {
          validateClaimGrounding(fact.text, candidate, evidence, 'plan fact', {
            asOf: options.asOf,
          });
          return true;
        } catch (error) {
          if (error instanceof LlmValidationError) return false;
          throw error;
        }
      });
      if (!citations) continue;
      if (ROSTER.test(fact.text)) continue;
      // Covered when the article already says it, under whatever citation;
      // or, looser, when its source is cited and most of it is said. One
      // agenda row can carry several facts (three millage rates), so a cited
      // source alone does not cover them all.
      const words = [...contentWords(fact.text)];
      const newShare = Math.min(
        ...paragraphs
          .flatMap((paragraph) => paragraph.claims)
          .map((existing) => {
            const existingWords = contentWords(existing.text);
            return words.length
              ? words.filter((word) => !existingWords.has(word)).length /
                  words.length
              : 0;
          }),
        1
      );
      const sourceCited = citations.some((citation) =>
        cited.has(identity(citation))
      );
      if (newShare <= 0.3 || (sourceCited && newShare <= 0.6)) continue;
      const claim: LlmBriefBullet = {
        text: fact.text,
        citations: [...citations],
        fromPlan: true,
      };
      const home = paragraphs.find((paragraph) =>
        paragraph.claims.some((existing) =>
          existing.citations.some((citation) =>
            matterKeys.has(identity(citation))
          )
        )
      );
      if (home) home.claims.push(claim);
      else paragraphs.push({ claims: [claim] });
      for (const citation of citations) cited.add(identity(citation));
    }
  }
  // One paragraph per matter, in the plan's order, whatever shape the writer
  // gave: a small writer often runs every claim into a single paragraph.
  const byMatter = plan.matters.map(() => [] as LlmBriefBullet[]);
  const unplaced: LlmBriefBullet[] = [];
  const matterKeys = plan.matters.map(
    (matter) =>
      new Set(matter.facts.flatMap((fact) => fact.citations.map(identity)))
  );
  for (const claim of paragraphs.flatMap((paragraph) => paragraph.claims)) {
    const index = matterKeys.findIndex((keys) =>
      claim.citations.some((citation) => keys.has(identity(citation)))
    );
    if (index >= 0) byMatter[index]!.push(claim);
    else unplaced.push(claim);
  }
  const arranged = [...byMatter, unplaced]
    .filter((claims) => claims.length)
    .map((claims) => ({ claims }));
  return {
    ...analysis,
    paragraphs: arranged,
    bullets: arranged.flatMap((paragraph) => paragraph.claims),
  };
}

/** What a resident is likeliest to act on: money, land, votes, permits, schools, safety. */
const CONSEQUENCE =
  /\b(?:millage|tax(?:es)?|budget|\$\s?\d|grant|fund(?:s|ing)?|fee|rate|zoning|rezon\w*|permit|variance|land|parcel|acre|development|ordinance|resolution|vote|hearing|election|school|superintendent|police|fire|emergency|ambulance|911|water|sewer|road|street|drainage|contract|purchase|sale|lease|hire|appoint\w*|indict\w*|arrest\w*|charged|charges|fraud|lawsuit|sued|court|sentenc\w*|convict\w*|resign\w*|fired|investigat\w*)\b/giu;

/**
 * Matters most consequential first. A planner is asked for that order but a
 * small one often keeps evidence order; the count of consequential terms in
 * a matter's facts reorders it, ties keeping the planner's order.
 */
export function orderPlanByConsequence(plan: LlmBriefPlan): LlmBriefPlan {
  const score = (matter: LlmBriefPlan['matters'][number]) =>
    (
      `${matter.subject} ${matter.facts
        .map((fact) => fact.text)
        .join(' ')}`.match(CONSEQUENCE) ?? []
    ).length;
  return {
    matters: plan.matters
      .map((matter, index) => ({ matter, index, score: score(matter) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(({ matter }) => matter),
  };
}

export function validateAgendaAnalysis(
  raw: unknown,
  evidence: readonly LlmEvidence[],
  options: {
    requireGrounding?: boolean;
    requireNumericCitationIds?: boolean;
    rejectModelCitationMetadata?: boolean;
  } = {}
): {
  items: {
    section: string;
    heading: string;
    body: string;
    citations: LlmCitation[];
  }[];
} {
  const value = parseStrictJson(raw);
  assertAllowedFields(value, ['items'], 'agenda_fixup');
  if (!Array.isArray(value['items']) || value['items'].length === 0)
    throw new LlmValidationError('agenda fixup requires items');
  return {
    items: value['items'].map((entry) => {
      if (!entry || typeof entry !== 'object')
        throw new LlmValidationError('malformed agenda item');
      const item = entry as Record<string, unknown>;
      assertAllowedFields(
        item,
        ['section', 'heading', 'body', 'citations'],
        'agenda item'
      );
      const section = requiredText(item['section'], 'section');
      const heading = requiredText(item['heading'], 'heading');
      const body = requiredText(item['body'], 'body');
      const citations = validateCitations(item['citations'], evidence, {
        requireNumericIds: options.requireNumericCitationIds,
        rejectModelMetadata: options.rejectModelCitationMetadata,
      });
      if (options.requireGrounding !== false) {
        validateClaimGrounding(section, citations, evidence, 'agenda section');
        validateClaimGrounding(heading, citations, evidence, 'agenda heading');
        validateClaimGrounding(body, citations, evidence, 'agenda body');
      }
      return { section, heading, body, citations };
    }),
  };
}

const REFUSAL_PATTERNS = [
  /i cannot (provide|summarize|help)/i,
  /i'm (unable|sorry)/i,
  /as an ai/i,
];

export function isRefusal(text: string): boolean {
  return REFUSAL_PATTERNS.some((p) => p.test(text));
}

/** Key tokens (numbers, parcel/case IDs, date fragments) the summary must keep. */
export function keyTokens(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/[A-Za-z0-9.\-/]*\d[A-Za-z0-9.\-/]*/g)) {
    const token = m[0]
      .replace(/^[-.,;:'"(\[]+/, '')
      .replace(/[.,;:'")\]]+$/, '');
    if (token.replace(/\D/g, '').length >= 3) found.add(token);
  }
  for (const m of source.matchAll(
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:\s+\d{4})?/gi
  )) {
    found.add(m[0]);
  }
  return [...found];
}

export function missingTokens(summary: string, tokens: string[]): string[] {
  const normalized = normalizeDates(summary);
  return tokens.filter((t) => !normalized.includes(normalizeDates(t)));
}

export function tryParseJsonArray(text: string): unknown[] | null {
  try {
    const parsed: unknown = JSON.parse(stripFences(text));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Strip markdown links and bare URLs — bullets/summaries must not invent links. */
export function stripLinks(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
export function firstSentences(text: string, n = 2): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(0, n).join(' ').trim().slice(0, 600);
}
