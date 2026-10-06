import { In, type EntityManager } from 'typeorm';
import type { LocalityRegistry } from './locality-registry.js';
import {
  AgendaItemSchema,
  CanonicalStoryItemSchema,
  CanonicalStorySchema,
  CivicItemSchema,
  type CanonicalStoryRow,
} from './schema.js';

/**
 * Story engine. Each piece of evidence (a news item, or one agenda line) is
 * matched against open stories in related places (the same place, a place
 * containing it, or a place inside it). A match appends a dated update to
 * the story; otherwise the evidence opens a new story. Matching is
 * deterministic: shared case/resolution identifiers, shared coined names, and
 * then, between agenda lines, enough shared distinctive terms weighted by how
 * rare they are; wherever an article is involved, how similar the texts are.
 *
 * Articles are compared by their text, not their headlines. Headline wording
 * misleads both ways: formula headlines ("graduates achieve 100% pass rate")
 * share words across unrelated news, while a genuine follow-up is phrased
 * afresh ("blood shortage", then "blood crisis"). Against the Georgia labels
 * reviewed on 2026-09-22, comparing texts took recall from 0.54 to 1.00 with
 * no labeled story coming apart; the threshold was tuned by replay, since the
 * engine weighs a word's rarity across the evidence of the run it is in.
 */
export interface EvidenceUnit {
  civicItemId: number;
  agendaItemId: number | null;
  scopeSlug: string;
  scopeKind: string;
  kind: string;
  title: string;
  /** Text compared for matching: the agenda line, or an article headline. */
  text: string;
  /** For an article, its headline and the start of its body, compared by similarity; absent for agenda lines. */
  content?: string;
  canonicalUrl: string | null;
  date: string | null;
  explicitIds: readonly string[];
  /** Whole meeting documents without extracted lines are not matched ("Agenda 09/14/2026"). */
  matchable: boolean;
}

export interface EvidenceSignature {
  ids: readonly string[];
  /** Distinctive words and adjacent word pairs. */
  terms: readonly string[];
  /** Runs of three distinctive words ("land water conservation"). */
  phrases: readonly string[];
  /** An agenda line (formal item wording) rather than a headline. */
  agenda: boolean;
  /** Headline with its dates removed, when it carries a date ("Education Briefs Aug. 20"): a recurring feature. */
  series: string | null;
  /** Words of a columnist or feature label before a colon ("GARY WISENBAKER"), when the headline carries one. */
  column: readonly string[] | null;
  /** Words written like coined names, with internal capitals ("ThunderCon", "RecoveryFest"). Acronyms
   * (institutions such as a hospital or college) recur across unrelated stories, so they do not count. */
  names: readonly string[];
  /** Distinctive words of the text compared: an agenda line, or an article's headline and lead where it has enough of its own. */
  bag: readonly string[];
}

export interface StoryMatch {
  score: number;
  reason: string;
}

/** Minimum score for evidence to join an existing story. */
export const STORY_MATCH_THRESHOLD = 0.5;
/**
 * Text similarity at which an article joins a story; it maps onto
 * STORY_MATCH_THRESHOLD. Tuned by replaying the Georgia corpus against the
 * reviewed labels: below 0.3 the matcher joins unrelated notices from the
 * same office, above it the labeled stories start coming apart. A story that
 * comes apart hides the connection a reader needs, so where the sweep is
 * close the setting favours recall.
 */
export const TEXT_MATCH_THRESHOLD = 0.3;
/** How much of an article's body is compared: its lead, where the story is said. */
export const ARTICLE_LEAD_WORDS = 200;
/** Below this many words of its own, an article's body says too little to compare; its headline decides. */
export const ARTICLE_MIN_BODY_WORDS = 15;
/** Evidence joins a story only when its date is within this many days of the story's evidence. */
export const STORY_WINDOW_DAYS = 120;

