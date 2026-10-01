import { findJargon, renderJargonBuster } from './glossary.js';
import { explainZoning, renderZoning } from './zoning.js';
import { itemEvidenceLocalDate } from './edition.js';
import { cleanEditorialBody } from './article-enrichment.js';
import type { LlmClaim } from './types.js';

export interface NewsThreadCandidateItem {
  civicItemId: number;
  sourceKey: string;
  title: string;
  body: string;
  date: string;
  scopeSlug: string;
  articleUrl?: string;
  snippetOnly?: boolean;
}

export interface NewsThreadCandidate {
  candidateKey: string;
  scopeSlug: string;
  items: NewsThreadCandidateItem[];
  earliestDate: string;
}

interface CandidateSourceItem {
  id?: number;
  sourceId: string;
  localitySlug?: string;
  scopeSlug?: string | null;
  scopeKind?: string | null;
  geographyDecision?: string | null;
  title: string;
  body: string;
  canonicalUrl?: string | null;
  uris?: string | readonly string[] | null;
  publishedAt?: string | null;
  eventDate?: string | null;
  observedAt?: string | null;
  externalId?: string | null;
  caseId?: string | null;
  matterId?: string | null;
  entity?: string | null;
  action?: string | null;
  accessMode?: string | null;
}

export interface NewsThreadCandidateOptions {
  targetScopeSlug: string;
  ancestry: readonly string[];
  contextRange: { start: string; end: string };
  timezone: string;
}

const CANDIDATE_BOILERPLATE = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'these',
  'those',
  'into',
  'after',
  'before',
  'county',
  'city',
  'town',
  'local',
  'locality',
  'community',
  'resident',
  'residents',
  'public',
  'civic',
  'news',
  'report',
  'reports',
  'reporting',
  'update',
  'updates',
  'meeting',
  'meetings',
  'agenda',
  'agendas',
  'minutes',
  'board',
  'boards',
  'district',
  'school',
  'schools',
  'official',
  'officials',
  'government',
  'commission',
  'council',
  'people',
  'area',
  'areas',
  'group',
  'groups',
  'organization',
  'organizations',
  'event',
  'events',
  'according',
  'announced',
  'announcement',
]);

// A small, deliberately conservative verb vocabulary.  These terms are used
// only as a second signal alongside an issue/entity term; a shared verb such
// as "announced" can never create a candidate on its own.
const CANDIDATE_ACTIONS = new Set([
  'advance',
  'advanced',
  'advances',
  'approve',
  'approved',
  'approves',
  'award',
  'awarded',
  'awards',
  'begin',
  'began',
  'begins',
  'build',
  'building',
  'built',
  'close',
  'closed',
  'closes',
  'continue',
  'continues',
  'continued',
  'delay',
  'delayed',
  'delays',
  'deny',
  'denied',
  'denies',
  'expand',
  'expanded',
  'expands',
  'fund',
  'funded',
  'funding',
  'funds',
  'install',
  'installed',
  'installs',
  'open',
  'opened',
  'opens',
  'plan',
  'planned',
  'plans',
  'propose',
  'proposed',
  'proposes',
  'receive',
  'received',
  'receives',
  'reject',
  'rejected',
  'rejects',
  'remain',
  'remains',
  'review',
  'reviewed',
  'schedule',
  'scheduled',
  'schedules',
  'start',
  'started',
  'starts',
  'table',
  'tabled',
  'vote',
  'voted',
  'votes',
  'zoned',
  'rezoned',
  'construct',
  'constructed',
  'construction',
]);

function normalizeCandidateTokens(
  value: string,
  ignored: ReadonlySet<string>
): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/u)
      .filter(
        (token) =>
          token.length >= 4 &&
          !/^\d+$/u.test(token) &&
          !CANDIDATE_BOILERPLATE.has(token) &&
          !ignored.has(token)
      )
  );
}

function sourceAndScopeTokens(item: CandidateSourceItem): Set<string> {
  const values = [item.sourceId, item.localitySlug ?? '', item.scopeSlug ?? ''];
  return new Set(
    values
      .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/u))
      .filter((token) => token.length >= 3)
  );
}

