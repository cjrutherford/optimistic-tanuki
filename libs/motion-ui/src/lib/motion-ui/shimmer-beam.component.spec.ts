import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShimmerBeamComponent } from './shimmer-beam.component';

describe('ShimmerBeamComponent', () => {
  let component: ShimmerBeamComponent;
  let fixture: ComponentFixture<ShimmerBeamComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShimmerBeamComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ShimmerBeamComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the shimmer beam shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.shimmer-beam')).toBeTruthy();
  });

  it('renders layered sweeps for seamless motion', () => {
    const sweeps = fixture.nativeElement.querySelectorAll('.beam-sweep');
    expect(sweeps.length).toBeGreaterThan(1);
  });

  it('applies the selected direction modifier class', () => {
    fixture.componentRef.setInput('direction', 'horizontal');
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.shimmer-beam')
        ?.classList.contains('is-horizontal')
    ).toBe(true);
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.shimmer-beam')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
