import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { getContrastRatio } from '@optimistic-tanuki/theme-models';
import {
  DiscoveryCardComponent,
  DiscoveryListComponent,
  DiscoveryRegionComponent,
  LandingHeaderComponent,
  LandingHeroComponent,
  LandingStatusComponent,
  type DiscoveryCard,
  type DiscoveryNavItem,
} from './public-landing';

@Component({
  standalone: true,
  imports: [
    DiscoveryCardComponent,
    DiscoveryListComponent,
    DiscoveryRegionComponent,
    LandingHeaderComponent,
    LandingHeroComponent,
    LandingStatusComponent,
  ],
  template: `
    <otui-public-landing-header
      brandLabel="Atlas"
      [navItems]="navItems"
      (menuToggled)="lastMenuState = $event"
    >
      <span slot="brand">Custom Atlas</span>
      <span slot="actions"><a href="/sign-in">Sign in</a></span>
    </otui-public-landing-header>

    <otui-public-landing-hero
      eyebrow="A better way to explore"
      heading="Find your next place"
      description="Browse a curated collection of useful places and people."
      [primaryAction]="primaryAction"
    >
      <span slot="visual">Map preview</span>
      <div slot="body">A projected hero body stays in normal flow.</div>
      <a slot="actions" href="/learn">Learn more</a>
    </otui-public-landing-hero>

    <otui-public-discovery-region
      heading="Featured discoveries"
      description="A small selection to get you started."
    >
      <otui-public-discovery-list
        [items]="items"
        ariaLabel="Featured discoveries"
      />
    </otui-public-discovery-region>
  `,
})
class PublicLandingHostComponent {
  navItems: DiscoveryNavItem[] = [
    { label: 'Explore', href: '/explore', current: true },
    { label: 'About', href: '/about' },
  ];
  primaryAction = { label: 'Start exploring', href: '/explore' };
  items: DiscoveryCard[] = [
    {
      id: 'one',
      eyebrow: 'Guide',
      title: 'A useful guide',
      description: 'A short description for the first discovery.',
      href: '/discoveries/one',
      imageUrl: '/guide.jpg',
      imageAlt: 'A map with a marked route',
      actionLabel: 'View guide',
    },
  ];
  lastMenuState: boolean | undefined;
}

