import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  StoreAuthoringDataService,
  StoreCatalog,
  StoreProduct,
} from './store-authoring-data.service';

describe('StoreAuthoringDataService', () => {
  const workspace = {
    workspaceId: 'workspace-1',
    workspaceSlug: 'north-star',
  };
  let service: StoreAuthoringDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        StoreAuthoringDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(StoreAuthoringDataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads catalogs with the required workspace scope', () => {
    const catalogs: StoreCatalog[] = [];

    service.listCatalogs(workspace).subscribe((result) => {
      expect(result).toEqual(catalogs);
    });

    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/store/catalogs/mine' &&
        candidate.params.get('workspaceSlug') === 'north-star'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('x-ot-appscope')).toBe('business-site');
    expect(request.request.headers.get('x-ot-workspace-id')).toBe(
      'workspace-1'
    );
    request.flush(catalogs);
  });

  it('creates catalogs and products with the workspace scope', () => {
    service.createCatalog(workspace, { name: 'Guides' }).subscribe();
    const catalogRequest = http.expectOne(
      (candidate) => candidate.url === '/api/store/catalogs'
    );
    expect(catalogRequest.request.params.get('workspaceSlug')).toBe(
      'north-star'
    );
    expect(catalogRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    catalogRequest.flush({ id: 'catalog-1', name: 'Guides' });

    service
      .createProduct(workspace, {
        name: 'Guide',
        priceCents: 1200,
        type: 'digital',
        catalogId: 'catalog-1',
      })
      .subscribe();
    const productRequest = http.expectOne(
      (candidate) => candidate.url === '/api/store/products'
    );
    expect(productRequest.request.params.get('workspaceSlug')).toBe(
      'north-star'
    );
    expect(productRequest.request.headers.get('x-ot-appscope')).toBe(
      'business-site'
    );
    expect(productRequest.request.body).toEqual(
      expect.objectContaining({ catalogId: 'catalog-1' })
    );
    productRequest.flush({ id: 'product-1' });
  });

  it('loads products through the selected catalog after requiring workspace scope', () => {
    const products: StoreProduct[] = [];

    service.listProducts(workspace, 'catalog-1').subscribe((result) => {
      expect(result).toEqual(products);
    });

    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/store/products' &&
        candidate.params.get('catalogId') === 'catalog-1' &&
        candidate.params.get('workspaceSlug') === 'north-star'
    );
    expect(request.request.headers.get('x-ot-appscope')).toBe('business-site');
    request.flush(products);
  });

  it('rejects missing workspace scope before making a request', () => {
    expect(() =>
      service.listCatalogs({ ...workspace, workspaceId: '  ' })
    ).toThrow('A workspaceId is required for Store authoring');
  });

  it('rejects a missing workspace slug without falling back to the canonical id', () => {
    expect(() =>
      service.listCatalogs({ ...workspace, workspaceSlug: ' ' })
    ).toThrow('A workspaceSlug is required for Store authoring');
  });
});
