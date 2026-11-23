import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { DashboardComponent } from './dashboard.component';
import { AuthService } from '../services/auth.service';
import { OwnerNavLeaf, flattenNav } from '../owner-nav';
import { AttentionService } from '../services/attention.service';
import { OwnerAccessService } from '../services/owner-access.service';
import { CommunityService } from '../services/community.service';
import { TownContextService } from '../services/town-context.service';

interface CommunityServiceStub {
  getCities: jest.Mock;
  getCommunities: jest.Mock;
}

interface OwnerAccessStub {
  load: jest.Mock;
  can: jest.Mock;
  reset: jest.Mock;
}

describe('DashboardComponent', () => {
  let router: Router;
  let authService: { logout: jest.Mock };
  let access: OwnerAccessStub;
  let themeService: any;
  let communities: CommunityServiceStub;

  const controlCenterPersonality = {
    id: 'control-center',
    name: 'Control Center',
    animations: {
      easing: 'ease',
      duration: {
        fast: '150ms',
        normal: '300ms',
        slow: '450ms',
      },
    },
  };

  beforeEach(async () => {
    localStorage.clear();
    communities = {
      getCities: jest.fn(() =>
        of([{ id: 't1', name: 'Springfield', city: 'Springfield' }])
      ),
      getCommunities: jest.fn(() => of([])),
    };
    authService = {
      logout: jest.fn(),
    };
    access = {
      load: jest.fn(() =>
        of({ status: 'owner', all: true, permissions: new Set<string>() })
      ),
      can: jest.fn(() => true),
      reset: jest.fn(),
    };
    themeService = {
      theme: new BehaviorSubject<'light' | 'dark' | undefined>('light'),
      themeColors$: of({
        background: '#ffffff',
        foreground: '#0f172a',
        accent: '#2dd4bf',
        accentShades: [],
        accentGradients: {},
        complementary: '#0f766e',
        complementaryShades: [],
        complementaryGradients: {},
        tertiary: '#38bdf8',
        tertiaryShades: [],
        tertiaryGradients: {},
        success: '#22c55e',
        successShades: [],
        successGradients: {},
        danger: '#ef4444',
        dangerShades: [],
        dangerGradients: {},
        warning: '#f59e0b',
        warningShades: [],
        warningGradients: {},
      }),
      generatedTheme$: of({
        colors: {
          background: '#ffffff',
          foreground: '#0f172a',
          primary: '#2dd4bf',
          secondary: '#0f766e',
          border: '#cbd5e1',
        },
        fonts: {
          heading: { family: 'IBM Plex Sans' },
          body: { family: 'IBM Plex Sans' },
          mono: { family: 'IBM Plex Mono' },
        },
        personality: controlCenterPersonality,
      }),
      personality$: of(controlCenterPersonality),
      getTheme: jest.fn(() => 'light'),
      getAccentColor: jest.fn(() => '#2dd4bf'),
      getCurrentPersonality: jest.fn(() => controlCenterPersonality),
      toggleTheme: jest.fn(),
      theme$: () => of('light'),
      setPersonality: jest.fn(),
      setPrimaryColor: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: OwnerAccessService, useValue: access },
        { provide: CommunityService, useValue: communities },
        {
          provide: AttentionService,
          useValue: {
            report: () => null,
            state: () => 'idle',
            health: () => null,
            healthLoad: () => 'idle',
            load: jest.fn(),
            loadHealth: jest.fn(),
            badgesFor: () => ({}),
          },
        },
        { provide: ThemeService, useValue: themeService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  const setUrl = (url: string): void => {
    Object.defineProperty(router, 'url', {
      configurable: true,
      get: () => url,
    });
  };

  const setViewport = (desktop: boolean): void => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: jest.fn().mockImplementation((query: string) => ({
        matches: desktop,
        media: query,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    });
  };

  const create = (): {
    fixture: ReturnType<typeof TestBed.createComponent<DashboardComponent>>;
    component: DashboardComponent;
  } => {
    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  const links = (fixture: ReturnType<typeof create>['fixture']): string[] =>
    fixture.debugElement
      .queryAll(By.css('app-owner-sidebar a'))
      .map((el) => (el.nativeElement as HTMLElement).textContent?.trim() ?? '');

  it('builds the grouped sidebar from OWNER_NAV, showing town pages disabled until a town is picked', () => {
    setViewport(true);
    setUrl('/dashboard/home');
    const { fixture, component } = create();

    expect(component.groups().map((g) => g.label)).toEqual([
      'Home',
      'People & access',
      'Towns',
      'Directory',
      'Moderation',
      'Commerce',
      'Apps & sites',
      'System',
    ]);
    const towns = component.groups().find((g) => g.id === 'towns');
    expect(towns?.leaves.some((leaf) => leaf.needsTown)).toBe(true);
    expect(links(fixture)[0]).toContain('Home');

    // Groups are collapsible: only the active group starts open.
    const toggle = fixture.debugElement.query(
      By.css('.group-toggle[aria-expanded="false"]')
    );
    toggle.nativeElement.click();
    fixture.detectChanges();
    expect(links(fixture).length).toBeGreaterThan(2);
  });

  it('hides leaves the owner lacks permission for', () => {
    setViewport(true);
    setUrl('/dashboard/home');
    const users = flattenNav().find(
      (entry) => entry.leaf.path === '/dashboard/users'
    )?.leaf as OwnerNavLeaf;
    users.requiredPermission = 'users.manage';
    try {
      access.can.mockImplementation((permission?: string) => !permission);
      const { component } = create();
      const people = component.groups().find((g) => g.id === 'people');
      expect(people?.leaves.map((leaf) => leaf.label)).not.toContain('Users');
      expect(
        component.paletteEntries().map((entry) => entry.leaf.label)
      ).not.toContain('Users');
    } finally {
      delete users.requiredPermission;
    }
  });

  it('docks the sidebar on desktop and keeps it open after navigating', () => {
    setViewport(true);
    setUrl('/dashboard/home');
    const { fixture, component } = create();

    expect(component.desktop()).toBe(true);
    expect(component.sidebarOpen()).toBe(true);
    const sidebar = fixture.debugElement.query(By.css('aside'));
    expect(sidebar.nativeElement.classList).toContain('sidebar--docked');

    component.onNavigated();
    component.onNavigated();
    expect(component.sidebarOpen()).toBe(true);
  });

  it('uses a closed modal drawer on narrow screens that closes on navigation', () => {
    setViewport(false);
    setUrl('/dashboard/home');
    const { fixture, component } = create();

    expect(component.desktop()).toBe(false);
    expect(component.sidebarOpen()).toBe(false);
    expect(
      fixture.debugElement.query(By.css('aside')).nativeElement.classList
    ).toContain('sidebar--drawer');

    component.toggleSidebar();
    fixture.detectChanges();
    expect(component.sidebarOpen()).toBe(true);
    expect(fixture.debugElement.query(By.css('.scrim'))).not.toBeNull();

    component.onNavigated();
    expect(component.sidebarOpen()).toBe(false);
  });

  it('tracks the active leaf from router navigation, not just init', () => {
    setViewport(true);
    setUrl('/dashboard/home');
    const { component } = create();
    expect(component.activePath()).toBe('/dashboard/home');

    setUrl('/dashboard/security');
    (router.events as Subject<unknown>).next(
      new NavigationEnd(1, '/dashboard/security', '/dashboard/security')
    );
    expect(component.activePath()).toBe('/dashboard/security');

    setUrl('/dashboard/app-config/designer/abc');
    (router.events as Subject<unknown>).next(
      new NavigationEnd(2, '/dashboard/app-config/designer/abc', '/x')
    );
    expect(component.activePath()).toBe('/dashboard/app-config/designer');
  });

  it('renders breadcrumbs for the current route', () => {
    setViewport(true);
    setUrl('/dashboard/store/orders');
    const { fixture } = create();
    const text = fixture.debugElement
      .query(By.css('app-owner-breadcrumbs'))
      .nativeElement.textContent.replace(/\s+/g, ' ');
    expect(text).toContain('Commerce');
    expect(text).toContain('Orders');
  });

  it('opens the palette with Ctrl+K and Cmd+K and closes it with Esc', () => {
    setViewport(true);
    setUrl('/dashboard/home');
    const { fixture, component } = create();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })
    );
    fixture.detectChanges();
    expect(component.paletteOpen()).toBe(true);
    expect(
      fixture.debugElement.query(By.css('[role="dialog"]'))
    ).not.toBeNull();

    const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
    dialog.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();
    expect(component.paletteOpen()).toBe(false);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'K', metaKey: true })
    );
    expect(component.paletteOpen()).toBe(true);
  });

  it('navigates to the chosen palette page and keeps the docked bar open', () => {
    setViewport(true);
    setUrl('/dashboard/home');
    const navigate = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);
    const { component } = create();

    component.goTo(component.paletteEntries()[2]);
    expect(navigate).toHaveBeenCalledWith(
      component.paletteEntries()[2].leaf.path
    );
    expect(component.sidebarOpen()).toBe(true);
  });

  it('clears cached access and signs out', () => {
    setViewport(true);
    setUrl('/dashboard/home');
    const { component } = create();
    component.logout();
    expect(access.reset).toHaveBeenCalled();
    expect(authService.logout).toHaveBeenCalled();
  });

  it('leaves the personality to the app theme defaults', () => {
    setViewport(true);
    setUrl('/dashboard/home');
    create();
    expect(themeService.setPersonality).not.toHaveBeenCalled();
    expect(themeService.setPrimaryColor).not.toHaveBeenCalled();
  });

  describe('town context', () => {
    const townLinks = (
      fixture: ReturnType<typeof create>['fixture']
    ): HTMLAnchorElement[] =>
      fixture.debugElement
        .queryAll(By.css('app-owner-sidebar .leaves a'))
        .map((el) => el.nativeElement as HTMLAnchorElement)
        .filter((a) => a.textContent?.includes('Boundary review'));

    it('shows town pages disabled with a hint and a picker link when no town is selected', () => {
      setViewport(true);
      setUrl('/dashboard/towns');
      const { fixture } = create();
      const [boundary] = townLinks(fixture);
      expect(boundary.getAttribute('aria-disabled')).toBe('true');
      expect(boundary.textContent).toContain('Pick a town');
      expect(boundary.getAttribute('href')).toBe('/dashboard/towns');
    });

    it('links town pages to the selected town', () => {
      setViewport(true);
      setUrl('/dashboard/towns');
      localStorage.setItem('owner-console.town', 't1');
      const town = TestBed.inject(TownContextService);
      town.selectedId.set('t1');
      const { fixture } = create();
      const [boundary] = townLinks(fixture);
      expect(boundary.getAttribute('aria-disabled')).toBeNull();
      expect(boundary.getAttribute('href')).toBe(
        '/dashboard/towns/t1/boundary-review'
      );
    });

    it('resolves palette town pages against the selected town', () => {
      setViewport(true);
      setUrl('/dashboard/home');
      const town = TestBed.inject(TownContextService);
      town.selectedId.set('t1');
      const { component } = create();
      const row = component
        .paletteEntries()
        .find((entry) => entry.leaf.label === 'Boundary review');
      expect(row?.href).toBe('/dashboard/towns/t1/boundary-review');
      expect(row?.hint).toBeUndefined();
    });

    it('marks palette town pages with a hint when no town is selected', () => {
      setViewport(true);
      setUrl('/dashboard/home');
      const { component } = create();
      const row = component
        .paletteEntries()
        .find((entry) => entry.leaf.label === 'Boundary review');
      expect(row?.href).toBe('/dashboard/towns');
      expect(row?.hint).toBe('Pick a town');
    });

    it('shows Town not found with a link to the picker for an unknown town URL', () => {
      setViewport(true);
      setUrl('/dashboard/towns/missing/boundary-review');
      const { fixture } = create();
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('Town not found');
      const back = fixture.debugElement.query(By.css('app-town-not-found a'));
      expect(back.nativeElement.getAttribute('href')).toBe('/dashboard/towns');
    });

    it('sets the town from the URL and shows the town tabs', () => {
      setViewport(true);
      setUrl('/dashboard/towns/t1/boundary-review');
      localStorage.setItem('owner-console.town', 'other');
      const { fixture } = create();
      expect(TestBed.inject(TownContextService).selected()?.id).toBe('t1');
      expect(fixture.debugElement.query(By.css('app-town-tabs'))).toBeTruthy();
      expect(
        fixture.debugElement.query(By.css('app-town-not-found'))
      ).toBeNull();
    });
  });
});
