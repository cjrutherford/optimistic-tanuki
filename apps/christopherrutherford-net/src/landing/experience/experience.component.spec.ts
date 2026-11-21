import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExperienceComponent } from './experience.component';
import { EXPERIENCE } from './experience.data';

describe('ExperienceComponent', () => {
  let fixture: ComponentFixture<ExperienceComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExperienceComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ExperienceComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders every entry from the data', () => {
    const items = el.querySelectorAll('.timeline-entry');
    expect(items).toHaveLength(EXPERIENCE.length);
    for (const entry of EXPERIENCE) {
      expect(el.textContent).toContain(entry.organization);
      expect(el.textContent).toContain(entry.period);
    }
  });

  it('does not use inflated titles or figures', () => {
    expect(el.textContent).not.toMatch(/Principal|Senior|Staff|\d+%/);
  });

  it('links the full resume PDF', () => {
    const link = el.querySelector<HTMLAnchorElement>('a.resume-link');
    expect(link?.getAttribute('href')).toBe(
      '/assets/christopher-rutherford-resume.pdf'
    );
    expect(link?.textContent).toContain('Download full résumé (PDF)');
  });
});
