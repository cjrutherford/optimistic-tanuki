import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { DEFAULT_APP_REGISTRY } from '@optimistic-tanuki/app-registry-backend';
import { SystemsLabComponent } from './systems-lab.component';
import { APP_CATALOG, APP_CATALOG_GROUPS } from '../app-catalog.data';

describe('SystemsLabComponent', () => {
  let fixture: ComponentFixture<SystemsLabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SystemsLabComponent],
      providers: [
        {
          provide: AppRegistryService,
          useValue: {
            getAllApps: jest
              .fn()
              .mockReturnValue(of(DEFAULT_APP_REGISTRY.apps)),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SystemsLabComponent);
    fixture.detectChanges();
  });

  it('explains the repository architecture as a labeled section with linked layers', () => {
    const section = (fixture.nativeElement as HTMLElement).querySelector(
      'section#systems-lab'
    );

    expect(section).toBeTruthy();
    expect(section?.getAttribute('aria-labelledby')).toBe('systems-lab-title');
    expect(
      section?.querySelector('h2#systems-lab-title')?.textContent
    ).toContain('Systems Lab');

    const layers = Array.from(section?.querySelectorAll('ol > li') ?? []);
    expect(layers).toHaveLength(5);
    expect(
      layers.map((layer) => layer.textContent?.replace(/\s+/g, ' '))
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Application experiences'),
        expect.stringContaining('Shared Angular libraries'),
        expect.stringContaining('Gateway and NestJS services'),
        expect.stringContaining('Data and security'),
        expect.stringContaining('Nx and Docker delivery'),
      ])
    );
    expect(section?.textContent).not.toMatch(
      /production uptime|always available/i
    );
  });

  it('shows only registered web apps with repository links', () => {
    const element = fixture.nativeElement as HTMLElement;
    const section = element.querySelector('section#systems-lab');
    const cards = Array.from(
      section?.querySelectorAll<HTMLElement>('.catalog-card') ?? []
    );
    const links = Array.from(
      section?.querySelectorAll<HTMLAnchorElement>('.catalog-card a') ?? []
    );

    expect(section?.textContent).toContain('Web apps in the registry');
    expect(section?.textContent).toContain('Browse 18 registered web apps');
    expect(cards).toHaveLength(18);
    expect(links).toHaveLength(18);
    expect(
      cards.map((card) => card.getAttribute('data-app-id')).sort()
    ).toEqual(APP_CATALOG.map((app) => app.id).sort());
    expect(APP_CATALOG.map((app) => app.registryId).sort()).toEqual(
      DEFAULT_APP_REGISTRY.apps
        .map((app) => app.appId)
        .filter((id) => id !== 'christopherrutherford-net')
        .sort()
    );
    expect(cards.map((card) => card.getAttribute('data-app-id'))).not.toContain(
      'christopherrutherford-net'
    );
    expect(section?.querySelectorAll('details')).toHaveLength(2);
    expect(section?.querySelector('details[open]')).toBeNull();
    expect(section?.textContent).toContain('Public web app');
    expect(section?.textContent).toContain('Internal web app');
    expect(
      cards.every((card) =>
        Boolean(card.querySelector('.catalog-card-copy p')?.textContent?.trim())
      )
    ).toBe(true);
    expect(section?.textContent).not.toMatch(/whitebox|matrix|\bslice\b|—/i);
    expect(
      links.filter((link) => link.href.includes('/tree/main/apps/'))
    ).toHaveLength(18);
    expect(links.find((link) => link.href.includes('/tools/'))).toBeUndefined();
    expect(
      cards.find((card) => card.getAttribute('data-app-id') === 'owner-console')
        ?.textContent
    ).toContain('operator');
    expect(
      cards.find((card) => card.getAttribute('data-app-id') === 'ui-playground')
        ?.textContent
    ).toContain('component and docs playground');
    expect(APP_CATALOG_GROUPS.publicApps).toHaveLength(14);
    expect(APP_CATALOG_GROUPS.internalTools).toHaveLength(4);
  });
});
