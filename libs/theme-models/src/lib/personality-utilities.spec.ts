import {
  PREDEFINED_PERSONALITIES,
  getPersonalityById,
  getDefaultPersonality,
  getPersonalityIds,
  getPersonalitiesByCategory,
  isValidPersonalityId,
  getPersonalityPreviewColors,
} from './personalities';

describe('personality lookup helpers', () => {
  it('getPersonalityById finds an existing personality', () => {
    const personality = getPersonalityById('classic');
    expect(personality?.id).toBe('classic');
  });

  it('getPersonalityById returns undefined for an unknown id', () => {
    expect(getPersonalityById('does-not-exist')).toBeUndefined();
  });

  it('getDefaultPersonality returns the classic personality', () => {
    expect(getDefaultPersonality().id).toBe('classic');
    expect(getDefaultPersonality()).toBe(PREDEFINED_PERSONALITIES[0]);
  });

  it('getPersonalityIds returns every predefined personality id', () => {
    const ids = getPersonalityIds();
    expect(ids).toEqual(PREDEFINED_PERSONALITIES.map((p) => p.id));
    expect(ids).toContain('classic');
    expect(ids).toContain('bold');
  });

  it('getPersonalitiesByCategory filters by category', () => {
    const technical = getPersonalitiesByCategory('technical');
    expect(technical.length).toBeGreaterThan(0);
    expect(technical.every((p) => p.category === 'technical')).toBe(true);

    const creative = getPersonalitiesByCategory('creative');
    expect(creative.every((p) => p.category === 'creative')).toBe(true);
  });

  it('getPersonalitiesByCategory returns an empty array when nothing matches', () => {
    expect(getPersonalitiesByCategory('nonexistent' as never)).toEqual([]);
  });

  it('isValidPersonalityId validates known and unknown ids', () => {
    expect(isValidPersonalityId('classic')).toBe(true);
    expect(isValidPersonalityId('nope')).toBe(false);
  });
});

describe('getPersonalityPreviewColors', () => {
  it('derives light and dark preview colors from the default primary color', () => {
    const personality = getPersonalityById('classic');
    const colors = getPersonalityPreviewColors(personality!);

    expect(colors.light).toHaveLength(2);
    expect(colors.dark).toHaveLength(2);
    colors.light.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
    colors.dark.forEach((c) => expect(c).toMatch(/^#[0-9a-f]{6}$/i));
  });

  it('accepts a custom primary color', () => {
    const personality = getPersonalityById('electric');
    const colors = getPersonalityPreviewColors(personality!, '#00ff88');
    expect(colors.light[0]).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('falls back to hue 0 for an invalid primary color', () => {
    const personality = getPersonalityById('bold');
    const colors = getPersonalityPreviewColors(personality!, 'not-a-color');
    expect(colors.light).toHaveLength(2);
    expect(colors.dark).toHaveLength(2);
  });

  it('produces distinct previews across every predefined personality', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      const colors = getPersonalityPreviewColors(personality, '#3f51b5');
      expect(colors.light[0]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.dark[1]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('handles an achromatic primary color (equal r/g/b)', () => {
    const personality = getPersonalityById('foundation');
    const colors = getPersonalityPreviewColors(personality!, '#808080');
    expect(colors.light[0]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
