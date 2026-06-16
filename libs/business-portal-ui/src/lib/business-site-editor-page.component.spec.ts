import { signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

import { BusinessSiteEditorPageComponent } from './business-site-editor-page.component';

describe('BusinessSiteEditorPageComponent', () => {
  const getSiteConfig = jest.fn();
  const updateSiteConfig = jest.fn();
  const listAssets = jest.fn();
  const getStoreProducts = jest.fn();
  const getOffers = jest.fn();
  const httpPost = jest.fn();
  const setTheme = jest.fn();
  const setPrimaryColor = jest.fn();
  const setPersonality = jest.fn().mockResolvedValue(undefined);
  const getTheme = jest.fn(() => 'light');
  const getAnimationSettings = jest.fn(() => ({
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
    duration: '300ms',
  }));
  const getButtonGradient = jest.fn(
    () => 'linear-gradient(135deg, #1f7a63, #0f172a)'
  );
  const pair = (base: string): [string, string][] => [
    ['0', base],
    ['1', base],
    ['2', base],
    ['3', base],
    ['4', base],
    ['5', base],
    ['6', base],
  ];
  const themeColors$ = of({
    background: '#ffffff',
    foreground: '#0f172a',
    accent: '#1f7a63',
    accentShades: pair('#1f7a63'),
    accentGradients: {
      light: 'linear-gradient(135deg, #34d399, #1f7a63)',
      dark: 'linear-gradient(135deg, #1f7a63, #0f172a)',
    },
    complementary: '#d97706',
    complementaryShades: pair('#d97706'),
    tertiary: '#7c3aed',
    tertiaryShades: pair('#7c3aed'),
    success: '#15803d',
    successShades: pair('#15803d'),
    danger: '#dc2626',
    dangerShades: pair('#dc2626'),
    warning: '#f59e0b',
    warningShades: pair('#f59e0b'),
    complementaryGradients: {
      light: 'linear-gradient(135deg, #d97706, #1f7a63)',
      dark: 'linear-gradient(135deg, #f59e0b, #0f172a)',
    },
    tertiaryGradients: {
      light: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
      dark: 'linear-gradient(135deg, #7c3aed, #0f172a)',
    },
    successGradients: {
      light: 'linear-gradient(135deg, #4ade80, #15803d)',
      dark: 'linear-gradient(135deg, #15803d, #0f172a)',
    },
    dangerGradients: {
      light: 'linear-gradient(135deg, #f87171, #dc2626)',
      dark: 'linear-gradient(135deg, #dc2626, #0f172a)',
    },
    warningGradients: {
      light: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
      dark: 'linear-gradient(135deg, #f59e0b, #0f172a)',
    },
  });

  function mockMobileViewport(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches,
        media: '(max-width: 768px)',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }

  function createComponent() {
    getSiteConfig.mockReturnValue(
      of({
        configId: 'config-1',
        config: JSON.parse(JSON.stringify(DEFAULT_BUSINESS_SITE_CONFIG)),
      })
    );
    updateSiteConfig.mockReturnValue(of({ id: 'config-1' }));
    getStoreProducts.mockReturnValue(
      of([
        {
          id: 'product-1',
          name: 'Store Advisory Sprint',
          description: 'Store-backed service offer.',
          price: 225,
          type: 'service',
          active: true,
          stock: 0,
        },
      ])
    );
    getOffers.mockReturnValue(of([]));
    listAssets.mockReturnValue(
      of([
        {
          id: 'asset-1',
          name: 'Studio',
          type: 'image',
          profileId: 'profile-1',
          url: '/api/asset/asset-1',
        },
      ])
    );
    httpPost.mockReturnValue(of({ id: 'uploaded-1' }));

    TestBed.configureTestingModule({
      imports: [BusinessSiteEditorPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfig,
            updateSiteConfig,
            getStoreProducts,
            getOffers,
            listAssets,
          },
        },
        {
          provide: HttpClient,
          useValue: {
            post: httpPost,
          },
        },
        {
          provide: BusinessAuthService,
          useValue: {
            user: signal({ profileId: 'profile-1' }),
            getAuthHeaders: () => ({ Authorization: 'Bearer owner-token' }),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            getTheme,
            setTheme,
            setPrimaryColor,
            setPersonality,
            getAnimationSettings,
            getButtonGradient,
            themeColors$,
          },
        },
        {
          provide: API_BASE_URL,
          useValue: 'http://localhost:3000',
        },
      ],
    });

    const fixture = TestBed.createComponent(BusinessSiteEditorPageComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getTheme.mockReturnValue('light');
    mockMobileViewport(false);
  });

  it('saves store-backed service catalog mode without persisting manual offers', () => {
    const { component } = createComponent();

    component.draft.update((draft) => {
      draft.serviceCatalog.source = 'store';
      draft.services = [
        {
          id: 'service-1',
          name: 'Legacy Manual Offer',
          description: 'Should not persist in store mode.',
          duration: 60,
          price: 90,
          allowOnlineBooking: true,
        },
      ];
      return draft;
    });

    component.save();

    expect(updateSiteConfig).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({
        serviceCatalog: { source: 'store' },
        services: [],
      }),
      null
    );
  });

  it('reorders landing sections with stable sequential order values', () => {
    const { component } = createComponent();

    component.moveSectionDown(0);
    component.moveSectionUp(2);

    expect(
      component.draft().landingPage.sections.map((section) => section.id)
    ).toEqual([
      'about',
      'services',
      'hero',
      'testimonials',
      'contact',
      'booking',
    ]);
    expect(
      component.draft().landingPage.sections.map((section) => section.order)
    ).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('syncs section motion edits into the live preview store', async () => {
    const { fixture, component } = createComponent();
    const store = TestBed.inject(BusinessSiteConfigStore);

    component.selectSection('about');
    component.updateSectionMotion('aurora-ribbon');
    component.updateSectionMotionParameter('intensity', '0.45');
    await Promise.resolve();
    fixture.detectChanges();

    const previewSection = store
      .site()
      .landingPage.sections.find((section) => section.id === 'about');

    expect(previewSection?.motion).toEqual(
      expect.objectContaining({
        kind: 'aurora-ribbon',
        intensity: 0.45,
      })
    );
  });

  it('exposes hero copy through the compose editor and writes changes back into rich content', () => {
    const { component } = createComponent();

    component.selectSection('hero');

    expect(component.selectedSectionComposeValue().title).toBe('Welcome');

    component.updateSelectedSectionRichContent({
      title: 'Hero',
      content: '<p>Owner-authored hero copy.</p>',
      links: [],
      attachments: [],
      injectedComponentsNew: [],
      themeConfig: {
        theme: 'light',
        accentColor: '#1f7a63',
      },
    });

    expect(component.selectedSection()?.richContent).toEqual(
      expect.objectContaining({
        title: 'Hero',
        content: '<p>Owner-authored hero copy.</p>',
      })
    );
  });

  it('starts the content editor with the existing body content from the selected section', async () => {
    const { fixture, component } = createComponent();

    component.draft.update((draft) => {
      const about = draft.landingPage.sections.find(
        (section) => section.id === 'about'
      );
      if (about) {
        about.body = 'First line\n\nSecond line';
      }
      return draft;
    });

    component.selectSection('about');
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.selectedSectionComposeValue().content).toBe(
      '<p>First line</p><p>Second line</p>'
    );
  });

  it('loads existing richContent into the compose editor when the section is selected', async () => {
    const { fixture, component } = createComponent();

    component.draft.update((draft) => {
      const about = draft.landingPage.sections.find(
        (section) => section.id === 'about'
      );
      if (about) {
        about.richContent = {
          title: 'Custom About Title',
          content: '<p>Custom overridden content here.</p>',
          injectedComponents: [],
          themeConfig: { theme: 'light', accentColor: '#ff0000' },
        };
      }
      return draft;
    });

    component.selectSection('about');
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.selectedSectionComposeValue().title).toBe(
      'Custom About Title'
    );
    expect(component.selectedSectionComposeValue().content).toBe(
      '<p>Custom overridden content here.</p>'
    );
  });

  it('recomputes the compose content key when switching between sections', () => {
    const { component } = createComponent();
    const readSectionContentKey = (
      component as unknown as { sectionContentKey: () => string }
    ).sectionContentKey;

    const heroKey = readSectionContentKey();

    component.selectSection('about');

    expect(readSectionContentKey()).not.toBe(heroKey);
  });

  it('resets custom rich content back to fallback body content', () => {
    const { component } = createComponent();

    component.addCustomSection();
    const customId = component
      .draft()
      .landingPage.sections.find((section) => section.type === 'custom')!.id;
    component.draft.update((draft) => {
      const section = draft.landingPage.sections.find(
        (candidate) => candidate.id === customId
      );
      if (section) {
        section.body = 'Fallback custom copy.';
      }
      return draft;
    });
    component.selectSection(customId);
    component.updateSelectedSectionRichContent({
      title: 'Custom section',
      content: '<p>Custom rich content.</p>',
      links: [],
      attachments: [],
      injectedComponentsNew: [],
      themeConfig: {
        theme: 'light',
        accentColor: '#1f7a63',
      },
    });

    component.resetSelectedSectionRichContent();

    const section = component
      .draft()
      .landingPage.sections.find((candidate) => candidate.id === customId);
    expect(section?.richContent).toBeUndefined();
    expect(section?.body).toBe('Fallback custom copy.');
    expect(component.selectedSectionComposeValue().content).toBe(
      '<p>Fallback custom copy.</p>'
    );
  });

  it('preserves paragraph breaks when rich text content is written back into the section body', () => {
    const { component } = createComponent();

    component.selectSection('about');
    component.updateSelectedSectionRichContent({
      title: 'About',
      content: '<p>First line</p><p>Second line</p>',
      links: [],
      attachments: [],
      injectedComponentsNew: [],
      themeConfig: {
        theme: 'light',
        accentColor: '#1f7a63',
      },
    });

    expect(component.selectedSection()?.body).toBe('First line\nSecond line');
  });

  it('keeps the selected custom section compose model stable across repeated renders', () => {
    const { fixture, component } = createComponent();

    component.addCustomSection();
    const customSection = component
      .draft()
      .landingPage.sections.find((section) => section.type === 'custom');
    expect(customSection).toBeTruthy();

    component.selectSection(customSection!.id);
    fixture.detectChanges();

    const firstValue = component.selectedSectionComposeValue();

    fixture.detectChanges();

    expect(component.selectedSectionComposeValue()).toBe(firstValue);

    component.updateSelectedSectionRichContent({
      title: 'Custom section',
      content: '<p>Updated once.</p>',
      links: [],
      attachments: [],
      injectedComponentsNew: [],
      themeConfig: {
        theme: 'light',
        accentColor: '#1f7a63',
      },
    });
    fixture.detectChanges();

    const updatedValue = component.selectedSectionComposeValue();
    expect(updatedValue).not.toBe(firstValue);
    expect(updatedValue.content).toBe('<p>Updated once.</p>');
  });

  it('saves edited feature flags with normalized landing section order', () => {
    const { component } = createComponent();

    component.draft.update((draft) => {
      draft.brand.ownerName = 'Jordan Vale';
      draft.brand.trainerName = '';
      draft.features.booking.enabled = false;
      draft.features.booking.allowOnlinePayment = true;
      draft.features.clientPortal.enabled = false;
      draft.features.clientTasks.enabled = true;
      draft.features.clientTasks.allowClientCompletion = true;
      draft.features.store.enabled = true;
      draft.services = [
        {
          id: 'service-1',
          name: 'Strategy Intensive',
          description: 'Owner-defined advisory offer.',
          duration: 60,
          price: 150,
          allowOnlineBooking: true,
        },
      ];
      draft.landingPage.sections = [
        { ...draft.landingPage.sections[4], order: 99 },
        { ...draft.landingPage.sections[0], order: 99 },
        { ...draft.landingPage.sections[1], order: -3 },
      ];
      return draft;
    });

    component.save();

    expect(updateSiteConfig).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({
        brand: expect.objectContaining({
          ownerName: 'Jordan Vale',
          trainerName: 'Jordan Vale',
        }),
        features: expect.objectContaining({
          booking: { enabled: false, allowOnlinePayment: false },
          clientPortal: { enabled: false },
          clientTasks: { enabled: true, allowClientCompletion: true },
          store: { enabled: true },
        }),
        services: [
          expect.objectContaining({
            id: 'service-1',
            name: 'Strategy Intensive',
            price: 150,
          }),
        ],
        landingPage: expect.objectContaining({
          sections: [
            expect.objectContaining({ id: 'about', order: 0 }),
            expect.objectContaining({ id: 'contact', order: 1 }),
            expect.objectContaining({ id: 'hero', order: 2 }),
          ],
        }),
      }),
      null
    );
  });

  it('renders the features editor as a horizontal feature row', () => {
    const { fixture, component } = createComponent();

    component.togglePanel('features');
    fixture.detectChanges();

    const featureRow = fixture.nativeElement.querySelector('.feature-row');
    expect(featureRow).toBeTruthy();
    expect(featureRow.querySelectorAll('.toggle-card').length).toBeGreaterThan(
      1
    );
  });

  it('shows storefront controls only when the store feature is enabled', () => {
    const { fixture, component } = createComponent();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.textContent).not.toContain('Add storefront block');

    component.draft.update((draft) => {
      draft.features.store.enabled = true;
      return draft;
    });
    fixture.detectChanges();

    expect(host.textContent).toContain('Add storefront block');
  });

  it('renders a persistent guided and studio mode switch', () => {
    const { fixture } = createComponent();
    const host = fixture.nativeElement as HTMLElement;

    const modeSwitch = host.querySelector('[data-editor-mode-switch]');

    expect(modeSwitch).toBeTruthy();
    expect(modeSwitch?.textContent).toContain('Guided Setup');
    expect(modeSwitch?.textContent).toContain('Studio');
  });

  it('renders the editor beside a live business landing-page preview', () => {
    const { fixture, component } = createComponent();
    component.togglePanel('contact');
    component.togglePanel('review');
    component.togglePanel('offers');
    component.togglePanel('testimonials');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelector('[data-live-preview]')).toBeTruthy();
    expect(host.querySelector('[data-design-system-panel]')).toBeTruthy();
    expect(host.querySelector('app-editor-block-tree')).toBeTruthy();
    expect(host.querySelector('app-schema-block-inspector')).toBeTruthy();
    expect(
      host.querySelectorAll('app-schema-form-panel').length
    ).toBeGreaterThanOrEqual(3);
    expect(
      host.querySelectorAll('app-schema-string-list-panel').length
    ).toBeGreaterThanOrEqual(3);
    expect(
      host.querySelectorAll('app-schema-collection-panel').length
    ).toBeGreaterThanOrEqual(1);
    expect(host.querySelector('business-landing-page')).toBeTruthy();
  });

  it('pushes unsaved draft changes into the shared preview store and theme service', async () => {
    const { fixture, component } = createComponent();
    const store = TestBed.inject(BusinessSiteConfigStore);
    const setSiteSpy = jest.spyOn(store, 'setSite');

    component.draft().brand.tagline = 'Live preview headline';
    component.draft().theme.primaryColor = '#0f766e';
    component.draft().theme.mode = 'dark';
    component.draft().theme.personalityId = 'bold';

    component.refreshDraftSignalFromTemplate();
    await Promise.resolve();
    fixture.detectChanges();

    expect(setSiteSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        brand: expect.objectContaining({
          tagline: 'Live preview headline',
        }),
        theme: expect.objectContaining({
          primaryColor: '#0f766e',
          mode: 'dark',
          personalityId: 'bold',
        }),
      }),
      'config-1'
    );
    expect(setTheme).toHaveBeenLastCalledWith('dark');
    expect(setPrimaryColor).toHaveBeenLastCalledWith('#0f766e');
    expect(setPersonality).toHaveBeenLastCalledWith('bold');
    expect(hostText(fixture)).toContain('Live preview headline');
  });

  it('ignores unsupported theme fields emitted by the design panel', () => {
    const { component } = createComponent();

    component.updateDraftThemeField('secondaryColor', '#ff4081');

    expect(component.draft().theme).toEqual(
      expect.objectContaining({
        mode: 'light',
        personalityId: 'professional',
        primaryColor: '#1f7a63',
      })
    );
    expect(
      (component.draft().theme as unknown as Record<string, unknown>)[
        'secondaryColor'
      ]
    ).toBeUndefined();
  });

  it('applies personality changes immediately without requiring a manual draft refresh', async () => {
    const { fixture, component } = createComponent();

    component.updateDraftThemeField('personalityId', 'bold');
    fixture.detectChanges();
    await Promise.resolve();

    expect(component.draft().theme.personalityId).toBe('bold');
    expect(setPersonality).toHaveBeenLastCalledWith('bold');
  });

  it('lets the rendered business preview drive section selection', () => {
    const { fixture, component } = createComponent();
    const host = fixture.nativeElement as HTMLElement;

    const previewSection = host.querySelector(
      '[data-live-preview] [data-section-id="hero"]'
    ) as HTMLElement;

    previewSection.click();
    fixture.detectChanges();

    expect(component.selectedSectionId()).toBe('hero');
    expect(previewSection.classList.contains('preview-section-selected')).toBe(
      true
    );
  });

  it('opens the contextual mobile sheet in inspector mode after selecting from preview', () => {
    mockMobileViewport(true);
    const { fixture, component } = createComponent();
    const host = fixture.nativeElement as HTMLElement;

    const previewSection = host.querySelector(
      '[data-live-preview] [data-section-id="hero"]'
    ) as HTMLElement;

    previewSection.click();
    fixture.detectChanges();

    expect(component.mobileSheetOpen()).toBe(true);
    expect(component.mobileSheetMode()).toBe('inspector');
    expect(host.querySelector('[data-mobile-sheet]')).toBeTruthy();
  });

  it('uses single-open major panels in guided mode and multi-open panels in studio mode', () => {
    const { fixture, component } = createComponent();

    component.setEditorMode('guided');
    fixture.detectChanges();
    expect(component.isPanelExpanded('business-info')).toBe(true);
    expect(component.isPanelExpanded('layout')).toBe(false);

    component.togglePanel('layout');
    fixture.detectChanges();
    expect(component.isPanelExpanded('layout')).toBe(true);
    expect(component.isPanelExpanded('business-info')).toBe(false);

    component.setEditorMode('studio');
    component.togglePanel('offers');
    fixture.detectChanges();

    expect(component.isPanelExpanded('layout')).toBe(true);
    expect(component.isPanelExpanded('offers')).toBe(true);
  });

  it('saves business type, portal capabilities, layout, and custom sections', () => {
    const { component } = createComponent();

    component.draft.update((draft) => {
      draft.businessType = 'consulting';
      draft.landingPage.layout = 'grid';
      draft.clientPortal.capabilities = [
        'Track billing',
        'Review assigned work',
      ];
      draft.landingPage.sections.push({
        id: 'custom-1',
        type: 'custom',
        title: 'Proof',
        enabled: true,
        order: draft.landingPage.sections.length,
        body: 'This is a custom proof section.',
        ctaLabel: 'Request a call',
        ctaHref: '/book',
      });
      return draft;
    });

    component.save();

    expect(updateSiteConfig).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({
        businessType: 'consulting',
        clientPortal: expect.objectContaining({
          capabilities: ['Track billing', 'Review assigned work'],
        }),
        landingPage: expect.objectContaining({
          layout: 'grid',
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: 'custom-1',
              type: 'custom',
              body: 'This is a custom proof section.',
              ctaLabel: 'Request a call',
              ctaHref: '/book',
            }),
          ]),
        }),
      }),
      null
    );
  });

  it('saves compose-backed custom section content and rich component metadata', () => {
    const { component } = createComponent();

    component.addCustomSection();
    const customSection = component
      .draft()
      .landingPage.sections.find((section) => section.type === 'custom');
    expect(customSection).toBeTruthy();

    component.selectSection(customSection!.id);
    component.updateSelectedCustomSectionRichContent({
      title: 'What collaboration looks like',
      content:
        '<p>Every engagement starts with a working session.</p><div data-angular-component data-instance-id="callout-1"></div>',
      links: [],
      attachments: [],
      injectedComponentsNew: [
        {
          instanceId: 'callout-1',
          componentType: 'callout-box',
          componentData: {
            title: 'Decision rhythm',
            content: 'Weekly review and shared action log.',
            type: 'info',
          },
        },
      ],
      themeConfig: {
        theme: 'light',
        accentColor: '#1f7a63',
      },
    });

    component.save();

    expect(updateSiteConfig).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({
        landingPage: expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: customSection!.id,
              richContent: expect.objectContaining({
                content: expect.stringContaining('Every engagement starts'),
                injectedComponents: expect.arrayContaining([
                  expect.objectContaining({
                    instanceId: 'callout-1',
                    componentType: 'callout-box',
                  }),
                ]),
              }),
            }),
          ]),
        }),
      }),
      null
    );
  });

  it('adds image and gallery sections with richer media and motion settings', () => {
    const { component } = createComponent();

    component.addImageSection();
    component.addGallerySection();

    const imageSection = component
      .draft()
      .landingPage.sections.find((section) => section.type === 'image');
    const gallerySection = component
      .draft()
      .landingPage.sections.find((section) => section.type === 'gallery');

    expect(imageSection).toEqual(
      expect.objectContaining({
        type: 'image',
        image: expect.objectContaining({
          sourceType: 'url',
          aspect: 'landscape',
        }),
        motion: expect.objectContaining({
          kind: 'none',
        }),
      })
    );
    expect(gallerySection).toEqual(
      expect.objectContaining({
        type: 'gallery',
        gallery: expect.objectContaining({
          columns: 3,
          items: expect.arrayContaining([
            expect.objectContaining({
              sourceType: 'url',
            }),
          ]),
        }),
      })
    );
  });

  it('saves image and gallery section media with motion configuration', () => {
    const { component } = createComponent();

    component.addImageSection();
    component.addGallerySection();
    component.draft.update((draft) => {
      const imageSection = draft.landingPage.sections.find(
        (section) => section.type === 'image'
      )!;
      imageSection.title = 'Studio walkthrough';
      imageSection.image!.sourceType = 'asset';
      imageSection.image!.src = '/assets/business/studio.jpg';
      imageSection.image!.alt = 'Studio floor';
      imageSection.motion!.kind = 'signal-mesh';
      imageSection.motion!.density = 7;

      const gallerySection = draft.landingPage.sections.find(
        (section) => section.type === 'gallery'
      )!;
      gallerySection.gallery!.style = 'masonry';
      gallerySection.gallery!.items[0].src =
        'https://cdn.example.com/proof-1.jpg';
      gallerySection.gallery!.items[0].alt = 'Proof image';
      gallerySection.motion!.kind = 'shimmer-beam';
      gallerySection.motion!.direction = 'horizontal';
      return draft;
    });

    component.save();

    expect(updateSiteConfig).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({
        landingPage: expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              type: 'image',
              title: 'Studio walkthrough',
              image: expect.objectContaining({
                sourceType: 'asset',
                src: '/assets/business/studio.jpg',
                alt: 'Studio floor',
              }),
              motion: expect.objectContaining({
                kind: 'signal-mesh',
                density: 7,
              }),
            }),
            expect.objectContaining({
              type: 'gallery',
              gallery: expect.objectContaining({
                style: 'masonry',
                items: expect.arrayContaining([
                  expect.objectContaining({
                    src: 'https://cdn.example.com/proof-1.jpg',
                    alt: 'Proof image',
                  }),
                ]),
              }),
              motion: expect.objectContaining({
                kind: 'shimmer-beam',
                direction: 'horizontal',
              }),
            }),
          ]),
        }),
      }),
      null
    );
  });

  it('loads owner assets and applies a picked asset to an image section', async () => {
    const { component } = createComponent();

    component.addImageSection();
    component.toggleAssetPicker(
      component.draft().landingPage.sections.length - 1
    );
    await Promise.resolve();

    expect(listAssets).toHaveBeenCalledWith('profile-1');

    component.selectAsset(
      component.draft().landingPage.sections.length - 1,
      null,
      {
        id: 'asset-1',
        name: 'Studio',
        type: 'image',
        profileId: 'profile-1',
        url: '/api/asset/asset-1',
      }
    );

    const section = component.draft().landingPage.sections.at(-1);
    expect(section?.image).toEqual(
      expect.objectContaining({
        sourceType: 'asset',
        src: '/api/asset/asset-1',
        alt: 'Studio',
      })
    );
  });

  it('applies a picked asset to the contact section image', async () => {
    const { component } = createComponent();

    component.selectSection('contact');
    component.toggleAssetPicker(component.selectedSectionIndex());
    await Promise.resolve();

    component.selectAsset(component.selectedSectionIndex(), null, {
      id: 'asset-1',
      name: 'Studio',
      type: 'image',
      profileId: 'profile-1',
      url: '/api/asset/asset-1',
    });

    expect(component.selectedSection()?.image).toEqual(
      expect.objectContaining({
        sourceType: 'asset',
        src: '/api/asset/asset-1',
        alt: 'Studio',
      })
    );
  });

  it('renders contact image metadata fields and writes edits to the selected image', () => {
    const { fixture, component } = createComponent();

    component.selectSection('contact');
    component.draft.update((draft) => {
      const contact = draft.landingPage.sections.find(
        (section) => section.id === 'contact'
      );
      if (contact) {
        contact.image = {
          sourceType: 'url',
          src: '/assets/business/studio.jpg',
          alt: 'Old studio image',
          caption: 'Old caption',
          aspect: 'portrait',
        };
      }
      return draft;
    });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Alt Text');
    expect(host.textContent).toContain('Caption');
    expect(host.textContent).toContain('Aspect');

    const altInput = host.querySelector(
      '[data-contact-image-field="alt"] input'
    ) as HTMLInputElement;
    altInput.value = 'Studio portrait';
    altInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedSection()?.image).toEqual(
      expect.objectContaining({
        alt: 'Studio portrait',
      })
    );
  });

  it('updates selected section motion settings directly on the draft section', () => {
    const { component } = createComponent();

    component.selectSection('contact');
    component.patchSelectedSectionField('motion.kind', 'signal-mesh');
    component.patchSelectedSectionField('motion.density', '7');

    expect(component.selectedSection()?.motion).toEqual(
      expect.objectContaining({
        kind: 'signal-mesh',
        density: 7,
      })
    );
  });

  it('renders a motion selector and writes the selected motion kind to the draft', () => {
    const { fixture, component } = createComponent();

    component.selectSection('contact');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const motionSelect = host.querySelector(
      '.motion-editor select'
    ) as HTMLSelectElement;

    expect(motionSelect).toBeTruthy();
    expect(motionSelect?.textContent).toContain('None');

    motionSelect.value = 'signal-mesh';
    motionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(component.selectedSection()?.motion).toEqual(
      expect.objectContaining({
        kind: 'signal-mesh',
      })
    );
  });

  it('routes built-in section editing back to the owning editor panels', () => {
    const { fixture, component } = createComponent();
    const host = fixture.nativeElement as HTMLElement;

    component.selectSection('contact');
    fixture.detectChanges();

    const selectedShell = host.querySelector('.selected-section-shell');

    expect(component.selectedSection()?.type).toBe('contact');
    expect(
      selectedShell?.querySelector('app-schema-block-inspector')
    ).toBeNull();
    expect(selectedShell?.textContent).toContain('Contact Details');
  });

  it('uploads an asset for a gallery item and applies the returned asset url', async () => {
    const { component } = createComponent();
    const file = new File(['binary'], 'proof.png', { type: 'image/png' });

    component.addGallerySection();
    const sectionIndex = component.draft().landingPage.sections.length - 1;
    const event = { target: { files: [file], value: '' } } as unknown as Event;

    await component.onAssetFileSelected(sectionIndex, 0, event);

    expect(httpPost).toHaveBeenCalledWith(
      '/api/asset',
      expect.objectContaining({
        profileId: 'profile-1',
        name: 'proof.png',
        fileExtension: 'png',
      }),
      expect.objectContaining({
        headers: { Authorization: 'Bearer owner-token' },
      })
    );
    expect(
      component.draft().landingPage.sections[sectionIndex].gallery?.items[0]
    ).toEqual(
      expect.objectContaining({
        sourceType: 'asset',
        src: '/api/asset/uploaded-1',
        alt: 'proof',
      })
    );
  });

  it('blocks oversize image uploads before posting to the asset API', async () => {
    const { component } = createComponent();
    const file = new File(['binary'], 'too-large.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 + 1 });

    component.addImageSection();
    const sectionIndex = component.draft().landingPage.sections.length - 1;
    const event = {
      target: { files: [file], value: 'selected' },
    } as unknown as Event;

    await component.onAssetFileSelected(sectionIndex, null, event);

    expect(httpPost).not.toHaveBeenCalled();
    expect(component.assetLibraryError()).toBe(
      'Images must be 20MB or smaller before uploading.'
    );
  });

  it('allows image uploads up to 20MB before posting to the asset API', async () => {
    const { component } = createComponent();
    const file = new File(['binary'], 'large-ok.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 20 * 1024 * 1024 });

    component.addImageSection();
    const sectionIndex = component.draft().landingPage.sections.length - 1;
    const event = {
      target: { files: [file], value: '' },
    } as unknown as Event;

    await component.onAssetFileSelected(sectionIndex, null, event);

    expect(httpPost).toHaveBeenCalled();
    expect(component.assetLibraryError()).toBe('');
  });

  it('restores recommended landing section state from the editor controls', () => {
    const { component } = createComponent();

    component.draft.update((draft) => {
      draft.landingPage.sections = [
        { ...draft.landingPage.sections[4], enabled: false, order: 4 },
        { ...draft.landingPage.sections[0], enabled: false, order: 3 },
        { ...draft.landingPage.sections[1], enabled: false, order: 2 },
        { ...draft.landingPage.sections[2], enabled: false, order: 1 },
        { ...draft.landingPage.sections[3], enabled: false, order: 0 },
        { ...draft.landingPage.sections[5], enabled: false, order: 5 },
      ];
      return draft;
    });

    component.restoreRecommendedSectionState();

    expect(
      component.draft().landingPage.sections.map((section) => section.id)
    ).toEqual([
      'hero',
      'about',
      'services',
      'testimonials',
      'contact',
      'booking',
    ]);
    expect(
      component.draft().landingPage.sections.every((section) => section.enabled)
    ).toBe(true);
  });

  it('renders visual layout cards and organizer actions for the landing page editor', () => {
    const { fixture } = createComponent();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.querySelectorAll('.layout-option-card')).toHaveLength(3);
    expect(host.textContent).toContain('Show recommended');
    expect(host.textContent).toContain('Reset order');
    expect(host.textContent).toContain('Add image block');
    expect(host.textContent).toContain('Add gallery block');
  });

  it('saves the same live draft currently rendered in the embedded preview', () => {
    const { component } = createComponent();

    component.draft().brand.tagline = 'Draft visible before save';
    component.refreshDraftSignalFromTemplate();
    component.save();

    expect(updateSiteConfig).toHaveBeenCalledWith(
      'config-1',
      expect.objectContaining({
        brand: expect.objectContaining({
          tagline: 'Draft visible before save',
        }),
      }),
      null
    );
  });

  it('moves a section into a split canvas zone and persists that placement', () => {
    const { component } = createComponent();

    component.moveSectionToLayoutZone('contact', 'split', 'primary');

    expect(
      component
        .draft()
        .landingPage.sections.find((section) => section.id === 'contact')
    ).toEqual(
      expect.objectContaining({
        layoutPlacement: expect.objectContaining({
          split: 'primary',
        }),
      })
    );
  });

  it('renders visual drop zones for split and grid canvas editing', () => {
    const { fixture, component } = createComponent();
    const host = fixture.nativeElement as HTMLElement;

    component.setLandingLayout('split');
    fixture.detectChanges();
    expect(host.querySelector('[data-drop-zone="split:primary"]')).toBeTruthy();
    expect(
      host.querySelector('[data-drop-zone="split:secondary"]')
    ).toBeTruthy();

    component.setLandingLayout('grid');
    fixture.detectChanges();
    expect(
      host.querySelector('[data-drop-zone="grid:hero-wide"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-drop-zone="grid:bottom-right"]')
    ).toBeTruthy();
  });

  function hostText(fixture: { nativeElement: HTMLElement }): string {
    return fixture.nativeElement.textContent ?? '';
  }
});
