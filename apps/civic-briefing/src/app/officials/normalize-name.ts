/**
 * Collapses a name for comparison: case, accents, punctuation, spacing and a
 * trailing Jr./Sr. aside. The same rule Civic Core applies to its own
 * `civic_officials` (apps/civic officials-extraction), so the two agree on
 * which names are one person.
 */
export function normalizeOfficialName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+(?:jr|sr|ii|iii|iv)$/u, '');
}
