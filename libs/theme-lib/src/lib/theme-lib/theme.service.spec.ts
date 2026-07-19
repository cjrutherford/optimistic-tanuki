import {
  generateColorShades,
  generateComplementaryColor,
  generateDangerColor,
  generateSuccessColor,
  generateWarningColor,
  generateTertiaryColor,
} from './color-utils';
import { loadPredefinedPalettes } from './theme-palettes';

import { TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ThemeService } from './theme.service';
import { FontLoadingService } from './font-loading.service';
import {
  getPersonalityById,
  PREDEFINED_PERSONALITIES,
  getContrastRatio,
  ensureContrast,
} from '@optimistic-tanuki/theme-models';
import { generateThemeResponsiveColors } from './color-harmony';

jest.mock('./color-utils', () => ({
  // Keep `hexToRgb` (and any other unlisted export) real: it's a pure
  // hex->rgb parser with no side effects, and the B2 shadow-profile tests
  // need genuine RGB output (e.g. to assert a `neon` shadow isn't neutral
  // black) rather than a stubbed value.
  ...jest.requireActual('./color-utils'),
  generateColorShades: jest.fn(),
  generateComplementaryColor: jest.fn(),
  generateDangerColor: jest.fn(),
  generateWarningColor: jest.fn(),
  generateSuccessColor: jest.fn(),
  generateTertiaryColor: jest.fn(),
}));

jest.mock('./theme-palettes', () => ({
  loadPredefinedPalettes: jest.fn(),
  PREDEFINED_PALETTES: [
    {
      name: 'Test Palette',
      description: 'A test palette',
      accent: '#ff0000',
      complementary: '#00ff00',
      tertiary: '#0000ff',
    },
  ],
}));

