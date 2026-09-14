import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FontLoadingService } from './font-loading.service';
import { GradientFactory } from './gradient-factory';
import { ThemeService } from './theme.service';

describe('personality interaction and label tokens', () => {
  const root = document.documentElement;
  const read = (name: string) => root.style.getPropertyValue(name).trim();

  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: FontLoadingService,
          useValue: {
            loadPersonalityFonts: jest.fn().mockResolvedValue([]),
            applyFontVariables: jest.fn(),
          },
        },
        GradientFactory,
      ],
    });
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('emits the treatments a personality declares', async () => {
    await service.setPersonality('architect');

    expect(read('--personality-hover-shadow')).toBe('4px 4px 0 var(--primary)');
    expect(read('--personality-hover-transform')).toBe('translate(-2px, -2px)');
    expect(read('--personality-accent-border')).toBe(
      '2px solid var(--foreground)'
    );
    expect(read('--personality-label-font-family')).toBe('var(--font-mono)');
    expect(read('--personality-label-text-transform')).toBe('uppercase');
    expect(read('--personality-input-focus-style')).toBe(
      '4px 4px 0 var(--primary)'
    );
  });

  it('clears treatments the next personality does not declare, so component fallbacks apply', async () => {
    await service.setPersonality('architect');
    await service.setPersonality('classic');

    for (const name of [
      '--personality-hover-transform',
      '--personality-hover-shadow',
      '--personality-active-transform',
      '--personality-active-shadow',
      '--personality-accent-border',
      '--personality-label-font-family',
      '--personality-label-text-transform',
      '--personality-label-letter-spacing',
    ]) {
      expect({ name, value: read(name) }).toEqual({ name, value: '' });
    }
  });
});
