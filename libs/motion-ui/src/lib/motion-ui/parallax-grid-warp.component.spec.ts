import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParallaxGridWarpComponent } from './parallax-grid-warp.component';

describe('ParallaxGridWarpComponent', () => {
  let component: ParallaxGridWarpComponent;
  let fixture: ComponentFixture<ParallaxGridWarpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParallaxGridWarpComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ParallaxGridWarpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the parallax grid shell', () => {
    expect(component).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.parallax-grid-warp')
    ).toBeTruthy();
  });

  it('renders one vertical beam per density step', () => {
    fixture.componentRef.setInput('density', 7);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.warp-beam')).toHaveLength(
      7
    );
  });

  it('renders an animated drift layer for the plane', () => {
    expect(fixture.nativeElement.querySelector('.warp-drift')).toBeTruthy();
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.parallax-grid-warp')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
