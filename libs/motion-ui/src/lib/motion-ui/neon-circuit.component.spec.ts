import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NeonCircuitComponent } from './neon-circuit.component';

describe('NeonCircuitComponent', () => {
  let component: NeonCircuitComponent;
  let fixture: ComponentFixture<NeonCircuitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NeonCircuitComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NeonCircuitComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the neon circuit shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.neon-circuit')).toBeTruthy();
  });

  it('is decorative (hidden from assistive technology)', () => {
    expect(
      fixture.nativeElement
        .querySelector('.neon-circuit')
        ?.getAttribute('aria-hidden')
    ).toBe('true');
  });

  it('feeds speed and intensity into the scene contract', () => {
    fixture.componentRef.setInput('speed', 1.5);
    fixture.componentRef.setInput('intensity', 0.4);
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector(
      '.neon-circuit'
    ) as HTMLElement;
    expect(root.style.getPropertyValue('--scene-speed-input')).toBe('1.5');
    expect(root.style.getPropertyValue('--scene-intensity-input')).toBe('0.4');
  });

  it('scales its elements with density', () => {
    fixture.componentRef.setInput('density', 2);
    fixture.detectChanges();
    const few = fixture.nativeElement.querySelectorAll('.pulse').length;
    fixture.componentRef.setInput('density', 8);
    fixture.detectChanges();
    const many = fixture.nativeElement.querySelectorAll('.pulse').length;
    expect(many).toBeGreaterThan(few);
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.neon-circuit')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
