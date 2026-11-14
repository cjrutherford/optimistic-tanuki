import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TechnicalSupportPageComponent } from './technical-support-page.component';
import { LABOR_RATE_LABEL } from '../../content/pricing';
import { SERVICE_AREA } from '../../content/site-content';

describe('TechnicalSupportPageComponent', () => {
  let fixture: ComponentFixture<TechnicalSupportPageComponent>;
  let element: HTMLElement;

  const text = () => element.textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TechnicalSupportPageComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(TechnicalSupportPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('has one visible h1 with the page title', () => {
    const headings = element.querySelectorAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(
      'Technology help without the runaround.'
    );
    expect(headings[0].classList).not.toContain('visually-hidden');
  });

  it('renders each section', () => {
    for (const id of [
      'who-its-for',
      'services',
      'how-it-works',
      'boundaries',
      'pricing',
      'service-area',
      'cta-heading',
    ]) {
      expect(element.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(
      Array.from(element.querySelectorAll('#services h3')).map(
        (title) => title.textContent
      )
    ).toEqual([
      'Troubleshooting and setup',
      'Files, backups and migration',
      'Business and organization help',
      'Ongoing care',
    ]);
    expect(element.querySelectorAll('#how-it-works li')).toHaveLength(5);
  });

  it('sends both calls to action to contact with the technical-support subject', () => {
    const hrefs = [
      element.querySelector('.intro-action'),
      element.querySelector('.primary-action'),
    ].map((link) => link?.getAttribute('href'));

    expect(hrefs).toEqual([
      '/contact?subject=technical-support',
      '/contact?subject=technical-support',
    ]);
  });

  it('states the labor rate and the service area', () => {
    expect(element.querySelector('#pricing')?.textContent).toContain(
      LABOR_RATE_LABEL
    );
    expect(element.querySelector('#service-area')?.textContent).toContain(
      SERVICE_AREA
    );
  });

  it('keeps the boundary statement and makes no unvalidated promises', () => {
    expect(element.querySelector('#boundaries')?.textContent).toContain(
      'We confirm scope, availability and pricing before work begins.'
    );
    expect(text()).not.toMatch(/48-hour|48 hour/i);
    expect(text()).not.toMatch(/guaranteed (fix|savings)|unhackable/i);
  });

  it('links to its sibling page from the closing panel', () => {
    const link = element.querySelector('.cta-panel .secondary a');

    expect(link?.getAttribute('href')).toBe('/training');
    expect(
      element.querySelector('.cta-panel .secondary')?.textContent
    ).toContain('understand it');
  });
});