const STOPWORDS = new Set(
  `a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your
    new old one two three four five six seven eight nine ten first second third said says per via
    agenda item items meeting meetings minutes session regular special called workshop public hearing hearings comment comments business
    city town county village borough state georgia council commission commissioners commissioner board mayor clerk manager director department office staff
    resolution resolutions ordinance ordinances approve approving approval approved authorize authorizing authorization amend amending amendment setting set adopt adopting adoption
    discussion discuss consider consideration considering proposal proposed proposing request requesting requested submitted submittal application recommendation award presentation report update updates
    tentative final regarding related consent agreement contract purchase fund funds fiscal year annual llc inc`
    .split(/\s+/u)
    .filter(Boolean)
);

/** Words of datelines and bylines, which every article repeats. */
const DATELINE_WORDS = new Set(
  `published updated am pm edt est monday tuesday wednesday thursday friday saturday sunday
  january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec
  special staff writer reporter editor contributed photo photos courtesy`
    .split(/\s+/u)
    .filter(Boolean)
);

function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies'))
    return `${token.slice(0, -3)}y`;
  if (
    token.length > 4 &&
    token.endsWith('s') &&
    !token.endsWith('ss') &&
    !token.endsWith('us')
  )
    return token.slice(0, -1);
  return token;
}

/** Case, zoning, resolution, and bid numbers such as "PP26-0016", "Resolution 26-03", "RFP# 2026-03". */
export function extractIdentifiers(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(
    /\b([A-Z]{1,5}\s?#?\s?\d{2,4}[-–]\d{2,5}[A-Z]?)\b/gu
  ))
    ids.add(match[1]!.toLowerCase().replace(/[^a-z0-9]/gu, ''));
  for (const match of text.matchAll(
    /\b(?:resolution|ordinance|case|matter|permit|petition|file|project|bid|rfp)\s*(?:no\.?|number|#)?\s*(\d{2,4}[-–]\d{1,5}[a-z]?)\b/giu
  ))
    ids.add(match[1]!.toLowerCase().replace(/[^a-z0-9]/gu, ''));
  return [...ids].filter((id) => id.length >= 4);
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']s\b/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      (token) =>
        token.length >= 3 && !/^\d+$/u.test(token) && !/^fy\d*$/u.test(token)
    )
    .map(stem);
}

/** Words of every place name and alias: a place name says where, not what the story is. */
export function placeWords(
  registry: Pick<LocalityRegistry, 'all'>
): Set<string> {
  return new Set(
    registry
      .all()
      .flatMap((locality) => [locality.name, ...(locality.aliases ?? [])])
      .flatMap(words)
  );
}

const DATE_IN_TITLE =
  /\b(?:jan|feb|mar|apr|may|june?|july?|aug|sept?|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/giu;
/** A columnist or series label before a colon: "GARY WISENBAKER: ...", "MOVIE REVIEWS: ...", "UPDATE: ...". */
const COLUMN_PREFIX = /^\s*[A-Z][A-Z .’'&-]*[A-Z]\s*:\s*/u;

export function evidenceSignature(
  unit: Pick<EvidenceUnit, 'text' | 'explicitIds'> & {
    agendaItemId?: number | null;
    content?: string;
  },
  places: ReadonlySet<string> = new Set()
): EvidenceSignature {
  const agenda = unit.agendaItemId !== undefined && unit.agendaItemId !== null;
  const headline = agenda ? unit.text : unit.text.replace(COLUMN_PREFIX, '');
  const text = headline.replace(/\([^)]*\)/gu, ' ');
  const tokens = words(text).filter(
    (token) => !STOPWORDS.has(token) && !places.has(token)
  );
  const terms = new Set(tokens);
  for (let index = 1; index < tokens.length; index += 1)
    terms.add(`${tokens[index - 1]} ${tokens[index]}`);
  const phrases = new Set<string>();
  for (let index = 2; index < tokens.length; index += 1)
    phrases.add(`${tokens[index - 2]} ${tokens[index - 1]} ${tokens[index]}`);
  const dated = !agenda && DATE_IN_TITLE.test(unit.text);
  DATE_IN_TITLE.lastIndex = 0;
  const series = dated
    ? words(headline.replace(DATE_IN_TITLE, ' '))
        .filter((token) => !STOPWORDS.has(token) && !places.has(token))
        .join(' ')
    : null;
  const label = agenda ? null : COLUMN_PREFIX.exec(unit.text)?.[0];
  const column = label ? words(label) : null;
  const names = [
    ...new Set(
      text
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => /\p{Ll}\p{Lu}/u.test(word))
        .flatMap(words)
        .filter((token) => !STOPWORDS.has(token) && !places.has(token))
    ),
  ];
  // An agenda line is all text and no boilerplate, so it compares as it stands.
  const compared = agenda ? text : unit.content;
  const bag = compared
    ? words(compared.replace(/\([^)]*\)/gu, ' ')).filter(
        (token) =>
          !STOPWORDS.has(token) &&
          !DATELINE_WORDS.has(token) &&
          !places.has(token)
      )
    : [];
  return {
    ids: [
      ...new Set([
        ...unit.explicitIds.map((id) =>
          id.toLowerCase().replace(/[^a-z0-9]/gu, '')
        ),
        ...extractIdentifiers(unit.text),
      ]),
    ],
    terms: [...terms],
    phrases: [...phrases],
    agenda,
    series,
    column,
    names,
    bag,
  };
}