describe('public landing primitives', () => {
  let fixture: ComponentFixture<PublicLandingHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PublicLandingHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PublicLandingHostComponent);
    fixture.detectChanges();
  });

  it('renders a semantic header with native navigation links and projected slots', () => {
    const host = fixture.nativeElement as HTMLElement;
    const header = host.querySelector('header');

    expect(header).not.toBeNull();
    expect(header?.querySelector('nav')?.getAttribute('aria-label')).toBe(
      'Primary navigation'
    );
    expect(
      header?.querySelector('a[href="/explore"]')?.getAttribute('aria-current')
    ).toBe('page');
    expect(header?.textContent).toContain('Custom Atlas');
    expect(header?.querySelector('a[href="/sign-in"]')).not.toBeNull();
  });

  it('makes the mobile navigation toggle keyboard-operable and stateful', () => {
    const button = fixture.nativeElement.querySelector(
      '.public-landing-header__menu'
    ) as HTMLButtonElement;

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.componentInstance.lastMenuState).toBe(true);
  });

  it('gives repeated headers, heroes, and regions unique default ARIA IDs', () => {
    const headers = [
      TestBed.createComponent(LandingHeaderComponent),
      TestBed.createComponent(LandingHeaderComponent),
    ];
    const heroes = [
      TestBed.createComponent(LandingHeroComponent),
      TestBed.createComponent(LandingHeroComponent),
    ];
    const regions = [
      TestBed.createComponent(DiscoveryRegionComponent),
      TestBed.createComponent(DiscoveryRegionComponent),
    ];

    [...headers, ...heroes, ...regions].forEach((componentFixture) =>
      componentFixture.detectChanges()
    );

    const headerIds = headers.map((componentFixture) =>
      (componentFixture.nativeElement as HTMLElement)
        .querySelector('nav')
        ?.getAttribute('id')
    );
    const heroIds = heroes.map((componentFixture) =>
      (componentFixture.nativeElement as HTMLElement)
        .querySelector('h1')
        ?.getAttribute('id')
    );
    const regionIds = regions.map((componentFixture) =>
      (componentFixture.nativeElement as HTMLElement)
        .querySelector('h2')
        ?.getAttribute('id')
    );

    expect(new Set(headerIds).size).toBe(2);
    expect(new Set(heroIds).size).toBe(2);
    expect(new Set(regionIds).size).toBe(2);
    expect(
      headers[0].nativeElement
        .querySelector('button')
        ?.getAttribute('aria-controls')
    ).toBe(headerIds[0]);
  });

  it('closes the open mobile navigation on Escape and returns focus to its toggle', () => {
    const button = fixture.nativeElement.querySelector(
      '.public-landing-header__menu'
    ) as HTMLButtonElement;

    button.click();
    fixture.detectChanges();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
    expect(fixture.componentInstance.lastMenuState).toBe(false);
  });

  it('closes the open mobile navigation after activating a navigation link', () => {
    const button = fixture.nativeElement.querySelector(
      '.public-landing-header__menu'
    ) as HTMLButtonElement;
    const link = fixture.nativeElement.querySelector(
      '.public-landing-header__nav-link'
    ) as HTMLAnchorElement;

    button.click();
    fixture.detectChanges();
    link.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.lastMenuState).toBe(false);
  });

  it('renders navigation items that share a route without duplicate tracking warnings', () => {
    const headerFixture = TestBed.createComponent(LandingHeaderComponent);
    headerFixture.componentInstance.navItems = [
      { label: 'Explore', href: '/explore' },
      { label: 'Featured', href: '/explore' },
    ];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    headerFixture.detectChanges();

    expect(
      (headerFixture.nativeElement as HTMLElement).querySelectorAll('nav a')
    ).toHaveLength(2);
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('NG0955');
    warnSpy.mockRestore();
  });

  it('renders the hero content as one h1 with product action and visual slots', () => {
    const hero = fixture.nativeElement.querySelector(
      'otui-public-landing-hero'
    ) as HTMLElement;

    expect(hero.querySelectorAll('h1')).toHaveLength(1);
    expect(hero.querySelector('h1')?.textContent).toContain(
      'Find your next place'
    );
    expect(hero.querySelector('a[href="/explore"]')?.textContent).toContain(
      'Start exploring'
    );
    expect(hero.querySelector('[slot="visual"]')?.textContent).toContain(
      'Map preview'
    );
    expect(hero.querySelector('[slot="body"]')?.textContent).toContain(
      'A projected hero body stays in normal flow.'
    );
    expect(
      hero
        .querySelector('h1')
        ?.compareDocumentPosition(hero.querySelector('[slot="body"]') as Node)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(hero.querySelector('a[href="/learn"]')).not.toBeNull();
  });

  it('keeps long hero titles in normal flow at narrow and wide layouts', () => {
    const styles = readFileSync(
      join(__dirname, 'public-landing.component.scss'),
      'utf8'
    );

    expect(styles).toContain('  max-width: 42rem;\n  min-width: 0;');
    expect(styles).toContain(
      '.public-landing-hero__copy {\n  position: relative;\n  z-index: 1;'
    );
    expect(styles).toContain(
      '.public-landing-hero {\n  position: relative;\n  isolation: isolate;'
    );
    expect(styles).toContain(
      '.public-landing-hero__inner {\n  position: relative;\n  z-index: 1;'
    );
    expect(styles).toContain(
      '.public-landing-hero__visual {\n  position: relative;\n  isolation: isolate;'
    );
    expect(styles).toContain('[data-public-landing-background]');
    expect(styles).toContain(
      ':host(.hero-has-background) .public-landing-hero__inner'
    );
    expect(styles).toContain('display: contents;');
    expect(styles).toContain('pointer-events: none;');
    expect(styles).toContain('overflow-wrap: anywhere;');
    expect(styles).toContain('  display: grid;\n  min-width: 0;');
  });

  it('renders a discovery card with a semantic article, heading link, media alt, and action link', () => {
    const cardFixture = TestBed.createComponent(DiscoveryCardComponent);
    cardFixture.componentInstance.item = fixture.componentInstance.items[0];
    cardFixture.detectChanges();
    const card = cardFixture.nativeElement as HTMLElement;

    expect(card.querySelector('article')).not.toBeNull();
    expect(card.querySelector('h3 a[href="/discoveries/one"]')).not.toBeNull();
    expect(card.querySelector('img')?.getAttribute('alt')).toBe(
      'A map with a marked route'
    );
    expect(
      card.querySelector('.public-discovery-card__actions a')?.textContent
    ).toContain('View guide');
  });

  it('renders discovery items in a labelled list', () => {
    const list = fixture.nativeElement.querySelector(
      'otui-public-discovery-list'
    ) as HTMLElement;

    expect(list.querySelector('ul')?.getAttribute('aria-label')).toBe(
      'Featured discoveries'
    );
    expect(list.querySelectorAll('ul > li')).toHaveLength(1);
    expect(list.querySelector('h3')?.textContent).toContain('A useful guide');
  });

  it('renders multiple discovery cards when items share a title and have no IDs', () => {
    const listFixture = TestBed.createComponent(DiscoveryListComponent);
    listFixture.componentInstance.items = [
      { title: 'Repeated title', href: '/one' },
      { title: 'Repeated title', href: '/two' },
    ];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    listFixture.detectChanges();

    expect(
      (listFixture.nativeElement as HTMLElement).querySelectorAll('ul > li')
    ).toHaveLength(2);
    expect(warnSpy.mock.calls.flat().join(' ')).not.toContain('NG0955');
    warnSpy.mockRestore();
  });

  it.each([
    ['loading', 'Loading discoveries', 'status'],
    ['empty', 'Nothing to discover yet', 'status'],
    ['error', 'Discoveries are unavailable', 'alert'],
  ] as const)(
    'renders the %s list status through the shared status primitive',
    (state, headline, role) => {
      const listFixture = TestBed.createComponent(DiscoveryListComponent);
      listFixture.componentInstance.state = state;
      listFixture.detectChanges();
      const root = listFixture.nativeElement.querySelector(
        '.state-message'
      ) as HTMLElement;

      expect(root.textContent).toContain(headline);
      expect(root.getAttribute('role')).toBe(role);
    }
  );

  it('renders the discovery region with a labelled section heading', () => {
    const region = fixture.nativeElement.querySelector(
      'otui-public-discovery-region'
    ) as HTMLElement;
    const section = region.querySelector('section');

    expect(section).not.toBeNull();
    expect(section?.querySelector('h2')?.textContent).toContain(
      'Featured discoveries'
    );
    expect(section?.getAttribute('aria-labelledby')).toBe(
      section?.querySelector('h2')?.id
    );
  });
});

