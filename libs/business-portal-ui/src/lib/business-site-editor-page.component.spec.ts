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
  const themeColors$ = of({
    background: '#ffffff',
    foreground: '#0f172a',
    accent: '#1f7a63',
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
            themeColors$,
          },
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
      })
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
      })
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

  it('pushes unsaved draft changes into the shared preview store and theme service', () => {
    const { fixture, component } = createComponent();
    const store = TestBed.inject(BusinessSiteConfigStore);
    const setSiteSpy = jest.spyOn(store, 'setSite');

    component.draft().brand.tagline = 'Live preview headline';
    component.draft().theme.primaryColor = '#0f766e';
    component.draft().theme.mode = 'dark';
    component.draft().theme.personalityId = 'bold';

    component.refreshDraftSignalFromTemplate();
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
      })
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
      })
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
      })
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
        name: 'proof',
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
      })
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
