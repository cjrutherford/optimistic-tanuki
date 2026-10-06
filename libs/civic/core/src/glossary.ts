/** Georgia local-government jargon → outsider plain language. */
export const GLOSSARY: [RegExp, string, string][] = [
  [
    /\bmillage rate\b/i,
    'millage rate',
    'the property-tax rate the council sets each year; 1 mill = $1 per $1,000 of assessed value',
  ],
  [
    /\bsecond reading\b/i,
    'second reading',
    'the second of (usually) two votes needed to pass a new local law',
  ],
  [
    /\bfirst reading\b/i,
    'first reading',
    'the first presentation of a proposed law; a vote usually follows later',
  ],
  [
    /\bquorum\b/i,
    'quorum',
    'the minimum number of members present for votes to count',
  ],
  [
    /\bSPLOST\b/,
    'SPLOST',
    'a 1% local sales tax voters approve for specific capital projects',
  ],
  [
    /\bLMIG\b/,
    'LMIG',
    'state grant money for local road maintenance (Local Maintenance & Improvement Grant)',
  ],
  [
    /\bexecutive session\b/i,
    'executive session',
    'a closed portion of a meeting (allowed only for topics like lawsuits, hiring, or land deals)',
  ],
  [
    /\bvariance\b/i,
    'variance',
    'official permission to break a zoning rule for a specific property',
  ],
  [
    /\brezoning\b/i,
    'rezoning',
    'changing what a piece of land is legally allowed to be used for',
  ],
  [
    /\bconditional use\b/i,
    'conditional use',
    'a special use allowed only if extra conditions are met',
  ],
  [/\bmotion carried\b/i, 'motion carried', 'the proposal passed'],
  [/\btabled\b/i, 'tabled', 'put aside to deal with later (not decided)'],
  [
    /\bwork session\b/i,
    'work session',
    'an informal meeting to discuss topics; usually no binding votes',
  ],
  [
    /\bpublic hearing\b/i,
    'public hearing',
    'a scheduled slot where any resident may speak on the record',
  ],
  [/\bcall to order\b/i, 'call to order', 'the formal start of the meeting'],
  [/\badjourn(?:ment|ed)?\b/i, 'adjourn', 'formally end the meeting'],
  [
    /\bmotion to approve\b/i,
    'motion to approve',
    'a member formally proposes accepting something; needs a second and a vote',
  ],
  [
    /\bseconded\b/i,
    'seconded',
    'another member backed the proposal so it could be voted on',
  ],
  [
    /\bunfunded mandate\b/i,
    'unfunded mandate',
    'a state/federal requirement the locality must pay for itself',
  ],
  [
    /\bconsent agenda\b/i,
    'consent agenda',
    'routine items passed together in one vote without discussion',
  ],
  [
    /\bCDBG\b/,
    'CDBG',
    'federal grant money for community development in lower-income areas',
  ],
];

export interface GlossaryHit {
  term: string;
  definition: string;
}

/** Terms from the glossary actually used in a text, in first-appearance order. */
export function findJargon(text: string): GlossaryHit[] {
  const hits: GlossaryHit[] = [];
  const seen = new Set<string>();
  // Sort by first-appearance position for a natural reading order.
  const positioned: { pos: number; term: string; definition: string }[] = [];
  for (const [pattern, term, definition] of GLOSSARY) {
    const m = pattern.exec(text);
    if (m && m.index != null && !seen.has(term)) {
      seen.add(term);
      positioned.push({ pos: m.index, term, definition });
    }
  }
  return positioned
    .sort((a, b) => a.pos - b.pos)
    .map(({ term, definition }) => ({ term, definition }));
}

export function renderJargonBuster(hits: GlossaryHit[]): string {
  if (!hits.length) return '';
  return [
    '## Words worth knowing',
    '',
    ...hits.map((h) => `- **${h.term}** — ${h.definition}.`),
    '',
  ].join('\n');
}
