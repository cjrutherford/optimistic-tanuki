import { PREDEFINED_PERSONALITIES } from './personalities';
import {
  COMPOSITION_BY_ID,
  compositionDataAttributes,
  getPersonalityComposition,
  resolveCompositionVariables,
} from './personality-composition';
import type { PersonalityComposition } from './personality.interfaces';

const FIELDS: (keyof PersonalityComposition)[] = [
  'density',
  'shape',
  'header',
  'surface',
  'fill',
  'tabs',
  'feedback',
  'labelCase',
];

function differingFields(
  a: PersonalityComposition,
  b: PersonalityComposition
): (keyof PersonalityComposition)[] {
  return FIELDS.filter((field) => a[field] !== b[field]);
}

describe('personality composition', () => {
  it('attaches a composition to every predefined personality', () => {
    for (const personality of PREDEFINED_PERSONALITIES) {
      expect(personality.presentation?.composition).toEqual(
        COMPOSITION_BY_ID[personality.id]
      );
    }
    expect(Object.keys(COMPOSITION_BY_ID).sort()).toEqual(
      PREDEFINED_PERSONALITIES.map((p) => p.id).sort()
    );
  });

  it('gives every personality a unique combination', () => {
    const signatures = Object.values(COMPOSITION_BY_ID).map((c) =>
      FIELDS.map((field) => c[field]).join('|')
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('keeps every pair apart on at least two composition axes', () => {
    const ids = Object.keys(COMPOSITION_BY_ID);
    const tooClose: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const diff = differingFields(
          COMPOSITION_BY_ID[ids[i]],
          COMPOSITION_BY_ID[ids[j]]
        );
        if (diff.length < 2) tooClose.push(`${ids[i]} ~ ${ids[j]}`);
      }
    }
    expect(tooClose).toEqual([]);
  });

  it.each([
    ['classic', 'professional'],
    ['classic', 'foundation'],
    ['classic', 'minimal'],
    ['professional', 'foundation'],
    ['professional', 'minimal'],
    ['foundation', 'minimal'],
    ['soft', 'soft-touch'],
    ['bold', 'electric'],
  ])(
    'separates the previously look-alike pair %s / %s on at least three axes',
    (a, b) => {
      expect(
        differingFields(COMPOSITION_BY_ID[a], COMPOSITION_BY_ID[b]).length
      ).toBeGreaterThanOrEqual(3);
    }
  );

  it('emits the same variable keys for every composition so switching clears the previous one', () => {
    const keySets = Object.values(COMPOSITION_BY_ID).map((c) =>
      Object.keys(resolveCompositionVariables(c)).sort().join(',')
    );
    expect(new Set(keySets).size).toBe(1);
  });

  it('only leaves the primary fill empty for textured personalities', () => {
    for (const [id, composition] of Object.entries(COMPOSITION_BY_ID)) {
      const variables = resolveCompositionVariables(composition);
      for (const [key, value] of Object.entries(variables)) {
        if (
          key === '--personality-fill-primary' &&
          composition.fill === 'texture'
        ) {
          expect(value).toBe('');
        } else {
          expect({ id, key, value }).toEqual(
            expect.objectContaining({ value: expect.stringMatching(/\S/) })
          );
        }
      }
    }
  });

  it('mirrors the composition as data attributes', () => {
    expect(compositionDataAttributes(COMPOSITION_BY_ID['architect'])).toEqual({
      'data-density': 'comfortable',
      'data-shape': 'square',
      'data-header': 'bar',
      'data-surface': 'textured',
      'data-fill': 'texture',
      'data-tabs': 'segment',
      'data-feedback': 'stripe',
    });
  });

  it('falls back to classic for unknown ids', () => {
    expect(getPersonalityComposition('does-not-exist')).toBe(
      COMPOSITION_BY_ID['classic']
    );
  });
});
