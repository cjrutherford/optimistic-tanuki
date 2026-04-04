import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MurmurationSceneComponent } from './murmuration-scene.component';

describe('MurmurationSceneComponent', () => {
  let component: MurmurationSceneComponent;
  let fixture: ComponentFixture<MurmurationSceneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MurmurationSceneComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MurmurationSceneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the scene shell', () => {
    expect(component).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.murmuration-scene')
    ).toBeTruthy();
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(component.reducedMotion).toBe(true);
  });

  it('seeds the flock across a wider horizontal span', () => {
    const positions = (component as any).createInitialPositions?.(48) as
      | Float32Array
      | undefined;
    expect(positions).toBeDefined();
    const xs = Array.from(
      { length: (positions as Float32Array).length / 3 },
      (_, index) => (positions as Float32Array)[index * 3]
    );
    const spread = Math.max(...xs) - Math.min(...xs);
    expect(spread).toBeGreaterThan(10);
  });
});
