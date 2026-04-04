import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the HAI Computer CTA', () => {
    expect(fixture.nativeElement.textContent).toContain('Explore HAI Computer');
  });

  it('renders the curated ecosystem cards', () => {
    expect(component.ecosystem).toHaveLength(4);
  });

  it('uses motion layers in the hero scene', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(nativeElement.querySelector('otui-topographic-drift')).not.toBeNull();
    expect(nativeElement.querySelector('otui-aurora-ribbon')).not.toBeNull();
    expect(nativeElement.querySelector('otui-pulse-rings')).not.toBeNull();
  });

  it('applies theme-aware styling hooks to the layout surfaces', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(
      nativeElement.querySelector('.landing-shell[data-theme-surface="page"]')
    ).not.toBeNull();
    expect(
      nativeElement.querySelector('.hero-panel[data-theme-surface="hero"]')
    ).not.toBeNull();
    expect(
      nativeElement.querySelector('.story-panel[data-theme-surface="card"]')
    ).not.toBeNull();
  });
});
