import { ApplicationInitStatus, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FontLoadingService } from './font-loading.service';
import { GradientFactory } from './gradient-factory';
import {
  THEME_DEFAULTS,
  provideProductTheme,
  provideThemeDefaults,
} from './theme-defaults';
import { ThemeService } from './theme.service';

const STORAGE_KEY = 'optimistic-tanuki-personality-theme';

describe('theme defaults', () => {
  interface FontLoadingDouble {
    loadPersonalityFonts: jest.Mock;
    applyFontVariables: jest.Mock;
  }

  let fonts: FontLoadingDouble;

  const configure = (providers: unknown[] = []) => {
    fonts = {
      loadPersonalityFonts: jest.fn().mockResolvedValue([]),
      applyFontVariables: jest.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: FontLoadingService, useValue: fonts },
        GradientFactory,
        ...(providers as never[]),
      ],
    });
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-mode');
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('falls back to classic in light mode when the app declares nothing', () => {
    configure();
    const service = TestBed.inject(ThemeService);

    expect(service.getCurrentPersonality().id).toBe('classic');
    expect(service.getTheme()).toBe('light');
    expect(service.getPersonalityConfig().primaryColor).toBe('#3f51b5');
  });

  it('starts in the app defaults when the user has saved nothing', () => {
    configure([
      provideThemeDefaults({
        personalityId: 'control-center',
        mode: 'dark',
        primaryColor: '#d97706',
      }),
    ]);
    const service = TestBed.inject(ThemeService);

    expect(service.getCurrentPersonality().id).toBe('control-center');
    expect(service.getTheme()).toBe('dark');
    expect(service.getPersonalityConfig().primaryColor).toBe('#d97706');
    expect(service.hasStoredPreference()).toBe(false);
    expect(fonts.loadPersonalityFonts).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'control-center' })
    );
  });

  it('does not save the defaults as though the user had chosen them', () => {
    configure([provideProductTheme('forgeofwill')]);
    TestBed.inject(ThemeService);

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('lets a saved user theme win over the app defaults', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        personalityId: 'elegant',
        primaryColor: '#123456',
        mode: 'light',
        version: '1.0.0',
      })
    );
    configure([provideProductTheme('marketing-generator')]);
    const service = TestBed.inject(ThemeService);
    await Promise.resolve();

    expect(service.getCurrentPersonality().id).toBe('elegant');
    expect(service.getTheme()).toBe('light');
    expect(service.hasStoredPreference()).toBe(true);
  });

  it('saves the user choice once they pick a personality', async () => {
    configure([provideProductTheme('forgeofwill')]);
    const service = TestBed.inject(ThemeService);

    await service.setPersonality('minimal');

    expect(service.hasStoredPreference()).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual(
      expect.objectContaining({ personalityId: 'minimal' })
    );
  });

  it('follows the operating system when the default mode is auto', () => {
    const matchMedia = jest.fn().mockReturnValue({ matches: true });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: matchMedia,
    });
    configure([
      provideThemeDefaults({
        personalityId: 'architect',
        mode: 'auto',
        primaryColor: '#0d7a66',
      }),
    ]);
    const service = TestBed.inject(ThemeService);

    expect(service.getTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores an unknown default personality', () => {
    configure([
      provideThemeDefaults({
        personalityId: 'does-not-exist',
        mode: 'light',
        primaryColor: '#3f51b5',
      }),
    ]);

    expect(TestBed.inject(ThemeService).getCurrentPersonality().id).toBe(
      'classic'
    );
  });

  it('stamps the resolved mode as both data-mode and data-theme', () => {
    configure([provideProductTheme('store-client')]);
    const service = TestBed.inject(ThemeService);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    service.setTheme('light');

    expect(document.documentElement.getAttribute('data-mode')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('applies the theme while the app initializes, before anything injects the service', async () => {
    document.body.className = '';
    configure([provideProductTheme('d6')]);

    await TestBed.inject(ApplicationInitStatus).donePromise;

    expect(TestBed.inject(THEME_DEFAULTS).personalityId).toBe('soft-touch');
    expect(document.body.classList.contains('personality-soft-touch')).toBe(
      true
    );
  });
});
