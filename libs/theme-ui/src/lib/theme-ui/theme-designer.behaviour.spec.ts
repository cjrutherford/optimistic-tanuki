import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { ThemeDesignerComponent } from './theme-designer.component';

/**
 * The spec beside this one stands up a fixture and covers wiring. These drive
 * the designer's own logic -- gradient and shadow generation, and the palette
 * form's create/edit/delete paths, including the failures the theme service
 * signals by throwing.
 */
describe('ThemeDesignerComponent behaviour', () => {
  interface ThemeMock {
    getTheme: jest.Mock;
    getAccentColor: jest.Mock;
    setTheme: jest.Mock;
    setAccentColor: jest.Mock;
    setPalette: jest.Mock;
    setPrimaryColor: jest.Mock;
    getCurrentPalette: jest.Mock;
    isPredefinedPalette: jest.Mock;
    createCustomPalette: jest.Mock;
    updateCustomPalette: jest.Mock;
    deleteCustomPalette: jest.Mock;
    getPersonalityConfig: jest.Mock;
  }

  let theme: ThemeMock & {
    themeColors$: unknown;
    availablePalettes$: unknown;
  };

  const palette = (name: string) =>
    ({
      name,
      description: '',
      accent: '#111111',
      complementary: '#222222',
      tertiary: '#333333',
      background: { light: '#fff', dark: '#000' },
      foreground: { light: '#000', dark: '#fff' },
    } as never);

  const build = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: ThemeService, useValue: theme }],
    });

    return TestBed.runInInjectionContext(
      () => new ThemeDesignerComponent(theme as unknown as ThemeService)
    );
  };

  beforeEach(() => {
    theme = {
      getTheme: jest.fn().mockReturnValue('light'),
      getAccentColor: jest.fn().mockReturnValue('#3f51b5'),
      setTheme: jest.fn(),
      setAccentColor: jest.fn(),
      setPalette: jest.fn(),
      setPrimaryColor: jest.fn(),
      getCurrentPalette: jest.fn().mockReturnValue(undefined),
      isPredefinedPalette: jest.fn().mockReturnValue(false),
      createCustomPalette: jest.fn(),
      updateCustomPalette: jest.fn(),
      deleteCustomPalette: jest.fn(),
      getPersonalityConfig: jest
        .fn()
        .mockReturnValue({ primaryColor: '#3f51b5' }),
      themeColors$: of({ accent: '#aaaaaa', complementary: '#bbbbbb' }),
      availablePalettes$: of([palette('Ocean')]),
    };

    Object.assign(navigator, {
      clipboard: { writeText: jest.fn() },
    });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('ngOnInit', () => {
    it('adopts the current theme and the emitted colours', () => {
      const component = build();

      component.ngOnInit();

      expect(component.currentTheme).toBe('light');
      expect(component.accentColor).toBe('#aaaaaa');
      expect(component.complementaryColor).toBe('#bbbbbb');
      expect(component.availablePalettes).toHaveLength(1);
      // Both previews are generated up front so the page is never blank.
      expect(component.generatedGradient).not.toBe('');
      expect(component.generatedShadow).not.toBe('');

      component.ngOnDestroy();
    });

    it('keeps the existing colours when the stream emits nothing usable', () => {
      theme.themeColors$ = of(null);
      const component = build();
      const before = component.accentColor;

      component.ngOnInit();

      expect(component.accentColor).toBe(before);
      component.ngOnDestroy();
    });
  });

  describe('theme toggle', () => {
    it('flips between light and dark, telling the service each time', () => {
      const component = build();
      component.currentTheme = 'light';

      component.toggleTheme();
      expect(component.currentTheme).toBe('dark');
      expect(theme.setTheme).toHaveBeenLastCalledWith('dark');

      component.toggleTheme();
      expect(component.currentTheme).toBe('light');
      expect(theme.setTheme).toHaveBeenLastCalledWith('light');
    });
  });

  describe('accent colours', () => {
    it('pushes the accent through and mirrors it into the gradient', () => {
      const component = build();
      component.accentColor = '#123456';
      component.complementaryColor = '#654321';

      component.updateAccentColor();

      expect(theme.setAccentColor).toHaveBeenCalledWith('#123456');
      expect(component.gradientColors[0]).toBe('#123456');
      expect(component.gradientColors[1]).toBe('#654321');
    });

    it('sends both colours when the complement changes', () => {
      const component = build();
      component.accentColor = '#123456';
      component.complementaryColor = '#654321';

      component.updateComplementaryColor();

      expect(theme.setAccentColor).toHaveBeenCalledWith('#123456', '#654321');
    });

    it('forwards the primary colour', () => {
      const component = build();
      component.primaryColor = '#abcdef';

      component.updatePrimaryColor();

      expect(theme.setPrimaryColor).toHaveBeenCalledWith('#abcdef');
    });
  });

  describe('gradient editing', () => {
    it('adds a stop and regenerates', () => {
      const component = build();
      const before = component.gradientColors.length;

      component.addGradientColor();

      expect(component.gradientColors).toHaveLength(before + 1);
      expect(component.generatedGradient).toContain('#ffffff');
    });

    it('removes a stop once there are more than two', () => {
      const component = build();
      component.gradientColors = ['#111111', '#222222', '#333333'];

      component.removeGradientColor(1);

      expect(component.gradientColors).toEqual(['#111111', '#333333']);
    });

    it('refuses to drop below two stops', () => {
      const component = build();
      component.gradientColors = ['#111111', '#222222'];

      component.removeGradientColor(0);

      expect(component.gradientColors).toHaveLength(2);
    });

    it('replaces a single stop', () => {
      const component = build();
      component.gradientColors = ['#111111', '#222222'];

      component.updateGradientColor(1, '#999999');

      expect(component.gradientColors[1]).toBe('#999999');
      expect(component.generatedGradient).toContain('#999999');
    });

    it('builds a linear gradient from the direction and angle', () => {
      const component = build();
      component.selectedGradientType = 'linear';
      component.gradientColors = ['#111111', '#222222'];

      component.updateGradient();

      expect(component.generatedGradient).toContain('linear-gradient');
      expect(component.generatedGradient).toContain('#111111');
    });

    it('builds a radial gradient without direction', () => {
      const component = build();
      component.selectedGradientType = 'radial';

      component.updateGradient();

      expect(component.generatedGradient).toContain('radial-gradient');
    });

    it('builds a conic gradient from the angle alone', () => {
      const component = build();
      component.selectedGradientType = 'conic';

      component.updateGradient();

      expect(component.generatedGradient).toContain('conic-gradient');
    });

    it('takes type, colours, angle and direction from a preset', () => {
      const component = build();

      component.applyGradientPreset({
        name: 'Preset',
        type: 'linear',
        colors: ['#aaaaaa', '#bbbbbb'],
        angle: '45deg',
        direction: 'to right',
      } as never);

      expect(component.gradientColors).toEqual(['#aaaaaa', '#bbbbbb']);
      expect(component.gradientAngle).toBe('45deg');
      expect(component.gradientDirection).toBe('to right');
    });

    it('keeps the current angle when the preset omits one', () => {
      const component = build();
      component.gradientAngle = '90deg';

      component.applyGradientPreset({
        name: 'Preset',
        type: 'linear',
        colors: ['#aaaaaa', '#bbbbbb'],
      } as never);

      expect(component.gradientAngle).toBe('90deg');
    });

    it('copies the generated gradient', () => {
      const component = build();
      component.generatedGradient = 'linear-gradient(red, blue)';

      component.copyGradientToClipboard();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'linear-gradient(red, blue)'
      );
    });
  });

  describe('shadow editing', () => {
    it('converts the hex colour and opacity into an rgba shadow', () => {
      const component = build();
      component.shadowBlur = 10;
      component.shadowSpread = 4;
      component.shadowColor = '#ff8000';
      component.shadowOpacity = 0.5;

      component.updateShadow();

      expect(component.generatedShadow).toBe(
        '0 0 10px 4px rgba(255, 128, 0, 0.5)'
      );
    });

    it('takes a preset value verbatim', () => {
      const component = build();

      component.applyShadowPreset({ name: 'Subtle', value: '0 1px 2px red' });

      expect(component.generatedShadow).toBe('0 1px 2px red');
    });

    it('copies the generated shadow', () => {
      const component = build();
      component.generatedShadow = '0 0 1px black';

      component.copyShadowToClipboard();

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        '0 0 1px black'
      );
    });
  });

  describe('preview styles', () => {
    it('exposes the gradient and shadow as inline styles', () => {
      const component = build();
      component.generatedGradient = 'linear-gradient(red, blue)';
      component.generatedShadow = '0 0 1px black';

      expect(component.getGradientStyle()).toMatchObject({
        background: 'linear-gradient(red, blue)',
      });
      expect(component.getShadowStyle()).toMatchObject({
        boxShadow: '0 0 1px black',
      });
    });
  });

  describe('palette identification', () => {
    it('recognises the active palette by name', () => {
      const component = build();
      theme.getCurrentPalette.mockReturnValue(palette('Ocean'));

      expect(component.isCurrentPalette(palette('Ocean'))).toBe(true);
      expect(component.isCurrentPalette(palette('Forest'))).toBe(false);
    });

    it('is not the current palette when none is set', () => {
      const component = build();

      expect(component.isCurrentPalette(palette('Ocean'))).toBe(false);
    });

    it('treats anything not predefined as custom', () => {
      const component = build();
      theme.isPredefinedPalette.mockReturnValue(true);
      expect(component.isCustomPalette(palette('Ocean'))).toBe(false);

      theme.isPredefinedPalette.mockReturnValue(false);
      expect(component.isCustomPalette(palette('Mine'))).toBe(true);
    });

    it('applies a palette by name', () => {
      const component = build();

      component.applyPalette(palette('Ocean'));

      expect(theme.setPalette).toHaveBeenCalledWith('Ocean');
    });
  });

  describe('palette form', () => {
    it('opens blank for a new palette', () => {
      const component = build();

      component.startCreatePalette();

      expect(component.showPaletteForm).toBe(true);
      expect(component.paletteFormMode).toBe('create');
      expect(component.paletteFormData.name).toBe('');
      expect(component.originalPaletteName).toBeNull();
    });

    it('opens prefilled for an edit and remembers the original name', () => {
      const component = build();

      component.startEditPalette(palette('Ocean'));

      expect(component.paletteFormMode).toBe('edit');
      expect(component.paletteFormData.name).toBe('Ocean');
      expect(component.originalPaletteName).toBe('Ocean');
    });

    it('edits a copy, so cancelling cannot mutate the original', () => {
      const component = build();
      const original = palette('Ocean');

      component.startEditPalette(original);
      component.paletteFormData.name = 'Changed';

      expect((original as { name: string }).name).toBe('Ocean');
    });

    it('closes and resets on cancel', () => {
      const component = build();
      component.startEditPalette(palette('Ocean'));

      component.cancelPaletteForm();

      expect(component.showPaletteForm).toBe(false);
      expect(component.paletteFormData.name).toBe('');
      expect(component.originalPaletteName).toBeNull();
    });

    it('requires a name', () => {
      const component = build();
      component.startCreatePalette();
      component.paletteFormData.name = '   ';

      component.savePalette();

      expect(component.paletteFormError).toBe('Palette name is required');
      expect(theme.createCustomPalette).not.toHaveBeenCalled();
      expect(component.showPaletteForm).toBe(true);
    });

    it('creates and closes', () => {
      const component = build();
      component.startCreatePalette();
      component.paletteFormData.name = 'Mine';

      component.savePalette();

      expect(theme.createCustomPalette).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Mine' })
      );
      expect(component.showPaletteForm).toBe(false);
    });

    it('updates under the original name when renaming', () => {
      const component = build();
      component.startEditPalette(palette('Ocean'));
      component.paletteFormData.name = 'Renamed';

      component.savePalette();

      expect(theme.updateCustomPalette).toHaveBeenCalledWith(
        'Ocean',
        expect.objectContaining({ name: 'Renamed' })
      );
    });

    it('keeps the form open and shows why when saving is rejected', () => {
      const component = build();
      theme.createCustomPalette.mockImplementation(() => {
        throw new Error('name already taken');
      });
      component.startCreatePalette();
      component.paletteFormData.name = 'Mine';

      component.savePalette();

      expect(component.paletteFormError).toBe('name already taken');
      expect(component.showPaletteForm).toBe(true);
    });

    it('falls back to a generic message for an error with no message', () => {
      const component = build();
      theme.createCustomPalette.mockImplementation(() => {
        throw {};
      });
      component.startCreatePalette();
      component.paletteFormData.name = 'Mine';

      component.savePalette();

      expect(component.paletteFormError).toBe('Failed to save palette');
    });
  });

  describe('palette deletion', () => {
    it('warns harder when deleting the active palette', () => {
      const component = build();
      theme.getCurrentPalette.mockReturnValue(palette('Ocean'));
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      component.deletePalette(palette('Ocean'));

      expect(confirmSpy.mock.calls[0][0]).toContain('currently active');
      expect(theme.deleteCustomPalette).toHaveBeenCalledWith('Ocean');
    });

    it('uses the plain warning otherwise', () => {
      const component = build();
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      component.deletePalette(palette('Other'));

      expect(confirmSpy.mock.calls[0][0]).toContain('cannot be undone');
    });

    it('does nothing when the operator declines', () => {
      const component = build();
      jest.spyOn(window, 'confirm').mockReturnValue(false);

      component.deletePalette(palette('Ocean'));

      expect(theme.deleteCustomPalette).not.toHaveBeenCalled();
    });

    it('surfaces a refusal from the service', () => {
      const component = build();
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      const alertSpy = jest
        .spyOn(window, 'alert')
        .mockImplementation(() => undefined);
      theme.deleteCustomPalette.mockImplementation(() => {
        throw new Error('cannot delete a predefined palette');
      });

      component.deletePalette(palette('Ocean'));

      expect(alertSpy).toHaveBeenCalledWith(
        'cannot delete a predefined palette'
      );
    });
  });

  describe('personality', () => {
    it('accepts a selection without touching the service itself', () => {
      const component = build();

      component.onPersonalitySelected({ name: 'Calm' });

      // The selector has already told the service; this is only a hook.
      expect(theme.setPrimaryColor).not.toHaveBeenCalled();
    });
  });
});