describe('landing status states', () => {
  it.each([
    ['loading', 'loading', 'info', 'status'],
    ['empty', 'empty', 'neutral', 'status'],
    ['error', 'error', 'danger', 'alert'],
  ] as const)(
    'maps %s to the shared state message contract',
    (state, kind, tone, role) => {
      const fixture = TestBed.createComponent(LandingStatusComponent);
      fixture.componentInstance.state = state;
      fixture.componentInstance.headline = 'Discovery state';
      fixture.detectChanges();
      const root = fixture.nativeElement.querySelector(
        '.state-message'
      ) as HTMLElement;

      expect(root.getAttribute('data-kind')).toBe(kind);
      expect(root.getAttribute('data-tone')).toBe(tone);
      expect(root.getAttribute('role')).toBe(role);
    }
  );
});

describe('public landing authored accessibility contract', () => {
  it('includes tokenized focus and responsive rules', () => {
    const styles = readFileSync(
      join(__dirname, 'public-landing.component.scss'),
      'utf8'
    );

    expect(styles).toMatch(/:focus-visible/);
    expect(styles).toMatch(/--otui-public-landing/);
    expect(styles).toMatch(/@media\s*\(min-width:\s*48rem\)/);
    expect(styles).toMatch(/@media\s*\(min-width:\s*72rem\)/);
  });

  it('pairs the public CTA background with a semantic foreground and contrast-safe root fallback', () => {
    const styles = readFileSync(
      join(__dirname, 'public-landing.component.scss'),
      'utf8'
    );

    expect(styles).toContain(
      '--otui-public-landing-cta-background: var(--primary, #0b5cad);'
    );
    expect(styles).toMatch(
      /--otui-public-landing-on-brand:\s*var\(\s*--on-primary,\s*var\(\s*--primary-foreground,\s*#ffffff\)\s*\);/
    );
    expect(styles).toContain(
      'background: var(--otui-public-landing-cta-background);'
    );
    expect(styles).toContain(
      'color: var(--otui-public-landing-on-brand) !important;'
    );
    expect(getContrastRatio('#ffffff', '#0b5cad')).toBeGreaterThanOrEqual(4.5);
  });

  it('does not use a tenant muted token for normal hero descriptions', () => {
    const styles = readFileSync(
      join(__dirname, 'public-landing.component.scss'),
      'utf8'
    );

    expect(styles).toContain(
      '--otui-public-landing-muted: var(--foreground, #435066);'
    );
    expect(styles).not.toContain('var(--muted-foreground, #435066)');
  });
});
