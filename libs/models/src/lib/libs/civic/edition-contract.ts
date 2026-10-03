/**
 * The published-briefing contract between civic-briefing, the gateway and
 * Towne Square's pages (plan slice P3.1). Plain data, no behaviour.
 */
export interface EditionSummary {
  slug: string;
  name: string;
  state: string;
  /** The newest published period's end date (YYYY-MM-DD), or null. */
  latest: string | null;
}

export interface BriefingSummary {
  cadence: string;
  periodStart: string;
  periodEnd: string;
}

export interface EditionHistory extends EditionSummary {
  briefings: BriefingSummary[];
}

export interface PublishedBriefing extends BriefingSummary {
  slug: string;
  name: string;
  state: string;
  createdAt: string;
  markdown: string;
}
