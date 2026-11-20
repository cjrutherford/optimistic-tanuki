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

  it('renders the shared public landing hero with dual CTAs', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const hero = compiled.querySelector('otui-public-landing-hero.hero');

    expect(hero).toBeTruthy();
    expect(hero?.querySelector('h1')?.textContent).toContain(
      'Christopher Rutherford'
    );
    expect(compiled.textContent).toContain('View experience');
    expect(compiled.textContent).toContain('Start a conversation');
  });

  it('renders the proof strip instead of the old pillar layout', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-proof-strip')).toBeTruthy();
    expect(compiled.querySelector('.hero-pillars')).toBeFalsy();
  });

  it('introduces Christopher as a full-stack engineer and systems administrator', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(
      'Full-stack engineer · platform and Linux systems'
    );
    expect(compiled.textContent).toContain('Georgia and New York');
    expect(compiled.textContent).toContain('remote or hybrid');
  });
});
