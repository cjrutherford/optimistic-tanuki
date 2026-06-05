import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroComponent } from './hero.component';

describe('HeroComponent', () => {
  let component: HeroComponent;
  let fixture: ComponentFixture<HeroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the editorial hero wrapper and dual CTAs', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-shell')).toBeTruthy();
    expect(compiled.textContent).toContain('Start a project');
    expect(compiled.textContent).toContain('Explore work');
  });

  it('renders the proof strip instead of the old pillar layout', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-proof-strip')).toBeTruthy();
    expect(compiled.querySelector('.hero-pillars')).toBeFalsy();
  });
});
