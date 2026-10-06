import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { LandingComponent } from './landing.component';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import { OFFERINGS } from '../../content/site-content';

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
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: HaiAppDirectoryService, useValue: directoryServiceStub },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('leads with the company-level ownership positioning', () => {
    const element = fixture.nativeElement as HTMLElement;
    const lede = element.querySelector('.hero-copy .lede')?.textContent ?? '';

    expect(element.querySelector('h1')?.textContent?.trim()).toBe(
      'Technology you own.'
    );
    for (const offering of [
      'Private cloud',
      'turn-key server appliances',
      'open-source software',
      'custom tools',
    ]) {
      expect(lede).toContain(offering);
    }
    expect(element.textContent).toContain(
      'You should be able to leave any vendor, including us, with your data intact.'
    );
  });

  it('names homes and organizations, using Faith groups terminology', () => {
    const audiences = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.hero-signal li')
    ).map((item) => item.textContent?.trim());

    expect(audiences).toEqual([
      'Families keeping photos, files, and media',
      'Faith groups, nonprofits, and community groups',
      'Small businesses and professional offices',
      'Local technology partners needing delivery capacity',
    ]);
    expect(fixture.nativeElement.textContent).not.toMatch(/church/i);
  });

  it('renders the operational guarantee banner', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain(
      '48-Hour Rapid Onboarding. Local On-Site Support in Savannah and South Georgia.'
    );
  });

  it('sends the hero actions to the audit and the offerings overview', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;
    const buttons = nativeElement.querySelectorAll(
      '.hero-panel .hero-actions a'
    );

    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent?.trim()).toBe('Schedule Free Audit');
    expect(buttons[0].getAttribute('href')).toBe('/contact');
    expect(buttons[0].classList).toContain('primary');
    expect(buttons[1].textContent?.trim()).toBe('See What We Offer');
    expect(buttons[1].getAttribute('href')).toBe('/#offerings');
    expect(buttons[1].classList).toContain('secondary');
  });

  it('gives every offering a headline, one sentence, and a link to its page', () => {
    const cards = Array.from(
      (
        fixture.nativeElement as HTMLElement
      ).querySelectorAll<HTMLAnchorElement>('#offerings a.offering-card')
    );

    expect(cards.map((card) => card.getAttribute('href'))).toEqual(
      OFFERINGS.map((offering) => offering.route)
    );
    for (const [index, card] of cards.entries()) {
      expect(card.querySelector('.offering-headline')?.textContent).toBe(
        OFFERINGS[index].headline
      );
      expect(card.querySelector('.offering-summary')?.textContent).toBe(
        OFFERINGS[index].summary
      );
    }
  });

  it('still represents appliances, stacks, and custom software', () => {
    const routes = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '#offerings a.offering-card'
      )
    ).map((card) => card.getAttribute('href'));

    expect(routes).toEqual(
      expect.arrayContaining([
        '/private-cloud',
        '/turn-key-appliances',
        '/software-stacks',
        '/custom-software',
      ])
    );
  });

  it('links to the cost comparison without claiming savings', () => {
    const note = (fixture.nativeElement as HTMLElement).querySelector(
      '.comparison-note'
    );

    expect(note?.querySelector('a')?.getAttribute('href')).toBe(
      '/cost-comparison'
    );
    expect(note?.textContent).not.toMatch(/save|cheaper|guarantee/i);
  });

  it('keeps detail sections off the homepage', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;

    for (const selector of [
      'hai-hardware-catalog',
      'hai-roi-calculator',
      'hai-solutions-matrix',
      'hai-services-section',
      'hai-manifesto-section',
      'hai-personal-cloud-section',
      'hai-engagement-section',
      'hai-partner-section',
      'hai-contact-section',
    ]) {
      expect(nativeElement.querySelector(selector)).toBeNull();
    }
  });

  it('closes with a single audit action', () => {
    const closing = (fixture.nativeElement as HTMLElement).querySelector(
      '.closing-panel'
    );
    const links = closing?.querySelectorAll('a') ?? [];

    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/contact');
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
  });

  it('introduces private cloud right after the offerings overview', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;
    const order = Array.from(nativeElement.querySelectorAll('section[id]')).map(
      (section) => section.id
    );

    expect(order.indexOf('private-cloud')).toBe(order.indexOf('offerings') + 1);
    expect(
      nativeElement.querySelector('#private-cloud h2')?.textContent?.trim()
    ).toBe('A cloud you control.');
    expect(
      nativeElement.querySelectorAll('#private-cloud otui-card h3')
    ).toHaveLength(3);
  });

  it('routes private-cloud visitors to home, organizations, and the overview', () => {
    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll(
        '#private-cloud a'
      )
    ).map((link) => [
      link.querySelector('.path-label')?.textContent?.trim() ??
        link.textContent?.trim(),
      link.getAttribute('href'),
    ]);

    expect(links).toEqual([
      ['For your home', '/private-cloud/home'],
      ['For organizations', '/private-cloud/organizations'],
      ['Explore private cloud', '/private-cloud'],
    ]);
  });

  it('uses the private-cloud headline once on the page', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text.split('A cloud you control.')).toHaveLength(2);
  });
});
