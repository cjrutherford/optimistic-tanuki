import {
  generateComplementaryHarmony,
  generateTriadicHarmony,
  generateAnalogousHarmony,
  generateSplitComplementaryHarmony,
  generateTetradicHarmony,
  generateHarmonyHues,
  adjustSaturation,
  adjustLightness,
  generateHarmonyColor,
  generatePerceptualShades,
  generateSemanticColors,
  calculateColorTemperature,
  generatePersonalityColors,
  getHarmonyDescription,
  generateShadowTintColor,
  generateShadowColor,
  resolveShadowOpacity,
  generatePageBackgroundPattern,
  generateThemeResponsiveColors,
} from './color-harmony';
import { ColorHarmonyType } from '@optimistic-tanuki/theme-models';

const HEX_RE = /^#[0-9a-f]{6}$/i;

describe('color-harmony', () => {
  describe('harmony hue generators', () => {
    it('generates complementary hues 180 degrees apart', () => {
      expect(generateComplementaryHarmony(200)).toEqual([200, 20]);
    });

    it('generates triadic hues at 120 degree intervals', () => {
      expect(generateTriadicHarmony(0)).toEqual([0, 120, 240]);
    });

    it('generates analogous hues with the default spread', () => {
      expect(generateAnalogousHarmony(180)).toEqual([150, 180, 210]);
    });

    it('generates analogous hues with a custom spread and wraps around 0', () => {
      expect(generateAnalogousHarmony(10, 20)).toEqual([350, 10, 30]);
    });

    it('generates split-complementary hues', () => {
      expect(generateSplitComplementaryHarmony(100)).toEqual([100, 250, 310]);
    });

    it('generates tetradic hues at 90 degree intervals', () => {
      expect(generateTetradicHarmony(10)).toEqual([10, 100, 190, 280]);
    });
  });

  describe('generateHarmonyHues', () => {
    const cases: ColorHarmonyType[] = [
      'complementary',
      'triadic',
      'analogous',
      'split-complementary',
      'tetradic',
    ];

    it.each(cases)('dispatches to the %s harmony generator', (type) => {
      const result = generateHarmonyHues(50, type);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('respects a custom spread for analogous harmony', () => {
      expect(generateHarmonyHues(180, 'analogous', { spread: 10 })).toEqual([
        170, 180, 190,
      ]);
    });

    it('falls back to complementary for an unknown type', () => {
      expect(generateHarmonyHues(50, 'nonsense' as ColorHarmonyType)).toEqual(
        generateComplementaryHarmony(50)
      );
    });
  });

  describe('adjustSaturation', () => {
    it('boosts saturation within default bounds', () => {
      expect(adjustSaturation(50, 0.2)).toBe(60);
    });

    it('clamps to the target minimum', () => {
      expect(adjustSaturation(5, -0.9, 20, 100)).toBe(20);
    });

    it('clamps to the target maximum', () => {
      expect(adjustSaturation(90, 5, 20, 100)).toBe(100);
    });
  });

  describe('adjustLightness', () => {
    it('shifts lightness within default bounds', () => {
      expect(adjustLightness(50, 0.1)).toBe(60);
    });

    it('clamps to the minimum', () => {
      expect(adjustLightness(10, -0.5, 15, 95)).toBe(15);
    });

    it('clamps to the maximum', () => {
      expect(adjustLightness(90, 0.5, 15, 95)).toBe(95);
    });
  });

  describe('generateHarmonyColor', () => {
    it('derives a color using computed saturation and lightness', () => {
      const result = generateHarmonyColor(
        { h: 0, s: 50, l: 50 },
        120,
        0.1,
        0.1
      );
      expect(result).toMatch(HEX_RE);
    });

    it('honors explicit saturation and lightness overrides', () => {
      const result = generateHarmonyColor(
        { h: 0, s: 50, l: 50 },
        120,
        0.1,
        0.1,
        80,
        30
      );
      expect(result).toMatch(HEX_RE);
    });
  });

  describe('generatePerceptualShades', () => {
    const curves = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;

    it.each(curves)('generates the requested number of %s shades', (curve) => {
      const shades = generatePerceptualShades('#3f51b5', 5, curve);
      expect(shades).toHaveLength(5);
      shades.forEach((shade) => expect(shade).toMatch(HEX_RE));
    });

    it('defaults to 10 ease-in-out shades', () => {
      const shades = generatePerceptualShades('#3f51b5');
      expect(shades).toHaveLength(10);
    });

    it('falls back to linear for an unrecognized curve', () => {
      const shades = generatePerceptualShades('#3f51b5', 4, 'bogus' as never);
      expect(shades).toHaveLength(4);
    });

    it('handles an invalid base color gracefully', () => {
      const shades = generatePerceptualShades('not-a-color', 3);
      expect(shades).toHaveLength(3);
    });
  });

  describe('generateSemanticColors', () => {
    it('generates success, warning, danger and info colors', () => {
      const colors = generateSemanticColors(210, 60, 50);
      expect(colors.success).toMatch(HEX_RE);
      expect(colors.warning).toMatch(HEX_RE);
      expect(colors.danger).toMatch(HEX_RE);
      expect(colors.info).toMatch(HEX_RE);
    });

    it('clamps saturation and lightness at their upper bounds', () => {
      const colors = generateSemanticColors(210, 100, 100);
      expect(colors.success).toMatch(HEX_RE);
      expect(colors.danger).toMatch(HEX_RE);
    });
  });

  describe('calculateColorTemperature', () => {
    it('treats red/yellow hues as warm', () => {
      expect(calculateColorTemperature(30)).toBeGreaterThan(0);
    });

    it('treats magenta-to-red hues (>=300) as warm', () => {
      expect(calculateColorTemperature(330)).toBeGreaterThan(0);
    });

    it('treats green-to-blue hues as cool', () => {
      expect(calculateColorTemperature(180)).toBeLessThan(0);
    });

    it('treats intermediate hues as neutral', () => {
      expect(calculateColorTemperature(90)).toBe(0);
      expect(calculateColorTemperature(270)).toBe(0);
    });
  });

  describe('generatePersonalityColors', () => {
    it('generates primary/secondary/tertiary colors for a harmony type', () => {
      const result = generatePersonalityColors(
        '#3f51b5',
        'complementary',
        0.1,
        0.1
      );
      expect(result.primary).toMatch(HEX_RE);
      expect(result.secondary).toMatch(HEX_RE);
      expect(result.tertiary).toMatch(HEX_RE);
    });

    it('honors accent saturation/lightness overrides', () => {
      const result = generatePersonalityColors(
        '#3f51b5',
        'triadic',
        0.1,
        0.1,
        70,
        40
      );
      expect(result.primaryHsl.s).toBe(70);
      expect(result.primaryHsl.l).toBe(40);
    });

    it('falls back to the complement when the harmony has only two hues', () => {
      const result = generatePersonalityColors(
        '#3f51b5',
        'complementary',
        0.1,
        0.1
      );
      expect(result.tertiary).toMatch(HEX_RE);
    });
  });

  describe('getHarmonyDescription', () => {
    const cases: [ColorHarmonyType, string][] = [
      ['complementary', 'High contrast colors opposite on the color wheel'],
      ['triadic', 'Three evenly spaced colors for balanced vibrancy'],
      ['analogous', 'Adjacent colors for harmonious, cohesive feel'],
      ['split-complementary', 'Base color with two adjacent to its complement'],
      ['tetradic', 'Four colors in rectangular formation for variety'],
    ];

    it.each(cases)('describes %s', (type, description) => {
      expect(getHarmonyDescription(type)).toBe(description);
    });

    it('returns an empty string for an unknown type', () => {
      expect(getHarmonyDescription('bogus' as ColorHarmonyType)).toBe('');
    });
  });

  describe('generateShadowTintColor', () => {
    it('returns pure black for a neutral tint', () => {
      expect(generateShadowTintColor('#3f51b5', 'neutral', 'light')).toEqual({
        r: 0,
        g: 0,
        b: 0,
      });
    });

    it('generates a tinted color for primary-tint in light and dark mode', () => {
      const light = generateShadowTintColor('#3f51b5', 'primary-tint', 'light');
      const dark = generateShadowTintColor('#3f51b5', 'primary-tint', 'dark');
      expect(light).not.toEqual(dark);
    });

    it('generates a fixed warm tint', () => {
      const result = generateShadowTintColor('#3f51b5', 'warm', 'light');
      expect(result.r).toBeGreaterThan(result.b);
    });

    it('generates a fixed cool tint', () => {
      const result = generateShadowTintColor('#3f51b5', 'cool', 'light');
      expect(result.b).toBeGreaterThan(result.r);
    });

    it('falls back to black for an unknown tint', () => {
      expect(
        generateShadowTintColor('#3f51b5', 'bogus' as never, 'light')
      ).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('generateShadowColor', () => {
    it('bakes the legacy alpha for each tint/mode combination', () => {
      expect(generateShadowColor('#3f51b5', 'neutral', 'light')).toBe(
        'rgba(0, 0, 0, 0.1)'
      );
      expect(generateShadowColor('#3f51b5', 'neutral', 'dark')).toBe(
        'rgba(0, 0, 0, 0.5)'
      );
      expect(generateShadowColor('#3f51b5', 'primary-tint', 'light')).toMatch(
        /^rgba\(\d+, \d+, \d+, 0\.15\)$/
      );
      expect(generateShadowColor('#3f51b5', 'warm', 'dark')).toMatch(
        /^rgba\(\d+, \d+, \d+, 0\.45\)$/
      );
      expect(generateShadowColor('#3f51b5', 'cool', 'light')).toMatch(
        /^rgba\(\d+, \d+, \d+, 0\.12\)$/
      );
    });
  });

  describe('resolveShadowOpacity', () => {
    it('returns the base opacity unchanged in light mode', () => {
      expect(resolveShadowOpacity(0.2, 'light')).toBe(0.2);
    });

    it('scales up opacity for dark mode', () => {
      expect(resolveShadowOpacity(0.1, 'dark')).toBeCloseTo(0.3);
    });

    it('clamps dark-mode opacity at the maximum', () => {
      expect(resolveShadowOpacity(0.25, 'dark')).toBe(0.6);
    });
  });

  describe('generatePageBackgroundPattern', () => {
    it('rewrites fill attributes with the tint color and hex opacity', () => {
      const pattern = '<rect fill="#000000" />';
      const result = generatePageBackgroundPattern(
        '#3f51b5',
        pattern,
        true,
        0.5,
        'light'
      );
      expect(result).toMatch(/fill="#[0-9a-f]{6}[0-9a-f]{2}"/i);
    });

    it('uses a neutral tint when usePrimaryTint is false', () => {
      const pattern = '<rect fill="#000000" />';
      const result = generatePageBackgroundPattern(
        '#3f51b5',
        pattern,
        false,
        0.2,
        'dark'
      );
      expect(result).toMatch(/fill="#[0-9a-f]{8}"/i);
    });

    it('does not rewrite url(#...) fills', () => {
      const pattern = '<rect fill="url(#grad1)" /><rect fill="#000" />';
      const result = generatePageBackgroundPattern(
        '#3f51b5',
        pattern,
        true,
        0.5,
        'light'
      );
      expect(result).toContain('fill="url(#grad1)"');
    });
  });

  describe('generateThemeResponsiveColors', () => {
    const baseParams = {
      backgroundLuminosity: 95,
      surfaceLuminosityOffset: -5,
      foregroundContrast: 80,
      secondaryLuminosityOffset: 20,
      mutedLuminosityOffset: 35,
      neutralSaturation: 10,
      darkModeLuminosityScale: 20,
      darkModeSaturationBoost: 5,
    };

    it('generates a full color set in light mode', () => {
      const colors = generateThemeResponsiveColors(
        '#3f51b5',
        baseParams,
        'light'
      );
      expect(colors.background).toMatch(HEX_RE);
      expect(colors.foreground).toMatch(HEX_RE);
      expect(colors.surface).toMatch(HEX_RE);
      expect(colors.muted).toMatch(HEX_RE);
      expect(colors.border).toMatch(HEX_RE);
      expect(colors.overlay).toMatch(/^#[0-9a-f]{6}80$/i);
    });

    it('generates a full color set in dark mode with an 80% overlay', () => {
      const colors = generateThemeResponsiveColors(
        '#3f51b5',
        baseParams,
        'dark'
      );
      expect(colors.overlay).toMatch(/^#[0-9a-f]{6}CC$/i);
    });

    it('applies a hue bias and saturation shift to the surface color', () => {
      const neutral = generateThemeResponsiveColors(
        '#3f51b5',
        baseParams,
        'light'
      );
      const warm = generateThemeResponsiveColors(
        '#3f51b5',
        { ...baseParams, surfaceHueBias: 'warm', surfaceSaturationShift: 20 },
        'light'
      );
      const cool = generateThemeResponsiveColors(
        '#3f51b5',
        { ...baseParams, surfaceHueBias: 'cool', surfaceSaturationShift: 20 },
        'light'
      );
      const primaryBias = generateThemeResponsiveColors(
        '#3f51b5',
        {
          ...baseParams,
          surfaceHueBias: 'primary',
          surfaceSaturationShift: 20,
        },
        'light'
      );
      expect(warm.surface).not.toBe(neutral.surface);
      expect(cool.surface).not.toBe(neutral.surface);
      expect(primaryBias.surface).toMatch(HEX_RE);
    });

    it('falls back toward the neutral surface when a large saturation shift fails contrast', () => {
      const colors = generateThemeResponsiveColors(
        '#3f51b5',
        { ...baseParams, surfaceHueBias: 'warm', surfaceSaturationShift: 90 },
        'light',
        7
      );
      expect(colors.surface).toMatch(HEX_RE);
    });
  });
});
