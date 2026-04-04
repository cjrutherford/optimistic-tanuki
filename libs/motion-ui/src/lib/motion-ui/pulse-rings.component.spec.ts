import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PulseRingsComponent } from './pulse-rings.component';

describe('PulseRingsComponent', () => {
  let component: PulseRingsComponent;
  let fixture: ComponentFixture<PulseRingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PulseRingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PulseRingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the pulse rings shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.pulse-rings')).toBeTruthy();
  });

  it('renders one ring per requested count', () => {
    component.ringCount = 5;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.pulse-ring')).toHaveLength(
      5
    );
  });

  it('supports reduced motion fallback mode', () => {
    component.reducedMotion = true;
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.pulse-rings')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
