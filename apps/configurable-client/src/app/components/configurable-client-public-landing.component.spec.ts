import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigurableClientPublicLandingComponent } from './configurable-client-public-landing.component';
import { AppDiscoveryStore } from '@optimistic-tanuki/app-config-data-access';

function mixRgb(first: string, second: string, firstWeight: number): string {
  const firstRgb = first
    .match(/[0-9a-f]{2}/gi)
    ?.map((value) => parseInt(value, 16));
  const secondRgb = second
    .match(/[0-9a-f]{2}/gi)
    ?.map((value) => parseInt(value, 16));

  if (
    !firstRgb ||
    !secondRgb ||
    firstRgb.length !== 3 ||
    secondRgb.length !== 3
  ) {
    throw new Error('Expected full hex colors in the style contract test.');
  }

  return `#${firstRgb
    .map((value, index) =>
      Math.round(value * firstWeight + secondRgb[index] * (1 - firstWeight))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

function relativeLuminance(hex: string): number {
  const channels = hex
    .match(/[0-9a-f]{2}/gi)
    ?.map((value) => parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) {
    throw new Error('Expected a full hex color in the style contract test.');
  }

  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(first: string, second: string): number {
  const luminances = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a
  );
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

describe('ConfigurableClientPublicLandingComponent', () => {
  let fixture: ComponentFixture<ConfigurableClientPublicLandingComponent>;
  let discovery: {
    apps: ReturnType<typeof signal<any[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    load: jest.Mock;
    join: jest.Mock;
    request: jest.Mock;
    actionError: jest.Mock;
    actionInFlight: jest.Mock;
  };

  beforeEach(async () => {
    discovery = {
      apps: signal([]),
      loading: signal(false),
      error: signal(null),
      load: jest.fn(),
      join: jest.fn(),
      request: jest.fn(),
      actionError: jest.fn().mockReturnValue(null),
      actionInFlight: jest.fn().mockReturnValue(false),
    };
    await TestBed.configureTestingModule({
      imports: [ConfigurableClientPublicLandingComponent],
      providers: [{ provide: AppDiscoveryStore, useValue: discovery }],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigurableClientPublicLandingComponent);
    fixture.detectChanges();
  });

  it('renders a product-specific discovery shell with owner and client actions', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('otui-public-landing-header')).not.toBeNull();
    expect(host.querySelector('otui-public-landing-hero')).not.toBeNull();
    expect(host.querySelector('h1')?.textContent).toContain(
      'Build a client experience people can find'
    );
    expect(host.textContent).toContain('Configurable Client');
    expect(host.textContent).toContain('For owners');
    expect(host.textContent).toContain('For clients');
    expect(
      Array.from(host.querySelectorAll('a')).find(
        (link) => link.getAttribute('href') === '/login?returnTo=%2Fowner'
      )?.textContent
    ).toContain('Owner sign in');
    expect(
      host.querySelector(
        '.public-landing-action--secondary[href="#discoveries"]'
      )?.textContent
    ).toContain('Find a published app');
  });

  it('makes the owner and client value proposition an explicit authentication choice', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('.value-proposition')?.textContent).toContain(
      'Owners publish.'
    );
    expect(host.querySelector('.value-proposition')?.textContent).toContain(
      'Clients arrive.'
    );
    expect(host.querySelector('#owners')?.textContent).toContain(
      'Sign in as an owner'
    );
    expect(host.querySelector('#clients')?.textContent).toContain(
      'Use a shared link'
    );
    expect(
      host.querySelector('#clients a[href="#published-apps"]')
    ).not.toBeNull();
  });

  it('explains client discovery with an empty published-apps status', () => {
    const host = fixture.nativeElement as HTMLElement;
    const discoveryRegion = host.querySelector('#published-apps');

    expect(discoveryRegion).not.toBeNull();
    expect(discoveryRegion?.textContent).toContain('Published experiences');
    expect(discoveryRegion?.querySelector('.state-message')).not.toBeNull();
    expect(
      discoveryRegion?.querySelector('.state-message')?.textContent
    ).toContain('No published apps yet');
    expect(
      discoveryRegion?.querySelector('a[href="#how-it-works"]')
    ).not.toBeNull();
  });

  it('loads and filters published apps from the discovery store', () => {
    const host = fixture.nativeElement as HTMLElement;
    const search = host.querySelector<HTMLInputElement>(
      '#published-app-search'
    );
    const policy = host.querySelector<HTMLSelectElement>(
      '#published-app-policy'
    );
    const form = host.querySelector<HTMLFormElement>('.published-app-search');

    expect(discovery.load).toHaveBeenCalledWith(undefined, undefined);
    expect(search).not.toBeNull();
    expect(policy).not.toBeNull();
    search!.value = 'north star';
    search!.dispatchEvent(new Event('input'));
    policy!.value = 'joinable';
    policy!.dispatchEvent(new Event('change'));
    form!.dispatchEvent(new Event('submit'));

    expect(discovery.load).toHaveBeenLastCalledWith('north star', 'joinable');
  });

  it('renders policy-specific cards and sends join/request actions to the store', () => {
    fixture.componentRef.setInput('signedIn', true);
    discovery.apps.set([
      {
        appId: 'north-star',
        name: 'North Star',
        description: 'Coaching',
        accessPolicy: 'joinable',
        membershipStatus: null,
        canOpen: false,
        canJoin: true,
        canRequest: false,
      },
      {
        appId: 'studio',
        name: 'Studio',
        description: 'Private studio',
        accessPolicy: 'request-only',
        membershipStatus: null,
        canOpen: false,
        canJoin: false,
        canRequest: true,
      },
    ]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('#published-apps')?.textContent).toContain(
      'North Star'
    );
    expect(host.querySelector('#published-apps')?.textContent).toContain(
      'Joinable'
    );
    expect(host.querySelector('#published-apps')?.textContent).toContain(
      'Request-only'
    );
    (
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Join'
      ) as HTMLButtonElement
    ).click();
    (
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Request access'
      ) as HTMLButtonElement
    ).click();

    expect(discovery.join).toHaveBeenCalledWith('north-star');
    expect(discovery.request).toHaveBeenCalledWith('studio');
  });

  it('explains denied, suspended, revoked, and private access without exposing an action', () => {
    fixture.componentRef.setInput('signedIn', true);
    discovery.apps.set([
      {
        appId: 'denied',
        name: 'Denied',
        accessPolicy: 'request-only',
        membershipStatus: 'denied',
        canOpen: false,
        canJoin: false,
        canRequest: false,
      },
      {
        appId: 'suspended',
        name: 'Suspended',
        accessPolicy: 'joinable',
        membershipStatus: 'suspended',
        canOpen: false,
        canJoin: false,
        canRequest: false,
      },
      {
        appId: 'revoked',
        name: 'Revoked',
        accessPolicy: 'joinable',
        membershipStatus: 'revoked',
        canOpen: false,
        canJoin: false,
        canRequest: false,
      },
      {
        appId: 'private',
        name: 'Private',
        accessPolicy: 'private',
        membershipStatus: null,
        canOpen: false,
        canJoin: false,
        canRequest: false,
      },
    ]);
    fixture.detectChanges();

    const region = (fixture.nativeElement as HTMLElement).querySelector(
      '#published-apps'
    );
    expect(region?.textContent).toContain('Access request denied');
    expect(region?.textContent).toContain('Access suspended');
    expect(region?.textContent).toContain('Access revoked');
    expect(region?.textContent).toContain('Private · membership required');
    expect(region?.querySelectorAll('.published-app-list button')).toHaveLength(
      0
    );
  });

  it('keeps the directory visible and announces a card-level action failure', () => {
    discovery.apps.set([
      {
        appId: 'north-star',
        name: 'North Star',
        accessPolicy: 'joinable',
        membershipStatus: null,
        canOpen: false,
        canJoin: true,
        canRequest: false,
      },
    ]);
    discovery.actionError.mockImplementation((appId: string) =>
      appId === 'north-star' ? 'This app is temporarily unavailable.' : null
    );
    fixture.componentRef.setInput('signedIn', true);
    fixture.detectChanges();

    const region = (fixture.nativeElement as HTMLElement).querySelector(
      '#published-apps'
    );
    expect(region?.textContent).toContain('North Star');
    expect(region?.querySelector('[role="alert"]')?.textContent).toContain(
      'This app is temporarily unavailable.'
    );
    expect(region?.querySelector('.state-message')).toBeNull();
  });

  it('sends anonymous clients to sign in before join or request actions', () => {
    discovery.apps.set([
      {
        appId: 'north-star',
        name: 'North Star',
        accessPolicy: 'joinable',
        membershipStatus: null,
        canOpen: false,
        canJoin: true,
        canRequest: false,
      },
    ]);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const signIn = Array.from(host.querySelectorAll('a')).find(
      (link) => link.textContent?.trim() === 'Sign in to join'
    );

    expect(signIn?.getAttribute('href')).toBe(
      '/login?returnTo=%2F%23published-apps'
    );
    expect(discovery.join).not.toHaveBeenCalled();
  });

  it('provides accessible loading and retryable error states for discovery', () => {
    discovery.loading.set(true);
    fixture.detectChanges();
    let host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('#published-apps [aria-busy="true"]')
    ).not.toBeNull();
    expect(host.querySelector('#published-apps')?.textContent).toContain(
      'Loading published apps'
    );

    discovery.loading.set(false);
    discovery.error.set('Directory is unavailable');
    fixture.detectChanges();
    host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('#published-apps')?.textContent).toContain(
      'Directory is unavailable'
    );
    (
      Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Try again'
      ) as HTMLButtonElement
    ).click();

    expect(discovery.load).toHaveBeenLastCalledWith(undefined, undefined);
  });

  it('does not advertise an unscoped demo doorway in the anonymous discovery context', () => {
    const host = fixture.nativeElement as HTMLElement;
    const demoLink = host.querySelector('a[href="/app/demo-app"]');

    expect(demoLink).toBeNull();
    expect(host.textContent).toContain(
      'Preview unavailable until a workspace is selected'
    );
    expect(host.querySelector('#published-apps')?.textContent).toContain(
      'Published links are for clients'
    );
  });

  it('scopes the demo preview to the current workspace', () => {
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.detectChanges();

    const demoLink = (fixture.nativeElement as HTMLElement).querySelector(
      '#published-apps a[href="/app/demo-app?workspaceSlug=north-star"]'
    );

    expect(demoLink?.textContent).toContain('Preview the demo');
  });

  it('routes signed-in owners to the scoped owner discovery entry point', () => {
    fixture.componentRef.setInput('signedIn', true);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('a[href="/owner"]')?.textContent).toContain(
      'Open owner workspace'
    );
    expect(host.querySelector('a[href="/dashboard/app-config"]')).toBeNull();
  });

  it('routes anonymous owners to login with a safe owner return target', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(
      Array.from(host.querySelectorAll('a')).find(
        (link) => link.getAttribute('href') === '/login?returnTo=%2Fowner'
      )?.textContent
    ).toContain('Owner sign in');
  });

  it('does not render an unscoped protected demo link without workspace context', () => {
    const host = fixture.nativeElement as HTMLElement;

    expect(
      host.querySelector('#published-apps a[href="/app/demo-app"]')
    ).toBeNull();
    expect(host.querySelector('#published-apps')?.textContent).toContain(
      'Preview unavailable until a workspace is selected'
    );
  });

  it('keeps the public shell navigable on narrow screens', () => {
    const host = fixture.nativeElement as HTMLElement;
    const menu = host.querySelector(
      '.public-landing-header__menu'
    ) as HTMLButtonElement;

    expect(menu).not.toBeNull();
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    menu.click();
    fixture.detectChanges();

    expect(menu.getAttribute('aria-expanded')).toBe('true');
    expect(
      host.querySelector('nav[aria-label="Primary navigation"]')
    ).not.toBeNull();
  });

  it('uses an inherited darker accent token for blue landing eyebrows', () => {
    const styles = readFileSync(
      join(__dirname, 'configurable-client-public-landing.component.scss'),
      'utf8'
    );

    expect(styles).toMatch(
      /--public-discovery-accessible-accent:\s*color-mix\(\s*in srgb,\s*var\(--primary,[\s\S]*?30%,\s*var\(--foreground,[\s\S]*?70%/
    );
    expect(styles).toMatch(
      /otui-public-landing-header[\s\S]*?--otui-public-landing-brand:\s*var\(--public-discovery-accessible-accent\)/
    );
    expect(
      contrastRatio(mixRgb('#356c91', '#1f2937', 0.3), '#f5f7fb')
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the dark handoff section text and actions on AA-safe opaque tokens', () => {
    const styles = readFileSync(
      join(__dirname, 'configurable-client-public-landing.component.scss'),
      'utf8'
    );
    const darkBackground = mixRgb('#172033', '#f8fafc', 0.92);

    expect(styles).toMatch(
      /--how-it-works-foreground:\s*var\(--ot-client-white\);/
    );
    expect(styles).toMatch(
      /--how-it-works-muted:\s*color-mix\(\s*in srgb,\s*var\(--ot-client-white\)\s+78%,\s*var\(--how-it-works-background\)\s*\)/
    );
    expect(styles).toMatch(
      /\.how-it-works\s+:is\(a,\s*button\)[\s\S]*?color:\s*var\(--how-it-works-foreground\)/
    );

    expect(contrastRatio('#ffffff', darkBackground)).toBeGreaterThanOrEqual(
      4.5
    );
    expect(
      contrastRatio(mixRgb('#0b5cad', '#ffffff', 0.35), darkBackground)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(mixRgb('#ffffff', darkBackground, 0.78), darkBackground)
    ).toBeGreaterThanOrEqual(4.5);
  });
});