function candidateIdentityKeys(item: CandidateSourceItem): Set<string> {
  const keys = new Set<string>();
  for (const value of [item.externalId, item.caseId, item.matterId]) {
    if (typeof value === 'string' && value.trim())
      keys.add(`id:${value.trim().toLowerCase()}`);
  }
  const url = firstUrl(item);
  if (url) keys.add(`url:${url.replace(/\/$/u, '').toLowerCase()}`);
  return keys;
}

function firstUrl(item: CandidateSourceItem): string | undefined {
  if (typeof item.canonicalUrl === 'string' && item.canonicalUrl.trim())
    return item.canonicalUrl.trim();
  if (Array.isArray(item.uris))
    return item.uris.find(
      (url): url is string => typeof url === 'string' && Boolean(url.trim())
    );
  if (typeof item.uris === 'string') {
    try {
      const parsed = JSON.parse(item.uris) as unknown;
      return Array.isArray(parsed)
        ? parsed.find(
            (url): url is string =>
              typeof url === 'string' && Boolean(url.trim())
          )
        : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function sharedValues(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): Set<string> {
  return new Set([...left].filter((value) => right.has(value)));
}

interface CandidateEntry {
  item: CandidateSourceItem;
  date: string;
  scopeSlug: string;
  tokens: Set<string>;
  issueTokens: Set<string>;
  actionTokens: Set<string>;
  identities: Set<string>;
}

function canJoinCandidates(
  left: CandidateEntry,
  right: CandidateEntry
): boolean {
  if (left.scopeSlug !== right.scopeSlug) return false;
  // Durable publisher/case identities are authoritative within a scope.  URL
  // and external-ID keys are kept independently so a noisy ID cannot cancel
  // an otherwise identical canonical article URL.
  if (sharedValues(left.identities, right.identities).size > 0) return true;
  const sharedTokens = sharedValues(left.tokens, right.tokens);
  const sharedIssues = sharedValues(left.issueTokens, right.issueTokens);
  const sharedActions = sharedValues(left.actionTokens, right.actionTokens);
  if (sharedIssues.size === 0 || sharedTokens.size < 2) return false;
  const smaller = Math.max(1, Math.min(left.tokens.size, right.tokens.size));
  const similarity = sharedTokens.size / smaller;
  // At least one issue/entity and one action must agree.  Two issue terms are
  // also sufficient for multi-date road/zoning/project reporting where the
  // verb changes ("proposed" -> "approved"), provided the overlap is strong.
  return (
    similarity >= 0.2 && (sharedActions.size > 0 || sharedIssues.size >= 2)
  );
}

function candidateGroupKey(group: readonly CandidateEntry[]): string {
  const commonIdentity = group.reduce<Set<string> | undefined>(
    (common, entry) => {
      if (!common) return new Set(entry.identities);
      return sharedValues(common, entry.identities);
    },
    undefined
  );
  if (commonIdentity?.size) return [...commonIdentity].sort()[0]!;
  const counts = new Map<string, number>();
  for (const entry of group)
    for (const token of entry.tokens)
      counts.set(token, (counts.get(token) ?? 0) + 1);
  const threshold = Math.max(1, Math.ceil(group.length / 2));
  const anchors = [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .map(([token]) => token)
    .sort()
    .slice(0, 8);
  return `subject:${
    anchors.join('-') ||
    [...group[0]!.tokens].sort().slice(0, 8).join('-') ||
    'unidentified'
  }`;
}

/**
 * Build deterministic, locality-scoped news candidates before any LLM call.
 * The model receives these groups as evidence only; it never decides story
 * identity or joins items across county scopes.
 */
export function buildNewsThreadCandidates(
  items: readonly CandidateSourceItem[],
  options: NewsThreadCandidateOptions
): NewsThreadCandidate[] {
  const prepared = items.flatMap((item) => {
    if (
      item.id === undefined ||
      !item.scopeSlug ||
      !options.ancestry.includes(item.scopeSlug)
    )
      return [];
    if (
      item.geographyDecision === 'withhold' ||
      item.geographyDecision === 'uncertain'
    )
      return [];
    const date = itemEvidenceLocalDate(item, options.timezone);
    if (
      !date ||
      date < options.contextRange.start ||
      date >= options.contextRange.end
    )
      return [];
    const ignored = sourceAndScopeTokens(item);
    const titleTokens = normalizeCandidateTokens(item.title, ignored);
    const bodyTokens = normalizeCandidateTokens(
      cleanEditorialBody(item.body).slice(0, 1200),
      ignored
    );
    return {
      item,
      date,
      scopeSlug: item.scopeSlug,
      ignored,
      titleTokens,
      bodyTokens,
    };
  });
  // Scraped article bodies commonly begin with the same navigation, footer,
  // and recommendation template.  Treat terms repeated across multiple body
  // documents as body boilerplate; retain title terms as the primary identity
  // signal so a real topic does not disappear when its copy is repeated.
  const bodyFrequency = new Map<string, number>();
  for (const entry of prepared)
    for (const token of entry.bodyTokens)
      bodyFrequency.set(token, (bodyFrequency.get(token) ?? 0) + 1);
  const repeatedBodyTokens = new Set(
    [...bodyFrequency]
      .filter(
        ([, count]) => count >= Math.max(2, Math.ceil(prepared.length / 2))
      )
      .map(([token]) => token)
  );
  const eligible: CandidateEntry[] = prepared.map(
    ({ item, date, scopeSlug, ignored, titleTokens, bodyTokens }) => {
      const tokens = new Set(
        [...titleTokens, ...bodyTokens].filter(
          (token) => titleTokens.has(token) || !repeatedBodyTokens.has(token)
        )
      );
      const metadataEntity = normalizeCandidateTokens(
        item.entity ?? '',
        ignored
      );
      const metadataAction = normalizeCandidateTokens(
        item.action ?? '',
        ignored
      );
      const actionTokens = new Set([
        ...metadataAction,
        ...[...tokens].filter((token) => CANDIDATE_ACTIONS.has(token)),
      ]);
      const issueTokens = new Set([
        ...metadataEntity,
        ...[...tokens].filter((token) => !actionTokens.has(token)),
      ]);
      return {
        item,
        date,
        scopeSlug,
        tokens,
        issueTokens,
        actionTokens,
        identities: candidateIdentityKeys(item),
      };
    }
  );
  const orderedEligible = [...eligible].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.item.sourceId.localeCompare(b.item.sourceId) ||
      (a.item.id as number) - (b.item.id as number)
  );
  const groups: CandidateEntry[][] = [];
  for (const entry of orderedEligible) {
    // Every member must support the join.  This intentionally avoids a
    // transitive A↔B↔C chain turning unrelated issues into one story.
    const matching = groups.filter((group) =>
      group.every((member) => canJoinCandidates(member, entry))
    );
    if (matching.length === 1) matching[0]!.push(entry);
    else if (matching.length > 1) {
      const merged = matching.flat();
      for (const group of matching) groups.splice(groups.indexOf(group), 1);
      groups.push([...merged, entry]);
    } else groups.push([entry]);
  }
  return groups
    .filter((group) => group.length >= 2)
    .map((group) => {
      const ordered = [...group].sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.item.sourceId.localeCompare(b.item.sourceId) ||
          (a.item.id as number) - (b.item.id as number)
      );
      const first = ordered[0]!;
      const identity = candidateGroupKey(ordered);
      return {
        candidateKey: `${first.scopeSlug}|${identity}`,
        scopeSlug: first.scopeSlug,
        earliestDate: first.date,
        items: ordered.map(({ item, date }) => ({
          civicItemId: item.id as number,
          sourceKey: item.sourceId,
          title: item.title,
          body: cleanEditorialBody(item.body),
          date,
          scopeSlug: item.scopeSlug as string,
          ...(firstUrl(item) ? { articleUrl: firstUrl(item) } : {}),
          ...(item.accessMode === 'snippet-only' ? { snippetOnly: true } : {}),
        })),
      };
    })
    .sort(
      (a, b) =>
        a.scopeSlug.localeCompare(b.scopeSlug) ||
        a.earliestDate.localeCompare(b.earliestDate) ||
        a.candidateKey.localeCompare(b.candidateKey)
    );
}

export interface StoryInput {
  locality: string;
  title: string;
  titleOrigin?: 'model' | 'evidence';
  status?: string;
  narrative: string;
  timeline: {
    date?: string;
    heading: string;
    detail?: string;
    url?: string;
    disclosure?: string;
  }[];
  meetings: string[];
  sources: {
    title: string;
    url?: string;
    snippetOnly?: boolean;
    disclosure?: string;
  }[];
  limitation?: string;
  model: string;
  updatedAt: string;
  /** True when every timeline item is an agenda/listing, not meeting minutes. */
  agendaOnly?: boolean;
  /** Local briefing boundary used to classify agenda rows as historical. */
  asOf?: string;
}

export const LLM_CLAIM_GROUNDING_DISCLOSURE =
  'LLM-generated, citation-bound; semantic entailment is not automatically verified.';

const FUTURE_MEETING =
  /\b(?:(?:will|shall)\s+be|(?:to be|scheduled to be|is expected to be))\s+(?:held|conducted|convened)\b|\b(?:will|shall)\s+(?:hold|conduct|convene)\b/giu;
const PAST_MEETING =
  /\b(?:met|conducted|convened|occurred|took\s+place)\b|\b(?:meeting|session)\s+(?:was|were|has|have)\s+held\b|\b(?:meeting|session)\s+held\b|\b(?:council|board|commission)\b[^.!?]{0,40}\b(?:met|held|conducted|convened)\b/iu;
const AGENDA_OUTCOME =
  /\b(?:approved|authorized|passed|adopted|denied|tabled|carried|rejected|voted)\b/iu;
const AGENDA_ATTRIBUTION_ACTION =
  /\b(?:submit(?:ted|s|ting)?|request(?:ed|s|ing)?|present(?:ed|s|ing)?|introduc(?:ed|es|ing)?|sponsor(?:ed|s|ing)?|initiat(?:ed|es|ing)?|led|announc(?:ed|es|ing)?|explain(?:ed|s|ing)?|propos(?:ed|es|ing)?|fil(?:ed|es|ing)?|recommend(?:ed|s|ing)?)\b/iu;
const HISTORICAL_PRESENT_FUTURE_MODALITY =
  /\b(?:will|shall)\s+(?:discuss|review|consider|vote|award|approve|deny|authorize|decide|pass|table|reject|hold|be\s+(?:held|conducted|convened))\b|\b(?:is|are)\s+scheduled\b|\b(?:council|board|commission|meeting|session)\b[^.!?]{0,40}\b(?:meets?|holds?|discusses?|reviews?|considers?)\b/iu;

function agendaOnlyPublicFieldHasUnsupportedAssertion(value: string): boolean {
  const withoutFuture = value.replace(FUTURE_MEETING, ' ');
  return PAST_MEETING.test(withoutFuture) || AGENDA_OUTCOME.test(withoutFuture);
}

/** Agenda row names/roles do not establish that a person performed an action. */
export function assertAgendaActionAttribution(
  value: string,
  sourceText: string,
  label = 'agenda'
): void {
  if (
    AGENDA_ATTRIBUTION_ACTION.test(value) &&
    !AGENDA_ATTRIBUTION_ACTION.test(sourceText)
  ) {
    throw new Error(
      `agenda-only ${label} asserts an unsupported action/attribution verb; use only wording present in the cited row evidence`
    );
  }
}

/** Historical agenda records should be rendered as records of what was
 * listed/scheduled, while future rows retain prospective language. */
export function assertAgendaTemporalModality(
  value: string,
  label: string,
  eventDate?: string,
  asOf?: string
): void {
  if (
    !eventDate ||
    !asOf ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(eventDate) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(asOf) ||
    eventDate >= asOf
  )
    return;
  if (
    HISTORICAL_PRESENT_FUTURE_MODALITY.test(value) ||
    PAST_MEETING.test(value) ||
    AGENDA_OUTCOME.test(value)
  ) {
    throw new Error(
      `historical agenda ${label} uses unsupported present/future, occurrence, or outcome wording; use agenda listed/was scheduled/no outcome record available wording`
    );
  }
}

/** Strip an ordinal-only agenda residue before rendering. */
export function cleanTimelineLabel(value: string): string {
  const trimmed = value.trim();
  return /^\(?\d{1,3}[.)]?\)?$/u.test(trimmed) ||
    /^[.…\s]+$/u.test(trimmed) ||
    /(?:\.\.\.|…)$/u.test(trimmed)
    ? ''
    : trimmed;
}

/** True only when the original record is a listing/schedule without a
 * source-supported past occurrence or finite outcome. Minutes and outcome
 * records therefore remain eligible for occurrence wording. */
export function isAgendaOnlyEvidence(title: string, body: string): boolean {
  const source = `${title} ${body}`;
  return (
    /\b(?:agenda|listed|scheduled|proposed)\b/iu.test(source) &&
    !agendaOnlyPublicFieldHasUnsupportedAssertion(source)
  );
}

/** Agenda/listing evidence cannot render as an occurrence or outcome claim. */
export function assertAgendaOnlyPublicField(
  value: string,
  label: string
): void {
  if (agendaOnlyPublicFieldHasUnsupportedAssertion(value)) {
    throw new Error(
      `agenda-only ${label} asserts an unsupported meeting occurrence or outcome; use agenda/listed/scheduled wording`
    );
  }
}

/** The canonical story body is a deterministic projection of validated claim text. */
export function deriveNarrativeFromClaims(claims: readonly LlmClaim[]): string {
  if (!Array.isArray(claims) || claims.length === 0)
    throw new Error('story requires at least one validated claim');
  return claims
    .map((claim) => claim.text.trim())
    .filter(Boolean)
    .join(' ');
}

interface StoryTimelineEvent {
  date?: string;
  heading: string;
  body: string;
  articleUrl?: string;
  civicItemId?: number;
  agendaItemId?: number;
  sourceKey?: string;
  snippetOnly?: boolean;
}

/**
 * Agenda documents contain many sibling rows that share one CivicItem
 * citation.  A canonical story is about the row selected by its validated
 * title/claims, not the whole parent document.  Keep only rows with a
 * distinctive overlap with that story identity; when no safe binding exists,
 * omit the timeline rather than rendering unrelated agenda items.
 */
export function selectStoryTimelineEvents<T extends StoryTimelineEvent>(
  events: readonly T[],
  analysis: {
    title: string;
    claims?: readonly LlmClaim[];
    citations?: readonly {
      sourceKey: string;
      civicItemId: number;
      agendaItemId?: number;
    }[];
    narrative?: string;
  }
): T[] {
  if (events.length <= 1) return [...events];
  const agendaEvents = events.filter(
    (event) => event.agendaItemId !== undefined
  );
  // Any agenda evidence requires an exact persisted row citation. Never fall
  // back to title/body token overlap: sibling rows routinely share generic
  // words such as "resolution" and "council".
  if (agendaEvents.length > 0) {
    const citations = [
      ...(analysis.citations ?? []),
      ...(analysis.claims ?? []).flatMap((claim) => claim.citations),
    ];
    const exact = citations.filter(
      (citation) => citation.agendaItemId !== undefined
    );
    if (!exact.length) return [];
    return events.filter((event) =>
      exact.some(
        (citation) =>
          citation.sourceKey === event.sourceKey &&
          citation.civicItemId === event.civicItemId &&
          citation.agendaItemId === event.agendaItemId
      )
    );
  }
  // Non-agenda events have no safe derived-row identity. The caller must bind
  // them through citations; absent an exact citation, omit the timeline.
  const citations = [
    ...(analysis.citations ?? []),
    ...(analysis.claims ?? []).flatMap((claim) => claim.citations),
  ];
  return events.filter(
    (event) =>
      event.civicItemId !== undefined &&
      citations.some(
        (citation) =>
          citation.agendaItemId === undefined &&
          citation.sourceKey === event.sourceKey &&
          citation.civicItemId === event.civicItemId
      )
  );
}

/** Fail closed when separate canonical stories receive the same synthesized
 * narrative, a strong signal that evidence crossed a story boundary. */
export function assertDistinctStoryNarratives(
  stories: readonly { storyKey: string; narrative: string }[]
): void {
  const seen = new Map<string, string>();
  for (const story of stories) {
    const normalized = story.narrative
      .toLocaleLowerCase()
      .replace(/\s+/gu, ' ')
      .trim();
    if (!normalized) continue;
    const prior = seen.get(normalized);
    if (prior && prior !== story.storyKey)
      throw new Error(
        `duplicate story narrative across canonical stories: ${prior} and ${story.storyKey}`
      );
    seen.set(normalized, story.storyKey);
  }
}

/** Full story article: narrative + timeline + sources. Deterministic shell. */
export function assembleStory(input: StoryInput): string {
  const renderedTimeline = input.timeline
    .map((timeline) => ({
      ...timeline,
      heading: cleanTimelineLabel(timeline.heading),
      detail: timeline.detail
        ? cleanTimelineLabel(timeline.detail)
        : timeline.detail,
    }))
    .filter((timeline) => Boolean(timeline.heading));
  const historicalAgenda = Boolean(
    input.agendaOnly &&
      input.asOf &&
      input.timeline.some(
        (timeline) => timeline.date && timeline.date < input.asOf!
      )
  );
  if (input.agendaOnly) {
    assertAgendaOnlyPublicField(input.title, 'title');
    assertAgendaOnlyPublicField(input.narrative, 'narrative');
    if (historicalAgenda) {
      const historicalDate = input.timeline.find(
        (timeline) => timeline.date && timeline.date < input.asOf!
      )?.date;
      assertAgendaTemporalModality(
        input.title,
        'title',
        historicalDate,
        input.asOf
      );
      assertAgendaTemporalModality(
        input.narrative,
        'narrative',
        historicalDate,
        input.asOf
      );
    }
    for (const [index, timeline] of renderedTimeline.entries()) {
      assertAgendaOnlyPublicField(
        timeline.heading,
        `timeline heading ${index + 1}`
      );
      if (timeline.detail)
        assertAgendaOnlyPublicField(
          timeline.detail,
          `timeline detail ${index + 1}`
        );
      assertAgendaTemporalModality(
        timeline.heading,
        `timeline heading ${index + 1}`,
        timeline.date,
        input.asOf
      );
      if (timeline.detail)
        assertAgendaTemporalModality(
          timeline.detail,
          `timeline detail ${index + 1}`,
          timeline.date,
          input.asOf
        );
    }
    if (input.status) assertAgendaOnlyPublicField(input.status, 'status');
    if (input.limitation)
      assertAgendaOnlyPublicField(input.limitation, 'limitation');
    if (historicalAgenda) {
      const historicalDate = input.timeline.find(
        (timeline) => timeline.date && timeline.date < input.asOf!
      )?.date;
      if (input.status)
        assertAgendaTemporalModality(
          input.status,
          'status',
          historicalDate,
          input.asOf
        );
      if (input.limitation)
        assertAgendaTemporalModality(
          input.limitation,
          'limitation',
          historicalDate,
          input.asOf
        );
    }
  }
  const lines = [
    `# ${input.title}`,
    '',
    `${input.locality} · Updated ${input.updatedAt} · Model: ${input.model}`,
    '',
    `> ${LLM_CLAIM_GROUNDING_DISCLOSURE}`,
    '',
  ];
  if (input.titleOrigin)
    lines.push(
      `**Title source:** ${
        input.titleOrigin === 'evidence'
          ? 'deterministic evidence input'
          : 'LLM model'
      }`,
      ''
    );
  if (input.status) lines.push(`**Status:** ${input.status}`, '');
  lines.push(input.narrative, '', '## Timeline', '');
  for (const t of renderedTimeline) {
    lines.push(
      `- **${t.date ?? 'undated'}** — ${t.heading}${
        t.url ? ` [evidence](${t.url})` : ''
      }`
    );
    if (t.detail && t.detail !== t.heading) lines.push(`  ${t.detail}`);
    if (t.disclosure) lines.push(`  > ${t.disclosure}`);
  }
  lines.push('', '## Sources', '');
  for (const s of input.sources) {
    lines.push(`- ${s.title}${s.url ? ` [source](${s.url})` : ''}`);
    if (s.disclosure) lines.push(`  > ${s.disclosure}`);
  }
  if (input.limitation) lines.push('', `> ${input.limitation}`);
  if (input.meetings.length) {
    lines.push(
      '',
      `_Tracked across ${input.meetings.length} meetings: ${input.meetings.join(
        ', '
      )}_`
    );
  }
  const body = lines.join('\n');
  const jargon = renderJargonBuster(findJargon(body));
  const zoning = renderZoning(explainZoning(body));
  return [[body, jargon, zoning].filter(Boolean).join('\n'), ''].join('\n');
}

export function storyFilename(threadKey: string, inputHash?: string): string {
  const stem =
    threadKey
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
      .slice(0, 80) || 'story';
  const version = inputHash
    ?.replace(/[^a-f0-9]/gi, '')
    .toLowerCase()
    .slice(0, 64);
  return `${stem}${version ? `-${version}` : ''}.md`;
}
