import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SoftwareStacksPageComponent } from './software-stacks-page.component';
import { VERTICAL_SOLUTIONS } from '../../components/solutions-matrix/solutions-matrix.component';
import { CORE_SERVICES, STACK_QUALIFIER } from '../../content/private-cloud';

describe('SoftwareStacksPageComponent', () => {
  let fixture: ComponentFixture<SoftwareStacksPageComponent>;
  let element: HTMLElement;

  const hrefs = (selector: string) =>
    Array.from(element.querySelectorAll(selector)).map((link) =>
      link.getAttribute('href')
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SoftwareStacksPageComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(SoftwareStacksPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('has one visible h1 and the audit action going to contact', () => {
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.classList).not.toContain(
      'visually-hidden'
    );
    expect(hrefs('.intro-action')).toEqual(['/contact']);
  });

  it('keeps the existing industry stacks intact', () => {
    expect(
      element.querySelector('hai-solutions-matrix #stacks')
    ).not.toBeNull();
    expect(element.textContent).toContain(VERTICAL_SOLUTIONS[0].name);
  });

  it('makes both kinds of stack reachable from the intro', () => {
    expect(hrefs('.intro-link')).toEqual([
      '/software-stacks#stacks',
      '/software-stacks#private-cloud-stack',
    ]);
  });

  it('adds a private cloud stack entry with every core service', () => {
    const entry = element.querySelector('#private-cloud-stack');

    expect(entry?.querySelector('h2')?.textContent).toBe(
      'The private cloud stack.'
    );
    expect(
      Array.from(entry?.querySelectorAll('.service-list strong') ?? []).map(
        (name) => name.textContent
      )
    ).toEqual(CORE_SERVICES.map((service) => service.project));
    expect(entry?.querySelector('.qualifier')?.textContent).toBe(
      STACK_QUALIFIER
    );
    expect(entry?.textContent).not.toMatch(/\$\s?\d/);
  });

  it('lists only named platform projects', () => {
    const projects = Array.from(
      element.querySelectorAll('#private-cloud-stack .platform-list li')
    ).map((item) => item.textContent?.trim());

    expect(projects).toEqual([
      'Debian or Ubuntu Linux',
      'Docker Compose',
      'WireGuard',
      'Restic',
      'Uptime Kuma',
    ]);
  });

  it('links to the full open-source page, private cloud, and the assessment', () => {
    expect(hrefs('#private-cloud-stack .links a')).toEqual([
      '/private-cloud/open-source-stack',
      '/private-cloud',
      '/private-cloud/assessment',
    ]);
  });
});
