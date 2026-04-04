import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TopographicDriftComponent } from './topographic-drift.component';

describe('TopographicDriftComponent', () => {
  let component: TopographicDriftComponent;
  let fixture: ComponentFixture<TopographicDriftComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopographicDriftComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TopographicDriftComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the topographic shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.topographic-drift')).toBeTruthy();
  });

  it('renders one contour per density step', () => {
    component.density = 7;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.contour-band')).toHaveLength(7);
  });

  it('supports reduced motion fallback mode', () => {
    component.reducedMotion = true;
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.topographic-drift')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
