import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the community service offers a briefing, and how a run reads it.
 *
 * The pipeline does not query the community database. The service writes a
 * snapshot per town — the material eligible under its own rules, and the
 * corrections owed on what it offered before — and a run reads the file. A
 * replay therefore depends on its inputs and nothing else, which is what
 * makes the golden harness worth anything; and the pipeline keeps no
 * connection to a service that holds personal data.
 *
 * A snapshot carries quotations, not claims. Every item is the contributor's
 * own words under their handle, with the path that let it through and the
 * record that bore it out. Nothing here is ever rewritten into the
 * briefing's prose.
 */

export type PromotionPath =
  | 'official-record'
  | 'authenticated-artifact'
  | 'confirmed';

export interface CommunityQuote {
  id: string;
  /** The contributor's own words, exactly as they wrote them. */
  quote: string;
  /** The handle it is attributed to, and the office when an official. */
  attribution: string;
  office: string | null;
  subject: string;
  /** The day the contributor says it happened, YYYY-MM-DD. */
  occurredOn: string | null;
  /** When it was submitted, which is when it becomes available to a briefing. */
  submittedAt: string;
  path: PromotionPath;
  /** The record that bore it out, when the path was `confirmed`. */
  confirmedBy: {
    title: string;
    url: string | null;
    publisher: string | null;
    date: string | null;
  } | null;
  /** Where the contribution is published on the community page. */
  url: string | null;
}

/**
 * Something a briefing said that has since been withdrawn, taken down or
 * contradicted. Published editions are not edited quietly: the correction is
 * dated and appears in the next edition, and in the edition that carried the
 * material when that edition is rendered again.
 */
export interface CommunityCorrection {
  id: string;
  /** The day the correction was made, YYYY-MM-DD. */
  at: string;
  /** The edition that carried the material, by its period end. */
  affects: string | null;
  text: string;
}

export interface CommunitySnapshot {
  generatedAt: string;
  localitySlug: string;
  quotes: CommunityQuote[];
  corrections: CommunityCorrection[];
}

/** The file a town's snapshot is written to. */
export function snapshotPath(directory: string, localitySlug: string): string {
  return join(directory, `${localitySlug}.json`);
}

/**
 * A town's snapshot, or null when none has been written. A malformed file is
 * null too: a briefing runs without community material rather than failing,
 * and the absence is visible because the section does not appear.
 */
export function readCommunitySnapshot(
  directory: string | undefined,
  localitySlug: string
): CommunitySnapshot | null {
  if (!directory) return null;
  const path = snapshotPath(directory, localitySlug);
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(
      readFileSync(path, 'utf8')
    ) as Partial<CommunitySnapshot>;
    if (!Array.isArray(value.quotes) || !Array.isArray(value.corrections))
      return null;
    return {
      generatedAt:
        typeof value.generatedAt === 'string' ? value.generatedAt : '',
      localitySlug,
      quotes: value.quotes,
      corrections: value.corrections,
    };
  } catch {
    return null;
  }
}

/**
 * What belongs in one edition: the material submitted inside its period, and
 * the corrections owed — those made inside the period, and any that correct
 * this very edition, however late they arrive.
 */
export function communityForEdition(
  snapshot: CommunitySnapshot | null,
  periodStart: string,
  periodEnd: string
): { quotes: CommunityQuote[]; corrections: CommunityCorrection[] } {
  if (!snapshot) return { quotes: [], corrections: [] };
  const within = (day: string | null | undefined) =>
    Boolean(day) &&
    day!.slice(0, 10) >= periodStart &&
    day!.slice(0, 10) <= periodEnd;
  const quotes = snapshot.quotes
    .filter((quote) => within(quote.occurredOn ?? quote.submittedAt))
    .sort(
      (a, b) =>
        (a.occurredOn ?? a.submittedAt).localeCompare(
          b.occurredOn ?? b.submittedAt
        ) || a.id.localeCompare(b.id)
    );
  const corrections = snapshot.corrections
    .filter(
      (correction) => correction.affects === periodEnd || within(correction.at)
    )
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return { quotes, corrections };
}