export type TermWeights = ((term: string) => number) & {
  frequency(term: string): number;
  /** Inverse document frequency of a word across the texts compared. */
  rarity(token: string): number;
};

/** Inverse document frequency over a set of signatures: for headline terms, and for the words of whole texts. */
export function termWeights(
  signatures: readonly EvidenceSignature[]
): TermWeights {
  const frequency = new Map<string, number>();
  const documents = new Map<string, number>();
  for (const signature of signatures) {
    for (const term of new Set(signature.terms))
      frequency.set(term, (frequency.get(term) ?? 0) + 1);
    for (const token of new Set(signature.bag))
      documents.set(token, (documents.get(token) ?? 0) + 1);
  }
  const total = signatures.length;
  const weight = (term: string) =>
    (Math.log((total + 1) / ((frequency.get(term) ?? 0) + 1)) + 1) *
    (term.includes(' ') ? 1.5 : 1);
  return Object.assign(weight, {
    frequency: (term: string) => frequency.get(term) ?? 0,
    rarity: (token: string) =>
      Math.log((total + 1) / ((documents.get(token) ?? 0) + 1)),
  });
}

/** Cosine similarity of two texts' words, weighted by how often each occurs and how rare it is. */
export function textSimilarity(
  a: readonly string[],
  b: readonly string[],
  rarity: (token: string) => number
): { score: number; shared: string[] } {
  const vector = (tokens: readonly string[]) => {
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    return new Map(
      [...counts].map(([token, count]) => [
        token,
        (1 + Math.log(count)) * rarity(token),
      ])
    );
  };
  const va = vector(a);
  const vb = vector(b);
  let dot = 0;
  const shared: [string, number][] = [];
  for (const [token, value] of va) {
    const other = vb.get(token);
    if (other) {
      dot += value * other;
      shared.push([token, value * other]);
    }
  }
  const norm = (v: Map<string, number>) =>
    Math.sqrt([...v.values()].reduce((sum, value) => sum + value * value, 0));
  const denominator = norm(va) * norm(vb);
  return {
    score: denominator ? dot / denominator : 0,
    shared: shared.sort((x, y) => y[1] - x[1]).map(([token]) => token),
  };
}

/** A coined name ("ThunderCon") that few headlines share usually identifies one thing. */
const RARE_NAME_MAX_FREQUENCY = 3;

