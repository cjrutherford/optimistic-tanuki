import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LandingComponent } from './landing.component';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  const directoryServiceStub = {
    getResolvedApps: jest.fn().mockReturnValue(
      of([
        {
          appId: 'optimistic-tanuki',
          name: 'Optimistic Tanuki',
          tagline: 'General social media offering.',
          category: 'Social Platform',
          resolvedHref: 'https://social.example.com',
          isPublic: true,
        },
        {
          appId: 'towne-square',
          name: 'Towne Square',
          tagline: 'Local-first social media and classifieds.',
          category: 'Local Community',
          resolvedHref: 'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/local-hub',
          isPublic: false,
        },
        {
          appId: 'forge-of-will',
          name: 'Forge of Will',
          tagline: 'Personal project planning.',
          category: 'Planning',
          resolvedHref: 'https://forge.example.com',
          isPublic: true,
        },
        {
          appId: 'fin-commander',
          name: 'Fin Commander',
          tagline: 'Small personal finance manager.',
          category: 'Finance',
          resolvedHref: 'https://finance.example.com',
          isPublic: true,
        },
        {
          appId: 'opportunity-compass',
          name: 'Opportunity Compass',
          tagline: 'Discover opportunities from interests and locality.',
          category: 'Discovery',
          resolvedHref: 'https://opportunities.example.com',
          isPublic: true,
        },
      ])
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        { provide: HaiAppDirectoryService, useValue: directoryServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the HAI Computer CTA', () => {
    expect(fixture.nativeElement.textContent).toContain('Explore HAI Computer');
  });

  it('renders the registry-backed HAI app cards', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Optimistic Tanuki');
    expect(text).toContain('Towne Square');
    expect(text).toContain('Forge of Will');
    expect(text).toContain('Fin Commander');
    expect(text).toContain('Opportunity Compass');
    expect(component.ecosystem$).toBeDefined();
  });

  it('uses motion layers in the hero scene', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(nativeElement.querySelector('otui-topographic-drift')).not.toBeNull();
    expect(nativeElement.querySelector('otui-aurora-ribbon')).not.toBeNull();
    expect(nativeElement.querySelector('otui-pulse-rings')).not.toBeNull();
  });

  it('applies theme-aware styling hooks to the layout surfaces', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(
      nativeElement.querySelector('.landing-shell[data-theme-surface="page"]')
    ).not.toBeNull();
    expect(
      nativeElement.querySelector('.hero-panel[data-theme-surface="hero"]')
    ).not.toBeNull();
    expect(
      nativeElement.querySelector('.story-panel[data-theme-surface="card"]')
    ).not.toBeNull();
  });

  it('renders the manifesto rail with motion-backed section emphasis', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(nativeElement.querySelector('.manifesto-rail')).not.toBeNull();
    expect(nativeElement.querySelector('otui-shimmer-beam')).not.toBeNull();
  });
});
