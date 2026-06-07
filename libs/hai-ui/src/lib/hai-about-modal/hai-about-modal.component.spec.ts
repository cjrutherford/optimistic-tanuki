import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HaiAboutModalComponent } from './hai-about-modal.component';
import { HaiAppDirectoryService } from '../hai-types/hai-app-directory.service';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('HaiAboutModalComponent', () => {
  let fixture: ComponentFixture<HaiAboutModalComponent>;
  let component: HaiAboutModalComponent;
  let themeService: ThemeService;

  // A public app (running URL available) and a repository-only app exercise
  // both link affordances rendered by the directory cards.
  const resolvedApps = [
    {
      appId: 'towne-square',
      configName: 'local-hub',
      name: 'Towne Square',
      category: 'Local Community',
      tagline: 'Neighborhood commerce and local connection.',
      repositoryUrl:
        'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/local-hub',
      resolvedHref: 'https://towne-square.example.com',
      runUrl: 'https://towne-square.example.com',
      isPublic: true,
      logoSrc: 'https://towne-square.example.com/assets/ts.png',
    },
    {
      appId: 'forge-of-will',
      configName: 'forgeofwill',
      name: 'Forge of Will',
      category: 'Planning',
      tagline: 'Personal project planning for deliberate work.',
      repositoryUrl:
        'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/forgeofwill',
      resolvedHref:
        'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/forgeofwill',
      isPublic: false,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HaiAboutModalComponent],
      providers: [
        {
          provide: HaiAppDirectoryService,
          useValue: {
            getResolvedApps: jest.fn().mockReturnValue(of(resolvedApps)),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HaiAboutModalComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    component.visible = true;
    component.config = {
      appId: 'hai-computer',
      appName: 'HAI Computer',
      appTagline: 'Pre-configured personal cloud systems.',
      appDescription: 'Purpose-built systems for digital homesteading.',
      appUrl: '/hai-computer',
    };
    fixture.detectChanges();
  });

  function showDirectory(): void {
    component.setActiveTab('directory');
    fixture.detectChanges();
  }

  it('renders an app card for each resolved directory app', () => {
    showDirectory();

    const cards = fixture.nativeElement.querySelectorAll(
      '[data-testid="hai-app-card"]'
    ) as NodeListOf<HTMLElement>;

    expect(cards.length).toBe(resolvedApps.length);
  });

  it('maps theme and personality values into local CSS variables for the modal body and cards', () => {
    jest
      .spyOn(themeService, 'getButtonGradient')
      .mockReturnValue('linear-gradient(rgb(1, 2, 3), rgb(4, 5, 6))');
    jest
      .spyOn(themeService, 'getCardGradient')
      .mockReturnValue('linear-gradient(rgb(6, 5, 4), rgb(3, 2, 1))');

    component.applyTheme({
      background: '#fcfaf4',
      foreground: '#17211b',
      accent: '#2d7a59',
      accentShades: [],
      accentGradients: { light: '', dark: '' },
      complementary: '#8f6aa7',
      complementaryShades: [],
      complementaryGradients: { light: '', dark: '' },
      tertiary: '#cf8b49',
      tertiaryShades: [],
      tertiaryGradients: { light: '', dark: '' },
      success: '#1f8f55',
      successShades: [],
      successGradients: { light: '', dark: '' },
      danger: '#d9534f',
      dangerShades: [],
      dangerGradients: { light: '', dark: '' },
      warning: '#d8a032',
      warningShades: [],
      warningGradients: { light: '', dark: '' },
    });

    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--local-hai-ink')).toBe('#17211b');
    expect(
      host.style.getPropertyValue('--local-hai-link-primary-background')
    ).toBe('#2d7a59');
    expect(host.style.getPropertyValue('--local-hai-mark-gradient')).toBe(
      'linear-gradient(rgb(1, 2, 3), rgb(4, 5, 6))'
    );
    expect(host.style.getPropertyValue('--local-hai-card-gradient')).toBe(
      'linear-gradient(rgb(6, 5, 4), rgb(3, 2, 1))'
    );
    expect(host.style.getPropertyValue('--local-hai-card-shadow')).toBe(
      'var(--personality-card-shadow, var(--shadow-lg))'
    );
    expect(host.style.getPropertyValue('--local-hai-body')).toContain(
      'color-mix(in srgb'
    );
  });

  it('renders a run link that opens the live app safely in a new tab', () => {
    showDirectory();

    const runLink = fixture.nativeElement.querySelector(
      '[data-testid="hai-app-run-link"]'
    ) as HTMLAnchorElement | null;

    expect(runLink).toBeTruthy();
    expect(runLink?.getAttribute('href')).toBe(
      'https://towne-square.example.com'
    );
    expect(runLink?.getAttribute('target')).toBe('_blank');
    expect(runLink?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(runLink?.getAttribute('aria-label')).toContain('opens in a new tab');
  });

  it('always renders a repository link that opens safely in a new tab', () => {
    showDirectory();

    const repoLinks = fixture.nativeElement.querySelectorAll(
      '[data-testid="hai-app-repo-link"]'
    ) as NodeListOf<HTMLAnchorElement>;

    expect(repoLinks.length).toBe(resolvedApps.length);
    repoLinks.forEach((link) => {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
    expect(repoLinks[0].getAttribute('href')).toContain('/apps/local-hub');
  });

  it('omits the run link for repository-only apps', () => {
    showDirectory();

    const cards = fixture.nativeElement.querySelectorAll(
      '[data-testid="hai-app-card"]'
    ) as NodeListOf<HTMLElement>;
    const repositoryOnlyCard = cards[1];

    expect(
      repositoryOnlyCard.querySelector('[data-testid="hai-app-run-link"]')
    ).toBeNull();
    expect(
      repositoryOnlyCard.querySelector('[data-testid="hai-app-repo-link"]')
    ).toBeTruthy();
  });

  it('switches to the HAI tab when selected', () => {
    const tabs = fixture.nativeElement.querySelectorAll(
      '.tab-item'
    ) as NodeListOf<HTMLButtonElement>;

    tabs[1].click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'software development house'
    );
  });
});
