import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SignalMeshComponent } from './signal-mesh.component';

describe('SignalMeshComponent', () => {
  let component: SignalMeshComponent;
  let fixture: ComponentFixture<SignalMeshComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignalMeshComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SignalMeshComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the signal mesh shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.signal-mesh')).toBeTruthy();
  });

  it('renders one node per grid intersection', () => {
    component.density = 4;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.mesh-node')).toHaveLength(20);
  });

  it('supports reduced motion fallback mode', () => {
    component.reducedMotion = true;
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.signal-mesh')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
