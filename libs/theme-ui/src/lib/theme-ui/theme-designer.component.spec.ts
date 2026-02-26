import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeDesignerComponent } from './theme-designer.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';

describe('ThemeDesignerComponent', () => {
  let component: ThemeDesignerComponent;
  let fixture: ComponentFixture<ThemeDesignerComponent>;
  let mockThemeService: jest.Mocked<ThemeService>;

  beforeEach(async () => {
    mockThemeService = {
      getTheme: jest.fn().mockReturnValue('light'),
      getAccentColor: jest.fn().mockReturnValue('#3f51b5'),
      setTheme: jest.fn(),
      setAccentColor: jest.fn(),
      setPalette: jest.fn(),
      getCurrentPalette: jest.fn().mockReturnValue(undefined),
      createCustomPalette: jest.fn(),
      updateCustomPalette: jest.fn(),
      deleteCustomPalette: jest.fn(),
      getAllPalettes: jest.fn().mockReturnValue([]),
      getPersonalityConfig: jest.fn().mockReturnValue({
        primaryColor: '#3f51b5',
        secondaryColor: '#c0af4b',
        personality: 'professional',
      }),
      themeColors$: of({
        accent: '#3f51b5',
        complementary: '#c0af4b',
        background: '#ffffff',
        foreground: '#000000',
        accentShades: [],
        accentGradients: {},
        complementaryShades: [],
        complementaryGradients: {},
        tertiary: '#000000',
        tertiaryShades: [],
        tertiaryGradients: {},
        success: '#28a745',
        successShades: [],
        successGradients: {},
        danger: '#dc3545',
        dangerShades: [],
        dangerGradients: {},
        warning: '#ffc107',
        warningShades: [],
        warningGradients: {},
      }),
      generatedTheme$: of({
        personality: {
          id: 'professional',
          name: 'Professional',
          description: 'Clean and professional',
          primaryColor: '#3f51b5',
        },
        config: {
          spacingScale: 'comfortable',
          borderRadius: 'soft',
          shadowIntensity: 'medium',
          animationSpeed: 'normal',
        },
        colors: {
          primary: '#3f51b5',
          primaryShades: ['#3f51b5'],
          secondary: '#c0af4b',
          secondaryShades: ['#c0af4b'],
          tertiary: '#000000',
          tertiaryShades: ['#000000'],
          success: '#28a745',
          successShades: ['#28a745'],
          warning: '#ffc107',
          warningShades: ['#ffc107'],
          danger: '#dc3545',
          dangerShades: ['#dc3545'],
          info: '#17a2b8',
          infoShades: ['#17a2b8'],
          background: '#ffffff',
          foreground: '#000000',
          surface: '#f8f9fa',
          muted: '#6c757d',
          border: '#dee2e6',
          gradients: {
            primary: 'linear-gradient(to right, #3f51b5, #5c6bc0)',
            secondary: 'linear-gradient(to right, #c0af4b, #d4c76a)',
            tertiary: 'linear-gradient(to right, #000000, #333333)',
            surface: 'linear-gradient(to bottom, #f8f9fa, #e9ecef)',
          },
        },
        tokens: {} as any,
        cssVariables: {},
        fonts: {
          heading: { family: 'system-ui', weights: [400, 700] },
          body: { family: 'system-ui', weights: [400, 700] },
          mono: { family: 'monospace', weights: [400] },
        },
        isValid: true,
        contrastReport: {
          isValid: true,
          ratio: 7.5,
          level: 'AAA',
          foreground: '#000000',
          background: '#ffffff',
        },
      }),
      personality$: of({
        id: 'professional',
        name: 'Professional',
        description: 'Clean and professional',
        primaryColor: '#3f51b5',
        tokens: {
          spacingMultiplier: 1,
        },
        animations: {
          speed: 'normal',
          easing: 'ease-in-out',
        },
      }),
      availablePalettes$: of([]),
    } as unknown as jest.Mocked<ThemeService>;

    await TestBed.configureTestingModule({
      imports: [ThemeDesignerComponent],
      providers: [{ provide: ThemeService, useValue: mockThemeService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeDesignerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with current theme colors', () => {
    expect(component.accentColor).toBe('#3f51b5');
    expect(component.complementaryColor).toBe('#c0af4b');
  });

  it('should toggle theme', () => {
    const initialTheme = component.currentTheme;
    component.toggleTheme();
    expect(mockThemeService.setTheme).toHaveBeenCalled();
    expect(component.currentTheme).not.toBe(initialTheme);
  });

  it('should update accent color', () => {
    component.accentColor = '#ff0000';
    component.updateAccentColor();
    expect(mockThemeService.setAccentColor).toHaveBeenCalledWith('#ff0000');
  });

  it('should generate gradient', () => {
    component.selectedGradientType = 'linear';
    component.gradientColors = ['#ff0000', '#00ff00'];
    component.updateGradient();
    expect(component.generatedGradient).toContain('linear-gradient');
  });

  it('should add gradient color', () => {
    const initialLength = component.gradientColors.length;
    component.addGradientColor();
    expect(component.gradientColors.length).toBe(initialLength + 1);
  });

  it('should remove gradient color when more than 2 colors', () => {
    component.gradientColors = ['#ff0000', '#00ff00', '#0000ff'];
    component.removeGradientColor(1);
    expect(component.gradientColors.length).toBe(2);
  });

  it('should not remove gradient color when only 2 colors', () => {
    component.gradientColors = ['#ff0000', '#00ff00'];
    component.removeGradientColor(0);
    expect(component.gradientColors.length).toBe(2);
  });

  it('should update shadow', () => {
    component.shadowBlur = 10;
    component.shadowSpread = 5;
    component.shadowColor = '#000000';
    component.shadowOpacity = 0.5;
    component.updateShadow();
    expect(component.generatedShadow).toContain('rgba');
  });

  it('should apply gradient preset', () => {
    const preset = component.gradientPresets[0];
    component.applyGradientPreset(preset);
    expect(component.selectedGradientType).toBe(preset.type);
    expect(component.gradientColors).toEqual(preset.colors);
  });

  it('should apply shadow preset', () => {
    const preset = component.shadowPresets[0];
    component.applyShadowPreset(preset);
    expect(component.generatedShadow).toBe(preset.value);
  });
});
