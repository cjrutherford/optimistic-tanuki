/**
 * Phase E: how many people are watching each town, and what they cover.
 *
 * The number that matters is not contributions but people: a town with one
 * prolific contributor has one source, and the gate will never open for it.
 * The corroboration plan sets the target at eight to twelve active
 * contributors per town — enough that independent accounts of the same
 * meeting are ordinary rather than lucky, and few enough to recruit for.
 *
 * Reported weekly, per town, against that band. A town below it is not
 * failing; it is telling us where to recruit. The report is for the operator,
 * and it says what is thin rather than dressing it up.
 */

import type { TownDensity } from '@optimistic-tanuki/models';

export const DENSITY_TARGET = { low: 8, high: 12 } as const;
/** A contributor counts as active with a contribution in this many days. */
export const ACTIVE_DAYS = 28;

export type { TownDensity };

export type DensityStanding = 'none' | 'short' | 'in band' | 'above';

export function standingOfDensity(active: number): DensityStanding {
  if (active === 0) return 'none';
  if (active < DENSITY_TARGET.low) return 'short';
  if (active > DENSITY_TARGET.high) return 'above';
  return 'in band';
}

/** How many more people a town needs before independent corroboration is ordinary. */
export function shortBy(active: number): number {
  return Math.max(0, DENSITY_TARGET.low - active);
}

/**
 * The weekly report, as the operator reads it. Plain markdown: it is meant to
 * be kept, compared with last week's, and acted on by recruiting in the towns
 * at the bottom.
 */
export function renderDensityReport(
  rows: readonly TownDensity[],
  week: string
): string {
  const ordered = [...rows].sort(
    (a, b) => a.active - b.active || a.town.localeCompare(b.town)
  );
  const lines: string[] = [
    `# Contributor density, week of ${week}`,
    '',
    `Target: ${DENSITY_TARGET.low}–${DENSITY_TARGET.high} active contributors per town` +
      ` (a contribution in the last ${ACTIVE_DAYS} days). Towns are listed thinnest first.`,
    '',
    '| Town | Active | Standing | Short by | Reports | Corroborations | Corroborated | Quotable | Meetings covered | Officials |',
    '| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |',
  ];
  for (const row of ordered) {
    const coverage = row.meetings
      ? `${row.meetingsWithContributions}/${row.meetings}`
      : '—';
    lines.push(
      `| ${row.town} | ${row.active} | ${standingOfDensity(row.active)} | ${
        shortBy(row.active) || '—'
      } ` +
        `| ${row.reports} | ${row.corroborations} | ${row.corroborated} | ${row.quotable} | ${coverage} | ${row.officials} |`
    );
  }
  lines.push('');
  const thin = ordered.filter(
    (row) =>
      standingOfDensity(row.active) !== 'in band' &&
      standingOfDensity(row.active) !== 'above'
  );
  if (thin.length) {
    lines.push('## Where to recruit', '');
    for (const row of thin) {
      lines.push(
        row.active === 0
          ? `- **${row.town}** has nobody contributing. Nothing here can be corroborated.`
          : `- **${row.town}** needs ${shortBy(
              row.active
            )} more to reach the band; ${row.active} ${
              row.active === 1 ? 'person is' : 'people are'
            } watching it now.`
      );
    }
    lines.push('');
  }
  const outcomes = ordered.reduce(
    (sum, row) => ({
      confirmed: sum.confirmed + row.confirmed,
      contradicted: sum.contradicted + row.contradicted,
    }),
    { confirmed: 0, contradicted: 0 }
  );
  lines.push(
    '## Against the record',
    '',
    `${outcomes.confirmed} report${
      outcomes.confirmed === 1 ? '' : 's'
    } borne out by a later record, ` +
      `${outcomes.contradicted} contradicted by one.`,
    ''
  );
  return lines.join('\n');
}
