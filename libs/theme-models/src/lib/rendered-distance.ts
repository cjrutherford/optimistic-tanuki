/**
 * Rendered distinctiveness: compares personalities by the CSS variables they
 * actually EMIT (what a user sees), not the fields they declare.
 *
 * Motivation: the repo's `personalityDistance()` scores ~26% of its weight on
 * fields nothing renders (tokens.typography, lineHeight, letterSpacing,
 * borderStyle/Width, shadowIntensity, iconStyle, harmony spreads,
 * animation.style, shadow.style…). It rates elegant vs foundation 0.70 apart
 * while they emit the most similar CSS of any pair.
 *
 * Each dimension is compared with a JND-aware distance:
 *  - colours: CIE76 ΔE / 40 (ΔE ≈ 2 is barely noticeable; 40 is "different colour")
 *  - lengths/numbers: relative difference against a per-dimension scale
 *  - atmosphere layers (gradients/patterns): by structure — the kind and
 *    layout of gradient, with colours and numbers stripped
 *  - everything else (shadows, fonts, patterns, compositions): categorical,
 *    after resolving one level of `var(--x)` references
 * The result is a weighted average in [0, 1]; callers average it over several
 * primaries and both modes, since colour is always derived from the primary.
 */
import { deltaE, isHex } from './personality-color';

type Vars = Record<string, string>;
type Kind =
  | 'color'
  | 'length'
  | 'ms'
  | 'number'
  | 'font'
  | 'category'
  | 'presence'
  | 'shape';

interface Dim {
  key: string;
  weight: number;
  kind: Kind;
  /** Value to assume when a personality doesn't emit the key (what renders instead). */
  fallback?: string | ((v: Vars) => string | undefined);
  scale?: number;
}

/** Grouped by what drives the look: canvas, colour use, type, shape, depth, motion, composition. */
export const RENDERED_DIMENSIONS: Dim[] = [
  // Canvas — the largest area of the screen.
  { key: '--background', weight: 3, kind: 'color' },
  { key: '--surface', weight: 2, kind: 'color' },
  { key: '--border', weight: 0.75, kind: 'color' },
  { key: '--foreground', weight: 0.5, kind: 'color' },
  {
    key: '--page-background-pattern',
    weight: 0.75,
    kind: 'category',
    fallback: 'none',
  },
  { key: '--surface-texture', weight: 0.5, kind: 'category', fallback: 'none' },
  // Colour use.
  { key: '--primary', weight: 1.5, kind: 'color' },
  { key: '--secondary', weight: 0.5, kind: 'color' },
  { key: '--tertiary', weight: 0.5, kind: 'color' },
  {
    key: '--accent-ground',
    weight: 2,
    kind: 'color',
    fallback: (v) => v['--surface'],
  },
  { key: '--personality-header-bg', weight: 1, kind: 'category' },
  { key: '--personality-fill-primary', weight: 0.5, kind: 'category' },
  // Typography.
  { key: '--font-heading', weight: 2, kind: 'font' },
  { key: '--font-body', weight: 1.5, kind: 'font' },
  {
    key: '--type-ratio',
    weight: 1.5,
    kind: 'number',
    fallback: '1.25',
    scale: 0.25,
  },
  {
    key: '--heading-weight',
    weight: 1.25,
    kind: 'number',
    fallback: (v) => v['--personality-font-weight'],
    scale: 400,
  },
  {
    key: '--heading-transform',
    weight: 0.75,
    kind: 'category',
    fallback: 'none',
  },
  {
    key: '--heading-tracking',
    weight: 0.5,
    kind: 'number',
    fallback: '0',
    scale: 0.04,
  },
  {
    key: '--line-height',
    weight: 0.75,
    kind: 'number',
    fallback: '1.5',
    scale: 0.3,
  },
  { key: '--personality-button-text-transform', weight: 0.5, kind: 'category' },
  {
    key: '--personality-label-text-transform',
    weight: 0.5,
    kind: 'category',
    fallback: 'none',
  },
  // Shape.
  { key: '--personality-card-radius', weight: 1, kind: 'length', scale: 16 },
  {
    key: '--personality-button-radius',
    weight: 0.75,
    kind: 'length',
    scale: 16,
  },
  {
    key: '--personality-primitive-radius',
    weight: 0.5,
    kind: 'length',
    scale: 10,
  },
  { key: '--personality-border-width', weight: 0.5, kind: 'length', scale: 2 },
  // Depth.
  { key: '--shadow-md', weight: 1, kind: 'category' },
  {
    key: '--personality-hover-shadow',
    weight: 0.5,
    kind: 'category',
    fallback: 'none',
  },
  // Composition & density.
  { key: '--personality-surface-border', weight: 0.5, kind: 'category' },
  { key: '--personality-surface-shadow', weight: 0.5, kind: 'category' },
  { key: '--personality-tab-active-bg', weight: 0.5, kind: 'category' },
  { key: '--personality-feedback-stripe', weight: 0.25, kind: 'category' },
  {
    key: '--personality-control-height',
    weight: 0.5,
    kind: 'length',
    scale: 12,
  },
  {
    key: '--personality-surface-padding',
    weight: 0.5,
    kind: 'length',
    scale: 14,
  },
  // Atmosphere: compared by STRUCTURE (colours/numbers stripped), so two
  // personalities with the same kind of gradient at different tints count as alike.
  {
    key: '--atmosphere-backdrop',
    weight: 1.5,
    kind: 'shape',
    fallback: 'none',
  },
  { key: '--surface-fill', weight: 1, kind: 'shape', fallback: 'none' },
  { key: '--accent-fill', weight: 1, kind: 'shape', fallback: 'none' },
  { key: '--primary-fill', weight: 0.75, kind: 'shape', fallback: 'none' },
  { key: '--pattern-page', weight: 0.75, kind: 'shape', fallback: 'none' },
  { key: '--pattern-accent', weight: 0.75, kind: 'shape', fallback: 'none' },
  // Motion character (proposed motion lever).
  {
    key: '--motion-enter-transform',
    weight: 0.5,
    kind: 'shape',
    fallback: 'none',
  },
  { key: '--glow-hover', weight: 0.5, kind: 'shape', fallback: 'none' },
  {
    key: '--ambient-primary-animation',
    weight: 0.25,
    kind: 'shape',
    fallback: 'none',
  },
  {
    key: '--ambient-pulse-animation',
    weight: 0.25,
    kind: 'shape',
    fallback: 'none',
  },
  {
    key: '--ambient-sheen-animation',
    weight: 0.25,
    kind: 'shape',
    fallback: 'none',
  },
  {
    key: '--ambient-band-animation',
    weight: 0.25,
    kind: 'shape',
    fallback: 'none',
  },
  // Motion.
  { key: '--animation-duration-normal', weight: 0.5, kind: 'ms', scale: 250 },
  { key: '--animation-easing', weight: 0.5, kind: 'category' },
];

