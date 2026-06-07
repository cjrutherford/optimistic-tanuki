import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectGridComponent } from './project-grid.component';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';

describe('ProjectGridComponent', () => {
  let component: ProjectGridComponent;
  let fixture: ComponentFixture<ProjectGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectGridComponent],
      providers: [
        {
          provide: HaiAppDirectoryService,
          useValue: {
            getResolvedApps: jest.fn().mockReturnValue(
              of([
                {
                  appId: 'optimistic-tanuki',
                  name: 'Optimistic Tanuki',
                  tagline: 'General social media offering.',
                  category: 'Social Platform',
                  resolvedHref: 'https://social.example.com',
                  repositoryUrl:
                    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/client-interface',
                  logoSrc: 'https://social.example.com/assets/tanuki.svg',
                  isPublic: true,
                },
                {
                  appId: 'towne-square',
                  name: 'Towne Square',
                  tagline: 'Local-first social media and classifieds.',
                  category: 'Local Community',
                  resolvedHref: 'https://towne.example.com',
                  repositoryUrl:
                    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/local-hub',
                  logoSrc: 'https://towne.example.com/assets/ts.png',
                  isPublic: true,
                },
                {
                  appId: 'forge-of-will',
                  name: 'Forge of Will',
                  tagline: 'Personal project planning.',
                  category: 'Planning',
                  resolvedHref: 'https://forge.example.com',
                  repositoryUrl:
                    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/forgeofwill',
                  logoSrc:
                    'https://forge.example.com/android-chrome-192x192.png',
                  isPublic: true,
                },
                {
                  appId: 'fin-commander',
                  name: 'Fin Commander',
                  tagline: 'Small personal finance manager.',
                  category: 'Finance',
                  resolvedHref: 'https://finance.example.com',
                  repositoryUrl:
                    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/fin-commander',
                  logoSrc:
                    'https://finance.example.com/images/fin-commander-icon.png',
                  isPublic: true,
                },
                {
                  appId: 'opportunity-compass',
                  name: 'Opportunity Compass',
                  tagline:
                    'Discover opportunities from interests and locality.',
                  category: 'Discovery',
                  resolvedHref: 'https://opportunities.example.com',
                  repositoryUrl:
                    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/leads-app',
                  logoSrc: 'https://opportunities.example.com/favicon.ico',
                  isPublic: true,
                },
                {
                  appId: 'developer-portal',
                  name: 'Developer Portal',
                  tagline: 'Docs, onboarding, and developer entry.',
                  category: 'Developer Experience',
                  resolvedHref: 'https://developer.example.com',
                  repositoryUrl:
                    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/developer-portal',
                  logoSrc: 'https://developer.example.com/favicon.ico',
                  isPublic: true,
                },
                {
                  appId: 'store-client',
                  name: 'Store',
                  tagline: 'Bookings, donations, and storefront flows.',
                  category: 'Commerce',
                  resolvedHref: 'https://store.example.com',
                  repositoryUrl:
                    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/store-client',
                  logoSrc: 'https://store.example.com/assets/store-icon.png',
                  isPublic: true,
                },
                {
                  appId: 'video-platform',
                  name: 'Video Platform',
                  tagline: 'Share and discover video content.',
                  category: 'Media',
                  resolvedHref: 'https://video.example.com',
                  repositoryUrl:
                    'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/video-client',
                  logoSrc:
                    'https://video.example.com/android-chrome-192x192.png',
                  isPublic: true,
                },
              ])
            ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the curated portfolio entries', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Optimistic Tanuki');
    expect(text).toContain('Developer Portal');
    expect(text).toContain('Video Platform');
    expect(text).toContain('proof of work');
    expect(text).toContain('View repository');
  });

  it('includes the expanded customer-facing app set', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Towne Square');
    expect(text).toContain('Fin Commander');
    expect(text).toContain('Opportunity Compass');
    expect(text).toContain('Store');
  });
});
