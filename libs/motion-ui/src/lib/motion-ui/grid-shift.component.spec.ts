import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GridShiftComponent } from './grid-shift.component';

describe('GridShiftComponent', () => {
  let component: GridShiftComponent;
  let fixture: ComponentFixture<GridShiftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridShiftComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GridShiftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the grid shift shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.grid-shift')).toBeTruthy();
  });

  it('is decorative (hidden from assistive technology)', () => {
    expect(
      fixture.nativeElement
        .querySelector('.grid-shift')
        ?.getAttribute('aria-hidden')
    ).toBe('true');
  });

  it('feeds speed and intensity into the scene contract', () => {
    fixture.componentRef.setInput('speed', 1.5);
    fixture.componentRef.setInput('intensity', 0.4);
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector(
      '.grid-shift'
    ) as HTMLElement;
    expect(root.style.getPropertyValue('--scene-speed-input')).toBe('1.5');
    expect(root.style.getPropertyValue('--scene-intensity-input')).toBe('0.4');
  });

  it('scales its elements with density', () => {
    fixture.componentRef.setInput('density', 2);
    fixture.detectChanges();
    const few = fixture.nativeElement.querySelectorAll('.block').length;
    fixture.componentRef.setInput('density', 8);
    fixture.detectChanges();
    const many = fixture.nativeElement.querySelectorAll('.block').length;
    expect(many).toBeGreaterThan(few);
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.grid-shift')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
