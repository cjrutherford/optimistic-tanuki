import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoginBlockComponent } from './login-block.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('LoginBlockComponent', () => {
  let component: LoginBlockComponent;
  let fixture: ComponentFixture<LoginBlockComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginBlockComponent],
      providers: [ThemeService]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginBlockComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply dark theme colors when theme is dark', () => {
    component.theme = 'dark';
    component.applyTheme({
      accent: '#000', background: '#111', complementary: '#222', foreground: '#333', complementaryGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' }, danger: '#444', dangerGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' }, dangerShades: [], success: '#555', successGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' }, successShades: [], warning: '#666', warningGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' }, warningShades: [], accentShades: [],
      accentGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' },
      complementaryShades: []
    });
    expect(component.borderGradient).toBe('dark-gradient');
  });

  it('should apply light theme colors when theme is not dark', () => {
    component.theme = 'light';
    component.applyTheme({
      accent: '#000', background: '#111', complementary: '#222', foreground: '#333', complementaryGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' }, danger: '#444', dangerGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' }, dangerShades: [], success: '#555', successGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' }, successShades: [], warning: '#666', warningGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' }, warningShades: [], accentShades: [],
      accentGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-cycle-gradient' },
      complementaryShades: []
    });
    expect(component.borderGradient).toBe('light-gradient');
  });

  it('should emit submitEvent on onSubmit', () => {
    jest.spyOn(component.submitEvent, 'emit');
    component.loginForm.setValue({ email: 'test@example.com', password: 'password' });
    component.onSubmit();
    expect(component.submitEvent.emit).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password' });
  });

  it('should log onFormChange', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    component.onFormChange('test');
    expect(consoleSpy).toHaveBeenCalledWith('test');
  });
});