export function scoreEvidence(
  a: EvidenceSignature,
  b: EvidenceSignature,
  weight: TermWeights | ((term: string) => number)
): StoryMatch {
  const sharedId = a.ids.find((id) => b.ids.includes(id));
  if (sharedId) return { score: 1, reason: `shared identifier ${sharedId}` };
  // Dated recurring features ("Education Briefs Aug. 13" / "Aug. 20") are separate editions, not one story.
  if (a.series && a.series === b.series)
    return { score: 0, reason: 'recurring feature' };
  // A column's label ("ADANN ALEXXANDAR MOVIE REVIEWS: ...") marks separate editions of a
  // recurring column the same way. Its byline varies between editions, so two words in
  // common are enough; one is not, since "UPDATE:" is a prefix rather than a column.
  if (
    a.column &&
    b.column &&
    a.column.filter((word) => b.column?.includes(word)).length >= 2
  ) {
    return { score: 0, reason: 'recurring column' };
  }
  // Formal agenda wording repeats three-word phrases for the same matter; headlines reuse
  // formulas ("achieve 100% pass rate") for unrelated news, so phrases count only with an agenda line.
  const sharedPhrase =
    a.agenda || b.agenda
      ? a.phrases.find((phrase) => b.phrases.includes(phrase))
      : undefined;
  if (sharedPhrase)
    return { score: 0.9, reason: `shared phrase: ${sharedPhrase}` };
  const bTerms = new Set(b.terms);
  const shared = a.terms.filter((term) => bTerms.has(term));
  const sharedBigrams = shared.filter((term) => term.includes(' '));
  const sharedUnigrams = shared.filter((term) => !term.includes(' '));
  const frequency = 'frequency' in weight ? weight.frequency : undefined;
  const rare = frequency
    ? a.names.find(
        (name) =>
          b.names.includes(name) && frequency(name) <= RARE_NAME_MAX_FREQUENCY
      )
    : undefined;
  if (rare) return { score: 0.8, reason: `shared rare name: ${rare}` };
  const byTerms = (): StoryMatch => {
    if (!sharedBigrams.length && sharedUnigrams.length < 2)
      return { score: 0, reason: 'no distinctive shared terms' };
    const total = (terms: readonly string[]) =>
      terms.reduce((sum, term) => sum + weight(term), 0);
    const denominator = Math.min(total(a.terms), total(b.terms));
    const score = denominator ? total(shared) / denominator : 0;
    return {
      score: Math.round(score * 1000) / 1000,
      reason: `shared terms: ${[...sharedBigrams, ...sharedUnigrams]
        .slice(0, 6)
        .join(', ')}`,
    };
  };
  // Wherever an article is involved the texts are compared as wholes, which joins follow-ups
  // worded differently from the first report. It is a second way to match, not a replacement:
  // whichever reading is stronger decides, so nothing that joined on its headline stops joining.
  if (
    (!a.agenda || !b.agenda) &&
    a.bag.length &&
    b.bag.length &&
    'rarity' in weight
  ) {
    const similar = textSimilarity(a.bag, b.bag, weight.rarity);
    const score = Math.min(
      1,
      Math.round(
        ((STORY_MATCH_THRESHOLD * similar.score) / TEXT_MATCH_THRESHOLD) * 1000
      ) / 1000
    );
    const terms = byTerms();
    if (score >= terms.score)
      return {
        score,
        reason: `similar text (${similar.score.toFixed(3)}): ${similar.shared
          .slice(0, 5)
          .join(', ')}`,
      };
    return terms;
  }
  return byTerms();
}

function daysBetween(a: string, b: string): number {
  return (
    Math.abs(
      Date.parse(`${a.slice(0, 10)}T00:00:00Z`) -
        Date.parse(`${b.slice(0, 10)}T00:00:00Z`)
    ) / 86_400_000
  );
}

/** A readable story title from a piece of evidence ("4. Discussion - FY 27 Millage Rate (Staff)" → "FY 27 Millage Rate"). */
export function storyTitle(title: string): string {
  const cleaned =
    title
      .replace(/^\d{1,2}\.\s*/u, '')
      .replace(/\s*\([^)]*\)\s*$/u, '')
      .replace(/^discussion\s*[-–—:]\s*/iu, '')
      // Drop applicant details: "Zoning Application PP26-0016 – Submitted by ...".
      .replace(
        /\s*[,–—-]\s*(?:submitted|requested|requesting|located)\b.*$/iu,
        ''
      )
      .replace(/[…]$/u, '')
      .replace(/\s+/gu, ' ')
      .trim() || title.trim();
  if (cleaned.length <= 90) return cleaned;
  const cut = cleaned.slice(0, 90);
  return `${cut
    .slice(0, cut.lastIndexOf(' ') > 50 ? cut.lastIndexOf(' ') : 90)
    .trim()}…`;
}

