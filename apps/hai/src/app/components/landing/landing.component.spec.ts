import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
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
          resolvedHref:
            'https://github.com/cjrutherford/optimistic-tanuki/tree/main/apps/local-hub',
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
      imports: [LandingComponent, HttpClientTestingModule],
      providers: [
        { provide: HaiAppDirectoryService, useValue: directoryServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders a project-start CTA and the HAI Computer path', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Start a Project');
    expect(text).toContain('See the services');
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

    expect(
      nativeElement.querySelector('otui-topographic-drift')
    ).not.toBeNull();
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

  it('renders the approved business positioning and removes playful messaging', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain(
      'Digital sovereignty for the work that runs your business.'
    );
    expect(text).toContain('Savannah, Georgia');
    expect(text).toContain('Custom Portals & Workflow Automation');
    expect(text).toContain('Independent Infrastructure');
    expect(text).toContain('Tailored Software');
    expect(text).toContain('Build the foundation');
    expect(text).toContain('Maintain and improve');
    expect(text).toContain(
      'White-label delivery for local technology partners'
    );
    expect(text).not.toContain('What does HAI actually stand for today?');
  });

  it('keeps services and engagement ahead of delivery proof in the page narrative', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text.indexOf('Services')).toBeGreaterThan(-1);
    expect(text.indexOf('Services')).toBeLessThan(
      text.indexOf('Delivery Proof')
    );
  });

  it('renders the business narrative sections with semantic service cards', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(nativeElement.querySelector('#services')).not.toBeNull();
    expect(nativeElement.querySelector('#approach')).not.toBeNull();
    expect(nativeElement.querySelector('#infrastructure')).not.toBeNull();
    expect(nativeElement.querySelectorAll('#services article')).toHaveLength(4);
    expect(nativeElement.querySelector('#services h3')?.textContent).toContain(
      'Custom Portals & Workflow Automation'
    );
    expect(nativeElement.querySelector('#services')?.textContent).not.toContain(
      'homelab'
    );
    expect(
      nativeElement.querySelector('#infrastructure')?.textContent
    ).not.toContain('family compute');
  });

  it('renders engagement and partner conversion paths before delivery proof', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;
    const text = nativeElement.textContent as string;

    expect(nativeElement.querySelector('#engagement')).not.toBeNull();
    expect(nativeElement.querySelector('#partners')).not.toBeNull();
    expect(text.indexOf('Build the foundation')).toBeLessThan(
      text.indexOf('Delivery Proof')
    );
    expect(text.indexOf('Maintain and improve')).toBeLessThan(
      text.indexOf('Delivery Proof')
    );
  });
});
