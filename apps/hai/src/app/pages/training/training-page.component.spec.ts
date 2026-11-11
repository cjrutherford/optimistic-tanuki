import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TrainingPageComponent } from './training-page.component';
import { SERVICE_AREA } from '../../content/site-content';

describe('TrainingPageComponent', () => {
  let fixture: ComponentFixture<TrainingPageComponent>;
  let element: HTMLElement;

  const text = () => element.textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TrainingPageComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(TrainingPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('has one visible h1 with the page title', () => {
    const headings = element.querySelectorAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe('Learn technology with confidence.');
    expect(headings[0].classList).not.toContain('visually-hidden');
  });

  it('renders each section', () => {
    for (const id of [
      'who-its-for',
      'ways-to-learn',
      'topics',
      'approach',
      'service-area',
      'cta-heading',
    ]) {
      expect(element.querySelector(`#${id}`)).not.toBeNull();
    }
    expect(
      Array.from(element.querySelectorAll('#who-its-for h3')).map(
        (title) => title.textContent
      )
    ).toEqual([
      "I'm just getting started",
      'I want to use technology for my work or community',
      'I want to understand and manage more myself',
    ]);
    expect(
      Array.from(element.querySelectorAll('#topics h3')).map(
        (title) => title.textContent
      )
    ).toEqual([
      'Technology Without Fear',
      'Technology for Your Aspirations',
      'Take Control of Your Technology',
    ]);
  });

  it('sends both calls to action to contact with the training subject', () => {
    const hrefs = [
      element.querySelector('.intro-action'),
      element.querySelector('.primary-action'),
    ].map((link) => link?.getAttribute('href'));

    expect(hrefs).toEqual([
      '/contact?subject=training',
      '/contact?subject=training',
    ]);
  });

  it('labels one-on-one as available now and the other modes as planned, unlinked', () => {
    const cards = Array.from(element.querySelectorAll('#ways-to-learn li')).map(
      (card) => [
        card.querySelector('h3')?.textContent,
        card.querySelector('p')?.textContent?.split('.')[0],
        card.querySelectorAll('a').length,
      ]
    );

    expect(cards).toEqual([
      ['One-on-one guidance', 'Available now', 0],
      ['Small-group and community instruction', 'Planned', 0],
      ['Accessible online resources', 'Planned', 0],
    ]);
  });

  it('states no price, quotes before work, and names the service area', () => {
    expect(text()).not.toMatch(/\$\s?\d/);
    expect(element.querySelector('#approach')?.textContent).toContain(
      'quoted before work begins'
    );
    expect(element.querySelector('#service-area')?.textContent).toContain(
      SERVICE_AREA
    );
  });

  it('makes no unvalidated claims', () => {
    expect(text()).not.toMatch(/48-hour|48 hour/i);
    expect(text()).not.toMatch(/certificat|guarantee|testimonial/i);
  });
});
