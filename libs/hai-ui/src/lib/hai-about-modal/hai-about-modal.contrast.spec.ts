import { getContrastRatio } from '@optimistic-tanuki/theme-lib';

/**
 * Automated WCAG 2.1 AA contrast verification for the brand tokens used by the
 * HAI directory app cards (see hai-about-modal.component.scss).
 *
 * These pairs are intentionally checked against the lower-contrast ("cream")
 * end of the card surface gradient so the assertions stay conservative. The
 * card lives on a light glass modal, so the cream surface is the worst case for
 * the dark brand foregrounds.
 */
describe('HAI app card contrast (WCAG 2.1 AA)', () => {
  // Worst-case opaque approximation of the card surface gradient bottom stop
  // (rgba(248, 242, 228, 0.92)).
  const CARD_SURFACE = '#f8f2e4';

  // Brand foreground tokens declared on .directory-card.
  const INK = '#1f2a24'; // --hai-card-ink (card name + body text)
  const MUTED = '#3f5347'; // --hai-card-muted (tagline)
  const LABEL = '#5a6e61'; // --hai-card-label (category eyebrow)
  const GREEN = '#214232'; // --hai-card-green (primary button bg)
  const GREEN_STRONG = '#11502f'; // --hai-card-green-strong (status + repo link)
  const ON_GREEN = '#f8f3e8'; // primary button text

  const AA_NORMAL = 4.5;
  const AA_LARGE_UI = 3;

  const normalTextPairs: Array<[string, string, string]> = [
    ['card name / body ink', INK, CARD_SURFACE],
    ['tagline muted', MUTED, CARD_SURFACE],
    ['category label', LABEL, CARD_SURFACE],
    ['status + repository link text', GREEN_STRONG, CARD_SURFACE],
    ['primary button text on green', ON_GREEN, GREEN],
  ];

  it.each(normalTextPairs)(
    'meets AA normal-text contrast for %s',
    (_label, foreground, background) => {
      expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(
        AA_NORMAL
      );
    }
  );

  it('keeps the primary button border/affordance distinct from the surface', () => {
    // The solid green button against the card surface is a UI component edge.
    expect(getContrastRatio(GREEN, CARD_SURFACE)).toBeGreaterThanOrEqual(
      AA_LARGE_UI
    );
  });
});
