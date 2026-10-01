import type {
  CommunityCorrection,
  CommunityQuote,
} from './community-evidence.js';
import { findJargon, renderJargonBuster } from './glossary.js';
import { explainZoning, renderZoning } from './zoning.js';
import { LLM_CLAIM_GROUNDING_DISCLOSURE } from './story.js';

export const DETERMINISTIC_QUIET_DAY_DISCLOSURE =
  'Deterministic quiet-day edition; no LLM generation; background is carried forward only from verified, dated evidence.';
export const DETERMINISTIC_NEWS_DISCLOSURE =
  'Deterministic edition; no LLM generation; each record is reported by its own title and date.';
export const INITIAL_BRIEFING_DISCLOSURE =
  'Initial briefing; no previous daily edition exists, so this report summarizes available context without a day-over-day comparison.';

export interface OutsiderSection {
  heading: string;
  summary: string;
  items: { title: string; date?: string; url?: string; disclosure?: string }[];
}

export interface StoryUpdate {
  date?: string;
  text: string;
  /** Article lead for news updates. */
  detail?: string;
  url?: string;
  /** Dated inside this edition's period. */
  current: boolean;
}

export interface OutsiderThread {
  heading: string;
  history: string;
  meetings: string[];
  story?: string;
  links: { title: string; url?: string; publisher?: string | null }[];
  /** Dated evidence, oldest first. When present it replaces the flat link list. */
  updates?: StoryUpdate[];
  /** The record of what was decided, when one exists. */
  outcome?: { date?: string; text: string; url?: string };
  /** The story's latest record is a scheduled item and no decision is published. */
  outcomePending?: boolean;
  disclosure?: string;
}

/**
 * Bold text from a source's own words. Markdown only bolds `**x**` when no
 * space sits inside the markers, so a headline ending in a space rendered
 * as literal asterisks; whitespace is collapsed and trimmed, and asterisks
 * in the headline itself are escaped so they cannot close the bold early.
 */
export function boldHeadline(text: string): string {
  const clean = text.replace(/\s+/gu, ' ').trim().replace(/\*/gu, '\\*');
  return clean ? `**${clean}**` : '';
}

/** How a quotation got here, in one line the reader can check. */
function describePath(quote: CommunityQuote): string {
  if (quote.path === 'official-record')
    return '*Submitted through an official account the operator confirmed by calling the number the town publishes.*';
  if (quote.path === 'authenticated-artifact')
    return '*Submitted with a document whose provenance was established.*';
  const record = quote.confirmedBy;
  const where = record
    ? `${record.title}${record.date ? `, ${record.date}` : ''}${
        record.publisher ? ` (${record.publisher})` : ''
      }`
    : 'a later record';
  const link = record?.url ? ` [source](${record.url})` : '';
  return `*A resident's report, corroborated independently and borne out by ${where}${link}. Daylight quotes it; it is not Daylight's own account.*`;
}

function renderUpdate(update: StoryUpdate): string {
  return `${update.date ?? 'undated'} — ${update.text}${
    update.url ? ` [source](${update.url})` : ''
  }`;
}

export interface OutsiderBriefing {
  locality: string;
  /** Daily editions are titled by edition date; weekly ones by week. */
  cadence?: import('./types.js').Cadence;
  periodStart: string;
  periodEnd: string;
  lede: string;
  inBrief: string[];
  newItems: { title: string; date?: string; impact?: string; url?: string }[];
  upcoming: {
    title: string;
    date?: string;
    url?: string;
    disclosure?: string;
  }[];
  /** Agenda lines that are not (yet) stories, grouped by meeting. */
  agendas?: { title: string; date?: string; url?: string; items: string[] }[];
  /** Earlier records in the context window, listed on a town's first edition. */
  recentContext?: { title: string; date?: string; url?: string }[];
  threads: OutsiderThread[];
  /** What the community sent that took the narrow path, and the corrections owed. */
  community?: {
    quotes: readonly CommunityQuote[];
    corrections: readonly CommunityCorrection[];
  };
  appendix: {
    heading: string;
    items: {
      title: string;
      date?: string;
      url?: string;
      disclosure?: string;
    }[];
  }[];
  sourceCount: number;
  model: string;
  editionMode?: import('./types.js').EditionMode;
  contextSince?: string;
  coverageRange?: { start: string; end: string };
  generationId?: number;
  generatedAt?: string;
  sourceFreshness?: {
    sourceKey: string;
    sourceName?: string;
    observedAt?: string | null;
    fetchedAt?: string | null;
    basis?: 'observed' | 'fetched-fallback' | 'unavailable';
  }[];
  discoveryNotes?: string[];
}

