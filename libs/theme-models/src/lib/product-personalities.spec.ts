import {
  PRODUCT_PERSONALITIES,
  PRODUCT_THEME_DEFAULTS,
  DEFAULT_PRIMARY_COLOR,
  getProductThemeDefaults,
  PRODUCT_DESCRIPTORS,
  DEFAULT_PERSONALITY_ID,
  getProductPersonality,
  getProductPersonalityId,
  getProductsForPersonality,
  getProductDescriptor,
  assertProductPersonalitiesAreValid,
} from './product-personalities';
import { PREDEFINED_PERSONALITIES } from './personalities';

describe('product-personalities', () => {
  it('maps every product to a registered personality', () => {
    expect(() => assertProductPersonalitiesAreValid()).not.toThrow();
  });

  it('exposes a default personality id that resolves', () => {
    const ids = PREDEFINED_PERSONALITIES.map((p) => p.id);
    expect(ids).toContain(DEFAULT_PERSONALITY_ID);
  });

  it('returns the canonical personality for a mapped product', () => {
    const personality = getProductPersonality('forgeofwill');
    expect(personality.id).toBe('bold');
  });

  it('falls back to the default for unmapped products', () => {
    const id = getProductPersonalityId('does-not-exist');
    expect(id).toBe(DEFAULT_PERSONALITY_ID);
  });

  it('supports inverse lookup', () => {
    const products = getProductsForPersonality('bold');
    expect(products).toContain('forgeofwill');
  });

  it('descriptors agree with the mapping', () => {
    for (const descriptor of PRODUCT_DESCRIPTORS) {
      expect(PRODUCT_PERSONALITIES[descriptor.project]).toBe(
        descriptor.personalityId
      );
    }
  });

  it('declares theme defaults for every described product', () => {
    for (const descriptor of PRODUCT_DESCRIPTORS) {
      expect(getProductDescriptor(descriptor.project)).toBe(descriptor);
      expect(PRODUCT_THEME_DEFAULTS[descriptor.project]).toBeDefined();
    }
  });

  it('derives the personality mapping from the theme defaults', () => {
    for (const [project, defaults] of Object.entries(PRODUCT_THEME_DEFAULTS)) {
      expect(PRODUCT_PERSONALITIES[project]).toBe(defaults.personalityId);
    }
  });

  it('gives every product a hex primary colour and a known mode', () => {
    for (const defaults of Object.values(PRODUCT_THEME_DEFAULTS)) {
      expect(defaults.primaryColor).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(['light', 'dark', 'auto']).toContain(defaults.mode);
    }
  });

  it('returns the declared defaults for a mapped product', () => {
    expect(getProductThemeDefaults('marketing-generator')).toEqual({
      personalityId: 'control-center',
      mode: 'dark',
      primaryColor: '#d97706',
    });
  });

  it('falls back to classic in light mode for unmapped products', () => {
    expect(getProductThemeDefaults('does-not-exist')).toEqual({
      personalityId: DEFAULT_PERSONALITY_ID,
      mode: 'light',
      primaryColor: DEFAULT_PRIMARY_COLOR,
    });
  });
});
