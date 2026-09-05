import { signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { of, throwError } from 'rxjs';

import { type BlockInstance } from '@optimistic-tanuki/app-config-models';
import {
  BusinessApiService,
  BusinessAuthService,
  DEFAULT_BUSINESS_SITE_CONFIG,
  LandingSection,
} from '@optimistic-tanuki/business-data-access';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

import { BusinessSiteEditorPageComponent } from './business-site-editor-page.component';

describe('BusinessSiteEditorPageComponent behaviour', () => {
  const getSiteConfig = jest.fn();
  const updateSiteConfig = jest.fn();
  const listAssets = jest.fn();
  const getStoreProducts = jest.fn();
  const getOwnerProducts = jest.fn();
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

  /** The ThemeService colour stream feeds the embedded landing-page preview. */
  const pair = (base: string): [string, string][] =>
    ['0', '1', '2', '3', '4', '5', '6'].map(
      (shade) => [shade, base] as [string, string]
    );
  const gradients = (base: string) => ({
    light: `linear-gradient(135deg, ${base}, #ffffff)`,
    dark: `linear-gradient(135deg, ${base}, #0f172a)`,
  });
  const themeColors$ = of({
    background: '#ffffff',
    foreground: '#0f172a',
    accent: '#1f7a63',
    accentShades: pair('#1f7a63'),
    accentGradients: gradients('#1f7a63'),
    complementary: '#d97706',
    complementaryShades: pair('#d97706'),
    complementaryGradients: gradients('#d97706'),
    tertiary: '#7c3aed',
    tertiaryShades: pair('#7c3aed'),
    tertiaryGradients: gradients('#7c3aed'),
    success: '#15803d',
    successShades: pair('#15803d'),
    successGradients: gradients('#15803d'),
    danger: '#dc2626',
    dangerShades: pair('#dc2626'),
    dangerGradients: gradients('#dc2626'),
    warning: '#f59e0b',
    warningShades: pair('#f59e0b'),
    warningGradients: gradients('#f59e0b'),
  });

  const authUser = signal<{ profileId: string; userId: string } | null>({
    profileId: 'profile-1',
    userId: 'owner-user-1',
  });

  interface CreateOptions {
    /** Set to null to simulate a site that has never been persisted yet. */
    configId?: string | null;
    /** Route data the component reads in its constructor. */
    routeData?: Record<string, unknown>;
  }

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

  function createComponent(options: CreateOptions = {}) {
    const configId =
      options.configId === undefined ? 'config-1' : options.configId;

    getSiteConfig.mockReturnValue(
      of({
        configId,
        config: JSON.parse(JSON.stringify(DEFAULT_BUSINESS_SITE_CONFIG)),
      })
    );
    updateSiteConfig.mockReturnValue(of({ id: 'saved-config-1' }));
    getStoreProducts.mockReturnValue(of([]));
    getOwnerProducts.mockReturnValue(of([]));
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
            getOwnerProducts,
            getOffers,
            listAssets,
          },
        },
        { provide: HttpClient, useValue: { post: httpPost } },
        {
          provide: BusinessAuthService,
          useValue: {
            user: authUser,
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
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    });

    if (options.routeData) {
      // The component reads `route.snapshot.data` in its constructor. Mutating
      // the real ActivatedRoute from `provideRouter` keeps RouterLink working,
      // which a hand-rolled ActivatedRoute stub would break.
      const routeData = TestBed.inject(ActivatedRoute).snapshot.data as Record<
        string,
        unknown
      >;
      Object.assign(routeData, options.routeData);
    }

    const fixture = TestBed.createComponent(BusinessSiteEditorPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  /**
   * CDK reorders are detected by *identity* of previousContainer/container, so
   * a same-zone drop has to reuse one object rather than two equal literals.
   */
  function dropEvent(
    previousContainerId: string,
    containerId: string,
    previousIndex: number,
    currentIndex: number
  ): CdkDragDrop<string[]> {
    const previousContainer = { id: previousContainerId };
    const container =
      previousContainerId === containerId
        ? previousContainer
        : { id: containerId };
    return {
      previousContainer,
      container,
      previousIndex,
      currentIndex,
    } as unknown as CdkDragDrop<string[]>;
  }

  function sectionById(
    component: BusinessSiteEditorPageComponent,
    id: string
  ): LandingSection | undefined {
    return component
      .draft()
      .landingPage.sections.find((section) => section.id === id);
  }

  function lastSectionIndex(
    component: BusinessSiteEditorPageComponent
  ): number {
    return component.draft().landingPage.sections.length - 1;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getTheme.mockReturnValue('light');
    authUser.set({ profileId: 'profile-1', userId: 'owner-user-1' });
    mockMobileViewport(false);
  });

  describe('string list collections', () => {
    it('adds, edits and removes brand credentials', () => {
      const { component } = createComponent();

      component.addCredential();
      component.addCredential();
      component.updateStringListItem('brand.credentials', 1, 'ICF Certified');

      expect(component.draft().brand.credentials).toEqual([
        '',
        'ICF Certified',
      ]);

      component.removeCredential(0);

      expect(component.draft().brand.credentials).toEqual(['ICF Certified']);
    });

    it('adds, edits and removes brand specializations', () => {
      const { component } = createComponent();

      component.addSpecialization();
      component.updateStringListItem(
        'brand.specializations',
        0,
        'Leadership transitions'
      );

      expect(component.draft().brand.specializations).toEqual([
        'Leadership transitions',
      ]);

      component.removeSpecialization(0);

      expect(component.draft().brand.specializations).toEqual([]);
    });

    it('adds, edits and removes client portal capabilities', () => {
      const { component } = createComponent();
      const originalCount = component.draft().clientPortal.capabilities.length;

      component.addCapability();
      component.updateStringListItem(
        'clientPortal.capabilities',
        originalCount,
        'Download session notes'
      );

      expect(component.draft().clientPortal.capabilities).toHaveLength(
        originalCount + 1
      );
      expect(component.draft().clientPortal.capabilities.at(-1)).toBe(
        'Download session notes'
      );

      component.removeCapability(originalCount);

      expect(component.draft().clientPortal.capabilities).toHaveLength(
        originalCount
      );
    });

    it('leaves the draft untouched when a string list edit targets a non-list path', () => {
      const { component } = createComponent();

      component.updateStringListItem('brand.businessName', 0, 'Overwritten');
      component.updateStringListItem('brand.credentials', 4, 'Out of range');
      component.updateStringListItem('nothing.here', 0, 'Ignored');

      expect(component.draft().brand.businessName).toBe('My Business');
      expect(component.draft().brand.credentials).toEqual([]);
    });
  });

  describe('offers and testimonials collections', () => {
    it('appends an offer and coerces edited field values by declared type', () => {
      const { component } = createComponent();

      component.addService();
      component.patchServiceField(0, 'name', 'Strategy Intensive');
      component.patchServiceField(0, 'price', '150');
      component.patchServiceField(0, 'duration', 'not-a-number');
      component.patchServiceField(0, 'allowOnlineBooking', 'true');

      expect(component.draft().services[0]).toEqual(
        expect.objectContaining({
          name: 'Strategy Intensive',
          price: 150,
          duration: 0,
          allowOnlineBooking: true,
        })
      );

      component.patchServiceField(0, 'allowOnlineBooking', false);

      expect(component.draft().services[0].allowOnlineBooking).toBe(false);
      expect(component.servicesCollectionItems()).toBe(
        component.draft().services as unknown as Array<Record<string, unknown>>
      );

      component.removeService(0);

      expect(component.draft().services).toEqual([]);
    });

    it('ignores offer edits addressed at an index that no longer exists', () => {
      const { component } = createComponent();

      component.patchServiceField(3, 'name', 'Ghost offer');

      expect(component.draft().services).toEqual([]);
    });

    it('appends, edits and removes testimonials', () => {
      const { component } = createComponent();

      component.addTestimonial();
      component.patchTestimonialField(0, 'quote', 'Doubled our close rate.');
      component.patchTestimonialField(0, 'clientName', 'Avery Stone');

      expect(component.draft().testimonials[0]).toEqual({
        quote: 'Doubled our close rate.',
        clientName: 'Avery Stone',
        clientDetail: '',
      });
      expect(component.testimonialCollectionItems()).toHaveLength(1);

      component.patchTestimonialField(7, 'quote', 'Ghost quote');
      component.removeTestimonial(0);

      expect(component.draft().testimonials).toEqual([]);
    });

    it('labels collection rows by their content and falls back to a position label', () => {
      const { component } = createComponent();

      expect(component.serviceItemLabel(0, { name: 'Advisory Sprint' })).toBe(
        'Advisory Sprint'
      );
      expect(component.serviceItemLabel(2, { name: '   ' })).toBe('Offer #3');
      expect(
        component.testimonialItemLabel(0, { clientName: 'Avery Stone' })
      ).toBe('Avery Stone');
      expect(component.testimonialItemLabel(1, {})).toBe('Testimonial #2');
      expect(component.trackCollectionItemById({ id: 'service-1' }, 4)).toBe(
        'service-1'
      );
      expect(component.trackCollectionItemById({}, 4)).toBe(4);
      expect(component.trackCollectionItemByIndex({}, 2)).toBe(2);
    });
  });

  describe('root field and feature editing', () => {
    it('writes brand, contact and portal fields through the schema panels', () => {
      const { component } = createComponent();

      component.patchDraftField('brand.businessName', 'North Star Coaching');
      component.patchDraftField('businessType', 'coaching');
      component.patchDraftField('contact.email', 'hello@northstar.test');
      component.patchDraftField(
        'clientPortal.headline',
        'Everything in one place.'
      );

      expect(component.draft().brand.businessName).toBe('North Star Coaching');
      expect(component.draft().businessType).toBe('coaching');
      expect(component.draft().contact.email).toBe('hello@northstar.test');
      expect(component.draft().clientPortal.headline).toBe(
        'Everything in one place.'
      );
    });

    it('toggles feature flags on the draft', () => {
      const { component } = createComponent();

      component.updateFeatureFlag('booking.enabled', false);
      component.updateFeatureFlag('clientTasks.allowClientCompletion', true);

      expect(component.draft().features.booking.enabled).toBe(false);
      expect(component.draft().features.clientTasks.allowClientCompletion).toBe(
        true
      );
    });

    it('drops storefront blocks from the rendered block tree when the store feature is disabled', () => {
      const { component } = createComponent();

      component.updateFeatureFlag('store.enabled', true);
      component.addStoreSection();
      const storeSectionId = component.selectedSectionId() as string;

      expect(storeSectionId).toMatch(/^store-/);
      expect(component.landingPageBlocks().map((block) => block.id)).toContain(
        storeSectionId
      );

      component.updateFeatureFlag('store.enabled', false);

      expect(component.draft().features.store.enabled).toBe(false);
      expect(
        component.landingPageBlocks().map((block) => block.id)
      ).not.toContain(storeSectionId);
    });

    it('refuses to add a storefront block while the store feature is off', () => {
      const { component } = createComponent();
      const before = component.draft().landingPage.sections.length;

      component.addStoreSection();

      expect(component.draft().landingPage.sections).toHaveLength(before);
    });

    it('accepts only the known service catalog sources', () => {
      const { component } = createComponent();

      component.updateServiceCatalogSource('store');
      expect(component.draft().serviceCatalog.source).toBe('store');

      component.updateServiceCatalogSource('spreadsheet');
      expect(component.draft().serviceCatalog.source).toBe('store');

      component.updateServiceCatalogSource('manual');
      expect(component.draft().serviceCatalog.source).toBe('manual');
    });
  });

  describe('theme draft editing', () => {
    it('writes supported theme fields and ignores an unknown mode value', () => {
      const { component } = createComponent();

      component.updateDraftThemeField('mode', 'dark');
      component.updateDraftThemeField('primaryColor', '#0f766e');

      expect(component.draft().theme).toEqual(
        expect.objectContaining({ mode: 'dark', primaryColor: '#0f766e' })
      );

      component.updateDraftThemeField('mode', 'neon');

      expect(component.draft().theme.mode).toBe('dark');
    });

    it('selects a personality and resolves its display label', () => {
      const { component } = createComponent();

      component.selectPersonality('bold');

      expect(component.draft().theme.personalityId).toBe('bold');
      expect(component.currentPersonalityLabel()).toBe('Bold');

      component.selectPersonality('not-a-real-personality');

      expect(component.currentPersonalityLabel()).toBe(
        'not-a-real-personality'
      );
    });

    it('coalesces repeated template-driven draft refreshes into one signal write', async () => {
      const { component } = createComponent();
      const setSpy = jest.spyOn(component.draft, 'set');

      component.draft().brand.tagline = 'Edited in the template';
      component.refreshDraftSignalFromTemplate();
      component.refreshDraftSignalFromTemplate();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(component.draft().brand.tagline).toBe('Edited in the template');
    });
  });

  describe('section motion editing', () => {
    it('clears motion when the none option is chosen and rebuilds it on the next edit', () => {
      const { component } = createComponent();

      component.selectSection('about');
      component.updateSectionMotion('none');

      expect(sectionById(component, 'about')?.motion).toBeUndefined();

      component.patchSelectedSectionField('motion.intensity', '0.9');

      expect(sectionById(component, 'about')?.motion).toEqual({
        intensity: 0.9,
      });
    });

    it('parses motion parameters and drops values that are not finite numbers', () => {
      const { component } = createComponent();

      component.selectSection('about');
      component.updateSectionMotion('pulse-rings');
      component.updateSectionMotionParameter('speed', '3');
      component.updateSectionMotionParameter('intensity', '0.45');

      expect(sectionById(component, 'about')?.motion).toEqual(
        expect.objectContaining({
          kind: 'pulse-rings',
          speed: 3,
          intensity: 0.45,
        })
      );

      component.updateSectionMotionParameter('density', 'not-a-number');

      expect(sectionById(component, 'about')?.motion?.density).toBeUndefined();
    });

    it('ignores motion and field edits while no section is selected', () => {
      const { component } = createComponent();
      const before = JSON.stringify(component.draft().landingPage.sections);

      component.selectedSectionId.set('no-such-section');
      component.updateSectionMotion('aurora-ribbon');
      component.updateSectionMotionParameter('intensity', '0.5');
      component.patchSelectedSectionField('title', 'Nothing');

      expect(JSON.stringify(component.draft().landingPage.sections)).toBe(
        before
      );
    });

    it('names motion kinds for the section summary chips', () => {
      const { component } = createComponent();

      expect(component.motionLabel('signal-mesh')).toBe('Signal Mesh');
      expect(component.motionLabel('murmuration-scene')).toBe('Motion');
    });
  });

  describe('contact image metadata', () => {
    it('writes only alt, caption and aspect onto the selected section image', () => {
      const { component } = createComponent();

      component.selectSection('contact');
      component.draft.update((draft) => {
        const contact = draft.landingPage.sections.find(
          (section) => section.id === 'contact'
        );
        if (contact) {
          contact.image = {
            sourceType: 'url',
            src: '/assets/business/studio.jpg',
            alt: '',
            caption: '',
            aspect: 'landscape',
          };
        }
        return draft;
      });

      component.updateContactImageField('alt', 'Studio floor');
      component.updateContactImageField('caption', 'Our workspace');
      component.updateContactImageField('aspect', 'portrait');
      component.updateContactImageField('src', 'https://example.test/hack.jpg');

      expect(sectionById(component, 'contact')?.image).toEqual(
        expect.objectContaining({
          alt: 'Studio floor',
          caption: 'Our workspace',
          aspect: 'portrait',
          src: '/assets/business/studio.jpg',
        })
      );
    });

    it('ignores contact image edits when the section has no image', () => {
      const { component } = createComponent();

      component.selectSection('hero');
      component.updateContactImageField('alt', 'Nothing to write to');

      expect(sectionById(component, 'hero')?.image).toBeUndefined();
    });
  });

  describe('gallery blocks', () => {
    it('adds and removes gallery items on a gallery section', () => {
      const { component } = createComponent();

      component.addGallerySection();
      const sectionIndex = lastSectionIndex(component);

      component.addGalleryItem(sectionIndex);
      component.addGalleryItem(sectionIndex);

      expect(
        component.draft().landingPage.sections[sectionIndex].gallery?.items
      ).toHaveLength(3);

      component.removeGalleryItem(sectionIndex, 0);

      expect(
        component.draft().landingPage.sections[sectionIndex].gallery?.items
      ).toHaveLength(2);
    });

    it('writes gallery item media fields and normalizes the source type', () => {
      const { component } = createComponent();

      component.addGallerySection();
      const sectionIndex = lastSectionIndex(component);

      component.updateGalleryItemField(
        sectionIndex,
        0,
        'src',
        'https://cdn.example.test/proof-1.jpg'
      );
      component.updateGalleryItemField(sectionIndex, 0, 'alt', 'Proof image');
      component.updateGalleryItemField(sectionIndex, 0, 'caption', 'Workshop');
      component.updateGalleryItemField(sectionIndex, 0, 'sourceType', 'asset');

      expect(
        component.draft().landingPage.sections[sectionIndex].gallery?.items[0]
      ).toEqual(
        expect.objectContaining({
          src: 'https://cdn.example.test/proof-1.jpg',
          alt: 'Proof image',
          caption: 'Workshop',
          sourceType: 'asset',
        })
      );

      component.updateGalleryItemField(
        sectionIndex,
        0,
        'sourceType',
        'anything-else'
      );

      expect(
        component.draft().landingPage.sections[sectionIndex].gallery?.items[0]
          .sourceType
      ).toBe('url');
    });

    it('ignores gallery item edits addressed at a missing item', () => {
      const { component } = createComponent();

      component.addGallerySection();
      const sectionIndex = lastSectionIndex(component);

      component.updateGalleryItemField(sectionIndex, 5, 'alt', 'Ghost');

      expect(
        component.draft().landingPage.sections[sectionIndex].gallery?.items
      ).toHaveLength(1);
    });
  });

  describe('asset picker', () => {
    it('closes the picker when the same target is toggled twice', async () => {
      const { component } = createComponent();

      component.addImageSection();
      const sectionIndex = lastSectionIndex(component);

      component.toggleAssetPicker(sectionIndex);
      await Promise.resolve();

      expect(component.isAssetPickerOpen(sectionIndex)).toBe(true);
      expect(component.assetLibrary()).toHaveLength(1);

      component.toggleAssetPicker(sectionIndex);

      expect(component.isAssetPickerOpen(sectionIndex)).toBe(false);
      expect(component.activeAssetPicker()).toBeNull();
    });

    it('loads the owner asset library once until a forced refresh', async () => {
      const { component } = createComponent();

      await component.loadOwnerAssets();
      await component.loadOwnerAssets();

      expect(listAssets).toHaveBeenCalledTimes(1);

      await component.loadOwnerAssets(true);

      expect(listAssets).toHaveBeenCalledTimes(2);
    });

    it('reports that assets cannot be browsed without an owner profile', async () => {
      authUser.set(null);
      const { component } = createComponent();

      await component.loadOwnerAssets();

      expect(listAssets).not.toHaveBeenCalled();
      expect(component.assetLibraryError()).toBe(
        'Owner profile is not available for asset browsing.'
      );
    });

    it('surfaces the asset API error message', async () => {
      const { component } = createComponent();
      listAssets.mockReturnValue(
        throwError(() => ({ error: { message: 'Asset service offline.' } }))
      );

      await component.loadOwnerAssets(true);

      expect(component.assetsLoading()).toBe(false);
      expect(component.assetLibraryError()).toBe('Asset service offline.');
    });

    it('applies a picked asset to a gallery item and closes the picker', () => {
      const { component } = createComponent();

      component.addGallerySection();
      const sectionIndex = lastSectionIndex(component);
      component.toggleAssetPicker(sectionIndex, 0);

      component.selectAsset(sectionIndex, 0, {
        id: 'asset-1',
        name: 'Studio',
        type: 'image',
        profileId: 'profile-1',
        url: '/api/asset/asset-1',
      });

      expect(
        component.draft().landingPage.sections[sectionIndex].gallery?.items[0]
      ).toEqual(
        expect.objectContaining({
          sourceType: 'asset',
          src: '/api/asset/asset-1',
          alt: 'Studio',
        })
      );
      expect(component.activeAssetPicker()).toBeNull();
    });

    it('creates a portrait image on the contact section when uploading to it', async () => {
      const { component } = createComponent();
      const file = new File(['binary'], 'front-desk.png', {
        type: 'image/png',
      });

      component.selectSection('contact');
      const sectionIndex = component.selectedSectionIndex();
      const event = {
        target: { files: [file], value: '' },
      } as unknown as Event;

      await component.onAssetFileSelected(sectionIndex, null, event);

      expect(sectionById(component, 'contact')?.image).toEqual(
        expect.objectContaining({
          sourceType: 'asset',
          src: '/api/asset/uploaded-1',
          alt: 'front-desk',
          aspect: 'portrait',
        })
      );
    });

    it('reports an upload failure and clears the uploading flag', async () => {
      const { component } = createComponent();
      httpPost.mockReturnValue(
        throwError(() => ({ message: 'Asset store rejected the upload.' }))
      );
      const file = new File(['binary'], 'proof.png', { type: 'image/png' });

      component.addImageSection();
      const sectionIndex = lastSectionIndex(component);
      const event = {
        target: { files: [file], value: '' },
      } as unknown as Event;

      await component.onAssetFileSelected(sectionIndex, null, event);

      expect(component.assetLibraryError()).toBe(
        'Asset store rejected the upload.'
      );
      expect(
        component.isUploading(component.assetTargetKey(sectionIndex, null))
      ).toBe(false);
    });

    it('does nothing when the file input reports no selected file', async () => {
      const { component } = createComponent();

      component.addImageSection();
      const sectionIndex = lastSectionIndex(component);
      const event = { target: { files: [], value: '' } } as unknown as Event;

      await component.onAssetFileSelected(sectionIndex, null, event);

      expect(httpPost).not.toHaveBeenCalled();
      expect(
        component.draft().landingPage.sections[sectionIndex].image?.src
      ).toBe('');
    });
  });

  describe('landing page structure', () => {
    it('renumbers section order and bulk-toggles section visibility', () => {
      const { component } = createComponent();

      component.draft.update((draft) => {
        draft.landingPage.sections = draft.landingPage.sections.map(
          (section, index) => ({ ...section, order: 90 - index })
        );
        return draft;
      });

      component.resetSectionOrder();

      expect(
        component.draft().landingPage.sections.map((section) => section.order)
      ).toEqual([0, 1, 2, 3, 4, 5]);

      component.setAllSectionsEnabled(false);
      expect(
        component
          .draft()
          .landingPage.sections.every((section) => !section.enabled)
      ).toBe(true);

      component.setAllSectionsEnabled(true);
      expect(
        component
          .draft()
          .landingPage.sections.every((section) => section.enabled)
      ).toBe(true);
    });

    it('toggles a single section on and off by id', () => {
      const { component } = createComponent();

      component.toggleSectionEnabled('about', false);

      expect(sectionById(component, 'about')?.enabled).toBe(false);
      expect(sectionById(component, 'hero')?.enabled).toBe(true);

      component.toggleSectionEnabled('about', true);

      expect(sectionById(component, 'about')?.enabled).toBe(true);
    });

    it('removes a section and moves the selection to its neighbour', () => {
      const { component } = createComponent();

      component.selectSection('services');
      component.removeSection(2);

      expect(
        component.draft().landingPage.sections.map((section) => section.id)
      ).toEqual(['hero', 'about', 'testimonials', 'contact', 'booking']);
      expect(component.selectedSectionId()).toBe('testimonials');
      expect(component.mobileSheetView()).toBe('structure');
    });

    it('falls back to the previous section when the last section is removed', () => {
      const { component } = createComponent();

      component.selectSection('booking');
      component.removeSection(5);

      expect(component.selectedSectionId()).toBe('contact');
    });

    it('keeps the selection when a different section is removed', () => {
      const { component } = createComponent();

      component.selectSection('booking');
      component.removeSection(0);

      expect(component.selectedSectionId()).toBe('booking');
    });

    it('refuses to move the first section up or the last section down', () => {
      const { component } = createComponent();
      const before = component
        .draft()
        .landingPage.sections.map((section) => section.id);

      component.moveSectionUp(0);
      component.moveSectionDown(before.length - 1);

      expect(
        component.draft().landingPage.sections.map((section) => section.id)
      ).toEqual(before);
    });
  });

  describe('canvas layout zones', () => {
    it('places sections in their default split and grid slots when unplaced', () => {
      const { component } = createComponent();

      component.draft.update((draft) => {
        for (const section of draft.landingPage.sections) {
          section.layoutPlacement = undefined;
        }
        return draft;
      });

      expect(component.sectionIdsForZone('split', 'primary')).toEqual([
        'hero',
        'about',
        'services',
      ]);
      expect(component.sectionIdsForZone('split', 'secondary')).toEqual([
        'testimonials',
        'contact',
        'booking',
      ]);
      expect(component.sectionIdsForZone('grid', 'hero-wide')).toEqual([
        'hero',
      ]);
      expect(component.sectionIdsForZone('grid', 'top-left')).toEqual([
        'about',
      ]);
      expect(component.sectionIdsForZone('grid', 'bottom-right')).toEqual([
        'contact',
        'booking',
      ]);
    });

    it('drops newly added blocks into the trailing default zones', () => {
      const { component } = createComponent();

      component.addCustomSection();
      const customId = component.selectedSectionId() as string;

      expect(component.sectionIdsForZone('split', 'secondary')).toContain(
        customId
      );
      expect(component.sectionIdsForZone('grid', 'bottom-right')).toContain(
        customId
      );
    });

    it('assigns a section to a grid slot and ignores unknown section ids', () => {
      const { component } = createComponent();

      component.moveSectionToLayoutZone('contact', 'grid', 'top-left');

      expect(sectionById(component, 'contact')?.layoutPlacement).toEqual(
        expect.objectContaining({ grid: 'top-left' })
      );

      const before = JSON.stringify(component.draft().landingPage.sections);
      component.moveSectionToLayoutZone('no-such-section', 'split', 'primary');

      expect(JSON.stringify(component.draft().landingPage.sections)).toBe(
        before
      );
    });

    it('reorders sections inside a split zone on drop', () => {
      const { component } = createComponent();

      component.setLandingLayout('split');
      expect(component.sectionIdsForZone('split', 'primary')).toEqual([
        'hero',
        'about',
        'services',
      ]);

      component.dropSection(
        dropEvent('landing-split-primary', 'landing-split-primary', 0, 2),
        'split',
        'primary'
      );

      expect(component.sectionIdsForZone('split', 'primary')).toEqual([
        'about',
        'services',
        'hero',
      ]);
      expect(
        component.draft().landingPage.sections.map((section) => section.order)
      ).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('transfers a section between grid zones on drop and records the placement', () => {
      const { component } = createComponent();

      component.setLandingLayout('grid');
      component.dropSection(
        dropEvent('landing-grid-top-left', 'landing-grid-bottom-right', 0, 0),
        'grid',
        'bottom-right'
      );

      expect(component.sectionIdsForZone('grid', 'top-left')).toEqual([]);
      expect(component.sectionIdsForZone('grid', 'bottom-right')).toEqual([
        'about',
        'contact',
        'booking',
      ]);
      expect(sectionById(component, 'about')?.layoutPlacement?.grid).toBe(
        'bottom-right'
      );
    });

    it('ignores drops whose container ids do not name a canvas zone', () => {
      const { component } = createComponent();
      const before = JSON.stringify(component.draft().landingPage.sections);

      component.dropSection(dropEvent('ab', 'cd', 0, 1), 'split', 'primary');

      expect(JSON.stringify(component.draft().landingPage.sections)).toBe(
        before
      );
    });

    it('exposes every canvas zone as a connected CDK drop list', () => {
      const { component } = createComponent();

      expect(component.connectedDropLists()).toEqual([
        'landing-single-column-main',
        'landing-split-primary',
        'landing-split-secondary',
        'landing-grid-hero-wide',
        'landing-grid-top-left',
        'landing-grid-top-right',
        'landing-grid-bottom-left',
        'landing-grid-bottom-right',
      ]);
    });
  });

  describe('section descriptions and summaries', () => {
    it.each([
      ['image', 'Drop in a single image block'],
      ['gallery', 'Use a multi-image block'],
      ['store', 'Control whether this section appears'],
    ])('describes the %s block type', (sectionType, expected) => {
      const { component } = createComponent();

      expect(component.sectionDescription(sectionType)).toContain(expected);
    });

    it('summarizes an image block from its media source and framing', () => {
      const { component } = createComponent();

      component.addImageSection();
      const sectionIndex = lastSectionIndex(component);
      const section = component.draft().landingPage.sections[sectionIndex];

      expect(component.sectionSummary(section)).toBe(
        'No image source selected yet.'
      );
      expect(component.sectionPreviewImage(section)).toBeNull();

      section.image = {
        sourceType: 'url',
        src: '/assets/business/studio.jpg',
        alt: 'Studio',
        aspect: 'landscape',
      };

      expect(component.sectionSummary(section)).toBe(
        'URL image with landscape framing.'
      );
      expect(component.sectionPreviewImage(section)).toBe(section.image);

      section.image.sourceType = 'asset';
      section.image.aspect = 'portrait';

      expect(component.sectionSummary(section)).toBe(
        'Asset image with portrait framing.'
      );
    });

    it('summarizes a gallery block from the number of populated items', () => {
      const { component } = createComponent();

      component.addGallerySection();
      const sectionIndex = lastSectionIndex(component);
      const section = component.draft().landingPage.sections[sectionIndex];

      expect(component.sectionSummary(section)).toBe(
        'No gallery images selected yet.'
      );
      expect(component.sectionPreviewImage(section)).toBeNull();

      component.updateGalleryItemField(
        sectionIndex,
        0,
        'src',
        '/assets/business/proof-1.jpg'
      );
      const withOne = component.draft().landingPage.sections[sectionIndex];

      expect(component.sectionSummary(withOne)).toBe(
        '1 gallery image in a grid layout.'
      );
      expect(component.sectionPreviewImage(withOne)?.src).toBe(
        '/assets/business/proof-1.jpg'
      );

      component.addGalleryItem(sectionIndex);
      component.updateGalleryItemField(
        sectionIndex,
        1,
        'src',
        '/assets/business/proof-2.jpg'
      );
      component.draft.update((draft) => {
        const gallery = draft.landingPage.sections[sectionIndex].gallery;
        if (gallery) {
          gallery.style = 'masonry';
        }
        return draft;
      });

      expect(
        component.sectionSummary(
          component.draft().landingPage.sections[sectionIndex]
        )
      ).toBe('2 gallery images in a masonry layout.');
    });

    it('names landing blocks from their block definition', () => {
      const { component } = createComponent();
      const blocks = component.landingPageBlocks();

      expect(component.landingBlockFallbackTitle(blocks[0], 0)).toBe('Hero');
      expect(
        component.landingBlockFallbackTitle(
          {
            id: 'ghost',
            type: 'not-a-block-type',
            order: 4,
            enabled: true,
            data: {},
          } satisfies BlockInstance,
          4
        )
      ).toBe('Section 5');
    });
  });

  describe('dedicated editor panels for the selected section', () => {
    it.each([
      ['hero', 'Brand & Identity', 'Brand & Identity panel'],
      ['about', 'Brand & Identity', 'Brand & Identity panel'],
      ['services', 'Offers', 'Offers panel'],
      ['booking', 'Offers', 'Offers panel'],
      ['testimonials', 'Testimonials', 'Testimonials panel'],
      ['contact', 'Contact Details', 'Contact Details panel'],
    ])(
      'routes the %s section to its owning panel',
      (sectionId, title, description) => {
        const { component } = createComponent();

        component.selectSection(sectionId);

        expect(component.selectedSectionUsesDedicatedPanel()).toBe(true);
        expect(component.selectedSectionEditorPanelTitle()).toBe(title);
        expect(component.selectedSectionEditorPanelDescription()).toContain(
          description
        );
      }
    );

    it('routes the storefront section to the offers panel', () => {
      const { component } = createComponent();

      component.updateFeatureFlag('store.enabled', true);
      component.addStoreSection();

      expect(component.selectedSectionEditorPanelTitle()).toBe('Offers');
      expect(component.selectedSectionEditorPanelDescription()).toContain(
        'Offers panel'
      );
    });

    it('keeps custom blocks on the generic section editor', () => {
      const { component } = createComponent();

      component.addCustomSection();

      expect(component.selectedSectionUsesDedicatedPanel()).toBe(false);
      expect(component.selectedSectionEditorPanelTitle()).toBe(
        'Section Editor'
      );
      expect(component.selectedSectionEditorPanelDescription()).toBe(
        'Use the dedicated editor panel on the left for this section.'
      );
    });

    it('opens the rich text editor for custom blocks and on explicit request', () => {
      const { component } = createComponent();

      component.selectSection('about');
      expect(component.composeEditorVisible()).toBe(false);

      component.toggleRichTextEditor();
      expect(component.composeEditorVisible()).toBe(true);

      component.addCustomSection();
      expect(component.composeEditorVisible()).toBe(true);
    });
  });

  describe('compose fallback content', () => {
    it.each([
      [
        'services',
        '<p>Choose a starting point, then build the right engagement from there.</p>',
      ],
      [
        'testimonials',
        '<p>Services that fit real schedules and still move the needle.</p>',
      ],
      [
        'contact',
        '<p>Reach out when you are ready to talk goals, schedule, and fit.</p>',
      ],
      ['booking', '<p>Book the right starting point when you are ready.</p>'],
    ])('seeds the %s section editor with its default copy', (id, expected) => {
      const { fixture, component } = createComponent();

      component.selectSection(id);
      fixture.detectChanges();

      expect(component.selectedSectionComposeValue().content).toBe(expected);
    });

    it('seeds the storefront section editor with its default copy', () => {
      const { fixture, component } = createComponent();

      component.updateFeatureFlag('store.enabled', true);
      component.addStoreSection();
      const storeId = component.selectedSectionId() as string;
      component.draft.update((draft) => {
        const store = draft.landingPage.sections.find(
          (section) => section.id === storeId
        );
        if (store) {
          store.body = '';
        }
        return draft;
      });
      fixture.detectChanges();

      expect(component.selectedSectionComposeValue().content).toBe(
        '<p>Browse available originals, print sets, and small-batch studio merch.</p>'
      );
    });

    it('leaves media blocks without fallback copy', () => {
      const { fixture, component } = createComponent();

      component.addImageSection();
      fixture.detectChanges();

      expect(component.selectedSectionComposeValue().content).toBe('');
    });

    it('leaves an emptied custom block without fallback copy', () => {
      const { component } = createComponent();

      component.addCustomSection();
      // No detectChanges here: the rendered compose editor re-emits its own
      // model on the next cycle, which would overwrite the reset we assert on.
      component.resetSelectedSectionRichContent();

      expect(component.selectedCustomSectionComposeValue().content).toBe('');
    });

    it('empties the compose model when the selection points at nothing', () => {
      const { fixture, component } = createComponent();

      component.selectedSectionId.set('no-such-section');
      fixture.detectChanges();

      expect(component.selectedSectionComposeValue()).toEqual(
        expect.objectContaining({ title: '', content: '' })
      );
    });

    it('refuses rich content edits for blocks that do not support compose', () => {
      const { component } = createComponent();

      component.addImageSection();
      const imageId = component.selectedSectionId() as string;

      component.updateSelectedSectionRichContent({
        title: 'Should be ignored',
        content: '<p>Should be ignored.</p>',
        links: [],
        attachments: [],
        injectedComponentsNew: [],
        themeConfig: { theme: 'light', accentColor: '#1f7a63' },
      });
      component.resetSelectedSectionRichContent();

      expect(sectionById(component, imageId)?.richContent).toBeUndefined();
      expect(sectionById(component, imageId)?.body).toBeUndefined();
    });

    it('writes an empty body when rich content is cleared to nothing', () => {
      const { component } = createComponent();

      component.selectSection('about');
      component.updateSelectedSectionRichContent({
        title: 'About',
        content: '   ',
        links: [],
        attachments: [],
        injectedComponentsNew: [],
        themeConfig: { theme: 'light', accentColor: '#1f7a63' },
      });

      expect(sectionById(component, 'about')?.body).toBe('');
    });
  });

  describe('guided mode navigation', () => {
    let scrollIntoView: jest.Mock;

    beforeEach(() => {
      // jsdom leaves scrollIntoView undefined and the component skips the whole
      // anchor-focus branch when it is missing, so stub it to exercise it.
      scrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
    });

    afterEach(() => {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    });

    it('expands the panel that belongs to each guided step and scrolls to it', () => {
      const { component } = createComponent();

      component.setEditorMode('guided');
      expect(component.isPanelExpanded('business-info')).toBe(true);

      component.nextGuidedStep();
      expect(component.guidedStep()).toBe(1);
      expect(component.isPanelExpanded('features')).toBe(true);

      component.nextGuidedStep();
      expect(component.isPanelExpanded('offers')).toBe(true);

      component.setGuidedStep(3);
      expect(component.isPanelExpanded('design')).toBe(true);

      component.setGuidedStep(4);
      expect(component.isPanelExpanded('review')).toBe(true);

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });

    it('clamps guided navigation at the first and last step', () => {
      const { component } = createComponent();

      component.setEditorMode('guided');
      component.prevGuidedStep();
      expect(component.guidedStep()).toBe(0);

      component.setGuidedStep(component.guidedSteps.length - 1);
      component.nextGuidedStep();
      expect(component.guidedStep()).toBe(component.guidedSteps.length - 1);

      component.prevGuidedStep();
      expect(component.guidedStep()).toBe(component.guidedSteps.length - 2);
    });

    it('starts in guided mode when the route asks for it', () => {
      const { component } = createComponent({
        routeData: { editorMode: 'guided' },
      });

      expect(component.editorMode()).toBe('guided');
      expect(component.isPanelExpanded('business-info')).toBe(true);
      expect(component.isPanelExpanded('layout')).toBe(false);
    });
  });

  describe('mobile sheet', () => {
    it('shows the structure view on request and closes on demand', () => {
      const { component } = createComponent();

      component.openMobileSheet('structure');

      expect(component.mobileSheetOpen()).toBe(true);
      expect(component.mobileSheetMode()).toBe('structure');
      expect(component.mobileSheetTitle()).toBe('Landing Page Structure');

      component.closeMobileSheet();

      expect(component.mobileSheetOpen()).toBe(false);
    });

    it('titles the inspector view after the selected section', () => {
      const { component } = createComponent();

      component.selectSection('contact');
      component.openMobileSheet('inspector');

      expect(component.mobileSheetMode()).toBe('inspector');
      expect(component.mobileSheetTitle()).toBe('Contact');
    });

    it('falls back to the structure view when nothing is selected', () => {
      const { component } = createComponent();

      component.selectedSectionId.set(null);
      component.openMobileSheet('auto');

      expect(component.mobileSheetMode()).toBe('structure');
      expect(component.mobileSheetTitle()).toBe('Landing Page Structure');
    });
  });

  describe('saving and resetting', () => {
    it('adopts the config id returned by the first save of a new site', () => {
      const { component } = createComponent({ configId: null });

      component.save();

      expect(updateSiteConfig).toHaveBeenLastCalledWith(
        null,
        expect.anything(),
        null
      );
      expect(component.saving()).toBe(false);
      expect(component.successMsg()).toBe('Site content saved successfully.');

      component.save();

      expect(updateSiteConfig).toHaveBeenLastCalledWith(
        'saved-config-1',
        expect.anything(),
        null
      );
    });

    it('stamps the onboarding completion time when saving from onboarding', () => {
      const { component } = createComponent({
        routeData: { onboardingMode: true },
      });

      component.save();

      const payload = updateSiteConfig.mock.calls[0][1];
      expect(component.onboardingMode()).toBe(true);
      expect(Date.parse(payload.site.onboardingCompletedAt)).not.toBeNaN();
    });

    it('surfaces the save error message and stops the saving indicator', () => {
      const { component } = createComponent();
      updateSiteConfig.mockReturnValue(
        throwError(() => ({ error: { message: 'Site is locked.' } }))
      );

      component.save();

      expect(component.saving()).toBe(false);
      expect(component.errorMsg()).toBe('Site is locked.');
      expect(component.successMsg()).toBe('');
    });

    it('falls back to a generic save error when the server sends no message', () => {
      const { component } = createComponent();
      updateSiteConfig.mockReturnValue(throwError(() => ({})));

      component.save();

      expect(component.errorMsg()).toBe('Save failed. Please try again.');
    });

    it('restores the packaged defaults and clears status messages on reset', () => {
      const { component } = createComponent();

      component.patchDraftField('brand.businessName', 'Edited Business');
      component.addCustomSection();
      component.save();

      expect(component.successMsg()).toBe('Site content saved successfully.');

      component.reset();

      expect(component.draft().brand.businessName).toBe(
        DEFAULT_BUSINESS_SITE_CONFIG.brand.businessName
      );
      expect(
        component.draft().landingPage.sections.map((section) => section.id)
      ).toEqual(
        DEFAULT_BUSINESS_SITE_CONFIG.landingPage.sections.map(
          (section) => section.id
        )
      );
      expect(component.selectedSectionId()).toBe('hero');
      expect(component.successMsg()).toBe('');
      expect(component.errorMsg()).toBe('');
    });
  });

  describe('store service products', () => {
    it('keeps only active service products from the owner catalog', async () => {
      const { component } = createComponent();
      // createComponent() seeds the API mocks, so catalog fixtures have to be
      // installed afterwards and the load re-run explicitly.
      getOwnerProducts.mockReturnValue(
        of([
          { id: 'p1', name: 'Sprint', type: 'service', active: true },
          { id: 'p2', name: 'Poster', type: 'physical', active: true },
          { id: 'p3', name: 'Retired', type: 'service', active: false },
        ])
      );

      await component.loadStoreProducts();

      expect(getOwnerProducts).toHaveBeenCalledWith('owner-user-1');
      expect(
        component.storeServiceProducts().map((product) => product.id)
      ).toEqual(['p1']);
      expect(component.storeProductsLoading()).toBe(false);
    });

    it('falls back to the public store catalog when there is no signed-in owner', async () => {
      authUser.set(null);
      const { component } = createComponent();
      getStoreProducts.mockReturnValue(
        of([{ id: 'p9', name: 'Public Sprint', type: 'service', active: true }])
      );

      await component.loadStoreProducts();

      expect(getOwnerProducts).not.toHaveBeenCalled();
      expect(
        component.storeServiceProducts().map((product) => product.id)
      ).toEqual(['p9']);
    });

    it('reports a store catalog failure', async () => {
      const { component } = createComponent();
      getOwnerProducts.mockReturnValue(
        throwError(() => ({ error: { message: 'Store unavailable.' } }))
      );

      await component.loadStoreProducts();

      expect(component.storeProductsError()).toBe('Store unavailable.');
      expect(component.storeProductsLoading()).toBe(false);
    });
  });
});
