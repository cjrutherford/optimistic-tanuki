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

  it('renders the editorial hero wrapper and value pillar grid', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-shell')).toBeTruthy();
    expect(compiled.querySelector('.hero-pillars')).toBeTruthy();
  });

  it('renders the hero blurb card and icon-backed value pillars', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-blurb-card')).toBeTruthy();
    expect(compiled.querySelector('.hero-pillars')).toBeTruthy();
  });
});
