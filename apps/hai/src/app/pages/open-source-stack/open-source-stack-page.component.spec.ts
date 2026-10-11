import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OpenSourceStackPageComponent } from './open-source-stack-page.component';
import {
  CORE_SERVICES,
  FREEDOM_PRINCIPLE,
  PLATFORM_COMPONENTS,
  STACK_QUALIFIER,
} from '../../content/private-cloud';

describe('OpenSourceStackPageComponent', () => {
  let fixture: ComponentFixture<OpenSourceStackPageComponent>;
  let element: HTMLElement;

  const projects = (sectionId: string) =>
    Array.from(element.querySelectorAll(`#${sectionId} .project`)).map(
      (project) => project.textContent
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OpenSourceStackPageComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(OpenSourceStackPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('has a single h1 and an assessment action', () => {
    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(
      Array.from(
        element.querySelectorAll('.intro-action, .primary-action')
      ).map((link) => link.getAttribute('href'))
    ).toEqual(['/private-cloud/assessment', '/private-cloud/assessment']);
  });

  it('states up front that the stack varies by customer', () => {
    const note = element.querySelector('.stack-qualifier');

    expect(note?.textContent).toBe(STACK_QUALIFIER);
    expect(note?.textContent).toMatch(/varies by customer/);
    expect(note?.textContent).toMatch(/no customer automatically gets every/);
  });

  it('presents every core service named in the content source of truth', () => {
    expect(projects('core-services')).toEqual([
      'Nextcloud',
      'Immich',
      'Jellyfin',
      'Paperless-ngx',
      'Vaultwarden',
    ]);
  });

  it('presents the platform and operations layer', () => {
    expect(
      Array.from(element.querySelectorAll('#platform h3')).map(
        (role) => role.textContent
      )
    ).toEqual(PLATFORM_COMPONENTS.map((component) => component.role));
    expect(projects('platform')).toEqual(
      expect.arrayContaining([
        'Debian or Ubuntu Linux',
        'Docker Compose',
        'WireGuard',
        'Restic',
        'Uptime Kuma',
      ])
    );
  });

  it('describes Vaultwarden as an unofficial Bitwarden-compatible server', () => {
    const vaultwarden = CORE_SERVICES.find(
      (service) => service.project === 'Vaultwarden'
    );

    expect(vaultwarden?.description).toMatch(/unofficial/);
    expect(vaultwarden?.description).toMatch(/Bitwarden/);
  });

  it('links each named project to its own site', () => {
    const links = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.project-link')
    );

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^https:\/\//);
      expect(link.getAttribute('rel')).toBe('noopener');
      const project = link.textContent?.replace('project site', '').trim();
      expect(
        [...CORE_SERVICES, ...PLATFORM_COMPONENTS].find(
          (component) => component.project === project
        )?.url
      ).toBe(link.getAttribute('href'));
    }
  });

  it('leads each item with a plain-language role before the project name', () => {
    for (const item of Array.from(element.querySelectorAll('.stack-item'))) {
      expect(item.firstElementChild?.tagName).toBe('H3');
    }
  });

  it('shows the stack diagram with its qualifier caption', () => {
    expect(element.querySelectorAll('#architecture .tier')).toHaveLength(4);
    expect(
      element.querySelector('#architecture figcaption')?.textContent
    ).toMatch(/only the services you choose/);
  });

  it('keeps the freedom principle and links back to private cloud', () => {
    expect(element.querySelector('#freedom h2')?.textContent).toBe(
      FREEDOM_PRINCIPLE
    );
    expect(element.querySelector('#freedom a')?.getAttribute('href')).toBe(
      '/private-cloud'
    );
  });
});