const TOTAL = RENDERED_DIMENSIONS.reduce((s, d) => s + d.weight, 0);

function resolve(v: Vars, raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return raw
    .replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (m, name) => v[name] ?? m)
    .trim();
}

function valueOf(v: Vars, dim: Dim): string | undefined {
  const own = v[dim.key];
  if (own !== undefined && own !== '') return resolve(v, own);
  const fb =
    typeof dim.fallback === 'function' ? dim.fallback(v) : dim.fallback;
  return resolve(v, fb);
}

const num = (s: string | undefined) => {
  const m = /-?\d*\.?\d+/.exec(s ?? '');
  return m ? parseFloat(m[0]) : 0;
};
const ms = (s: string | undefined) =>
  s?.trim().endsWith('ms')
    ? num(s)
    : s?.trim().endsWith('s')
    ? num(s) * 1000
    : num(s);
/** A CSS value with colours and numbers removed: its structure (gradient kinds, stops, layers). */
const structure = (s: string | undefined) =>
  (s ?? 'none')
    .replace(/#[0-9a-f]{3,8}/gi, 'C')
    .replace(/rgba?\([^)]*\)/g, 'C')
    .replace(/-?\d*\.?\d+/g, 'N')
    .replace(/\s+/g, ' ')
    .trim();
const fontToken = (s: string | undefined) =>
  (s ?? '').split(',')[0].replace(/["']/g, '').trim().toLowerCase();

function dimDistance(
  a: string | undefined,
  b: string | undefined,
  dim: Dim
): number {
  if (a === b) return 0;
  switch (dim.kind) {
    case 'color': {
      const x = (a ?? '').slice(0, 7);
      const y = (b ?? '').slice(0, 7);
      if (isHex(x) && isHex(y)) return Math.min(1, deltaE(x, y) / 40);
      return a === b ? 0 : 1;
    }
    case 'length':
    case 'number':
      return Math.min(1, Math.abs(num(a) - num(b)) / (dim.scale ?? 1));
    case 'ms':
      return Math.min(1, Math.abs(ms(a) - ms(b)) / (dim.scale ?? 250));
    case 'font':
      return fontToken(a) === fontToken(b) ? 0 : 1;
    case 'shape':
      return structure(a) === structure(b) ? 0 : 1;
    default:
      return (a ?? '') === (b ?? '') ? 0 : 1;
  }
}

export interface DimensionContribution {
  key: string;
  weight: number;
  distance: number;
}

export function renderedDistanceBreakdown(
  a: Vars,
  b: Vars
): DimensionContribution[] {
  return RENDERED_DIMENSIONS.map((dim) => ({
    key: dim.key,
    weight: dim.weight,
    distance: dimDistance(valueOf(a, dim), valueOf(b, dim), dim),
  }));
}

/** Weighted rendered distance in [0, 1] for one primary/mode sample. */
export function renderedDistance(a: Vars, b: Vars): number {
  return (
    renderedDistanceBreakdown(a, b).reduce(
      (s, d) => s + d.weight * d.distance,
      0
    ) / TOTAL
  );
}

/** Averages over matched samples (same primary + mode at each index). */
export function averagedRenderedDistance(a: Vars[], b: Vars[]): number {
  return (
    a.reduce((s, sample, i) => s + renderedDistance(sample, b[i]), 0) / a.length
  );
}
