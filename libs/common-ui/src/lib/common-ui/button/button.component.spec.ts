import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('ButtonComponent', () => {
  let component: ButtonComponent;
  let fixture: ComponentFixture<ButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
      providers: [ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(ButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function btn(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('button');
  }

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

  it('should expose canonical tone/emphasis/size axes with defaults', () => {
    expect(component.tone).toBe('brand');
    expect(component.emphasis).toBe('solid');
    expect(component.size).toBe('md');
  });

  it('should map legacy variant onto tone/emphasis via the bridge', () => {
    component.variant = 'outlined';
    expect(component.tone).toBe('brand');
    expect(component.emphasis).toBe('outline');

    component.variant = 'danger';
    expect(component.tone).toBe('danger');
    expect(component.emphasis).toBe('solid');

    component.variant = 'text';
    expect(component.tone).toBe('brand');
    expect(component.emphasis).toBe('ghost');

    component.variant = 'secondary';
    expect(component.tone).toBe('neutral');
    expect(component.emphasis).toBe('solid');
  });

  it('should render data-tone/emphasis/size on the button element', () => {
    component.tone = 'success';
    component.emphasis = 'soft';
    component.size = 'lg';
    fixture.detectChanges();
    expect(btn().getAttribute('data-tone')).toBe('success');
    expect(btn().getAttribute('data-emphasis')).toBe('soft');
    expect(btn().getAttribute('data-size')).toBe('lg');
  });

  it('should flag the gradient path for brand+solid when useGradient is true', () => {
    component.variant = 'primary';
    component.useGradient = true;
    fixture.detectChanges();
    expect(btn().classList.contains('use-gradient')).toBe(true);
    // A gradient value is computed and surfaced as the CSS var.
    expect(component.buttonGradient).not.toBe('none');
  });

  it('should not flag the gradient path when useGradient is false', () => {
    component.variant = 'primary';
    component.useGradient = false;
    fixture.detectChanges();
    expect(btn().classList.contains('use-gradient')).toBe(false);
  });

  it('should not flag the gradient path for non-solid emphasis', () => {
    component.variant = 'outlined';
    component.useGradient = true;
    fixture.detectChanges();
    expect(btn().classList.contains('use-gradient')).toBe(false);
  });

  it('should add the rounded class for the rounded legacy variant', () => {
    component.variant = 'rounded';
    fixture.detectChanges();
    expect(btn().classList.contains('rounded')).toBe(true);
  });

  it('should keep the legacy variant class for personality selectors', () => {
    component.variant = 'primary';
    fixture.detectChanges();
    expect(btn().classList.contains('primary')).toBe(true);
  });
});
