import {
  PRODUCT_PERSONALITIES,
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

  it('exposes a descriptor for every mapped product', () => {
    for (const project of Object.keys(PRODUCT_PERSONALITIES)) {
      expect(getProductDescriptor(project)).toBeDefined();
    }
  });
});
