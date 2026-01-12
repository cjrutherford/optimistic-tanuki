import {
  generateColorShades,
  generateComplementaryColor,
  generateDangerColor,
  generateSuccessColor,
  generateWarningColor,
  generateTertiaryColor,
} from './color-utils';
import { loadTheme, saveTheme } from './theme-storage';
import { loadPredefinedPalettes } from './theme-palettes';

import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

jest.mock('./color-utils', () => ({
  generateColorShades: jest.fn(),
  generateComplementaryColor: jest.fn(),
  generateDangerColor: jest.fn(),
  generateWarningColor: jest.fn(),
  generateSuccessColor: jest.fn(),
  generateTertiaryColor: jest.fn(),
}));

jest.mock('./theme-storage', () => ({
  loadTheme: jest.fn(),
  saveTheme: jest.fn(),
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

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {
      'accentColor': '#ff0000', // Simulate existing user to avoid first-time logic
    };
    global.Storage.prototype.getItem = jest.fn((key: string) => localStorageMock[key] || null);
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
    (loadTheme as jest.Mock).mockReturnValue({
      theme: 'light',
      accentColor: '#ff0000',
      complementColor: '#00ff00',
      paletteMode: 'custom',
    });
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
      providers: [ThemeService],
    });

    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Clear mocks after each test
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with stored theme and accent color', () => {
    expect(service.getTheme()).toBe('light');
    expect(service.getAccentColor()).toBe('#ff0000');
    expect(loadTheme).toHaveBeenCalledTimes(1);
  });

  it('should update theme and save it', () => {
    service.setTheme('dark');
    expect(service.getTheme()).toBe('dark');
    expect(saveTheme).toHaveBeenCalledWith(expect.anything(), {
      theme: 'dark',
      accentColor: '#ff0000',
      complementColor: '#00ff00',
      paletteMode: 'custom',
      paletteName: undefined,
    });
  });

  it('should update accent color and save it', () => {
    service.setAccentColor('#00ff00');
    expect(service.getAccentColor()).toBe('#00ff00');
    expect(saveTheme).toHaveBeenCalledWith(expect.anything(), {
      theme: 'light',
      accentColor: '#00ff00',
      complementColor: '#00ff00',
      paletteMode: 'custom',
      paletteName: undefined,
    });
  });

  it('should expose theme as observable', (done) => {
    service.theme$().subscribe((theme) => {
      expect(theme).toBe('light');
      done();
    });
  });

  it('should expose themeColors as observable', (done) => {
    service.themeColors$.subscribe((themeColors) => {
      expect(themeColors).toBeTruthy();
      expect(themeColors!.accent).toBe('#ff0000');
      done();
    });
  });

  it('should generate theme colors correctly', () => {
    (service as any).complementColor = '#00ff00'; // Set complementColor to ensure generateComplementaryColor is called
    const themeColors = (service as any).generateThemeColors();
    expect(themeColors.accent).toBe('#ff0000');
    expect(generateColorShades).toHaveBeenCalledWith('#ff0000');
    expect(generateColorShades).toHaveBeenCalledWith('#00ff00');
    expect(generateTertiaryColor).toHaveBeenCalledWith('#ff0000');
    expect(generateDangerColor).toHaveBeenCalledWith('#ff0000');
    expect(generateWarningColor).toHaveBeenCalledWith('#ff0000');
    expect(generateSuccessColor).toHaveBeenCalledWith('#ff0000');
  });
});