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
      providers: [ThemeService]
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

  it('should apply theme colors correctly for dark theme', () => {
    const mockColors = {
      background: '#000',
      foreground: '#fff',
      accent: '#111',
      complementary: '#222',
      success: '#333',
      warning: '#444',
      danger: '#555',
      complementaryGradients: { dark: 'dark-comp-gradient', light: 'light-comp-gradient' },
      accentGradients: { dark: 'dark-accent-gradient', light: 'light-accent-gradient' },
      complementaryShades: [[null, '#666'], [null, '#777'], [null, '#888'], [null, '#999'], [null, '#aaa'], [null, '#bbb'], [null, '#ccc']],
    } as any;

    component.theme = 'dark';
    component.applyTheme(mockColors);

    expect(component.background).toBe(`linear-gradient(to bottom, ${mockColors.background}, ${mockColors.accent})`);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.success).toBe(mockColors.success);
    expect(component.warning).toBe(mockColors.warning);
    expect(component.danger).toBe(mockColors.danger);
    expect(component.borderGradient).toBe(mockColors.complementaryGradients.dark);
    expect(component.borderColor).toBe(mockColors.complementaryShades[6][1]);
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
      complementaryGradients: { dark: 'dark-comp-gradient', light: 'light-comp-gradient' },
      accentGradients: { dark: 'dark-accent-gradient', light: 'light-accent-gradient' },
      complementaryShades: [[null, '#666'], [null, '#777'], [null, '#888'], [null, '#999'], [null, '#aaa'], [null, '#bbb'], [null, '#ccc']],
    } as any;

    component.theme = 'light';
    component.applyTheme(mockColors);

    expect(component.background).toBe(`linear-gradient(to bottom, ${mockColors.background}, ${mockColors.accent})`);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.success).toBe(mockColors.success);
    expect(component.warning).toBe(mockColors.warning);
    expect(component.danger).toBe(mockColors.danger);
    expect(component.borderGradient).toBe(mockColors.accentGradients.light);
    expect(component.borderColor).toBe(mockColors.complementaryShades[2][1]);
  });
});
