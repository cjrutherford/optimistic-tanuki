import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextAreaComponent } from './text-area.component';
import { ReactiveFormsModule } from '@angular/forms';
import { ThemeColors } from '@optimistic-tanuki/theme-ui';

describe('TextAreaComponent', () => {
  let component: TextAreaComponent;
  let fixture: ComponentFixture<TextAreaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextAreaComponent, ReactiveFormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(TextAreaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should update value on input', () => {
    const testValue = 'Hello World';
    const inputElement = fixture.nativeElement.querySelector('textarea');
    inputElement.value = testValue;
    inputElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.value).toBe(testValue);
  });

  it('should emit valueChange event on input', () => {
    const testValue = 'Hello World';
    const emitSpy = jest.spyOn(component.valueChange, 'emit');
    const inputElement = fixture.nativeElement.querySelector('textarea');
    inputElement.value = testValue;
    inputElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(emitSpy).toHaveBeenCalledWith(testValue);
  });

  it('should call onChange when value changes', () => {
    const testValue = 'New Value';
    const onChangeSpy = jest.fn();
    component.registerOnChange(onChangeSpy);
    const inputElement = fixture.nativeElement.querySelector('textarea');
    inputElement.value = testValue;
    inputElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(onChangeSpy).toHaveBeenCalledWith(testValue);
  });

  it('should write value to the component', () => {
    const testValue = 'Initial Value';
    component.writeValue(testValue);
    fixture.detectChanges();
    expect(component.value).toBe(testValue);
    const inputElement = fixture.nativeElement.querySelector('textarea');
    expect(inputElement.value).toBe(testValue);
  });

  it('should register onChange function', () => {
    const fn = () => {};
    component.registerOnChange(fn);
    expect(component.onChange).toBe(fn);
  });

  it('should register onTouched function', () => {
    const fn = () => {};
    component.registerOnTouched(fn);
    expect(component.onTouched).toBe(fn);
  });

  it('should apply theme colors correctly', () => {
    const mockColors: ThemeColors = {
      background: '#000000',
      foreground: '#ffffff',
      accent: '#ff0000',
      complementary: '#00ff00',
      accentShades: [['0', '#ff0000'], ['1', '#cc0000']],
      complementaryShades: [['0', '#00ff00'], ['1', '#00cc00'], ['2', '#009900']],
      accentGradients: { dark: 'linear-gradient(to right, red, darkred)', light: 'linear-gradient(to right, pink, lightpink)' },
      complementaryGradients: { dark: 'linear-gradient(to right, green, darkgreen)', light: 'linear-gradient(to right, lightgreen, palegreen)' },
      success: '#00ff00',
      successShades: [['0', '#00ff00'], ['1', '#00cc00']],
      successGradients: { dark: 'linear-gradient(to right, green, darkgreen)', light: 'linear-gradient(to right, lightgreen, palegreen)' },
      danger: '#ff0000',
      dangerShades: [['0', '#ff0000'], ['1', '#cc0000']],
      dangerGradients: { dark: 'linear-gradient(to right, red, darkred)', light: 'linear-gradient(to right, pink, lightpink)' },
      warning: '#ffff00',
      warningShades: [['0', '#ffff00'], ['1', '#cccc00']],
      warningGradients: { dark: 'linear-gradient(to right, yellow, darkyellow)', light: 'linear-gradient(to right, lightyellow, paleyellow)' },
    };

    component.theme = 'dark';
    component.applyTheme(mockColors);
    fixture.detectChanges();

    expect(component.background).toBe(mockColors.background);
    expect(component.foreground).toBe(mockColors.foreground);
    expect(component.accent).toBe(mockColors.accent);
    expect(component.complement).toBe(mockColors.complementary);
    expect(component.borderGradient).toBe(mockColors.accentGradients['dark']);
    expect(component.borderColor).toBe(mockColors.complementaryShades[2][1]);

    component.theme = 'light';
    component.applyTheme(mockColors);
    fixture.detectChanges();
    expect(component.borderGradient).toBe(mockColors.accentGradients['light']);
    expect(component.borderColor).toBe(mockColors.complementaryShades[2][1]);
  });

  it('should set host styles based on theme properties', () => {
    component.background = '#123456';
    component.foreground = '#654321';
    component.accent = '#abcdef';
    component.complement = '#fedcba';
    component.borderColor = '#1a2b3c';
    component.borderGradient = 'linear-gradient(to right, blue, green)';
    component.transitionDuration = '0.5s';
    fixture.detectChanges();

    const hostElement = fixture.nativeElement;
    expect(hostElement.style.getPropertyValue('--background')).toBe('#123456');
    expect(hostElement.style.getPropertyValue('--foreground')).toBe('#654321');
    expect(hostElement.style.getPropertyValue('--accent')).toBe('#abcdef');
    expect(hostElement.style.getPropertyValue('--complement')).toBe('#fedcba');
    expect(hostElement.style.getPropertyValue('--border-color')).toBe('#1a2b3c');
    expect(hostElement.style.getPropertyValue('--border-gradient')).toBe('linear-gradient(to right, blue, green)');
    expect(hostElement.style.getPropertyValue('--transition-duration')).toBe('0.5s');
  });
});