function unitKey(
  civicItemId: number,
  agendaItemId: number | null | undefined
): string {
  return `${civicItemId}:${agendaItemId ?? 'item'}`;
}

interface StoryState {
  story: CanonicalStoryRow;
  units: { unit: EvidenceUnit; signature: EvidenceSignature }[];
}

const sentences = (body: string | null | undefined): string[] =>
  (body ?? '')
    .split(/\n+|(?<=[.!?])\s+/u)
    .map((part) => part.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);

/**
 * Publishers repeat themselves: a subscription pitch, a byline, a series'
 * standing introduction, a note to call for more information. Those sentences
 * say nothing about the article, and left in they make everything one
 * publisher prints read alike — for a restricted source, whose body is the
 * pitch and little else, they are most of the text. A sentence a source
 * repeats is not what an article is about, so it is dropped before the texts
 * are compared. A follow-up that repeats a line of background loses that
 * line, and is matched on the rest.
 */
function repeatedSentences(
  items: readonly { sourceId?: string | null; body?: string | null }[]
): Map<string, Set<string>> {
  const counts = new Map<string, Map<string, number>>();
  for (const item of items) {
    const source = item.sourceId ?? '';
    const seen = counts.get(source) ?? new Map<string, number>();
    for (const sentence of new Set(sentences(item.body)))
      seen.set(sentence, (seen.get(sentence) ?? 0) + 1);
    counts.set(source, seen);
  }
  return new Map(
    [...counts].map(([source, seen]) => [
      source,
      new Set(
        [...seen].filter(([, count]) => count > 1).map(([sentence]) => sentence)
      ),
    ])
  );
}

/** An article's own words: its body without the sentences its publisher repeats elsewhere. */
function ownWords(
  item: { body?: string | null },
  repeated: ReadonlySet<string> | undefined
): string[] {
  return sentences(item.body)
    .filter((sentence) => !repeated?.has(sentence))
    .join(' ')
    .split(/\s+/u)
    .filter(Boolean);
}

