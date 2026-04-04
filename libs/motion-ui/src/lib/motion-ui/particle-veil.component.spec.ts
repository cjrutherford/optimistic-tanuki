import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ParticleVeilComponent } from './particle-veil.component';

describe('ParticleVeilComponent', () => {
  let component: ParticleVeilComponent;
  let fixture: ComponentFixture<ParticleVeilComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParticleVeilComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ParticleVeilComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the particle veil shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.particle-veil')).toBeTruthy();
  });

  it('renders one particle per requested density', () => {
    fixture.componentRef.setInput('density', 18);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.particle')).toHaveLength(
      18
    );
  });

  it('creates stronger travel variation for particles', () => {
    const [first] = (component as any).particles as Array<
      Record<string, string | number>
    >;
    expect(first).toHaveProperty('driftX');
    expect(first).toHaveProperty('driftY');
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.particle-veil')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
