import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { BlogCatalogService } from './blog-catalog.service';

describe('BlogCatalogService', () => {
  let service: BlogCatalogService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BlogCatalogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads only Blog catalogs resolved for the requested workspace', () => {
    service.getMyCatalogs('north-site').subscribe();

    const request = httpMock.expectOne(
      '/api/blog/catalogs/mine?workspaceSlug=north-site'
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});
