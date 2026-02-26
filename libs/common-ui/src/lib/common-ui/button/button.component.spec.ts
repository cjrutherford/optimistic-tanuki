import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('ButtonComponent', () => {
  let component: ButtonComponent;
  let fixture: ComponentFixture<ButtonComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
      providers: [ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit action when not disabled', () => {
    jest.spyOn(component.action, 'emit');
    component.disabled = false;
    component.onClick();
    expect(component.action.emit).toHaveBeenCalled();
  });

  it('should not emit action when disabled', () => {
    jest.spyOn(component.action, 'emit');
    component.disabled = true;
    component.onClick();
    expect(component.action.emit).not.toHaveBeenCalled();
  });

  it('should apply theme colors correctly for dark theme with primary variant', () => {
    const mockColors = {
      background: '#000',
      foreground: '#fff',
      accent: '#111',
      complementary: '#222',
      success: '#333',
      warning: '#444',
      danger: '#555',
      complementaryGradients: {
        dark: 'dark-comp-gradient',
        light: 'light-comp-gradient',
      },
      accentGradients: {
        dark: 'dark-accent-gradient',
        light: 'light-accent-gradient',
      },
      complementaryShades: [
        [null, '#666'],
        [null, '#777'],
        [null, '#888'],
        [null, '#999'],
        [null, '#aaa'],
        [null, '#bbb'],
        [null, '#ccc'],
      ],
    } as any;

    component.theme = 'dark';
    component.variant = 'primary';
    component.useGradient = true;
    component.applyTheme(mockColors);

    // With useGradient=true, background should be CSS variable reference
    expect(component.background).toBe('var(--button-gradient)');
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.success).toBe(mockColors.success);
    expect(component.warning).toBe(mockColors.warning);
    expect(component.danger).toBe(mockColors.danger);
    expect(component.borderColor).toBe('transparent');
  });

  it('should apply solid background when useGradient is false', () => {
    const mockColors = {
      background: '#000',
      foreground: '#fff',
      accent: '#111',
      complementary: '#222',
      success: '#333',
      warning: '#444',
      danger: '#555',
      complementaryGradients: {
        dark: 'dark-comp-gradient',
        light: 'light-comp-gradient',
      },
      accentGradients: {
        dark: 'dark-accent-gradient',
        light: 'light-accent-gradient',
      },
      complementaryShades: [
        [null, '#666'],
        [null, '#777'],
        [null, '#888'],
        [null, '#999'],
        [null, '#aaa'],
        [null, '#bbb'],
        [null, '#ccc'],
      ],
    } as any;

    component.theme = 'dark';
    component.variant = 'primary';
    component.useGradient = false;
    component.applyTheme(mockColors);

    // With useGradient=false, background should be accent color
    expect(component.background).toBe(mockColors.accent);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.success).toBe(mockColors.success);
    expect(component.warning).toBe(mockColors.warning);
    expect(component.danger).toBe(mockColors.danger);
    expect(component.borderColor).toBe('transparent');
  });

  it('should apply theme colors correctly for light theme', () => {
    const mockColors = {
      background: '#eee',
      foreground: '#222',
      accent: '#abc',
      complementary: '#def',
      success: '#fed',
      warning: '#cba',
      danger: '#987',
      complementaryGradients: {
        dark: 'dark-comp-gradient',
        light: 'light-comp-gradient',
      },
      accentGradients: {
        dark: 'dark-accent-gradient',
        light: 'light-accent-gradient',
      },
      complementaryShades: [
        [null, '#666'],
        [null, '#777'],
        [null, '#888'],
        [null, '#999'],
        [null, '#aaa'],
        [null, '#bbb'],
        [null, '#ccc'],
      ],
    } as any;

    component.theme = 'light';
    component.variant = 'primary';
    component.useGradient = true;
    component.applyTheme(mockColors);

    expect(component.background).toBe('var(--button-gradient)');
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.success).toBe(mockColors.success);
    expect(component.warning).toBe(mockColors.warning);
    expect(component.danger).toBe(mockColors.danger);
    expect(component.borderColor).toBe('transparent');
  });

  it('should apply outlined variant styles', () => {
    const mockColors = {
      background: '#eee',
      foreground: '#222',
      accent: '#abc',
      complementary: '#def',
    } as any;

    component.theme = 'light';
    component.variant = 'outlined';
    component.applyTheme(mockColors);

    expect(component.background).toBe('transparent');
    expect(component.borderColor).toBe(mockColors.accent);
  });

  it('should apply text variant styles', () => {
    const mockColors = {
      background: '#eee',
      foreground: '#222',
      accent: '#abc',
      complementary: '#def',
    } as any;

    component.theme = 'light';
    component.variant = 'text';
    component.applyTheme(mockColors);

    expect(component.background).toBe('transparent');
    expect(component.borderColor).toBe('transparent');
  });

  it('should support danger variant with solid color', () => {
    const mockColors = {
      background: '#eee',
      foreground: '#222',
      accent: '#abc',
      complementary: '#def',
      danger: '#987',
    } as any;

    component.theme = 'light';
    component.variant = 'danger';
    component.applyTheme(mockColors);

    expect(component.background).toBe(mockColors.danger);
    expect(component.borderColor).toBe('transparent');
  });
});
