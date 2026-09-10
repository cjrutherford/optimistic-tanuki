import { convertToParamMap } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import {
  BusinessApiService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
  type BusinessStoreProduct,
} from '@optimistic-tanuki/business-data-access';

import { BusinessProductDetailComponent } from './business-product-detail.component';

describe('BusinessProductDetailComponent', () => {
  const products: BusinessStoreProduct[] = [
    {
      id: 'product-1',
      name: 'Collector Print',
      description: 'Archival print release.',
      priceCents: 4800,
      type: 'physical',
      active: true,
      stock: 6,
      imageUrl: '/assets/collector-print.jpg',
    },
    {
      id: 'product-2',
      name: 'Inactive Product',
      description: 'Not public.',
      priceCents: 2000,
      type: 'digital',
      active: false,
      stock: 4,
    },
  ];

  function configure(
    siteSlug = 'steady-hand-contracting',
    productId = 'product-1',
    storeSite = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      serviceCatalog: { source: 'store' as const, catalogId: 'catalog-north' },
    },
    fetchedSite = storeSite
  ) {
    return TestBed.configureTestingModule({
      imports: [BusinessProductDetailComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                siteSlug,
                productId,
              }),
            },
            paramMap: of(convertToParamMap({ siteSlug, productId })),
          },
        },
        {
          provide: BusinessApiService,
          useValue: {
            getStoreProducts: jest.fn().mockReturnValue(of(products)),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => storeSite),
            fetch: jest.fn().mockReturnValue(of(fetchedSite)),
          },
        },
      ],
    });
  }

  it('renders the active product requested from the public route', async () => {
    TestBed.resetTestingModule();
    await configure().compileComponents();

    const fixture = TestBed.createComponent(BusinessProductDetailComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Collector Print');
    expect(text).toContain('Archival print release.');
    expect(text).toContain('$48.00');
  });

  it('queries only the catalog selected by the public site', async () => {
    TestBed.resetTestingModule();
    const module = configure();
    await module.compileComponents();
    const api = TestBed.inject(BusinessApiService) as unknown as {
      getStoreProducts: jest.Mock;
    };

    const fixture = TestBed.createComponent(BusinessProductDetailComponent);
    fixture.detectChanges();

    expect(api.getStoreProducts).toHaveBeenCalledWith('catalog-north');
  });

  it('hides inactive products from the public product detail page', async () => {
    TestBed.resetTestingModule();
    await configure('steady-hand-contracting', 'product-2').compileComponents();

    const fixture = TestBed.createComponent(BusinessProductDetailComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Inactive Product');
    expect(text).toContain('Product not available');
  });

  it('fetches the route tenant before loading products on a cold direct route', async () => {
    const warmedSite = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      serviceCatalog: { source: 'store' as const, catalogId: 'warmed-catalog' },
    };
    const tenantSite = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      serviceCatalog: { source: 'store' as const, catalogId: 'tenant-catalog' },
    };

    TestBed.resetTestingModule();
    const module = configure(
      'tenant-site',
      'product-1',
      warmedSite,
      tenantSite
    );
    await module.compileComponents();

    const fixture = TestBed.createComponent(BusinessProductDetailComponent);
    fixture.detectChanges();
    const api = TestBed.inject(BusinessApiService) as unknown as {
      getStoreProducts: jest.Mock;
    };
    const store = TestBed.inject(BusinessSiteConfigStore) as unknown as {
      fetch: jest.Mock;
    };

    expect(store.fetch).toHaveBeenCalledWith(false, 'tenant-site');
    expect(api.getStoreProducts).toHaveBeenCalledWith('tenant-catalog');
    expect(api.getStoreProducts).not.toHaveBeenCalledWith('warmed-catalog');
  });
});
