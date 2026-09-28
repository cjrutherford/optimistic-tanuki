import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlueprintScanComponent } from './blueprint-scan.component';

describe('BlueprintScanComponent', () => {
  let component: BlueprintScanComponent;
  let fixture: ComponentFixture<BlueprintScanComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlueprintScanComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BlueprintScanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the blueprint scan shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.blueprint-scan')).toBeTruthy();
  });

  it('is decorative (hidden from assistive technology)', () => {
    expect(
      fixture.nativeElement
        .querySelector('.blueprint-scan')
        ?.getAttribute('aria-hidden')
    ).toBe('true');
  });

  it('feeds speed and intensity into the scene contract', () => {
    fixture.componentRef.setInput('speed', 1.5);
    fixture.componentRef.setInput('intensity', 0.4);
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector(
      '.blueprint-scan'
    ) as HTMLElement;
    expect(root.style.getPropertyValue('--scene-speed-input')).toBe('1.5');
    expect(root.style.getPropertyValue('--scene-intensity-input')).toBe('0.4');
  });

  it('scales its elements with density', () => {
    fixture.componentRef.setInput('density', 2);
    fixture.detectChanges();
    const few = fixture.nativeElement.querySelectorAll('.mark').length;
    fixture.componentRef.setInput('density', 8);
    fixture.detectChanges();
    const many = fixture.nativeElement.querySelectorAll('.mark').length;
    expect(many).toBeGreaterThan(few);
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.blueprint-scan')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
