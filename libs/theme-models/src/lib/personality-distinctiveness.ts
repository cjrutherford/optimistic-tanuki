/**
 * Perceptual distinctiveness metric for `Personality` presets (Workstream C1).
 *
 * Computes a pairwise "how different does this actually look/feel" score in
 * `[0, 1]` (0 = identical, 1 = maximally different) between two
 * `Personality` objects, using JND-aware ("just noticeable difference")
 * weighting rather than raw field-count or raw numeric range:
 *
 * - Categorical/enum fields (color harmony type, border-radius style,
 *   border style, shadow intensity, animation speed, typography style, icon
 *   style, font family tokens, ...) count as a **full unit of difference**
 *   when they differ, and 0 when they match — there is no "partial credit"
 *   for two different enum values being "close".
 * - Numeric fields are normalized against a plausible perceptual scale for
 *   that specific dimension (its approximate JND), not the field's raw
 *   numeric range. A 400ms vs 350ms animation-duration delta barely
 *   registers (both read as "medium-fast" to a user); a 20-point accent
 *   saturation delta registers strongly. Deltas are clamped to `[0, 1]`
 *   *after* normalization, so one wildly divergent field cannot dominate the
 *   weighted average on its own.
 *
 * Fields are grouped by how much they drive the rendered look and weighted
 * accordingly (color + typography carry the most; a single component's
 * border radius carries comparatively little). Group weights sum to 1.
 *
 * Pure TypeScript — no Angular or DOM dependencies, matching the rest of
 * this framework-agnostic library.
 */

import { Personality } from './personality.interfaces';

type FieldDistance = (a: Personality, b: Personality) => number;

interface FieldSpec {
  /** Human-readable id, surfaced in diagnostics only. */
  readonly id: string;
  /** Relative contribution to the overall weighted average. */
  readonly weight: number;
  /** Normalized distance for this field in `[0, 1]`. */
  readonly distance: FieldDistance;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Full-unit distance for enum/string/boolean fields: 0 if equal, 1 if not. */
function categorical<T>(get: (p: Personality) => T | undefined): FieldDistance {
  return (a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === undefined && vb === undefined) return 0;
    return va === vb ? 0 : 1;
  };
}

/**
 * Numeric distance normalized by `scale` (the approximate JND / perceptual
 * span for that dimension), clamped to `[0, 1]`. Missing values default to
 * `0` so an absent optional field doesn't throw off the comparison.
 */
function numeric(
  get: (p: Personality) => number | undefined,
  scale: number
): FieldDistance {
  return (a, b) => {
    const va = get(a) ?? 0;
    const vb = get(b) ?? 0;
    return clamp01(Math.abs(va - vb) / scale);
  };
}

/** Parses a leading numeric literal out of a CSS-ish value, e.g. `"1.5px"` -> `1.5`. */
function parseLeadingNumber(value: string | undefined): number {
  if (!value) return 0;
  const match = /-?\d+(\.\d+)?/.exec(value);
  return match ? parseFloat(match[0]) : 0;
}

/** Parses a CSS duration (`"300ms"` / `"0.3s"`) to milliseconds. */
function parseMs(value: string | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (trimmed.endsWith('ms')) return parseFloat(trimmed) || 0;
  if (trimmed.endsWith('s')) return (parseFloat(trimmed) || 0) * 1000;
  return parseFloat(trimmed) || 0;
}