/**
 * Outsider-first briefing: lede → 3-bullet brief → new → upcoming →
 * stories → compact source appendix. No 28-link dumps in the body.
 */
export function assembleOutsiderBriefing(input: OutsiderBriefing): string {
  const initialContext =
    input.editionMode === 'bootstrap' || input.editionMode === 'initial-empty';
  const lines: string[] = [
    input.cadence === 'daily'
      ? `# ${input.locality} — daily briefing, ${input.periodEnd}`
      : `# ${input.locality} — week of ${input.periodEnd}`,
    '',
    input.lede,
    '',
    `*${input.periodStart} to ${input.periodEnd} · ${input.sourceCount} sources · Model: ${input.model}*`,
    `> ${
      input.editionMode === 'initial-empty'
        ? INITIAL_BRIEFING_DISCLOSURE
        : input.editionMode === 'bootstrap'
        ? 'Initial briefing; this first report summarizes the available context. All factual claims are grounded in cited evidence.'
        : input.model === 'deterministic-quiet-day'
        ? DETERMINISTIC_QUIET_DAY_DISCLOSURE
        : LLM_CLAIM_GROUNDING_DISCLOSURE
    }`,
    '',
  ];
  // The first bullet is the lead: evidence reaches the model in editorial
  // order, so bullet one is the day's most consequential item. It reads as a
  // paragraph; the rest stay a scannable list.
  const [lead, ...rest] = input.inBrief;
  // An edition with nothing to report has no lead; it says so under the plain
  // heading rather than dressing an empty day up as the day's top story.
  const hasReporting =
    Boolean(lead) &&
    (rest.length > 0 || input.newItems.length > 0 || input.threads.length > 0);
  if (hasReporting) {
    lines.push('## The lead', '', lead!, '');
    if (rest.length)
      lines.push(
        input.cadence === 'daily' ? '## Also today' : '## Also this week',
        '',
        ...rest.map((b) => `- ${b}`),
        ''
      );
  } else {
    lines.push(
      '## In brief',
      '',
      ...(lead ? [`- ${lead}`] : ['- No civic items in this period.']),
      ''
    );
  }
  if (input.newItems.length) {
    lines.push(
      initialContext
        ? '## Available context'
        : input.cadence === 'daily'
        ? '## New today'
        : '## New this week',
      ''
    );
    for (const item of input.newItems) {
      const when = item.date ? ` (${item.date})` : '';
      const link = item.url ? ` [source](${item.url})` : '';
      lines.push(`- ${boldHeadline(item.title)}${when}${link}`);
      if (item.impact) lines.push(`  ${item.impact}`);
    }
    lines.push('');
  }
  if (input.upcoming.length) {
    lines.push('## Coming up', '');
    for (const item of input.upcoming) {
      const when = item.date ? ` (${item.date})` : '';
      const link = item.url ? ` [source](${item.url})` : '';
      lines.push(`- ${boldHeadline(item.title)}${when}${link}`);
      if (item.disclosure) lines.push(`  ${item.disclosure}`);
    }
    lines.push('');
  }
  const agendas = (input.agendas ?? []).filter(
    (meeting) => meeting.items.length
  );
  if (agendas.length) {
    lines.push('## On the agenda', '');
    for (const meeting of agendas) {
      const when = meeting.date ? ` (${meeting.date})` : '';
      const link = meeting.url ? ` [source](${meeting.url})` : '';
      lines.push(`- ${boldHeadline(meeting.title)}${when}${link}`);
      for (const item of meeting.items) lines.push(`  - ${item}`);
    }
    lines.push('');
  }
  const renderThreads = (
    heading: string,
    threads: readonly OutsiderThread[]
  ) => {
    if (!threads.length) return;
    lines.push(heading, '');
    for (const thread of threads) {
      const span =
        thread.meetings.length > 1
          ? ` (${thread.meetings[thread.meetings.length - 1]} ← ${
              thread.meetings[0]
            })`
          : thread.meetings.length === 1
          ? ` (${thread.meetings[0]})`
          : '';
      lines.push(`### ${thread.heading}${span}`, '');
      if (thread.history) lines.push(thread.history, '');
      // What a reader wants first: was it decided, and where is that on the record.
      if (thread.outcome)
        lines.push(
          `**What happened:** ${
            thread.outcome.date ? `${thread.outcome.date} — ` : ''
          }${thread.outcome.text}${
            thread.outcome.url ? ` [source](${thread.outcome.url})` : ''
          }`,
          ''
        );
      else if (thread.outcomePending)
        lines.push(
          '**What happened:** no decision is on the public record yet.',
          ''
        );
      if (thread.disclosure) lines.push(`> ${thread.disclosure}`, '');
      if (thread.story)
        lines.push(`*Full story: [${thread.heading}](${thread.story})*`, '');
      if (thread.updates?.length) {
        const latest = thread.updates[thread.updates.length - 1]!;
        const earlier = thread.updates.slice(0, -1).reverse();
        // The outcome line already named this record; don't print it twice.
        const latestIsOutcome = Boolean(
          thread.outcome?.url && latest.url && thread.outcome.url === latest.url
        );
        if (!latestIsOutcome)
          lines.push(
            `**${latest.current ? 'New' : 'Latest'}:** ${renderUpdate(latest)}`
          );
        if (latest.detail) lines.push('', latest.detail);
        lines.push('');
        if (earlier.length) {
          lines.push('Previously:');
          for (const update of earlier)
            lines.push(
              `- ${update.current ? '**New:** ' : ''}${renderUpdate(update)}`
            );
          lines.push('');
        }
        continue;
      }
      const seenLinks = new Set<string>();
      for (const link of thread.links) {
        const linkKey = `${link.title}\u0000${link.url ?? ''}`;
        if (seenLinks.has(linkKey)) continue;
        seenLinks.add(linkKey);
        lines.push(
          `- ${link.title}${link.publisher ? ` — ${link.publisher}` : ''}${
            link.url ? ` [source](${link.url})` : ''
          }`
        );
      }
      if (thread.links.length) lines.push('');
    }
  };
  const hasUpdates = input.threads.some((thread) => thread.updates);
  if (hasUpdates) {
    renderThreads(
      '## Story updates',
      input.threads.filter((thread) =>
        thread.updates?.some((update) => update.current)
      )
    );
    renderThreads(
      '## Ongoing stories',
      input.threads.filter(
        (thread) => !thread.updates?.some((update) => update.current)
      )
    );
  } else {
    renderThreads('## Stories', input.threads);
  }
  // Community material is quoted and attributed, never restated. A briefing
  // that paraphrased a resident's account would be making the claim itself;
  // here the platform hosts what someone said, with what let it through.
  const community = input.community;
  if (community?.quotes.length) {
    lines.push('## From the community', '');
    for (const quote of community.quotes) {
      const who = quote.office
        ? `${quote.attribution}, ${quote.office}`
        : quote.attribution;
      const when = quote.occurredOn ? `, ${quote.occurredOn}` : '';
      for (const line of quote.quote.split(/\n+/u))
        lines.push(`> ${line.trim()}`);
      lines.push(
        '>',
        `> — ${who}${when}${
          quote.url ? ` ([their report](${quote.url}))` : ''
        }`,
        ''
      );
      lines.push(`${describePath(quote)}`, '');
    }
  }
  if (community?.corrections.length) {
    lines.push('## Corrections', '');
    for (const correction of community.corrections)
      lines.push(`- **${correction.at}** — ${correction.text}`);
    lines.push('');
  }
  if (input.recentContext?.length) {
    lines.push('## Also noted', '');
    for (const item of input.recentContext)
      lines.push(
        `- ${item.title}${item.date ? ` (${item.date})` : ''}${
          item.url ? ` [source](${item.url})` : ''
        }`
      );
    lines.push('');
  }
  if (input.discoveryNotes?.length) {
    lines.push('## Discovery / coverage notes', '');
    for (const note of input.discoveryNotes) lines.push(`- ${note}`);
    lines.push('');
  }
  if (input.appendix.length) {
    lines.push('<details>', '<summary>All sources</summary>', '');
    for (const section of input.appendix) {
      lines.push(`**${section.heading}**`, '');
      for (const item of section.items) {
        const when = item.date ? ` (${item.date})` : '';
        const link = item.url ? ` [source](${item.url})` : '';
        lines.push(`- ${item.title}${when}${link}`);
        if (item.disclosure) lines.push(`  ${item.disclosure}`);
      }
      lines.push('');
    }
    lines.push('</details>', '');
  }
  if (input.sourceFreshness?.length) {
    lines.push('## Source freshness', '');
    for (const source of input.sourceFreshness) {
      const freshness = source.observedAt
        ? ` — observed ${source.observedAt}`
        : source.fetchedAt
        ? ` — fetched ${source.fetchedAt} (item observation unavailable)`
        : ' — observation and fetch time unavailable';
      lines.push(`- ${source.sourceName ?? 'Configured source'}${freshness}`);
    }
    lines.push('');
  }
  // Run provenance belongs on the page, but under the reporting, not above it.
  if (
    input.contextSince ||
    input.coverageRange ||
    input.generationId !== undefined ||
    input.generatedAt
  ) {
    lines.push(
      '<details>',
      '<summary>How this edition was made</summary>',
      '',
      `- Story context: ${
        input.contextSince ?? input.coverageRange?.start ?? 'not recorded'
      } to ${input.coverageRange?.end ?? input.periodEnd}`,
      `- Brief generation: ${input.generationId ?? 'not recorded'}${
        input.generatedAt ? ` at ${input.generatedAt}` : ''
      }`,
      '',
      '</details>',
      ''
    );
  }
  const body = lines.join('\n');
  const jargon = renderJargonBuster(findJargon(body));
  const zoning = renderZoning(explainZoning(body));
  return [body, jargon, zoning].filter(Boolean).join('\n');
}

