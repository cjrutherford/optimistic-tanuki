import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HaiResolvedAppLink } from '@optimistic-tanuki/hai-ui';
import { EcosystemSectionComponent } from './ecosystem-section.component';

describe('EcosystemSectionComponent', () => {
  let fixture: ComponentFixture<EcosystemSectionComponent>;
  const apps: HaiResolvedAppLink[] = [
    {
      appId: 'first-app',
      configName: 'first-app',
      name: 'First App',
      tagline: 'The first tagline.',
      href: '/first-app',
      resolvedHref: 'https://example.com/first-app',
      isPublic: true,
      category: 'Featured',
      appPath: 'first-app',
      portfolioSummary: 'First summary',
      repositoryUrl: 'https://github.com/example/first-app',
    },
    {
      appId: 'second-app',
      configName: 'second-app',
      name: 'Second App',
      tagline: 'The second tagline.',
      href: '/second-app',
      resolvedHref: 'https://github.com/example/second-app',
      isPublic: false,
      category: 'Supporting',
      appPath: 'second-app',
      portfolioSummary: 'Second summary',
      repositoryUrl: 'https://github.com/example/second-app',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EcosystemSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EcosystemSectionComponent);
    fixture.componentRef.setInput('apps', apps);
    fixture.detectChanges();
  });

  it('keeps every ecosystem item as a native anchor with its resolved destination and content', () => {
    const anchors = Array.from(
      (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLAnchorElement>('a.ecosystem-card')
    );

    expect(anchors).toHaveLength(2);
    expect(anchors.map((anchor) => anchor.href)).toEqual([
      apps[0].resolvedHref,
      apps[1].resolvedHref,
    ]);
    expect(anchors.every((anchor) => !anchor.querySelector('a,button'))).toBe(
      true
    );
    expect(anchors[0].textContent).toContain('Open app');
    expect(anchors[1].textContent).toContain('View repository');
    expect(anchors[0].classList.contains('ecosystem-card-featured')).toBe(true);
    expect(anchors[1].classList.contains('ecosystem-card-featured')).toBe(
      false
    );
  });

  it('renders the canonical anchor-card contract with stronger first-item branding', () => {
    const anchors = Array.from(
      (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLAnchorElement>('a.ecosystem-card')
    );

    expect(anchors[0].getAttribute('data-tone')).toBe('brand');
    expect(anchors[0].getAttribute('data-emphasis')).toBe('solid');
    expect(anchors[0].getAttribute('data-size')).toBe('lg');
    expect(anchors[1].getAttribute('data-tone')).toBe('neutral');
    expect(anchors[1].getAttribute('data-emphasis')).toBe('soft');
    expect(anchors[1].getAttribute('data-size')).toBe('md');
  });

  it('keeps native ecosystem anchors visibly focusable', () => {
    const anchor = (fixture.nativeElement as HTMLElement).querySelector(
      'a.ecosystem-card'
    );

    expect(anchor?.matches(':focus-visible')).toBe(false);
    expect(anchor?.classList.contains('ecosystem-card')).toBe(true);
    expect(anchor?.getAttribute('href')).toBe(apps[0].resolvedHref);
  });
});
