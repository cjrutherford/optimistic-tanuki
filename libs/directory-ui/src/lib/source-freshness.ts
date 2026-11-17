import type { LocalDirectorySourceFreshness } from './models';

export type { LocalDirectorySourceFreshness };

const STATES = ['fresh', 'due', 'stale', 'unknown'];

/** Keeps only a well-formed freshness object; anything else is treated as absent. */
export function readSourceFreshness(
  value: unknown
): LocalDirectorySourceFreshness | undefined {
  const v = value as Partial<LocalDirectorySourceFreshness> | null;
  if (!v || typeof v !== 'object' || !STATES.includes(v.state as string)) {
    return undefined;
  }
  const t = v.thresholds;
  return {
    state: v.state as LocalDirectorySourceFreshness['state'],
    releaseId: typeof v.releaseId === 'string' ? v.releaseId : null,
    sourcePublishedAt:
      typeof v.sourcePublishedAt === 'string' ? v.sourcePublishedAt : null,
    acquiredAt: typeof v.acquiredAt === 'string' ? v.acquiredAt : null,
    thresholds: {
      freshDays: typeof t?.freshDays === 'number' ? t.freshDays : 90,
      staleDays: typeof t?.staleDays === 'number' ? t.staleDays : 120,
    },
  };
}

/** Plain-text label for the source data age. Never invents a date. */
export function describeSourceFreshness(
  freshness: LocalDirectorySourceFreshness | null | undefined
): string | null {
  if (!freshness) return null;
  const ms = freshness.sourcePublishedAt
    ? Date.parse(freshness.sourcePublishedAt)
    : NaN;
  const date = Number.isNaN(ms)
    ? null
    : new Date(ms).toISOString().slice(0, 10);
  const release = freshness.releaseId
    ? ` (release ${freshness.releaseId})`
    : '';
  if (freshness.state === 'unknown' || !date) {
    return 'Source date unknown';
  }
  const base = `Source data: updated ${date}${release}`;
  if (freshness.state === 'due') return `${base}, due for refresh`;
  if (freshness.state === 'stale') return `${base}, may be out of date`;
  return base;
}
