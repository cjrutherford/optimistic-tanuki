import { EntitySchema } from 'typeorm';

/**
 * A pipeline problem an operator was told about (P5.2). One row per problem:
 * a failed run, or a source that turned failing or stale. A problem is
 * emailed once, when first seen, and is resolved when it clears, so a
 * recurrence alerts again. A sent daily digest is recorded here too, as a
 * resolved `digest:<local date>` row, so it goes out once a day.
 */
export interface DaylightAlertRow {
  id?: number;
  /** run:<town>:<cause>, source:<sourceId>:<failing|stale>, or digest:<date>. */
  key: string;
  kind: 'run-failed' | 'source-failing' | 'source-stale' | 'digest';
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
