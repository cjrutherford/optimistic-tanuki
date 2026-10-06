/**
 * Zoning-code → normie language. Deterministic decoder for common US municipal
 * codes plus pattern rules (R-15, C-2, …). Exact setbacks/uses vary by city —
 * definitions say what the code *means*, not the local ordinance text.
 */
const KNOWN: [RegExp, string][] = [
  [
    /\bRP\b/,
    'Residential Professional — homes plus small offices like clinics or studios',
  ],
  [
    /\bGB\b/,
    'General Business — most retail, restaurants, and services allowed',
  ],
  [/\bCB\b/, 'Central Business — downtown shops and offices'],
  [
    /\bCBD\b/,
    'Central Business District — the downtown core, mixed shops and offices',
  ],
  [/\bC-1\b/i, 'Neighborhood Commercial — small shops serving nearby homes'],
  [/\bC-2\b/i, 'General Commercial — larger retail along main roads'],
  [/\bRM\b/, 'Residential Multi-family — apartments and duplexes allowed'],
  [/\bR-15\b/i, 'Single-family homes on large lots (15,000 sq ft minimum)'],
  [/\bR-10\b/i, 'Single-family homes on mid-size lots (10,000 sq ft minimum)'],
  [/\bR-8\b/i, 'Single-family homes on smaller lots (8,000 sq ft minimum)'],
  [/\bR-6\b/i, 'Single-family homes on small lots (6,000 sq ft minimum)'],
  [
    /\bDR-?10\b/i,
    'Duplex Residential — one- or two-family homes (10,000 sq ft minimum)',
  ],
  [
    /\bM-1\b/i,
    'Light Industrial — warehouses, workshops, no heavy manufacturing',
  ],
  [/\bM-2\b/i, 'Heavy Industrial — factories and heavy manufacturing'],
  [
    /\bPUD\b/i,
    'Planned Unit Development — a custom mixed-use plan approved as one package',
  ],
  [
    /\bPDO\b/,
    'Planned Development Overlay — special custom rules layered over the base zoning',
  ],
  [/\bOI\b/, 'Office Institutional — offices, clinics, schools, churches'],
  [/\bAG\b/, 'Agricultural — farming and very low-density homes'],
  [/\bRE\b/, 'Residential Estate — large-lot homes, often 1+ acres'],
  [/\bMH\b/, 'Manufactured Housing — mobile/modular home parks allowed'],
];

export interface ZoningHit {
  code: string;
  definition: string;
}

/** Find zoning codes in text with plain-language definitions (deduped). */
export function explainZoning(text: string): ZoningHit[] {
  const hits: ZoningHit[] = [];
  const seen = new Set<string>();
  for (const [pattern, definition] of KNOWN) {
    const m = pattern.exec(text);
    if (m && !seen.has(m[0].toUpperCase())) {
      seen.add(m[0].toUpperCase());
      hits.push({ code: m[0].toUpperCase(), definition });
    }
  }
  return hits;
}

export function renderZoning(hits: ZoningHit[]): string {
  if (!hits.length) return '';
  return [
    '## Zoning codes in plain words',
    '',
    ...hits.map((h) => `- **${h.code}** — ${h.definition}.`),
    '',
  ].join('\n');
}