/** One claim of the article, with the numbers of the sources it rests on. */
export interface ArticleClaim {
  text: string;
  sources: number[];
  limitation?: string;
}

/** A source the article cites, numbered by first citation. */
export interface ArticleSource {
  title: string;
  url?: string;
  publisher?: string | null;
  date?: string;
}

export interface ArticleEdition {
  locality: string;
  cadence?: import('./types.js').Cadence;
  periodStart: string;
  periodEnd: string;
  headline: string;
  paragraphs: { claims: ArticleClaim[] }[];
  sources: ArticleSource[];
  /** Dated meetings and notices still ahead. */
  upcoming: {
    title: string;
    date?: string;
    url?: string;
    disclosure?: string;
  }[];
  community?: {
    quotes: readonly CommunityQuote[];
    corrections: readonly CommunityCorrection[];
  };
  sourceCount: number;
  model: string;
  disclosure: string;
  contextSince?: string;
  coverageRange?: { start: string; end: string };
  generationId?: number;
  generatedAt?: string;
  sourceFreshness?: OutsiderBriefing['sourceFreshness'];
}

function sourceKey(sources: readonly number[]): string {
  return [...new Set(sources)].sort((a, b) => a - b).join(',');
}

/** Consecutive paragraphs that rest on exactly the same sources are one
 * matter; a small model often gives each of its sentences a paragraph. */