/** Reduces a CSS font-family list to its primary token, unquoted/lowercased. */
function primaryFontToken(family: string | undefined): string {
  if (!family) return '';
  const first = family.split(',')[0] ?? '';
  return first.replace(/["']/g, '').trim().toLowerCase();
}

function headingFamily(p: Personality): string {
  return primaryFontToken(p.fonts.heading?.family ?? p.fonts.body.family);
}

function bodyFamily(p: Personality): string {
  return primaryFontToken(p.fonts.body.family);
}

function harmonySpread(p: Personality): number | undefined {
  return (
    p.colorHarmony.analogousSpread ??
    p.colorHarmony.complementDistance ??
    p.colorHarmony.tertiaryDistance
  );
}

/**
 * Categorical signature for a personality's page-background pattern
 * (Workstream C1/D3, 2026-07-18 refactor plan). `undefined` for the two
 * documented flat personalities (`classic`, `foundation`) — matching
 * `categorical()`'s existing "both undefined counts as equal" rule, so a
 * flat/flat pair contributes 0 here (correctly: two flat personalities
 * really are alike on this one dimension) while any pattern/pattern or
 * pattern/flat pair contributes a full unit of difference. The full pattern
 * string (plus the tint flag) is used as the signature rather than a
 * hand-picked motif label so two authored patterns can never accidentally
 * collide.
 */
function pageBackgroundSignature(p: Personality): string | undefined {
  if (!p.pageBackground) return undefined;
  return `${p.pageBackground.usePrimaryTint ? 'tint' : 'neutral'}:${
    p.pageBackground.pattern
  }`;
}

/**
 * Field specs, grouped by how strongly they drive the rendered look. Group
 * weights (sum to 1.08; `personalityDistance` normalizes by the actual
 * summed weight, so this isn't required to be exactly 1, but is kept close
 * to it for the numbers below to stay meaningful at a glance):
 *   color 0.28 | typography 0.24 | structure/tokens 0.25 (was 0.22 — +0.03
 *   for `tokens.shadowProfile`, Workstream B2) | animation 0.10 |
 *   presentation 0.08 | color-generation + icon 0.10 (was 0.08 — +0.02 for
 *   `pageBackground.pattern`, Workstream C1/D3, 2026-07-18 refactor plan) |
 *   surface character 0.03 (new — Workstream E1/D3, same 2026-07-18 plan's
 *   Phase 5b: `surfaceHueBias` + `surfaceLuminosityOffset`, a combined
 *   weight similar in magnitude to `tokens.shadowProfile`'s single 0.03)
 */
const FIELD_SPECS: readonly FieldSpec[] = [
  // ---- Color (0.28) ----
  {
    id: 'colorHarmony.type',
    weight: 0.08,
    distance: categorical((p) => p.colorHarmony.type),
  },
  {
    id: 'colorHarmony.saturationBoost',
    weight: 0.04,
    // Boost is authored roughly in [-0.3, 0.1]; a delta of ~0.5 spans that range.
    distance: numeric((p) => p.colorHarmony.saturationBoost, 0.5),
  },
  {
    id: 'colorHarmony.lightnessShift',
    weight: 0.04,
    distance: numeric((p) => p.colorHarmony.lightnessShift, 0.3),
  },
  {
    id: 'colorHarmony.accentSaturation',
    weight: 0.05,
    // Saturation is 0-100; ~25 points is a clearly-visible shift.
    distance: numeric((p) => p.colorHarmony.accentSaturation, 25),
  },
  {
    id: 'colorHarmony.accentLightness',
    weight: 0.04,
    distance: numeric((p) => p.colorHarmony.accentLightness, 20),
  },
  {
    id: 'colorHarmony.spread',
    weight: 0.03,
    // Degrees around the hue wheel; ~40deg is a clearly different harmony spread.
    distance: numeric(harmonySpread, 40),
  },

  // ---- Typography (0.24) ----
  {
    id: 'tokens.typography',
    weight: 0.06,
    distance: categorical((p) => p.tokens.typography),
  },
  {
    id: 'fonts.heading',
    weight: 0.07,
    distance: categorical(headingFamily),
  },
  {
    id: 'fonts.body',
    weight: 0.07,
    distance: categorical(bodyFamily),
  },
  {
    id: 'tokens.lineHeight',
    weight: 0.02,
    distance: numeric((p) => p.tokens.lineHeight, 0.3),
  },
  {
    id: 'tokens.letterSpacing',
    weight: 0.02,
    // 'normal' treated as 0em; ~0.03em spread covers the authored range.
    distance: numeric((p) => parseLeadingNumber(p.tokens.letterSpacing), 0.03),
  },

  // ---- Structure / tokens (0.22) ----
  {
    id: 'tokens.spacingScale',
    weight: 0.03,
    distance: categorical((p) => p.tokens.spacingScale),
  },
  {
    id: 'tokens.spacingMultiplier',
    weight: 0.03,
    distance: numeric((p) => p.tokens.spacingMultiplier, 0.4),
  },
  {
    id: 'tokens.borderRadius',
    weight: 0.04,
    distance: categorical((p) => p.tokens.borderRadius),
  },
  {
    id: 'tokens.borderRadiusMultiplier',
    weight: 0.03,
    distance: numeric((p) => p.tokens.borderRadiusMultiplier, 0.6),
  },
  {
    id: 'tokens.borderStyle',
    weight: 0.03,
    distance: categorical((p) => p.tokens.borderStyle),
  },
  {
    id: 'tokens.borderWidth',
    weight: 0.02,
    distance: numeric((p) => parseLeadingNumber(p.tokens.borderWidth), 2),
  },
  {
    id: 'tokens.shadowIntensity',
    weight: 0.02,
    distance: categorical((p) => p.tokens.shadowIntensity),
  },
  {
    id: 'tokens.shadowMultiplier',
    weight: 0.02,
    distance: numeric((p) => p.tokens.shadowMultiplier, 0.4),
  },
  {
    // Workstream B2 (2026-07-18 refactor plan / joint 07-14 plan B2):
    // shadowProfile is a genuine shape discriminator (layered / diffuse /
    // hard-offset / neon / technical / minimal / playful-drop) on top of
    // shadowIntensity's magnitude scaling, so it earns its own categorical
    // dimension here rather than folding into shadowIntensity above.
    id: 'tokens.shadowProfile',
    weight: 0.03,
    distance: categorical((p) => p.tokens.shadowProfile),
  },

  // ---- Animation (0.10) ----
  {
    id: 'animations.speed',
    weight: 0.03,
    distance: categorical((p) => p.animations.speed),
  },
  {
    id: 'animations.duration.normal',
    weight: 0.03,
    // ~250ms delta is the point a duration reads as a different "speed class".
    distance: numeric((p) => parseMs(p.animations.duration.normal), 250),
  },
  {
    id: 'animations.prefersReducedMotion',
    weight: 0.02,
    distance: categorical((p) => p.animations.prefersReducedMotion),
  },
  {
    id: 'animations.easing',
    weight: 0.02,
    distance: categorical((p) => p.animations.easing),
  },

  // ---- Presentation (0.08) ----
  {
    id: 'presentation.border.radius',
    weight: 0.02,
    distance: categorical((p) => p.presentation?.border.radius),
  },
  {
    id: 'presentation.shadow.style',
    weight: 0.02,
    distance: categorical((p) => p.presentation?.shadow.style),
  },
  {
    id: 'presentation.animation.style',
    weight: 0.02,
    distance: categorical((p) => p.presentation?.animation.style),
  },
  {
    id: 'presentation.components.button.textTransform',
    weight: 0.02,
    distance: categorical(
      (p) => p.presentation?.components.button.textTransform
    ),
  },

  // ---- Color generation + icon (0.08) ----
  {
    id: 'colorGeneration.shadowTint',
    weight: 0.02,
    distance: categorical((p) => p.colorGeneration.shadowTint),
  },
  {
    id: 'colorGeneration.shadowOpacity',
    weight: 0.02,
    distance: numeric((p) => p.colorGeneration.shadowOpacity, 0.08),
  },
  {
    id: 'colorGeneration.backgroundLuminosity',
    weight: 0.01,
    distance: numeric((p) => p.colorGeneration.backgroundLuminosity, 15),
  },
  {
    id: 'colorGeneration.neutralSaturation',
    weight: 0.01,
    distance: numeric((p) => p.colorGeneration.neutralSaturation, 15),
  },
  {
    id: 'iconStyle',
    weight: 0.02,
    distance: categorical((p) => p.iconStyle),
  },
  {
    // Workstream C1/D3 (2026-07-18 refactor plan): page-background pattern
    // presence/type is now a genuine per-personality visual dimension (10 of
    // 12 personalities render a distinct pattern; `classic`/`foundation` are
    // the documented flat exceptions). Small weight, same categorical style
    // as `tokens.shadowProfile` above.
    id: 'pageBackground.pattern',
    weight: 0.02,
    distance: categorical(pageBackgroundSignature),
  },

  // ---- Surface character (0.03, Workstream E1/D3, Phase 5b) ----
  {
    // Every predefined personality authors a `surfaceHueBias`
    // ('none'/'primary'/'warm'/'cool', mirroring `shadowTint`'s vocabulary),
    // so this is a genuine categorical dimension the same way
    // `colorGeneration.shadowTint` is above, not an optional field with a
    // meaningful "both undefined" case.
    id: 'colorGeneration.surfaceHueBias',
    weight: 0.015,
    distance: categorical((p) => p.colorGeneration.surfaceHueBias),
  },
  {
    // Authored range is roughly -1..-7 (Workstream E1 spread the previous
    // -1..-4, mostly-−2 cluster across 7 unique values); ~3 points is the
    // point an elevation lift reads as clearly deeper/shallower than
    // another personality's, so that's the JND scale here.
    id: 'colorGeneration.surfaceLuminosityOffset',
    weight: 0.015,
    distance: numeric((p) => p.colorGeneration.surfaceLuminosityOffset, 3),
  },
];

const TOTAL_WEIGHT = FIELD_SPECS.reduce((sum, f) => sum + f.weight, 0);

/**
 * Per-field contribution breakdown for a single pair, useful for debugging
 * why two personalities scored the way they did.
 */
export interface PersonalityFieldBreakdown {
  id: string;
  weight: number;
  distance: number;
}

/**
 * Computes the JND-aware perceptual distance between two personalities.
 * `0` means identical across every compared dimension; `1` means maximally
 * different across every compared dimension. In practice values cluster well
 * inside `(0, 1)` because personalities always share *some* dimensions.
 */
export function personalityDistance(a: Personality, b: Personality): number {
  const weightedSum = FIELD_SPECS.reduce(
    (sum, field) => sum + field.weight * clamp01(field.distance(a, b)),
    0
  );
  return clamp01(weightedSum / TOTAL_WEIGHT);
}

/**
 * Per-field breakdown of the distance between two personalities, sorted by
 * contribution (largest first). Handy for diagnosing why a pair scored low.
 */
export function personalityDistanceBreakdown(
  a: Personality,
  b: Personality
): PersonalityFieldBreakdown[] {
  return FIELD_SPECS.map((field) => ({
    id: field.id,
    weight: field.weight,
    distance: clamp01(field.distance(a, b)),
  })).sort((x, y) => y.weight * y.distance - x.weight * x.distance);
}

export interface PersonalityPairDistance {
  a: Personality;
  b: Personality;
  distance: number;
}

/**
 * Computes the perceptual distance for every unordered pair in
 * `personalities`. Order is not significant (`distance(a, b) === distance(b, a)`).
 */
export function allPairDistances(
  personalities: readonly Personality[]
): PersonalityPairDistance[] {
  const pairs: PersonalityPairDistance[] = [];
  for (let i = 0; i < personalities.length; i++) {
    for (let j = i + 1; j < personalities.length; j++) {
      pairs.push({
        a: personalities[i],
        b: personalities[j],
        distance: personalityDistance(personalities[i], personalities[j]),
      });
    }
  }
  return pairs;
}

/**
 * The minimum pairwise distance across `personalities` — i.e. how close the
 * two most similar personalities in the set are. Returns `Infinity` if fewer
 * than two personalities are given.
 */
export function minPairDistance(personalities: readonly Personality[]): number {
  const closest = closestPair(personalities);
  return closest ? closest.distance : Infinity;
}

/**
 * The single closest (most similar / least distinct) pair in `personalities`,
 * or `undefined` if fewer than two are given.
 */
export function closestPair(
  personalities: readonly Personality[]
): PersonalityPairDistance | undefined {
  const pairs = allPairDistances(personalities);
  if (pairs.length === 0) return undefined;
  return pairs.reduce((min, pair) =>
    pair.distance < min.distance ? pair : min
  );
}
