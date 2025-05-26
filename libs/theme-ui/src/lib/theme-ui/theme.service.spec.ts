import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';
import {
  generateColorShades,
  generateComplementaryColor,
  generateDangerColor,
  generateWarningColor,
  generateSuccessColor,
} from './color-utils';

import { loadTheme, saveTheme } from './theme-storage';
import { ThemeColors } from './theme.interface';
jest.mock('./color-utils', () => ({
  generateColorShades: jest.fn(),
  generateComplementaryColor: jest.fn(),
  generateDangerColor: jest.fn(),
  generateWarningColor: jest.fn(),
  generateSuccessColor: jest.fn(),
}));

jest.mock('./theme-storage', () => ({
  loadTheme: jest.fn(),
  saveTheme: jest.fn(),
}));

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    // Mock return values for dependencies
    (loadTheme as jest.Mock).mockReturnValue({
      theme: 'light',
      accentColor: '#ff0000',
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
    expect(saveTheme).toHaveBeenCalledWith('dark', '#ff0000');
    expect(document.documentElement.style.getPropertyValue('--background-color')).toBe('#333');
    expect(document.documentElement.style.getPropertyValue('--foreground-color')).toBe('#fff');
  });

  it('should update accent color and save it', () => {
    service.setAccentColor('#00ff00');
    expect(service.getAccentColor()).toBe('#00ff00');
    expect(saveTheme).toHaveBeenCalledWith('light', '#00ff00');
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

  it('should apply theme colors to document', () => {
    service.setTheme('dark');
    service.setAccentColor('#00ff00');
    expect(document.documentElement.style.getPropertyValue('--accent-color')).toBe('#00ff00');
    expect(document.documentElement.style.getPropertyValue('--background-color')).toBe('#333');
  });

  it('should generate theme colors correctly', () => {
    const themeColors = (service as any).generateThemeColors();
    expect(themeColors.accent).toBe('#ff0000');
    expect(generateColorShades).toHaveBeenCalledWith('#ff0000');
    expect(generateComplementaryColor).toHaveBeenCalledWith('#ff0000');
    expect(generateDangerColor).toHaveBeenCalledWith('#ff0000');
    expect(generateWarningColor).toHaveBeenCalledWith('#ff0000');
    expect(generateSuccessColor).toHaveBeenCalledWith('#ff0000');
  });
});