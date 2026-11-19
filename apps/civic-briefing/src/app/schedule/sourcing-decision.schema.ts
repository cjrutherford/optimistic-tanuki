import { EntitySchema } from 'typeorm';

/**
 * One record of the sourcing engine, replacing `decisions.jsonl`. Two kinds of
 * record share the table, as they did in the log:
 *
 * - `adopted` / `refused`: one per candidate source judged (the log's
 *   `type: "decision"` lines). `sourceKey`, `url`, `adapter`, `via`,
 *   `ownerSlug`, `reason` and `evidence` are set.
 * - `searched`: one per town per run (the log's `type: "search"` lines).
 *   `localDate` is what `sourcingDue` reads as `lastSearched`; `detail` holds
 *   the run summary. The source-specific columns are null.
 */
export type SourcingDecisionKind = 'adopted' | 'refused' | 'searched';

export interface SourcingDecisionRow {
  id?: number;
  /** The town the run was for. */
  slug: string;
  /** The locality the source belongs to: the town, or the county whose site it came from. */
  ownerSlug?: string | null;
  sourceKey?: string | null;
  adapter?: string | null;
  url?: string | null;
  decision: SourcingDecisionKind;
  /** How it was found: `crawl <page>` or `search "<query>"`. */
  via?: string | null;
  /** The decision's reasons, one per line. */
  reason?: string | null;
  /** JSON array of evidence strings. */
  evidence?: string | null;
  /** The town's local date the search ran for (`searched` rows); `lastSearched` reads the latest. */
  localDate?: string | null;
  /** JSON run summary (`searched` rows): pagesRead, searched, adopted, refused, officialSites. */
  detail?: string | null;
  decidedAt: Date;
}

export const SourcingDecisionSchema = new EntitySchema<SourcingDecisionRow>({
  name: 'SourcingDecision',
  tableName: 'sourcing_decisions',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    slug: { type: String },
    ownerSlug: { type: String, nullable: true },
    sourceKey: { type: String, nullable: true },
    adapter: { type: String, nullable: true },
    url: { type: String, nullable: true },
    decision: { type: String },
    via: { type: String, nullable: true },
    reason: { type: 'text', nullable: true },
    evidence: { type: 'text', nullable: true },
    localDate: { type: String, nullable: true },
    detail: { type: 'text', nullable: true },
    decidedAt: { type: 'timestamptz' },
  },
  indices: [{ columns: ['slug', 'decidedAt'] }],
});