function mergeSameSourceParagraphs(
  paragraphs: ArticleEdition['paragraphs']
): ArticleEdition['paragraphs'] {
  const merged: { claims: ArticleClaim[] }[] = [];
  let previousKey: string | undefined;
  for (const paragraph of paragraphs) {
    const keys = new Set(
      paragraph.claims.map((claim) => sourceKey(claim.sources))
    );
    const key = keys.size === 1 ? [...keys][0] : undefined;
    const last = merged.at(-1);
    if (last && key && key === previousKey)
      last.claims.push(...paragraph.claims);
    else merged.push({ claims: [...paragraph.claims] });
    previousKey = key;
  }
  return merged;
}

/**
 * The edition as a news article: a headline, paragraphs of cited claims, what
 * is coming up, and the numbered sources. Citations are numbers that link to
 * the source and match the list below, the way a reader expects a news story
 * to show its work.
 */
export function assembleArticleEdition(input: ArticleEdition): string {
  const cite = (numbers: readonly number[]) =>
    numbers
      .map((number) => {
        const source = input.sources[number - 1];
        return source?.url
          ? `[\\[${number}\\]](${source.url})`
          : `\\[${number}\\]`;
      })
      .join('');
  const lines: string[] = [
    input.cadence === 'weekly'
      ? `# ${input.locality} — week of ${input.periodEnd}`
      : `# ${input.locality} — daily briefing, ${input.periodEnd}`,
    '',
    `## ${input.headline.replace(/\s+/gu, ' ').trim()}`,
    '',
  ];
  for (const paragraph of mergeSameSourceParagraphs(input.paragraphs)) {
    // A run of sentences resting on the same sources is cited once, at its
    // end, the way a reporter attributes a passage rather than every line.
    const text = paragraph.claims
      .map((claim, index, claims) => {
        const sentence = claim.text.trim();
        const next = claims[index + 1];
        const citedLater =
          !claim.limitation &&
          next !== undefined &&
          sourceKey(next.sources) === sourceKey(claim.sources);
        const marker =
          claim.sources.length && !citedLater ? ` ${cite(claim.sources)}` : '';
        const limitation = claim.limitation
          ? ` (${claim.limitation.trim()})`
          : '';
        return `${sentence}${marker}${limitation}`;
      })
      .join(' ');
    if (text.trim()) lines.push(text, '');
  }
  lines.push(
    `*${input.periodStart} to ${input.periodEnd} · ${input.sourceCount} sources · Model: ${input.model}*`,
    '',
    `> ${input.disclosure}`,
    ''
  );
  if (input.upcoming.length) {
    lines.push('## Coming up', '');
    for (const item of input.upcoming) {
      const when = item.date ? ` — ${item.date.slice(0, 10)}` : '';
      const link = item.url ? ` [source](${item.url})` : '';
      lines.push(`- ${boldHeadline(item.title)}${when}${link}`);
      if (item.disclosure) lines.push(`  ${item.disclosure}`);
    }
    lines.push('');
  }
  const community = input.community;
  if (community?.quotes.length) {
    lines.push('## From the community', '');
    for (const quote of community.quotes) {
      const who = quote.office
        ? `${quote.attribution}, ${quote.office}`
        : quote.attribution;
      const when = quote.occurredOn ? `, ${quote.occurredOn}` : '';
      for (const line of quote.quote.split(/\n+/u))
        lines.push(`> ${line.trim()}`);
      lines.push(
        '>',
        `> — ${who}${when}${
          quote.url ? ` ([their report](${quote.url}))` : ''
        }`,
        ''
      );
      lines.push(`${describePath(quote)}`, '');
    }
  }
  if (community?.corrections.length) {
    lines.push('## Corrections', '');
    for (const correction of community.corrections)
      lines.push(`- **${correction.at}** — ${correction.text}`);
    lines.push('');
  }
  if (input.sources.length) {
    lines.push('## Sources', '');
    input.sources.forEach((source, index) => {
      const by = [source.publisher, source.date].filter(Boolean).join(', ');
      const title = source.url
        ? `[${source.title.replace(/[[\]]/gu, '')}](${source.url})`
        : source.title;
      lines.push(`${index + 1}. ${title}${by ? ` — ${by}` : ''}`);
    });
    lines.push('');
  }
  if (input.sourceFreshness?.length) {
    lines.push('<details>', '<summary>Source freshness</summary>', '');
    for (const source of input.sourceFreshness) {
      const freshness = source.observedAt
        ? ` — observed ${source.observedAt}`
        : source.fetchedAt
        ? ` — fetched ${source.fetchedAt} (item observation unavailable)`
        : ' — observation and fetch time unavailable';
      lines.push(`- ${source.sourceName ?? 'Configured source'}${freshness}`);
    }
    lines.push('', '</details>', '');
  }
  if (
    input.contextSince ||
    input.coverageRange ||
    input.generationId !== undefined ||
    input.generatedAt
  ) {
    lines.push(
      '<details>',
      '<summary>How this edition was made</summary>',
      '',
      `- Story context: ${
        input.contextSince ?? input.coverageRange?.start ?? 'not recorded'
      } to ${input.coverageRange?.end ?? input.periodEnd}`,
      `- Brief generation: ${input.generationId ?? 'not recorded'}${
        input.generatedAt ? ` at ${input.generatedAt}` : ''
      }`,
      '',
      '</details>',
      ''
    );
  }
  const body = lines.join('\n');
  const jargon = renderJargonBuster(findJargon(body));
  const zoning = renderZoning(explainZoning(body));
  return [body, jargon, zoning].filter(Boolean).join('\n');
}

const PROSE_MONTHS = [
  'Jan.',
  'Feb.',
  'March',
  'April',
  'May',
  'June',
  'July',
  'Aug.',
  'Sept.',
  'Oct.',
  'Nov.',
  'Dec.',
];

/** A date as a news story writes it: "Sept. 14". The year only when it is not the edition's. */
export function proseDate(isoDay: string, editionYear?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(isoDay);
  if (!match) return isoDay;
  const [, year, month, day] = match;
  const text = `${PROSE_MONTHS[Number(month) - 1]} ${Number(day)}`;
  return editionYear && editionYear !== year ? `${text}, ${year}` : text;
}
