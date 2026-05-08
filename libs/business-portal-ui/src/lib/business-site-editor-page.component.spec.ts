import { signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessAuthService,
  DEFAULT_BUSINESS_SITE_CONFIG,
} from '@optimistic-tanuki/business-data-access';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

import { BusinessSiteEditorPageComponent } from './business-site-editor-page.component';

describe('BusinessSiteEditorPageComponent', () => {
  const getSiteConfig = jest.fn();
  const updateSiteConfig = jest.fn();
  const listAssets = jest.fn();
  const httpPost = jest.fn();
  const setTheme = jest.fn();
  const setPrimaryColor = jest.fn();
  const setPersonality = jest.fn().mockResolvedValue(undefined);
  const themeColors$ = of({
    background: '#ffffff',
    foreground: '#0f172a',
    accent: '#1f7a63',
  });

  function createComponent() {
    getSiteConfig.mockReturnValue(
      of({
        configId: 'config-1',
        config: JSON.parse(JSON.stringify(DEFAULT_BUSINESS_SITE_CONFIG)),
      })
    );
    updateSiteConfig.mockReturnValue(of({ id: 'config-1' }));
    listAssets.mockReturnValue(
      of([{ id: 'asset-1', name: 'Studio', type: 'image', profileId: 'profile-1', url: '/api/asset/asset-1' }])
    );
    httpPost.mockReturnValue(of({ id: 'uploaded-1' }));

    TestBed.configureTestingModule({
      imports: [BusinessSiteEditorPageComponent],
      providers: [
        {
          provide: BusinessApiService,
          useValue: {
            getSiteConfig,
            updateSiteConfig,
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
  });

  it('reorders landing sections with stable sequential order values', () => {
    const { component } = createComponent();

    component.moveSectionDown(0);
    component.moveSectionUp(2);

    expect(component.draft().landingPage.sections.map((section) => section.id)).toEqual([
      'about',
      'services',
      'hero',
      'testimonials',
      'contact',
      'booking',
    ]);
    expect(component.draft().landingPage.sections.map((section) => section.order)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
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
    const { fixture } = createComponent();

    const featureRow = fixture.nativeElement.querySelector('.feature-row');
    expect(featureRow).toBeTruthy();
    expect(featureRow.querySelectorAll('.toggle-card').length).toBeGreaterThan(1);
  });

  it('saves business type, portal capabilities, layout, and custom sections', () => {
    const { component } = createComponent();

    component.draft.update((draft) => {
      draft.businessType = 'consulting';
      draft.landingPage.layout = 'grid';
      draft.clientPortal.capabilities = ['Track billing', 'Review assigned work'];
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

  it('adds image and gallery sections with richer media and motion settings', () => {
    const { component } = createComponent();

    component.addImageSection();
    component.addGallerySection();

    const imageSection = component.draft().landingPage.sections.find((section) => section.type === 'image');
    const gallerySection = component.draft().landingPage.sections.find((section) => section.type === 'gallery');

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
      const imageSection = draft.landingPage.sections.find((section) => section.type === 'image')!;
      imageSection.title = 'Studio walkthrough';
      imageSection.image!.sourceType = 'asset';
      imageSection.image!.src = '/assets/business/studio.jpg';
      imageSection.image!.alt = 'Studio floor';
      imageSection.motion!.kind = 'signal-mesh';
      imageSection.motion!.density = 7;

      const gallerySection = draft.landingPage.sections.find((section) => section.type === 'gallery')!;
      gallerySection.gallery!.style = 'masonry';
      gallerySection.gallery!.items[0].src = 'https://cdn.example.com/proof-1.jpg';
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
    component.toggleAssetPicker(component.draft().landingPage.sections.length - 1);
    await Promise.resolve();

    expect(listAssets).toHaveBeenCalledWith('profile-1');

    component.selectAsset(
      component.draft().landingPage.sections.length - 1,
      null,
      { id: 'asset-1', name: 'Studio', type: 'image', profileId: 'profile-1', url: '/api/asset/asset-1' }
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
    expect(component.draft().landingPage.sections[sectionIndex].gallery?.items[0]).toEqual(
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

    expect(component.draft().landingPage.sections.map((section) => section.id)).toEqual([
      'hero',
      'about',
      'services',
      'testimonials',
      'contact',
      'booking',
    ]);
    expect(component.draft().landingPage.sections.every((section) => section.enabled)).toBe(true);
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

  it('moves a section into a split canvas zone and persists that placement', () => {
    const { component } = createComponent();

    component.moveSectionToLayoutZone('contact', 'split', 'primary');

    expect(
      component.draft().landingPage.sections.find((section) => section.id === 'contact')
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
    expect(host.querySelector('[data-drop-zone="split:secondary"]')).toBeTruthy();

    component.setLandingLayout('grid');
    fixture.detectChanges();
    expect(host.querySelector('[data-drop-zone="grid:hero-wide"]')).toBeTruthy();
    expect(host.querySelector('[data-drop-zone="grid:bottom-right"]')).toBeTruthy();
  });
});
