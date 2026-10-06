/** Deterministic quality metrics for briefings and stories. */

export interface Score {
  name: string;
  score: number; // 0-100
  detail: string;
}

const HEDGES = [
  'various',
  'multiple',
  'several',
  'ongoing with no',
  'no further updates',
  'no additional',
  'further details were',
  'additional considerations',
  'a number of',
  'involved',
  'related matters',
  'general matters',
  'remains pending, with no',
  'various topics',
];

const VAGUE_STATUS = [
  'ongoing with no further updates',
  'no final status determined',
];

export function hedgeDensity(text: string): { hits: string[]; ratio: number } {
  const lower = text.toLowerCase();
  const hits = HEDGES.filter((h) => lower.includes(h));
  const words = lower.split(/\s+/).filter(Boolean).length || 1;
  return { hits, ratio: hits.length / Math.max(1, words / 100) };
}

export function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((n, p) => n + (text.match(p)?.length ?? 0), 0);
}

const DATE_RE =
  /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2})\b/gi;
const NUM_RE =
  /\b\d+(?:\.\d+)?\s*(?:%|dollars|acres|pads|votes|million|billion)?|\$\d[\d,.]*[MBK]?|\b\d+-\d+\b/g;

/** Specificity: dates, numbers, names, votes per 100 words. Higher is better. */
export function specificity(text: string): Score {
  const dates = countMatches(text, [DATE_RE]);
  const nums = countMatches(text, [NUM_RE]);
  const votes = countMatches(text, [
    /\b\d+-\d+\b/g,
    /\bmotion\b/gi,
    /\bseconded\b/gi,
  ]);
  const words = text.split(/\s+/).filter(Boolean).length || 1;
  const density = ((dates + nums + votes) / words) * 100;
  return {
    name: 'specificity',
    score: Math.min(100, Math.round(density * 12)),
    detail: `${dates} dates, ${nums} numbers, ${votes} vote-words in ${words} words`,
  };
}

/** Vagueness: hedge phrases per 100 words. Lower is better (inverted to 0-100). */
export function vagueness(text: string): Score {
  const { hits, ratio } = hedgeDensity(text);
  return {
    name: 'clarity',
    score: Math.max(0, Math.round(100 - ratio * 60)),
    detail: hits.length
      ? `hedges: ${hits.slice(0, 5).join('; ')}`
      : 'no hedge phrases',
  };
}

/** Actionability: when/where/links present. */
export function actionability(text: string): Score {
  const checks: [string, boolean][] = [
    [
      'date/time',
      /(?:\d{1,2}:\d{2}|\b(?:Mon|Tues?|Wednes?|Thurs?|Fri|Satur?|Sun)day|\d{4}-\d{2}-\d{2})/i.test(
        text
      ),
    ],
    [
      'venue',
      /(hall|chambers|boardroom|office|avenue|drive|road|city hall)/i.test(
        text
      ),
    ],
    ['source-link', /\[source\]|\(https?:\/\//.test(text)],
    [
      'status/decision',
      /(decided|pending|passed|approved|vote|scheduled|ongoing)/i.test(text),
    ],
  ];
  const hit = checks.filter(([, v]) => v).length;
  return {
    name: 'actionability',
    score: Math.round((hit / checks.length) * 100),
    detail: checks.map(([k, v]) => `${v ? '+' : '-'}${k}`).join(' '),
  };
}

/** Readability: prefers 12-22 word sentences. */
export function readability(text: string): Score {
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
  if (!sentences.length)
    return { name: 'readability', score: 0, detail: 'no sentences' };
  const avg =
    sentences.reduce((n, s) => n + s.split(/\s+/).length, 0) / sentences.length;
  const inBand =
    sentences.filter((s) => {
      const w = s.split(/\s+/).length;
      return w >= 8 && w <= 28;
    }).length / sentences.length;
  const score = Math.round(
    Math.max(0, 100 - Math.abs(avg - 17) * 6) * 0.5 + inBand * 50
  );
  return {
    name: 'readability',
    score,
    detail: `avg ${avg.toFixed(1)} words/sentence, ${Math.round(
      inBand * 100
    )}% in 8-28 band`,
  };
}

/** Timeline quality: entries should carry outcomes, not bare headings. */
export function timelineQuality(
  entries: { date?: string; heading: string; detail?: string }[]
): Score {
  if (!entries.length) return { name: 'timeline', score: 0, detail: 'empty' };
  const dated = entries.filter((e) => e.date).length / entries.length;
  const detailed =
    entries.filter((e) => (e.detail ?? e.heading).length > 80).length /
    entries.length;
  const outcomes =
    entries.filter((e) =>
      /(passed|approved|voted|motion|decided|tabled|scheduled|failed|carried)/i.test(
        `${e.heading} ${e.detail ?? ''}`
      )
    ).length / entries.length;
  const score = Math.round(dated * 30 + detailed * 40 + outcomes * 30);
  return {
    name: 'timeline',
    score,
    detail: `${Math.round(dated * 100)}% dated, ${Math.round(
      detailed * 100
    )}% detailed, ${Math.round(outcomes * 100)}% with outcomes`,
  };
}

export function grade(text: string): Score[] {
  return [
    specificity(text),
    vagueness(text),
    actionability(text),
    readability(text),
  ];
}

export function overall(scores: Score[]): number {
  return Math.round(
    scores.reduce((n, s) => n + s.score, 0) / Math.max(1, scores.length)
  );
}
