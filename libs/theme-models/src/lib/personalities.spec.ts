import {
  PREDEFINED_PERSONALITIES,
  getPersonalityById,
} from './personalities';

describe('personality presentation contract', () => {
  it('defines presentation traits for every predefined personality', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      expect(personality.presentation).toBeDefined();
      expect(personality.presentation.border.styleValue).toBeTruthy();
      expect(personality.presentation.border.widthValue).toMatch(/px$/);
      expect(personality.presentation.border.radiusValue).toMatch(/px$/);
      expect(personality.presentation.shadow.value).toBeTruthy();
      expect(personality.presentation.typography.familyValue).toBeTruthy();
      expect(personality.presentation.typography.weightValue).toBeTruthy();
      expect(personality.presentation.animation.duration).toMatch(/ms|s/);
      expect(
        personality.presentation.components.button.borderRadius
      ).toMatch(/px$/);
      expect(
        personality.presentation.components.card.boxShadow
      ).toBeTruthy();
      expect(
        personality.presentation.components.input.borderWidth
      ).toMatch(/px$/);
    }
  });

  it('matches the finalized bold personality presentation values', () => {
    const bold = getPersonalityById('bold');

    expect(bold?.presentation.border.styleValue).toBe('solid');
    expect(bold?.presentation.border.widthValue).toBe('3px');
    expect(bold?.presentation.border.radiusValue).toBe('8px');
    expect(bold?.presentation.shadow.value).toBe(
      '4px 4px 0px rgba(0,0,0,0.2)'
    );
    expect(bold?.presentation.typography.familyValue).toBe(
      "'Inter', -apple-system, sans-serif"
    );
    expect(bold?.presentation.typography.weightValue).toBe('700');
    expect(bold?.presentation.animation.duration).toBe('0.3s');
    expect(bold?.presentation.animation.timingFunction).toBe(
      'cubic-bezier(0.68, -0.55, 0.265, 1.55)'
    );
    expect(bold?.presentation.components.button.borderRadius).toBe('8px');
    expect(bold?.presentation.components.card.borderRadius).toBe('12px');
    expect(bold?.presentation.components.input.borderWidth).toBe('3px');
  });
});
