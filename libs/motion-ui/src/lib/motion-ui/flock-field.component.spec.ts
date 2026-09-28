import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlockFieldComponent } from './flock-field.component';

describe('FlockFieldComponent', () => {
  let component: FlockFieldComponent;
  let fixture: ComponentFixture<FlockFieldComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlockFieldComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FlockFieldComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the flock field shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.flock-field')).toBeTruthy();
  });

  it('is decorative (hidden from assistive technology)', () => {
    expect(
      fixture.nativeElement
        .querySelector('.flock-field')
        ?.getAttribute('aria-hidden')
    ).toBe('true');
  });

  it('feeds speed and intensity into the scene contract', () => {
    fixture.componentRef.setInput('speed', 1.5);
    fixture.componentRef.setInput('intensity', 0.4);
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector(
      '.flock-field'
    ) as HTMLElement;
    expect(root.style.getPropertyValue('--scene-speed-input')).toBe('1.5');
    expect(root.style.getPropertyValue('--scene-intensity-input')).toBe('0.4');
  });

  it('renders a canvas for the flock', () => {
    expect(
      fixture.nativeElement.querySelector('canvas.flock-canvas')
    ).toBeTruthy();
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.flock-field')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
