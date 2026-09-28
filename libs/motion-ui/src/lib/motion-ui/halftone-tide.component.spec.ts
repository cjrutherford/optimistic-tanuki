import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HalftoneTideComponent } from './halftone-tide.component';

describe('HalftoneTideComponent', () => {
  let component: HalftoneTideComponent;
  let fixture: ComponentFixture<HalftoneTideComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HalftoneTideComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HalftoneTideComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the halftone tide shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.halftone-tide')).toBeTruthy();
  });

  it('is decorative (hidden from assistive technology)', () => {
    expect(
      fixture.nativeElement
        .querySelector('.halftone-tide')
        ?.getAttribute('aria-hidden')
    ).toBe('true');
  });

  it('feeds speed and intensity into the scene contract', () => {
    fixture.componentRef.setInput('speed', 1.5);
    fixture.componentRef.setInput('intensity', 0.4);
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector(
      '.halftone-tide'
    ) as HTMLElement;
    expect(root.style.getPropertyValue('--scene-speed-input')).toBe('1.5');
    expect(root.style.getPropertyValue('--scene-intensity-input')).toBe('0.4');
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.halftone-tide')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
