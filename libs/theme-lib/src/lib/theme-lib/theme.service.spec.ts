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
      providers: [ThemeService, { provide: PLATFORM_ID, useValue: 'browser' }],
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
    expect(rootStyle.getPropertyValue('--personality-font-weight')).toBe(
      '400'
    );
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
});
