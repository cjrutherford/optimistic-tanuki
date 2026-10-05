import { EntitySchema } from 'typeorm';

/**
 * A pipeline problem an operator was told about (P5.2). One row per problem:
 * a failed run, or a source that turned failing or stale. A problem is
 * emailed once, when first seen, and is resolved when it clears, so a
 * recurrence alerts again.
 */
export interface DaylightAlertRow {
  id?: number;
  /** run:<runId>, or source:<sourceId>:<failing|stale>. */
  key: string;
  kind: 'run-failed' | 'source-failing' | 'source-stale';
  localitySlug: string;
  detail: string;
  firstSeenAt: string;
  notifiedAt: string | null;
  resolvedAt: string | null;
}

export const DaylightAlertSchema = new EntitySchema<DaylightAlertRow>({
  name: 'DaylightAlert',
  tableName: 'daylight_alerts',
  columns: {
    id: { type: Number, primary: true, generated: 'increment' },
    key: { type: String },
    kind: { type: String },
    localitySlug: { type: String },
    detail: { type: 'text' },
    firstSeenAt: { type: String },
    notifiedAt: { type: String, nullable: true },
    resolvedAt: { type: String, nullable: true },
  },
  indices: [{ columns: ['key', 'resolvedAt'] }],
});
