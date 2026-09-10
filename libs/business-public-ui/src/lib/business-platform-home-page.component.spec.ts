import { effect, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { By } from '@angular/platform-browser';
import { RouterLink, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import {
  getContrastRatio,
  getSuggestedTextColor,
} from '@optimistic-tanuki/theme-models';

import {
  BusinessApiService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';

import {
  businessPlatformHomePageStyles,
  BusinessPlatformHomePageComponent,
} from './business-platform-home-page.component';
import { BUSINESS_PUBLIC_LIGHT_ACCENT_TEXT } from './public-contrast.tokens';

describe('BusinessPlatformHomePageComponent', () => {
  async function render(
    publishedSites: unknown[] = [],
    titleService = { setTitle: jest.fn() }
  ) {
    await TestBed.configureTestingModule({
      imports: [BusinessPlatformHomePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessApiService,
          useValue: {
            listPublishedSites: jest.fn().mockReturnValue(of(publishedSites)),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: signal(DEFAULT_BUSINESS_SITE_CONFIG).asReadonly(),
          },
        },
        { provide: Title, useValue: titleService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessPlatformHomePageComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('restores the Business Site platform title after tenant history', async () => {
    const titleService = { setTitle: jest.fn() };
    titleService.setTitle(
      'North Star Advisory | Operational guidance for growing service businesses.'
    );

    await render([], titleService);

    expect(titleService.setTitle).toHaveBeenLastCalledWith(
      'Business Site Platform'
    );
  });

  it('keeps the platform title authoritative after root navigation receives stale tenant config', async () => {
    const titleService = { setTitle: jest.fn() };
    const tenantConfig = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      brand: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.brand,
        businessName: 'North Star Advisory',
        tagline: 'Operational guidance for growing service businesses.',
      },
    };
    const currentUrl = signal('/sites/north-star-advisory');
    const site = signal(tenantConfig);

    await TestBed.configureTestingModule({
      imports: [BusinessPlatformHomePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessApiService,
          useValue: { listPublishedSites: jest.fn().mockReturnValue(of([])) },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: { site: site.asReadonly() },
        },
        { provide: Title, useValue: titleService },
      ],
    }).compileComponents();

    const appTitleEffect = TestBed.runInInjectionContext(() =>
      effect(() => {
        currentUrl();
        const loadedSite = site();
        const businessName = loadedSite.brand.businessName.trim();
        const tagline = loadedSite.brand.tagline.trim();
        titleService.setTitle(`${businessName} | ${tagline}`);
      })
    );

    currentUrl.set('/');
    const fixture = TestBed.createComponent(BusinessPlatformHomePageComponent);
    fixture.detectChanges();

    site.set({
      ...tenantConfig,
      brand: { ...tenantConfig.brand },
    });
    fixture.detectChanges();

    expect(titleService.setTitle).toHaveBeenLastCalledWith(
      'Business Site Platform'
    );

    appTitleEffect.destroy();
  });

  it('composes the platform landing through shared header and hero primitives', async () => {
    const fixture = await render();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('otui-public-landing-header')).not.toBeNull();
    expect(host.querySelector('otui-public-landing-hero')).not.toBeNull();
    expect(
      host.querySelector('otui-public-landing-hero h1')?.textContent
    ).toContain('Launch a client-ready business site');
  });

  it('renders published businesses through the shared discovery region and list', async () => {
    const fixture = await render([
      {
        slug: 'north-star-advisory',
        businessName: 'North Star Advisory',
        tagline: 'Operational guidance for growing service businesses.',
        location: 'Remote',
        businessType: 'Consulting',
      },
    ]);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('otui-public-discovery-region')).not.toBeNull();
    expect(host.querySelector('otui-public-discovery-list')).not.toBeNull();
    expect(
      host.querySelector(
        'otui-public-discovery-card a[href="/sites/north-star-advisory"]'
      )
    ).not.toBeNull();
  });

  it('uses the shared discovery status for an empty published directory', async () => {
    const fixture = await render();

    expect(
      fixture.nativeElement.querySelector(
        'otui-discovery-status, .state-message'
      )
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'No published businesses are available yet.'
    );
  });

  it('does not announce platform fragment links as the current page', async () => {
    const fixture = await render();
    const links = fixture.nativeElement.querySelectorAll(
      'otui-public-landing-header a[href="#capabilities"], otui-public-landing-header a[href="#directory"]'
    ) as NodeListOf<HTMLAnchorElement>;

    expect(links).toHaveLength(2);
    expect(
      Array.from(links).every(
        (link) => link.getAttribute('aria-current') === null
      )
    ).toBe(true);
  });

  it('renders platform messaging for owners and clients', async () => {
    const fixture = await render();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Hosted business connection services');
    expect(text).toContain('Start as an owner');
    expect(text).toContain('Client account');
    expect(text).toContain('Profile-to-site onboarding');
    expect(text).toContain('Live WYSIWYG composition');
    expect(text).toContain('Tenant-scoped public experiences');
  });

  it('uses semantic flex groups to separate projected header and hero actions', async () => {
    const fixture = await render();
    const actionGroups = fixture.nativeElement.querySelectorAll(
      'otui-public-landing-header [slot="actions"], otui-public-landing-hero [slot="actions"]'
    ) as NodeListOf<HTMLElement>;

    expect(actionGroups).toHaveLength(2);
    expect(
      Array.from(actionGroups).every((group) =>
        group.classList.contains('platform-actions')
      )
    ).toBe(true);
    expect(businessPlatformHomePageStyles).toContain(
      '.platform-actions {\n        display: flex;'
    );
    expect(businessPlatformHomePageStyles).toContain('gap: 0.85rem;');
  });

  it('links the primary platform actions to auth and client registration', async () => {
    const fixture = await render();

    const links = fixture.debugElement
      .queryAll(By.directive(RouterLink))
      .map((element) => element.injector.get(RouterLink));

    expect(links.map((link) => link.href)).toEqual(
      expect.arrayContaining(['/auth', '/client/register'])
    );
  });

  it('defines explicit light-mode contrast overrides for landing-page legibility', async () => {
    expect(businessPlatformHomePageStyles).toContain(
      ":host-context([data-mode='light'])"
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-muted: #425466'
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-card: #ffffff'
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-accent-text: var(--primary-2, #0f5f4b)'
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-accent-text: var(--primary-8, #9fe0ca)'
    );
  });

  it('projects the semantic on-brand foreground to shared root CTAs', () => {
    expect(businessPlatformHomePageStyles).toContain(
      '--platform-panel-ink: var(--on-primary, var(--primary-foreground, #ffffff))'
    );
    expect(businessPlatformHomePageStyles).toContain(
      '--on-primary: var(--platform-panel-ink);'
    );
    expect(getContrastRatio('#ffffff', '#b85c38')).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['light tenant', '#1f5f8b'],
    ['dark tenant', '#c46a52'],
  ])(
    'uses the generated semantic CTA foreground for a %s primary',
    (_context, primary) => {
      expect(businessPlatformHomePageStyles).toContain(
        '--platform-accent: var(--primary, #b85c38);'
      );
      expect(businessPlatformHomePageStyles).toContain(
        '--platform-panel-ink: var(--on-primary, var(--primary-foreground, #ffffff))'
      );
      expect(
        getContrastRatio(getSuggestedTextColor(primary).color, primary)
      ).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('uses a contrast-safe accent for directory category eyebrows', () => {
    const directoryCategoryRuleStart = businessPlatformHomePageStyles.indexOf(
      '.directory-card p {'
    );
    expect(directoryCategoryRuleStart).toBeGreaterThanOrEqual(0);
    const directoryCategoryRule = businessPlatformHomePageStyles.slice(
      directoryCategoryRuleStart
    );
    expect(directoryCategoryRule).toContain(
      'color: var(--platform-accent-text);'
    );
    expect(
      getContrastRatio(BUSINESS_PUBLIC_LIGHT_ACCENT_TEXT, '#fff8ee')
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps platform layout shells within the host width', () => {
    expect(businessPlatformHomePageStyles).toContain('box-sizing: border-box;');
    expect(businessPlatformHomePageStyles).toContain('min-width: 0;');
    expect(businessPlatformHomePageStyles).toContain('max-width: 100%;');
    expect(businessPlatformHomePageStyles).toContain(
      'otui-public-landing-header,\n      otui-public-landing-hero,\n      otui-public-discovery-region'
    );
  });

  it('keeps platform actions visibly focusable and honors reduced motion', () => {
    expect(businessPlatformHomePageStyles).toContain(':focus-visible');
    expect(businessPlatformHomePageStyles).toContain(
      '@media (prefers-reduced-motion: reduce)'
    );
  });
});
