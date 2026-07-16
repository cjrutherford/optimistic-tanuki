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
import { getPersonalityById } from '@optimistic-tanuki/theme-models';

jest.mock('./color-utils', () => ({
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
      expect(boldShadow).toBe(bold?.presentation?.shadow.value);
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
      expect(minimalShadow).toBe(minimal?.presentation?.shadow.value);
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
});
