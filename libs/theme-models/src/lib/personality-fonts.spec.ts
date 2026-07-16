import { PREDEFINED_PERSONALITIES } from './personalities';

/**
 * Font source-of-truth regression guard (Workstream C2).
 *
 * The theme service emits `--font-heading`/`--font-body` from
 * `Personality.fonts` and `--personality-font-family` from
 * `presentation.typography.familyValue`. Historically these were authored
 * independently and diverged for half the personalities, so the same
 * personality rendered two different typefaces. These tests fail if the
 * presentation font-family values ever stop being derived from
 * `Personality.fonts`.
 */
describe('personality font source of truth', () => {
  it('derives presentation family values from Personality.fonts for every personality', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      const headingFamily =
        personality.fonts.heading?.family ?? personality.fonts.body.family;
      const bodyFamily = personality.fonts.body.family;
      const typography = personality.presentation?.typography;

      expect(typography).toBeDefined();
      // The primary personality family must match the heading font, so that
      // --personality-font-family and --font-heading never disagree.
      expect(typography?.familyValue).toBe(headingFamily);
      expect(typography?.headingFamilyValue).toBe(headingFamily);
      expect(typography?.bodyFamilyValue).toBe(bodyFamily);
    }
  });

  it('never emits a presentation font family that is absent from fonts', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      const known = new Set(
        [
          personality.fonts.heading?.family,
          personality.fonts.body.family,
          personality.fonts.mono?.family,
          personality.fonts.accent?.family,
        ].filter((f): f is string => !!f)
      );
      const typography = personality.presentation?.typography;

      expect(known.has(typography?.familyValue ?? '')).toBe(true);
      expect(known.has(typography?.bodyFamilyValue ?? '')).toBe(true);
    }
  });
});
