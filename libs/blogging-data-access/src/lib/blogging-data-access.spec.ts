import {
  resolveBlogCatalogReference,
  resolvePublishedBlogCatalogId,
} from './blogging-data-access';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BlogPublicDataService } from './blog-public-data.service';

describe('Blogging data access', () => {
  it('accepts only the blog-catalog resource reference', () => {
    expect(
      resolveBlogCatalogReference({ type: 'blog-catalog', id: 'catalog-1' })
    ).toEqual('catalog-1');
    expect(
      resolveBlogCatalogReference({ type: 'store-catalog', id: 'catalog-1' })
    ).toBeUndefined();
  });

  it('resolves a catalog only for an enabled public blogging placement', () => {
    expect(
      resolvePublishedBlogCatalogId({
        enabled: true,
        placement: 'public-content',
        resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
      })
    ).toBe('catalog-1');

    expect(
      resolvePublishedBlogCatalogId({
        enabled: false,
        placement: 'public-content',
        resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
      })
    ).toBeUndefined();
    expect(
      resolvePublishedBlogCatalogId({
        enabled: true,
        placement: 'public-navigation',
        resourceRef: { type: 'blog-catalog', id: 'catalog-navigation' },
      })
    ).toBe('catalog-navigation');

    expect(
      resolvePublishedBlogCatalogId({
        enabled: true,
        placement: 'owner',
        resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
      })
    ).toBeUndefined();
    expect(
      resolvePublishedBlogCatalogId({
        enabled: true,
        placement: 'public-content',
        resourceRef: { type: 'store-catalog', id: 'catalog-1' },
      })
    ).toBeUndefined();
  });

  it('reads public posts through the domain endpoint without workspace transport', () => {
    TestBed.configureTestingModule({
      providers: [
        BlogPublicDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const service = TestBed.inject(BlogPublicDataService);
    const http = TestBed.inject(HttpTestingController);
    service.getPublishedPosts('North.Example.com').subscribe();

    const request = http.expectOne(
      '/api/blog/by-domain/north.example.com/posts'
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    expect(request.request.headers.keys()).toEqual([]);
    request.flush([]);
    http.verify();
  });

  it('rejects blank or untyped catalog references before making a request', () => {
    TestBed.configureTestingModule({
      providers: [
        BlogPublicDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const service = TestBed.inject(BlogPublicDataService);
    expect(() => service.getPublishedPosts(' ')).toThrow(
      'A valid public domain is required'
    );
  });
});
