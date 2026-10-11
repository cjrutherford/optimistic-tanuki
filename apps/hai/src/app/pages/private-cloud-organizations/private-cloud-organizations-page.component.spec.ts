import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivateCloudOrganizationsPageComponent } from './private-cloud-organizations-page.component';
import { FREEDOM_PRINCIPLE } from '../../content/private-cloud';

describe('PrivateCloudOrganizationsPageComponent', () => {
  let fixture: ComponentFixture<PrivateCloudOrganizationsPageComponent>;
  let element: HTMLElement;

  const hrefs = (selector: string) =>
    Array.from(element.querySelectorAll(selector)).map((link) =>
      link.getAttribute('href')
    );
  const titles = (sectionId: string) =>
    Array.from(element.querySelectorAll(`#${sectionId} h3`)).map(
      (title) => title.textContent
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PrivateCloudOrganizationsPageComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(PrivateCloudOrganizationsPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('leads with the approved organization message in a single h1', () => {
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toBe(
      'Shared files, secure backups, and local support.'
    );
    expect(element.querySelector('.summary')?.textContent).toContain(
      'Without vendor lock-in.'
    );
  });

  it('sends the assessment actions to the assessment form', () => {
    const actions = Array.from(
      element.querySelectorAll('.intro-action, .primary-action')
    );

    expect(actions.map((action) => action.textContent?.trim())).toEqual([
      'Start an assessment',
      'Start an assessment',
    ]);
    expect(hrefs('.intro-action, .primary-action')).toEqual([
      '/private-cloud/assessment',
      '/private-cloud/assessment',
    ]);
  });

  it('sends the free audit to the contact form (D017)', () => {
    const audit = element.querySelector('.cta-panel .secondary a');

    expect(audit?.textContent?.trim()).toBe('Schedule a free audit');
    expect(audit?.getAttribute('href')).toBe('/contact');
  });

  it('names the four audiences, using Faith groups and never Churches', () => {
    expect(titles('audiences')).toEqual([
      'Faith groups',
      'Nonprofits',
      'Community groups',
      'Small businesses',
    ]);
    expect(
      (
        element.querySelector('#audiences ul') as HTMLElement
      ).style.getPropertyValue('--grid-columns')
    ).toBe('4');
    expect(element.textContent).not.toMatch(/church/i);
  });

  it('covers shared files, reliable backups, and setup and support', () => {
    expect(titles('outcomes')).toEqual([
      'Shared files',
      'Reliable backups',
      'Setup and support',
    ]);
  });

  it('answers ownership, continuity, and cost without quoting prices', () => {
    expect(titles('questions')).toEqual([
      'Who owns the data?',
      'What if HAI is no longer around?',
      'What will it cost?',
    ]);
    expect(element.querySelector('#questions')?.textContent).not.toMatch(
      /\$\s?\d/
    );
  });

  it('keeps the freedom principle prominent', () => {
    expect(element.querySelector('#freedom h2')?.textContent).toBe(
      FREEDOM_PRINCIPLE
    );
  });

  it('uses no cross imagery and makes no prohibited claims', () => {
    expect(element.querySelectorAll('img, svg')).toHaveLength(0);
    expect(element.textContent).not.toMatch(/[✝✞✟†]/);
    expect(element.textContent).not.toMatch(
      /unhackable|impossible to breach|guarantee[sd]? (savings|uptime)|always cheaper/i
    );
  });
});
