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

  it('renders the shared public landing hero with a resume download and work CTA', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const hero = compiled.querySelector('otui-public-landing-hero.hero');

    expect(hero).toBeTruthy();
    expect(hero?.querySelector('h1')?.textContent).toContain(
      'Christopher Rutherford'
    );
    const resume = Array.from(compiled.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Download résumé')
    );
    expect(resume?.getAttribute('href')).toBe(
      '/assets/christopher-rutherford-resume.pdf'
    );
    expect(resume?.textContent?.trim()).toBe('Download résumé (PDF)');
    expect(resume?.getAttribute('target')).toBe('_blank');
    expect(resume?.getAttribute('rel')).toContain('noopener');
    const work = Array.from(compiled.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Explore engineering work')
    );
    expect(work?.getAttribute('href')).toBe('#work');
  });

  it('renders the proof strip instead of the old pillar layout', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.hero-proof-strip')).toBeTruthy();
    expect(compiled.querySelector('.hero-pillars')).toBeFalsy();
  });

  it('states the role, availability, and badges', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';

    expect(text).toContain('Full-Stack & Systems Engineer');
    expect(text).toContain(
      'Based in Georgia · Open to relocation to New York City · Remote, hybrid, or on-site'
    );
    expect(text).toContain(
      'Available for full-time roles and conventional contracts'
    );
    expect(text).not.toContain('Georgia and New York');
    expect(
      Array.from(compiled.querySelectorAll('.hero-proof-strip li')).map((li) =>
        li.textContent?.trim()
      )
    ).toEqual([
      'TypeScript · Angular · NestJS',
      'Linux · Docker · Kubernetes',
      'Go · PostgreSQL · SQLite',
      'Electron · Capacitor · Native integration',
    ]);
  });

  it('keeps contact reachable from the hero', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(compiled.querySelectorAll('a')).map((a) =>
      a.getAttribute('href')
    );

    expect(hrefs).toContain('#contact');
    expect(hrefs).toContain('mailto:chris@christopherrutherford.net');
  });
});
