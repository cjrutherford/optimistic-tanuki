import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuroraRibbonComponent } from './aurora-ribbon.component';

describe('AuroraRibbonComponent', () => {
  let component: AuroraRibbonComponent;
  let fixture: ComponentFixture<AuroraRibbonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuroraRibbonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AuroraRibbonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the aurora shell', () => {
    expect(component).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.aurora-ribbon')).toBeTruthy();
  });

  it('renders one ribbon layer per density step', () => {
    fixture.componentRef.setInput('density', 4);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('.aurora-layer')
    ).toHaveLength(4);
  });

  it('supports reduced motion fallback mode', () => {
    fixture.componentRef.setInput('reducedMotion', true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement
        .querySelector('.aurora-ribbon')
        ?.classList.contains('is-fallback')
    ).toBe(true);
  });
});
