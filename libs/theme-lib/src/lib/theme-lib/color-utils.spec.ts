import {
  hexToRgb,
  generateColorShades,
  generateComplementaryColor,
  generateTertiaryColor,
  generateSuccessColor,
  generateDangerColor,
  generateWarningColor,
} from './color-utils';

describe('color-utils', () => {
  describe('hexToRgb', () => {
    it('parses a hex color with a leading #', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('parses a hex color without a leading #', () => {
      expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('returns null for an invalid hex color', () => {
      expect(hexToRgb('not-a-color')).toBeNull();
    });
  });

  describe('generateColorShades', () => {
    it('generates 10 shades by default', () => {
      const shades = generateColorShades('#3366ff');
      expect(shades).toHaveLength(10);
      expect(shades[0][0]).toBe('0');
      expect(shades.every(([, hex]) => /^#[0-9a-f]{6}$/i.test(hex))).toBe(true);
    });

    it('respects the limit parameter', () => {
      const shades = generateColorShades('#3366ff', 3);
      expect(shades).toHaveLength(3);
    });

    it('returns the original color for each shade when the input is invalid', () => {
      const shades = generateColorShades('not-a-color', 2);
      expect(shades).toEqual([
        ['0', 'not-a-color'],
        ['1', 'not-a-color'],
      ]);
    });
  });

  describe('generateComplementaryColor', () => {
    it('inverts a valid hex color', () => {
      expect(generateComplementaryColor('#000000')).toBe('#ffffff');
      expect(generateComplementaryColor('#ffffff')).toBe('#000000');
    });

    it('returns the input unchanged for an invalid hex color', () => {
      expect(generateComplementaryColor('nope')).toBe('nope');
    });
  });

  describe('generateTertiaryColor', () => {
    it('shifts an achromatic color toward blue', () => {
      const result = generateTertiaryColor('#808080');
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('shifts a saturated color and respects custom factors', () => {
      const result = generateTertiaryColor('#ff0000', 0.5, 0.4);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('returns the input unchanged for an invalid hex color', () => {
      expect(generateTertiaryColor('nope')).toBe('nope');
    });
  });

  describe('generateSuccessColor', () => {
    it('shifts hue toward green', () => {
      expect(generateSuccessColor('#3366ff')).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('returns the input unchanged for an invalid hex color', () => {
      expect(generateSuccessColor('nope')).toBe('nope');
    });

    it('clamps saturation and lightness at their maximums', () => {
      const result = generateSuccessColor('#ff00ff', 5, 5);
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  describe('generateDangerColor', () => {
    it('shifts hue toward red', () => {
      expect(generateDangerColor('#3366ff')).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('returns the input unchanged for an invalid hex color', () => {
      expect(generateDangerColor('nope')).toBe('nope');
    });
  });

  describe('generateWarningColor', () => {
    it('shifts hue toward yellow', () => {
      expect(generateWarningColor('#3366ff')).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('returns the input unchanged for an invalid hex color', () => {
      expect(generateWarningColor('nope')).toBe('nope');
    });
  });
});
