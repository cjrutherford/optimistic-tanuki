import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { DEFAULT_APP_REGISTRY } from '@optimistic-tanuki/app-registry-backend';
import { APP_CATALOG } from '../app-catalog.data';
import {
  getPublicExternalUrl,
  ProjectGridComponent,
} from './project-grid.component';

describe('ProjectGridComponent', () => {
  let fixture: ComponentFixture<ProjectGridComponent>;
  let registryService: { getAllApps: jest.Mock };

  beforeEach(async () => {
    registryService = {
      getAllApps: jest.fn().mockReturnValue(of(DEFAULT_APP_REGISTRY.apps)),
    };
    await TestBed.configureTestingModule({
      imports: [ProjectGridComponent],
      providers: [
        {
          provide: AppRegistryService,
          useValue: registryService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectGridComponent);
    fixture.detectChanges();
  });

  it('renders every registered web app except the portfolio site', () => {
    const cards = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '[role="listitem"]'
      )
    );
    const names = cards.map((card) =>
      card.querySelector('h3')?.textContent?.trim()
    );

    expect(cards).toHaveLength(18);
    expect(names).toContain('Opportunity Compass');
    expect(names).toContain('UI Playground');
    expect(names.sort()).toEqual(
      APP_CATALOG.map(
        (app) =>
          DEFAULT_APP_REGISTRY.apps.find(
            (registered) => registered.appId === app.registryId
          )?.name ?? app.name
      ).sort()
    );
  });

  it('updates cards from runtime registry changes and uses safe generic fallbacks', () => {
    const addedPublicApp = {
      appId: 'new-public-app',
      name: 'New Public App',
      domain: 'new-public-app.example',
      uiBaseUrl: 'https://new-public-app.example',
      apiBaseUrl: 'https://api.example',
      appType: 'client' as const,
      visibility: 'public' as const,
    };
    const addedInternalApp = {
      ...addedPublicApp,
      appId: 'new-internal-console',
      name: 'New Internal Console',
      appType: 'admin' as const,
      visibility: 'internal' as const,
    };
    const runtimeApps = [
      ...DEFAULT_APP_REGISTRY.apps
        .filter((app) => app.appId !== 'hai')
        .map((app) =>
          app.appId === 'local-hub'
            ? { ...app, visibility: 'internal' as const }
            : app
        ),
      addedPublicApp,
      addedInternalApp,
      { ...addedPublicApp, appId: 'backend-service', appType: 'user' as const },
      { ...addedPublicApp, appId: 'client-without-ui', uiBaseUrl: '' },
    ];
    registryService.getAllApps.mockReturnValue(of(runtimeApps));
    fixture.destroy();
    fixture = TestBed.createComponent(ProjectGridComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const cards = Array.from(
      element.querySelectorAll<HTMLElement>('[role="listitem"]')
    );
    const newPublic = cards.find(
      (card) =>
        card.classList.contains('tone-business') &&
        card.textContent?.includes('New Public App')
    );
    const newInternal = cards.find(
      (card) =>
        card.classList.contains('tone-internal') &&
        card.textContent?.includes('New Internal Console')
    );
    const reclassified = cards.find((card) =>
      card.textContent?.includes('Towne Square')
    );

    expect(cards).toHaveLength(19);
    expect(cards.map((card) => card.textContent).join(' ')).not.toContain(
      'HAI company site'
    );
    expect(
      cards.some((card) => card.textContent?.includes('Backend Service'))
    ).toBe(false);
    expect(
      cards.some((card) => card.textContent?.includes('Client Without UI'))
    ).toBe(false);
    expect(newPublic?.textContent).toContain(
      'New Public App is part of the platform.'
    );
    expect(newPublic?.querySelector('a[href*="github.com"]')).toBeNull();
    expect(newInternal?.textContent).toContain('Explore this application.');
    expect(newInternal?.querySelector('a[href*="github.com"]')).toBeNull();
    expect(reclassified?.classList.contains('tone-internal')).toBe(true);
    expect(reclassified?.textContent).toContain('Internal tool');
    expect(
      element.querySelector('.projectGrid')?.getAttribute('aria-label')
    ).toBe('Registered web apps');
  });

  it('links each experience to its real repository root without implying a live deployment', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.portfolio-actions a')
    );

    expect(links).toHaveLength(19);
    expect(
      links.filter((link) => link.textContent?.includes('View source'))
    ).toHaveLength(18);
    expect(
      links
        .filter((link) => link.textContent?.includes('View source'))
        .every((link) => link.href.includes('/tree/main/apps/'))
    ).toBe(true);
    expect(
      links.some((link) => link.href.includes('christopherrutherford-net'))
    ).toBe(false);
    expect(element.textContent).toContain('Source in workspace');
    expect(element.querySelector('a[href*="localhost"]')).toBeNull();
    expect(element.textContent).not.toContain('Open app');
    expect(element.textContent).not.toMatch(/whitebox|matrix/i);
    expect(
      links.filter((link) => link.textContent?.includes('Visit site'))
    ).toHaveLength(1);
    expect(
      links.find((link) => link.textContent?.includes('Visit site'))?.href
    ).toBe('https://forgeofwill.com/');
    expect(
      Array.from(
        element.querySelectorAll<HTMLImageElement>('.portfolio-mark img')
      ).every((image) => !image.src.includes('localhost'))
    ).toBe(true);
  });

  it('renders the work intro and descriptive proof for each registered app', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('product work I take on');
    expect(text).toContain('internal workspace for registry');
    expect(text).toContain('View source');
  });

  it('filters local or private HTTPS hosts from external destinations and logos', () => {
    expect(getPublicExternalUrl('http://forgeofwill.com')).toBeUndefined();
    expect(getPublicExternalUrl('https://localhost:8080')).toBeUndefined();
    expect(getPublicExternalUrl('https://127.0.0.1')).toBeUndefined();
    expect(getPublicExternalUrl('https://192.168.1.8')).toBeUndefined();
    expect(getPublicExternalUrl('https://dev.local')).toBeUndefined();
    expect(getPublicExternalUrl('https://localhost.')).toBeUndefined();
    expect(getPublicExternalUrl('https://dev.local.')).toBeUndefined();
    expect(getPublicExternalUrl('https://service.internal.')).toBeUndefined();
    expect(getPublicExternalUrl('https://forgeofwill.com')).toBe(
      'https://forgeofwill.com/'
    );
  });
});
