/**
 * @jest-environment jsdom
 *
 * See `personality-backgrounds.spec.ts` for why this file opts back into
 * jsdom via the per-file docblock pragma above (theme-models' shared jest
 * config runs `testEnvironment: 'node'`; this is the only reason this file
 * needs a DOM — a real, spec-compliant `DOMParser`).
 */
import { PREDEFINED_PERSONALITIES } from './personalities';

/**
 * Surface-texture contract tests (Workstream C3, 2026-07-18 refactor plan).
 * `surfaceTexture` is deliberately a SMALL curated set, not "one per
 * personality" like `pageBackground` — only personalities whose stated
 * character is literally tactile/textured get one. This locks:
 *
 * - Every declared `surfaceTexture.pattern` is well-formed SVG.
 * - No pattern uses `url(#...)` fill indirection (same runtime-substitution
 *   hazard `pageBackground` patterns must avoid — see
 *   `personality-backgrounds.spec.ts`'s "never uses url(#...)" test and
 *   `generatePageBackgroundPattern`'s doc comment in theme-lib).
 * - Every authored opacity sits in `(0, 0.05]` — the tighter cap this
 *   dimension carries because it paints under running text, vs.
 *   `pageBackground`'s 0.08 cap.
 * - The curated set is EXACTLY `{soft-touch, control-center, architect,
 *   electric}` — asserted by name so an accidental addition (or removal) is
 *   a deliberate, reviewed decision, not a silent drift.
 */
const CURATED_SURFACE_TEXTURE_IDS = [
  'soft-touch',
  'control-center',
  'architect',
  'electric',
] as const;
const MAX_SURFACE_TEXTURE_OPACITY = 0.05;

function parseSvg(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('personality surface textures', () => {
  it('declares surfaceTexture on exactly the curated set', () => {
    const idsWithTexture = PREDEFINED_PERSONALITIES.filter(
      (p) => !!p.surfaceTexture
    )
      .map((p) => p.id)
      .sort();

    expect(idsWithTexture).toEqual([...CURATED_SURFACE_TEXTURE_IDS].sort());
  });

  it('gives every curated personality a parseable SVG texture pattern', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      if (!personality.surfaceTexture) continue;

      const { pattern } = personality.surfaceTexture;
      expect(typeof pattern).toBe('string');
      expect(pattern.length).toBeGreaterThan(0);

      const doc = parseSvg(pattern);
      const parserError = doc.getElementsByTagName('parsererror');
      expect({
        id: personality.id,
        parserErrors: Array.from(parserError).map((n) => n.textContent),
      }).toEqual({ id: personality.id, parserErrors: [] });

      expect(doc.documentElement?.tagName.toLowerCase()).toBe('svg');
    }
  });

  it('keeps every authored surfaceTexture.opacity within (0, 0.05]', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      if (!personality.surfaceTexture) continue;

      expect(personality.surfaceTexture.opacity).toBeGreaterThan(0);
      expect(personality.surfaceTexture.opacity).toBeLessThanOrEqual(
        MAX_SURFACE_TEXTURE_OPACITY
      );
    }
  });

  // Same carry-over hazard `pageBackground` patterns must avoid (see
  // `personality-backgrounds.spec.ts`): `generatePageBackgroundPattern`
  // rewrites every `fill="..."` attribute wholesale, including
  // `url(#...)` references into a `<defs>`/`<pattern>` element — orphaning
  // the definition and painting a flat, uncontrolled wash instead of the
  // authored motif.
  it('never uses url(#...) fill indirection in any authored texture pattern', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      if (!personality.surfaceTexture) continue;
      expect(personality.surfaceTexture.pattern).not.toContain('url(#');
    }
  });

  // The runtime fill substitution only rewrites `fill="..."` attributes
  // (stroke is left untouched, uncontrolled by opacity) — every authored
  // texture must carry its "ink" via `fill`.
  it('carries its ink via fill (not stroke) so opacity substitution controls it', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      if (!personality.surfaceTexture) continue;
      expect(personality.surfaceTexture.pattern).toMatch(/fill="/);
    }
  });
});
