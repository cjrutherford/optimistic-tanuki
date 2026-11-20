import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PROFILE } from '../profile.data';
import { HIRING_HIGHLIGHTS, HIRING_TARGETS } from './hiring.data';
import { HiringComponent } from './hiring.component';

describe('HiringComponent', () => {
  let fixture: ComponentFixture<HiringComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HiringComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HiringComponent);
    fixture.detectChanges();
  });

  it('renders every approved highlight and role target', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.hiring-highlight')).toHaveLength(
      HIRING_HIGHLIGHTS.length
    );
    expect(element.querySelectorAll('.hiring-targets li')).toHaveLength(
      HIRING_TARGETS.length
    );
  });

  it('links to the approved GitHub and LinkedIn profiles', () => {
    const element = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.hiring-link')
    ).map((link) => link.getAttribute('href'));

    expect(hrefs).toContain(PROFILE.links.github);
    expect(hrefs).toContain(PROFILE.links.linkedin);
  });

  it('links the approved resume PDF', () => {
    const element = fixture.nativeElement as HTMLElement;
    const resume = element.querySelector<HTMLAnchorElement>(
      'a[type="application/pdf"]'
    );

    expect(PROFILE.links.resume).toBe(
      '/assets/christopher-rutherford-resume.pdf'
    );
    expect(resume?.getAttribute('href')).toBe(PROFILE.links.resume);
    expect(element.textContent).not.toContain('Resume available on request');
  });

  it('renders the public email and keeps the contact form available', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(PROFILE.links.email).toBe('chris@christopherrutherford.net');
    expect(
      element.querySelector<HTMLAnchorElement>(
        'a[href="mailto:chris@christopherrutherford.net"]'
      )
    ).not.toBeNull();
    expect(
      element.querySelector<HTMLAnchorElement>('a[href="#contact"]')
    ).not.toBeNull();
  });
});
