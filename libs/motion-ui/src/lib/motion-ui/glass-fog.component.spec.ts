import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GlassFogComponent } from './glass-fog.component';

describe('GlassFogComponent', () => {
  let component: GlassFogComponent;
  let fixture: ComponentFixture<GlassFogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlassFogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GlassFogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the glass fog shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.glass-fog')).toBeTruthy();
  });

  it('renders one blob per density step', () => {
    component.density = 5;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.fog-blob')).toHaveLength(5);
  });

  it('supports reduced motion fallback mode', () => {
    component.reducedMotion = true;
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.glass-fog')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
