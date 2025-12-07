import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoginBlockComponent } from './login-block.component';
import { ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';

describe('LoginBlockComponent', () => {
  let component: LoginBlockComponent;
  let fixture: ComponentFixture<LoginBlockComponent>;
  let themeServiceMock: any;

  beforeEach(async () => {
    themeServiceMock = {
      themeColors$: of({
        background: '#ffffff',
        foreground: '#333333',
        accent: '#000000',
        accentShades: [['0', '#000'], ['1', '#111'], ['2', '#222'], ['3', '#333'], ['4', '#444'], ['5', '#555'], ['6', '#666'], ['7', '#777'], ['8', '#888'], ['9', '#999']],
        accentGradients: { light: 'light-accent-gradient', dark: 'dark-accent-gradient', fastCycle: 'fast-accent-cycle' },
        complementary: '#cccccc',
        complementaryShades: [['0', '#ccc'], ['1', '#ddd'], ['2', '#eee'], ['3', '#fff'], ['4', '#aaa'], ['5', '#bbb'], ['6', '#ccc'], ['7', '#ddd'], ['8', '#eee'], ['9', '#fff']],
        complementaryGradients: { dark: 'dark-gradient', light: 'light-gradient', fastCycle: 'fast-complementary-cycle' },
        tertiary: '#123456',
        tertiaryShades: [['0', '#123'], ['1', '#234'], ['2', '#345'], ['3', '#456'], ['4', '#567'], ['5', '#678'], ['6', '#789'], ['7', '#89a'], ['8', '#9ab'], ['9', '#abc']],
        tertiaryGradients: { light: 'light-tertiary-gradient', dark: 'dark-tertiary-gradient', fastCycle: 'fast-tertiary-cycle' },
        success: '#00ff00',
        successShades: [['0', '#0f0'], ['1', '#1f1'], ['2', '#2f2'], ['3', '#3f3'], ['4', '#4f4'], ['5', '#5f5'], ['6', '#6f6'], ['7', '#7f7'], ['8', '#8f8'], ['9', '#9f9']],
        successGradients: { light: 'light-success-gradient', dark: 'dark-success-gradient', fastCycle: 'fast-success-cycle' },
        danger: '#ff0000',
        dangerShades: [['0', '#f00'], ['1', '#f11'], ['2', '#f22'], ['3', '#f33'], ['4', '#f44'], ['5', '#f55'], ['6', '#f66'], ['7', '#f77'], ['8', '#f88'], ['9', '#f99']],
        dangerGradients: { light: 'light-danger-gradient', dark: 'dark-danger-gradient', fastCycle: 'fast-danger-cycle' },
        warning: '#ffff00',
        warningShades: [['0', '#ff0'], ['1', '#ff1'], ['2', '#ff2'], ['3', '#ff3'], ['4', '#ff4'], ['5', '#ff5'], ['6', '#ff6'], ['7', '#ff7'], ['8', '#ff8'], ['9', '#ff9']],
        warningGradients: { light: 'light-warning-gradient', dark: 'dark-warning-gradient', fastCycle: 'fast-warning-cycle' },
      } as ThemeColors),
      getTheme: () => 'light',
    };

    await TestBed.configureTestingModule({
      imports: [LoginBlockComponent, ReactiveFormsModule],
      providers: [{ provide: ThemeService, useValue: themeServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should apply dark theme colors when theme is dark', () => {
    themeServiceMock.getTheme = () => 'dark';
    component.ngOnInit();
    fixture.detectChanges();
    expect(component.borderGradient).toBe('dark-gradient');
  });

  it('should apply light theme colors when theme is not dark', () => {
    themeServiceMock.getTheme = () => 'light';
    component.ngOnInit();
    fixture.detectChanges();
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