/** Evidence units for stored civic items: one per non-procedural agenda line, otherwise one per item. */
export async function evidenceUnitsFor(
  manager: Pick<EntityManager, 'getRepository'>,
  itemIds: readonly number[],
  timezoneDate: (item: {
    eventDate?: string | null;
    publishedAt?: string | null;
    observedAt?: string | null;
  }) => string | null
): Promise<EvidenceUnit[]> {
  if (!itemIds.length) return [];
  const items = await manager
    .getRepository(CivicItemSchema)
    // Unit order feeds clustering and tie-breaks; pin it to insertion order.
    .find({ where: { id: In([...itemIds]) }, order: { id: 'ASC' } });
  const agenda = await manager.getRepository(AgendaItemSchema).find({
    where: { itemId: In([...itemIds]), procedural: false },
    order: { id: 'ASC' },
  });
  const agendaByItem = new Map<number, typeof agenda>();
  for (const row of agenda)
    agendaByItem.set(row.itemId, [
      ...(agendaByItem.get(row.itemId) ?? []),
      row,
    ]);
  const boilerplate = repeatedSentences(items);
  const units: EvidenceUnit[] = [];
  for (const item of items) {
    if (!item.scopeSlug || !item.scopeKind || item.id === undefined) continue;
    const explicitIds = [item.caseId, item.matterId, item.permitId].filter(
      (value): value is string => Boolean(value && value.trim())
    );
    const base = {
      civicItemId: item.id,
      scopeSlug: item.scopeSlug,
      scopeKind: item.scopeKind,
      kind: item.kind,
      canonicalUrl: item.canonicalUrl ?? null,
      explicitIds,
    };
    const rows = item.kind === 'meeting' ? agendaByItem.get(item.id) ?? [] : [];
    if (rows.length) {
      for (const row of rows)
        units.push({
          ...base,
          agendaItemId: row.id as number,
          title: row.heading,
          text: row.heading,
          date: row.meetingDate?.slice(0, 10) ?? timezoneDate(item),
          matchable: true,
        });
    } else {
      // An article is compared by its headline and the start of what it says, minus the
      // sentences its publisher repeats. Identifiers in the lead still count, and alerts
      // never form stories by wording.
      const lead =
        (item.body ?? '').split(/(?<=[.!?])\s+/u)[0]?.slice(0, 300) ?? '';
      const own = ownWords(item, boilerplate.get(item.sourceId ?? ''));
      const content =
        own.length >= ARTICLE_MIN_BODY_WORDS
          ? `${item.title}\n${own.slice(0, ARTICLE_LEAD_WORDS).join(' ')}`
          : undefined;
      units.push({
        ...base,
        explicitIds: [...explicitIds, ...extractIdentifiers(lead)],
        agendaItemId: null,
        title: item.title,
        text: item.title,
        content,
        date: timezoneDate(item),
        matchable: item.kind !== 'meeting' && item.kind !== 'alert',
      });
    }
  }
  return units.sort(
    (a, b) =>
      (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
      a.civicItemId - b.civicItemId ||
      (a.agendaItemId ?? 0) - (b.agendaItemId ?? 0)
  );
}

/**
 * Link each evidence unit to a story, opening stories as needed. Units that
 * are already linked keep their story. Returns the story ID for every unit.
 */
export async function assignStories(
  manager: EntityManager,
  units: readonly EvidenceUnit[],
  registry: LocalityRegistry,
  timezoneDate: Parameters<typeof evidenceUnitsFor>[2]
): Promise<Map<string, number>> {
  const assigned = new Map<string, number>();
  if (!units.length) return assigned;
  const storyRepo = manager.getRepository(CanonicalStorySchema);
  const linkRepo = manager.getRepository(CanonicalStoryItemSchema);
  const related = (slug: string): string[] => {
    try {
      return [
        slug,
        ...registry.ancestors(slug).map((locality) => locality.slug),
        ...registry.descendants(slug).map((locality) => locality.slug),
      ];
    } catch {
      return [slug];
    }
  };
  const scopes = [...new Set(units.flatMap((unit) => related(unit.scopeSlug)))];
  const dated = units
    .map((unit) => unit.date)
    .filter((date): date is string => Boolean(date))
    .sort();
  const earliest = dated[0];
  const candidates =
    // Candidate order decides which story wins a matching tie; pin it to insertion order.
    (
      await storyRepo.find({
        where: { scopeSlug: In(scopes) },
        order: { id: 'ASC' },
      })
    ).filter(
      (story) =>
        !earliest ||
        !story.lastEvidenceDate ||
        daysBetween(story.lastEvidenceDate, earliest) <= STORY_WINDOW_DAYS ||
        story.lastEvidenceDate > earliest
    );
  const links = candidates.length
    ? await linkRepo.find({
        where: {
          canonicalStoryId: In(candidates.map((story) => story.id as number)),
        },
        // Per-story unit order feeds matching; pin it to insertion order.
        order: { id: 'ASC' },
      })
    : [];
  const existingUnits = await evidenceUnitsFor(
    manager,
    [...new Set(links.map((link) => link.civicItemId))],
    timezoneDate
  );
  const existingByKey = new Map(
    existingUnits.map((unit) => [
      unitKey(unit.civicItemId, unit.agendaItemId),
      unit,
    ])
  );
  const places = placeWords(registry);
  const states = new Map<number, StoryState>(
    candidates.map((story) => [story.id as number, { story, units: [] }])
  );
  const linkedKeys = new Map<string, number>();
  for (const link of links) {
    const key = unitKey(link.civicItemId, link.agendaItemId);
    linkedKeys.set(key, link.canonicalStoryId);
    const unit = existingByKey.get(key);
    if (unit)
      states
        .get(link.canonicalStoryId)
        ?.units.push({ unit, signature: evidenceSignature(unit, places) });
  }
  // Units linked to stories outside the candidate window keep those links.
  const pendingKeys = units
    .map((unit) => unitKey(unit.civicItemId, unit.agendaItemId))
    .filter((key) => !linkedKeys.has(key));
  if (pendingKeys.length) {
    const itemIds = [...new Set(units.map((unit) => unit.civicItemId))];
    for (const link of await linkRepo.find({
      where: { civicItemId: In(itemIds) },
    }))
      linkedKeys.set(
        unitKey(link.civicItemId, link.agendaItemId),
        link.canonicalStoryId
      );
  }
  const signatures = new Map(
    units.map((unit) => [
      unitKey(unit.civicItemId, unit.agendaItemId),
      evidenceSignature(unit, places),
    ])
  );
  const weight = termWeights([
    ...signatures.values(),
    ...[...states.values()].flatMap((state) =>
      state.units.map((entry) => entry.signature)
    ),
  ]);
  const now = new Date().toISOString();
  for (const unit of units) {
    const key = unitKey(unit.civicItemId, unit.agendaItemId);
    const linked = linkedKeys.get(key);
    if (linked !== undefined) {
      assigned.set(key, linked);
      continue;
    }
    const signature = signatures.get(key)!;
    const unitScopes = new Set(related(unit.scopeSlug));
    let best: { state: StoryState; match: StoryMatch } | null = null;
    if (unit.matchable) {
      for (const state of states.values()) {
        if (!unitScopes.has(state.story.scopeSlug)) continue;
        for (const entry of state.units) {
          if (!entry.unit.matchable) continue;
          if (
            unit.date &&
            entry.unit.date &&
            daysBetween(unit.date, entry.unit.date) > STORY_WINDOW_DAYS
          )
            continue;
          // Agenda lines share their document's URL, so only whole items match by URL.
          const sameUrl =
            unit.agendaItemId === null &&
            entry.unit.agendaItemId === null &&
            unit.canonicalUrl &&
            entry.unit.canonicalUrl === unit.canonicalUrl;
          const match = sameUrl
            ? { score: 1, reason: 'same article URL' }
            : scoreEvidence(signature, entry.signature, weight);
          if (
            match.score >= STORY_MATCH_THRESHOLD &&
            (!best || match.score > best.match.score)
          )
            best = { state, match };
        }
      }
    }
    let state = best?.state;
    if (!state) {
      const storyKey = `evidence:${key}`;
      await storyRepo.upsert(
        {
          scopeSlug: unit.scopeSlug,
          scopeKind: unit.scopeKind,
          storyKey,
          strategy: 'engine',
          title: storyTitle(unit.title),
          status: 'open',
          createdAt: now,
          updatedAt: now,
          lastEvidenceDate: unit.date,
        },
        ['scopeSlug', 'scopeKind', 'storyKey']
      );
      const story = (await storyRepo.findOneBy({
        scopeSlug: unit.scopeSlug,
        scopeKind: unit.scopeKind,
        storyKey,
      }))!;
      state = { story, units: [] };
      states.set(story.id as number, state);
    }
    const storyId = state.story.id as number;
    await linkRepo.insert({
      canonicalStoryId: storyId,
      civicItemId: unit.civicItemId,
      agendaItemId: unit.agendaItemId,
      evidenceDate: unit.date,
      matchReason: best ? best.match.reason : 'opened',
      matchScore: best ? best.match.score : null,
      createdAt: now,
    });
    if (best) {
      // Only evidence from the story's own place retitles it: a town article
      // in a county story must not rename the story in a sibling town's edition.
      const article =
        unit.agendaItemId === null &&
        unit.kind !== 'meeting' &&
        unit.scopeSlug === state.story.scopeSlug;
      const lastEvidenceDate =
        [state.story.lastEvidenceDate, unit.date]
          .filter((date): date is string => Boolean(date))
          .sort()
          .at(-1) ?? null;
      const title = article ? storyTitle(unit.title) : state.story.title;
      await storyRepo.update(
        { id: storyId },
        { lastEvidenceDate, title, updatedAt: now }
      );
      state.story = { ...state.story, lastEvidenceDate, title, updatedAt: now };
    }
    state.units.push({ unit, signature });
    linkedKeys.set(key, storyId);
    assigned.set(key, storyId);
  }
  return assigned;
}
