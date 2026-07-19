/**
 * @jest-environment jsdom
 *
 * theme-models' shared jest.config.ts runs `testEnvironment: 'node'` (this
 * lib is framework-agnostic and has no other reason to need a DOM). This one
 * spec file opts back into jsdom via the per-file docblock pragma above,
 * purely to get a real, spec-compliant `DOMParser` for the SVG well-formed
 * -ness assertions below — cheaper and less invasive than switching the
 * whole project's test environment, or pulling in the `jsdom` package
 * directly (which drags in ESM-only transitive deps the SWC jest transform
 * doesn't handle).
 */
import { PREDEFINED_PERSONALITIES } from './personalities';

/**
 * Page-background contract tests (Workstream C1/D2, 2026-07-18 refactor
 * plan). Locks two things that would otherwise silently regress:
 *
 * - Every predefined personality either defines `pageBackground` or is on
 *   the documented flat-list (`classic`, `foundation`) — no personality is
 *   silently missing a pattern by omission.
 * - Every authored pattern is well-formed SVG (parsed with a real DOM
 *   parser, not just "looks like a string") and its `pageBackgroundOpacity`
 *   sits in `(0, 0.08]` — the plan's enforced authoring cap (stricter than
 *   the interface's documented 0-0.2 hard type-level range).
 */
const FLAT_PERSONALITY_IDS = ['classic', 'foundation'] as const;
const MAX_AUTHORED_OPACITY = 0.08;

function parseSvg(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('personality page backgrounds', () => {
  it('covers every predefined personality with a pattern or a documented flat entry', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      const isFlat = (FLAT_PERSONALITY_IDS as readonly string[]).includes(
        personality.id
      );
      if (isFlat) {
        expect(personality.pageBackground).toBeUndefined();
      } else {
        expect(personality.pageBackground).toBeDefined();
      }
    }
  });

  it('gives every non-flat personality a parseable SVG pattern', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      if (!personality.pageBackground) continue;

      const { pattern } = personality.pageBackground;
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

  it('keeps every authored pageBackgroundOpacity within (0, 0.08]', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      if (!personality.pageBackground) continue;

      expect(personality.colorGeneration.pageBackgroundOpacity).toBeGreaterThan(
        0
      );
      expect(
        personality.colorGeneration.pageBackgroundOpacity
      ).toBeLessThanOrEqual(MAX_AUTHORED_OPACITY);
    }
  });

  it('gives the documented flat personalities no pattern', () => {
    for (const id of FLAT_PERSONALITY_IDS) {
      const personality = PREDEFINED_PERSONALITIES.find((p) => p.id === id);
      expect(personality).toBeDefined();
      expect(personality?.pageBackground).toBeUndefined();
    }
  });

  it('exercises the runtime fill substitution used by generatePageBackgroundPattern', () => {
    // generatePageBackgroundPattern (theme-lib) replaces every `fill="..."`
    // attribute wholesale with the computed tint color, regardless of the
    // placeholder value — so authored patterns must carry their visible
    // "ink" via `fill`, not `stroke` (stroke is left untouched and would
    // render as static black, uncontrolled by pageBackgroundOpacity). Guard
    // that every authored (non-flat) pattern has at least one `fill`
    // attribute so this substitution has something to act on.
    for (const personality of PREDEFINED_PERSONALITIES) {
      if (!personality.pageBackground) continue;
      expect(personality.pageBackground.pattern).toMatch(/fill="/);
    }
  });

  // Carry-over bug fix (Phase 5b, Task 4, 2026-07-18 refactor plan):
  // `control-center`'s original pattern used `<rect fill="url(#grid)"/>`
  // indirection into a `<defs>`/`<pattern>` element — the runtime fill
  // substitution above rewrites every `fill="..."` wholesale, including
  // `url(#grid)`, orphaning the pattern definition and painting a flat wash
  // instead of the authored grid. Every authored pattern must carry its
  // "ink" via direct `fill` values, never `url(#...)` indirection.
  it('never uses url(#...) fill indirection in any authored pattern', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      if (!personality.pageBackground) continue;
      expect(personality.pageBackground.pattern).not.toContain('url(#');
    }
  });
});