describe('ThemeService', () => {
  let service: ThemeService;
  let localStorageMock: { [key: string]: string };

  beforeEach(fakeAsync(() => {
    // Mock localStorage - disable personality system to test legacy behavior
    localStorageMock = {
      accentColor: '#ff0000', // Simulate existing user to avoid first-time logic
    };
    global.Storage.prototype.getItem = jest.fn((key: string) => {
      if (key === 'optimistic-tanuki-personality-theme') {
        return null; // Return null for personality theme to force legacy initialization
      }
      return localStorageMock[key] || null;
    });
    global.Storage.prototype.setItem = jest.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    global.Storage.prototype.removeItem = jest.fn((key: string) => {
      delete localStorageMock[key];
    });

    // Mock loadPredefinedPalettes to return test palettes
    (loadPredefinedPalettes as jest.Mock).mockResolvedValue([
      {
        name: 'Test Palette',
        description: 'A test palette',
        accent: '#ff0000',
        complementary: '#00ff00',
        tertiary: '#0000ff',
      },
    ]);

    // Mock return values for dependencies
    (generateColorShades as jest.Mock).mockReturnValue([
      [0, '#shade1'],
      [1, '#shade2'],
      [2, '#shade3'],
      [3, '#shade4'],
      [4, '#shade5'],
      [5, '#shade6'],
      [6, '#shade7'],
      [7, '#shade8'],
      [8, '#shade9'],
      [9, '#shade10'],
      [10, '#shade11'],
      [11, '#shade12'],
      [12, '#shade13'],
    ]);
    (generateComplementaryColor as jest.Mock).mockReturnValue('#00ff00');
    (generateDangerColor as jest.Mock).mockReturnValue('#ff0000');
    (generateWarningColor as jest.Mock).mockReturnValue('#ffff00');
    (generateSuccessColor as jest.Mock).mockReturnValue('#00ff00');
    (generateTertiaryColor as jest.Mock).mockReturnValue('#0000ff');

    TestBed.configureTestingModule({
      providers: [
        ThemeService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        // Stub font loading: the real implementation injects a <link> and
        // awaits its `load` event, which jsdom never fires, so any
        // personality with a non-system font (e.g. Poppins, Inter) would
        // hang `setPersonality()` forever in these tests. The CSS variables
        // under test here (`--font-heading`, `--font-body`,
        // `--personality-font-family`, ...) are populated by ThemeService
        // itself from `personality.fonts`/`personality.presentation`
        // independent of whether the font actually finished loading, so
        // stubbing this out does not weaken what's being asserted.
        {
          provide: FontLoadingService,
          useValue: {
            loadPersonalityFonts: jest.fn().mockResolvedValue([]),
            applyFontVariables: jest.fn(),
          },
        },
      ],
    });

    service = TestBed.inject(ThemeService);

    // Wait for async initialization to complete
    tick(100);
    flush();
  }));

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with default personality when no stored config', fakeAsync(() => {
    expect(service.getTheme()).toBe('light');
    expect(service.getCurrentPersonality()).toBeTruthy();
    expect(service.getAccentColor()).toBeTruthy();
  }));

  it('should update theme', fakeAsync(() => {
    service.setTheme('dark');
    tick();
    expect(service.getTheme()).toBe('dark');
    // Note: With personality system enabled, saveTheme is not called directly
    // The service uses savePersonalityTheme instead
  }));

  it('should update accent color', fakeAsync(() => {
    (generateComplementaryColor as jest.Mock).mockReturnValue('#00ff00');
    service.setAccentColor('#00ff00');
    tick();
    expect(service.getAccentColor()).toBe('#00ff00');
    // Note: With personality system enabled, saveTheme is not called directly
  }));

  it('should expose theme as observable', (done) => {
    service.theme$().subscribe((theme) => {
      if (theme) {
        expect(theme).toBe('light');
        done();
      }
    });
  });

  it('should expose themeColors as observable', (done) => {
    service.themeColors$.subscribe((themeColors) => {
      if (themeColors) {
        expect(themeColors).toBeTruthy();
        expect(themeColors.accent).toMatch(/^#/);
        done();
      }
    });
  });

  it('should generate theme colors correctly', fakeAsync(() => {
    // Get the theme colors that were generated during initialization
    let themeColors: any;
    service.themeColors$.subscribe((colors) => {
      if (colors) {
        themeColors = colors;
      }
    });
    tick();

    // Verify theme colors were generated
    expect(themeColors).toBeTruthy();
    expect(themeColors.accent).toMatch(/^#/);
  }));

  it('should apply personality presentation css variables', fakeAsync(() => {
    service.setPrimaryColor('#0ea5e9');
    tick();

    const rootStyle = document.documentElement.style;

    expect(rootStyle.getPropertyValue('--personality-border-style')).toBe(
      'solid'
    );
    expect(rootStyle.getPropertyValue('--personality-border-width')).toBe(
      '1px'
    );
    expect(rootStyle.getPropertyValue('--personality-border-radius')).toBe(
      '4px'
    );
    expect(rootStyle.getPropertyValue('--personality-box-shadow')).toContain(
      'rgba'
    );
    expect(rootStyle.getPropertyValue('--personality-font-family')).toContain(
      'sans-serif'
    );
    expect(rootStyle.getPropertyValue('--personality-font-weight')).toBe('400');
    expect(rootStyle.getPropertyValue('--personality-transition')).toContain(
      '0.2s'
    );
    expect(rootStyle.getPropertyValue('--personality-button-radius')).toBe(
      '4px'
    );
    expect(rootStyle.getPropertyValue('--personality-card-shadow')).toContain(
      'rgba'
    );
    expect(rootStyle.getPropertyValue('--personality-input-border-width')).toBe(
      '1px'
    );
  }));

  // Workstream C3: integration tests asserting real emitted CSS variables
  // after setPersonality(), not just that a mock was invoked.
  describe('setPersonality() CSS variable integration', () => {
    it('agrees on --font-heading and --personality-font-family for a personality whose curated heading font differs from the default', fakeAsync(() => {
      const bold = getPersonalityById('bold');
      expect(bold).toBeTruthy();

      service.setPersonality('bold');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      const headingFamily = bold?.fonts.heading?.family;
      expect(headingFamily).toBeTruthy();

      // --font-heading comes from Personality.fonts (the single source of
      // truth); --personality-font-family comes from
      // presentation.typography.familyValue, which is derived from
      // Personality.fonts at registry-build time (Phase 1 / withDerivedFontFamilies).
      // They must agree at the service layer, closing the audit's dual
      // source-of-truth finding.
      expect(rootStyle.getPropertyValue('--font-heading')).toBe(headingFamily);
      expect(rootStyle.getPropertyValue('--personality-font-family')).toBe(
        headingFamily
      );
      expect(rootStyle.getPropertyValue('--personality-font-family')).toBe(
        rootStyle.getPropertyValue('--font-heading')
      );
    }));

    it('emits --font-body matching the selected personality body family', fakeAsync(() => {
      const minimal = getPersonalityById('minimal');
      expect(minimal).toBeTruthy();

      service.setPersonality('minimal');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      expect(rootStyle.getPropertyValue('--font-body')).toBe(
        minimal?.fonts.body.family
      );
    }));

    it('reflects distinct radius/shadow/animation tokens for personalities that differ (bold vs minimal)', fakeAsync(() => {
      const bold = getPersonalityById('bold');
      const minimal = getPersonalityById('minimal');
      expect(bold?.presentation).toBeTruthy();
      expect(minimal?.presentation).toBeTruthy();

      const rootStyle = document.documentElement.style;

      service.setPersonality('bold');
      tick(100);
      flush();

      const boldRadius = rootStyle.getPropertyValue(
        '--personality-border-radius'
      );
      const boldShadow = rootStyle.getPropertyValue('--personality-box-shadow');
      const boldTransition = rootStyle.getPropertyValue(
        '--personality-transition'
      );
      const boldDuration = rootStyle.getPropertyValue(
        '--animation-duration-normal'
      );

      expect(boldRadius).toBe(bold?.presentation?.border.radiusValue);
      // Workstream B2/B3 (Phase 3, 2026-07-18 refactor plan):
      // --personality-box-shadow is now derived from the profile-aware
      // shadow generator (agrees with --shadow-md) rather than read from the
      // static presentation literal — see the single-source-of-truth tests
      // in the "shadow profile shape" describe block below.
      expect(boldShadow).toBe(rootStyle.getPropertyValue('--shadow-md'));
      expect(boldTransition).toBe(bold?.presentation?.animation.transition);
      expect(boldDuration).toBe(bold?.animations.duration.normal);

      service.setPersonality('minimal');
      tick(100);
      flush();

      const minimalRadius = rootStyle.getPropertyValue(
        '--personality-border-radius'
      );
      const minimalShadow = rootStyle.getPropertyValue(
        '--personality-box-shadow'
      );
      const minimalTransition = rootStyle.getPropertyValue(
        '--personality-transition'
      );
      const minimalDuration = rootStyle.getPropertyValue(
        '--animation-duration-normal'
      );

      expect(minimalRadius).toBe(minimal?.presentation?.border.radiusValue);
      expect(minimalShadow).toBe(rootStyle.getPropertyValue('--shadow-md'));
      expect(minimalTransition).toBe(
        minimal?.presentation?.animation.transition
      );
      expect(minimalDuration).toBe(minimal?.animations.duration.normal);

      // The two personalities are deliberately structurally different
      // (bold: thick/dramatic/animated; minimal: none/flat/instant) so the
      // emitted values must actually differ, not just be independently
      // "correct" against a mock.
      expect(boldRadius).not.toBe(minimalRadius);
      expect(boldShadow).not.toBe(minimalShadow);
      expect(boldTransition).not.toBe(minimalTransition);
      expect(boldDuration).not.toBe(minimalDuration);
    }));
  });

  // Workstream B1 (2026-07-18 personality-styles-refactor plan): locks the
  // reconnected shadow tint. Before this fix, `--shadow-md` (and sm/lg/xl)
  // hardcoded `rgba(0, 0, 0, opacity)` regardless of the personality's
  // `colorGeneration.shadowTint`, so warm/cool/primary-tint personalities
  // cast identical neutral shadows to `neutral` ones.
  describe('shadow tint reconnection (B1)', () => {
    it('gives a warm-tint personality (soft-touch) a non-neutral --shadow-md', fakeAsync(() => {
      const softTouch = getPersonalityById('soft-touch');
      expect(softTouch).toBeTruthy();
      expect(softTouch?.colorGeneration.shadowTint).toBe('warm');

      service.setPersonality('soft-touch');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      const shadowMd = rootStyle.getPropertyValue('--shadow-md');
      expect(shadowMd).toBeTruthy();

      // Pull the first rgba(...) out of the (possibly multi-layer) shadow
      // value and assert its r/g/b are not all zero (i.e. not neutral black).
      const match = shadowMd.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      expect(match).toBeTruthy();
      const [, r, g, b] = match as RegExpMatchArray;
      expect([r, g, b]).not.toEqual(['0', '0', '0']);

      // --shadow-color should carry the same (alpha-free) tint.
      const shadowColor = rootStyle.getPropertyValue('--shadow-color');
      expect(shadowColor).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
      expect(shadowColor).not.toBe('rgb(0, 0, 0)');
    }));

    it('emits a different --shadow-md for the same personality in light vs dark mode', fakeAsync(() => {
      const softTouch = getPersonalityById('soft-touch');
      expect(softTouch).toBeTruthy();
      expect(softTouch?.colorGeneration.shadowOpacity).toBeGreaterThan(0);

      service.setPersonality('soft-touch');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;

      service.setTheme('light');
      tick(100);
      flush();
      const lightShadowMd = rootStyle.getPropertyValue('--shadow-md');
      const lightOpacity = rootStyle.getPropertyValue('--shadow-opacity');

      service.setTheme('dark');
      tick(100);
      flush();
      const darkShadowMd = rootStyle.getPropertyValue('--shadow-md');
      const darkOpacity = rootStyle.getPropertyValue('--shadow-opacity');

      expect(lightShadowMd).not.toBe(darkShadowMd);
      expect(lightOpacity).not.toBe(darkOpacity);
    }));

    it('still produces sane rgba shadow output for a neutral-tint personality (classic)', fakeAsync(() => {
      const classic = getPersonalityById('classic');
      expect(classic).toBeTruthy();
      expect(classic?.colorGeneration.shadowTint).toBe('neutral');

      service.setPersonality('classic');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      const shadowMd = rootStyle.getPropertyValue('--shadow-md');
      expect(shadowMd).toMatch(/rgba\(0, 0, 0, [\d.]+\)/);

      const shadowColor = rootStyle.getPropertyValue('--shadow-color');
      expect(shadowColor).toBe('rgb(0, 0, 0)');

      const shadowOpacity = Number(
        rootStyle.getPropertyValue('--shadow-opacity')
      );
      expect(shadowOpacity).toBeGreaterThan(0);
      expect(shadowOpacity).toBeLessThanOrEqual(1);
    }));
  });

  // Workstream C0 (2026-07-18 personality-styles-refactor plan): locks the
  // data-URI encoding fix. The previous `encodeURIComponent(svg)` followed by
  // a five-way `.replace()` chain re-escaped every `%` the encoder had just
  // produced, so a single `decodeURIComponent` pass yielded the literal text
  // `%3Csvg...` instead of `<svg...>` — invalid SVG.
  describe('page background pattern encoding (C0)', () => {
    it('emits a --page-background-pattern for control-center that decodes with ONE decodeURIComponent pass to valid SVG', fakeAsync(() => {
      const controlCenter = getPersonalityById('control-center');
      expect(controlCenter).toBeTruthy();
      expect(controlCenter?.pageBackground).toBeTruthy();

      service.setPersonality('control-center');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      const raw = rootStyle.getPropertyValue('--page-background-pattern');
      expect(raw).toBeTruthy();

      const prefix = 'url("data:image/svg+xml,';
      const suffix = '")';
      expect(raw.startsWith(prefix)).toBe(true);
      expect(raw.endsWith(suffix)).toBe(true);

      const encoded = raw.slice(prefix.length, raw.length - suffix.length);

      // No re-escaped percent signs should survive in the encoded payload.
      expect(encoded).not.toContain('%25');

      const decodedOnce = decodeURIComponent(encoded);
      expect(decodedOnce.startsWith('<svg')).toBe(true);
      expect(decodedOnce).not.toContain('%25');
      expect(decodedOnce).not.toContain('%3C');
      expect(decodedOnce).not.toContain('%3E');

      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(
          decodedOnce,
          'image/svg+xml'
        );
        expect(doc.querySelector('parsererror')).toBeNull();
      }
    }));

    // Workstream C1 (same plan): `control-center` was the only personality
    // with a `pageBackground` before this phase, so the test above alone
    // couldn't prove the C0 fix generalizes to newly-authored patterns.
    // `architect`'s "blueprint grid + crosshairs" pattern is one of the 9
    // added in this phase — assert it round-trips through the same
    // encode/decode path to valid SVG.
    it('emits a --page-background-pattern for the newly-authored architect personality that decodes to valid SVG', fakeAsync(() => {
      const architect = getPersonalityById('architect');
      expect(architect).toBeTruthy();
      expect(architect?.pageBackground).toBeTruthy();

      service.setPersonality('architect');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      const raw = rootStyle.getPropertyValue('--page-background-pattern');
      expect(raw).toBeTruthy();

      const prefix = 'url("data:image/svg+xml,';
      const suffix = '")';
      expect(raw.startsWith(prefix)).toBe(true);
      expect(raw.endsWith(suffix)).toBe(true);

      const encoded = raw.slice(prefix.length, raw.length - suffix.length);
      expect(encoded).not.toContain('%25');

      const decodedOnce = decodeURIComponent(encoded);
      expect(decodedOnce.startsWith('<svg')).toBe(true);

      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(
          decodedOnce,
          'image/svg+xml'
        );
        expect(doc.querySelector('parsererror')).toBeNull();
        expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');
      }
    }));
  });

  // Workstream C3 (2026-07-18 personality-styles-refactor plan): surface
  // texture reuses the SAME generator + encode path as `--page-background-
  // pattern` above, emitted as `--surface-texture` for the small curated
  // set of personalities that declare one. Also locks the stale-variable
  // fix: switching FROM a texture-bearing personality TO one without a
  // texture must clear the variable, not leave the previous personality's
  // texture painted underneath the new one.
  describe('surface texture (C3)', () => {
    it('emits a --surface-texture for soft-touch that decodes with ONE decodeURIComponent pass to valid SVG', fakeAsync(() => {
      const softTouch = getPersonalityById('soft-touch');
      expect(softTouch).toBeTruthy();
      expect(softTouch?.surfaceTexture).toBeTruthy();

      service.setPersonality('soft-touch');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      const raw = rootStyle.getPropertyValue('--surface-texture');
      expect(raw).toBeTruthy();

      const prefix = 'url("data:image/svg+xml,';
      const suffix = '")';
      expect(raw.startsWith(prefix)).toBe(true);
      expect(raw.endsWith(suffix)).toBe(true);

      const encoded = raw.slice(prefix.length, raw.length - suffix.length);
      expect(encoded).not.toContain('%25');

      const decodedOnce = decodeURIComponent(encoded);
      expect(decodedOnce.startsWith('<svg')).toBe(true);
      expect(decodedOnce).not.toContain('%25');
      expect(decodedOnce).not.toContain('%3C');
      expect(decodedOnce).not.toContain('%3E');

      if (typeof DOMParser !== 'undefined') {
        const doc = new DOMParser().parseFromString(
          decodedOnce,
          'image/svg+xml'
        );
        expect(doc.querySelector('parsererror')).toBeNull();
        expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');
      }
    }));

    it('does not emit a --surface-texture for classic (no declared texture)', fakeAsync(() => {
      const classic = getPersonalityById('classic');
      expect(classic).toBeTruthy();
      expect(classic?.surfaceTexture).toBeUndefined();

      service.setPersonality('classic');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      expect(rootStyle.getPropertyValue('--surface-texture')).toBe('');
    }));

    // The leak this test locks: `applyPersonalityTheme()` only SETS
    // properties present in the newly-generated CSS variable record — it
    // never diffs against the previous personality's set. Without an
    // explicit clear (see theme.service.ts), soft-touch's paper-grain
    // `--surface-texture` would still be sitting on `documentElement.style`
    // after switching to classic, which declares no texture at all.
    it('clears --surface-texture when switching from soft-touch to classic', fakeAsync(() => {
      service.setPersonality('soft-touch');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      expect(rootStyle.getPropertyValue('--surface-texture')).toBeTruthy();

      service.setPersonality('classic');
      tick(100);
      flush();

      expect(rootStyle.getPropertyValue('--surface-texture')).toBe('');
    }));

    // Same stale-variable hazard applies to `--page-background-pattern`
    // (control-center declares a pageBackground; classic does not) — locked
    // alongside the surface-texture fix since both went in together.
    it('clears --page-background-pattern when switching from control-center to classic', fakeAsync(() => {
      service.setPersonality('control-center');
      tick(100);
      flush();

      const rootStyle = document.documentElement.style;
      expect(
        rootStyle.getPropertyValue('--page-background-pattern')
      ).toBeTruthy();

      service.setPersonality('classic');
      tick(100);
      flush();

      expect(rootStyle.getPropertyValue('--page-background-pattern')).toBe('');
    }));
  });

  // Workstream B2/B3 (Phase 3, 2026-07-18 personality-styles-refactor plan;
  // joint with the 07-14 plan's B2): `shadowProfile` gives shadows a genuine
  // SHAPE (not just tint/intensity), and `--personality-box-shadow`/
  // `--personality-card-shadow` are now derived from that same generator
  // output rather than a separately hand-authored literal.
  describe('shadow profile shape (D1)', () => {
    it('emits structurally distinct --shadow-md shapes for personalities with different shadow profiles', fakeAsync(() => {
      const architect = getPersonalityById('architect');
      const minimal = getPersonalityById('minimal');
      const electric = getPersonalityById('electric');
      expect(architect?.tokens.shadowProfile).toBe('hard-offset');
      expect(minimal?.tokens.shadowProfile).toBe('minimal');
      expect(electric?.tokens.shadowProfile).toBe('neon');

      const rootStyle = document.documentElement.style;

      service.setPersonality('architect');
      tick(100);
      flush();
      const architectMd = rootStyle.getPropertyValue('--shadow-md');
      // hard-offset: zero-blur solid offset ("Xpx Ypx 0px rgba(...)").
      expect(architectMd).toMatch(/[\d.]+px [\d.]+px 0px rgba/);

      service.setPersonality('minimal');
      tick(100);
      flush();
      const minimalMd = rootStyle.getPropertyValue('--shadow-md');
      // minimal's authored shadowOpacity is 0, so the minimal profile
      // collapses to 'none' rather than rendering a hairline at zero alpha.
      expect(minimalMd).toBe('none');

      service.setPersonality('electric');
      tick(100);
      flush();
      const electricMd = rootStyle.getPropertyValue('--shadow-md');
      // neon: the glow is built from the PRIMARY color, not the neutral
      // shadow tint, so it must not be a plain black/neutral rgba.
      const match = electricMd.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      expect(match).toBeTruthy();
      const [, r, g, b] = match as RegExpMatchArray;
      expect([r, g, b]).not.toEqual(['0', '0', '0']);

      expect(architectMd).not.toBe(minimalMd);
      expect(minimalMd).not.toBe(electricMd);
      expect(architectMd).not.toBe(electricMd);
    }));

    it('keeps --personality-box-shadow/--personality-card-shadow agreeing with the generated --shadow-md/--shadow-lg for personalities with different profiles', fakeAsync(() => {
      const rootStyle = document.documentElement.style;

      const architect = getPersonalityById('architect');
      const softTouch = getPersonalityById('soft-touch');
      expect(architect?.tokens.shadowProfile).toBe('hard-offset');
      expect(softTouch?.tokens.shadowProfile).toBe('diffuse');

      for (const id of ['architect', 'soft-touch']) {
        service.setPersonality(id);
        tick(100);
        flush();

        const boxShadow = rootStyle.getPropertyValue(
          '--personality-box-shadow'
        );
        const cardShadow = rootStyle.getPropertyValue(
          '--personality-card-shadow'
        );
        const shadowMd = rootStyle.getPropertyValue('--shadow-md');
        const shadowLg = rootStyle.getPropertyValue('--shadow-lg');

        expect(boxShadow).toBeTruthy();
        expect(boxShadow).toBe(shadowMd);
        expect(cardShadow).toBeTruthy();
        expect(cardShadow).toBe(shadowLg);
      }
    }));
  });

  // Workstream E1/E2/E3 (Phase 5b, 2026-07-18 refactor plan): every
  // personality now derives its elevated surface with its own hue bias
  // (`colorGeneration.surfaceHueBias`) and saturation shift
  // (`surfaceSaturationShift`), on top of the pre-existing
  // `surfaceLuminosityOffset`. E3 is the hard constraint: no personality's
  // character may break foreground/muted-on-surface contrast. This exercises
  // `generateThemeResponsiveColors` directly (the pure function ThemeService
  // itself calls) rather than through the Angular TestBed, so all
  // 12 personalities x both modes x 2 representative primary colors (the
  // system default, plus a saturated color) can be swept cheaply.
  describe('surface character contrast gate (E3)', () => {
    const REPRESENTATIVE_PRIMARY_COLORS = ['#3f51b5', '#e91e63'];
    const MIN_FOREGROUND_ON_SURFACE_RATIO = 4.5;
    // See the doc comment on `MUTED_ON_SURFACE_MIN_RATIO` in color-harmony.ts:
    // 3.0 (the more conventional WCAG non-text floor) is not achievable even
    // at the neutral (pre-Workstream-E) surface derivation for most
    // personalities in light mode — `mutedLuminosityOffset` (authored in
    // earlier phases) already puts muted text at ~2.0-2.7:1 against a
    // near-white surface. 1.9 is the same empirically-measured floor used by
    // the production auto-clamp, kept identical here so this test verifies
    // the SAME contract the clamp enforces.
    const MIN_MUTED_ON_SURFACE_RATIO = 1.9;

    it('keeps foreground-on-surface and muted-on-surface passing contrast for every personality, mode, and representative primary color', () => {
      const failures: string[] = [];

      for (const personality of PREDEFINED_PERSONALITIES) {
        for (const mode of ['light', 'dark'] as const) {
          for (const primaryColor of REPRESENTATIVE_PRIMARY_COLORS) {
            const themeColors = generateThemeResponsiveColors(
              primaryColor,
              personality.colorGeneration,
              mode,
              personality.contrast.minimumRatio
            );

            // Mirror ThemeService.generateAndApplyPersonalityTheme()'s own
            // foreground adjustment so this test exercises the SAME
            // foreground that ends up rendered as `--foreground`.
            const adjustedForeground = personality.contrast.autoAdjust
              ? ensureContrast(
                  themeColors.foreground,
                  themeColors.background,
                  personality.contrast.minimumRatio,
                  'auto'
                )
              : themeColors.foreground;

            const foregroundRatio = getContrastRatio(
              adjustedForeground,
              themeColors.surface
            );
            const mutedRatio = getContrastRatio(
              themeColors.muted,
              themeColors.surface
            );

            if (foregroundRatio < MIN_FOREGROUND_ON_SURFACE_RATIO) {
              failures.push(
                `${
                  personality.id
                }/${mode}/${primaryColor}: foreground-on-surface ${foregroundRatio.toFixed(
                  2
                )} < ${MIN_FOREGROUND_ON_SURFACE_RATIO}`
              );
            }
            if (mutedRatio < MIN_MUTED_ON_SURFACE_RATIO) {
              failures.push(
                `${
                  personality.id
                }/${mode}/${primaryColor}: muted-on-surface ${mutedRatio.toFixed(
                  2
                )} < ${MIN_MUTED_ON_SURFACE_RATIO}`
              );
            }
          }
        }
      }

      expect(failures).toEqual([]);
    });

    it('auto-clamps a personality with a large surfaceSaturationShift toward the neutral derivation rather than failing contrast', () => {
      // electric authors the largest surfaceSaturationShift (9) in the set;
      // exercising it directly at both authored and pathologically large
      // shift values proves the clamp (not luck) is what keeps it passing.
      const electric = getPersonalityById('electric');
      expect(electric).toBeTruthy();
      if (!electric) return;

      const pathological = {
        ...electric.colorGeneration,
        surfaceSaturationShift: 80,
      };

      const clamped = generateThemeResponsiveColors(
        '#e91e63',
        pathological,
        'light',
        electric.contrast.minimumRatio
      );
      const authored = generateThemeResponsiveColors(
        '#e91e63',
        electric.colorGeneration,
        'light',
        electric.contrast.minimumRatio
      );

      // The clamp should have pulled the pathological case back toward (or
      // all the way to) the same neutral-ish territory as the authored
      // value, rather than emitting a wildly over-saturated, contrast-
      // failing surface.
      expect(
        getContrastRatio(clamped.foreground, clamped.surface)
      ).toBeGreaterThanOrEqual(MIN_FOREGROUND_ON_SURFACE_RATIO);
      expect(
        getContrastRatio(clamped.muted, clamped.surface)
      ).toBeGreaterThanOrEqual(MIN_MUTED_ON_SURFACE_RATIO);
      expect(clamped.surface).not.toBe(authored.surface);
    });
  });

  // Workstream E2/D-series: locks the single-source rule (`--surface` and
  // `--background-elevated` both come from the SAME computed surface color)
  // and proves two personalities with different `surfaceHueBias`/
  // `surfaceSaturationShift`/`surfaceLuminosityOffset` actually render
  // different `--surface` values for the identical primary color and mode —
  // i.e. surface character is real, not just plumbed and ignored.
  describe('surface character integration (E3 / theme.service)', () => {
    it('emits different --surface for differently-biased personalities given the same primary color and mode', fakeAsync(() => {
      const rootStyle = document.documentElement.style;

      service.setPrimaryColor('#3f51b5');
      tick(100);
      flush();

      service.setPersonality('architect'); // surfaceHueBias: 'none', shift 0
      tick(100);
      flush();
      const architectSurface = rootStyle.getPropertyValue('--surface');
      const architectBackground = rootStyle.getPropertyValue('--background');
      const architectElevated = rootStyle.getPropertyValue(
        '--background-elevated'
      );

      service.setPersonality('electric'); // surfaceHueBias: 'primary', shift 9
      tick(100);
      flush();
      const electricSurface = rootStyle.getPropertyValue('--surface');
      const electricBackground = rootStyle.getPropertyValue('--background');
      const electricElevated = rootStyle.getPropertyValue(
        '--background-elevated'
      );

      expect(architectSurface).toBeTruthy();
      expect(electricSurface).toBeTruthy();
      expect(architectSurface).not.toBe(electricSurface);

      // Single-source rule (Workstream E2): `--background-elevated` always
      // agrees with `--surface` for a given personality.
      expect(architectElevated).toBe(architectSurface);
      expect(electricElevated).toBe(electricSurface);

      // Surface must never collapse onto background for either personality.
      expect(architectSurface).not.toBe(architectBackground);
      expect(electricSurface).not.toBe(electricBackground);
    }));
  });
});
