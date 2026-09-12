import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import {
  BusinessApiService,
  BusinessSiteConfigStore,
  DEFAULT_BUSINESS_SITE_CONFIG,
  type BusinessSiteConfig,
} from '@optimistic-tanuki/business-data-access';

import { BusinessBlogPageComponent } from './business-blog-page.component';

describe('BusinessBlogPageComponent', () => {
  async function render(
    config: BusinessSiteConfig,
    storeSite: BusinessSiteConfig = config,
    siteSlug?: string,
    blogPosts$ = of([
      {
        id: 'post-1',
        name: 'Catalog-only update',
        description: 'Visible through the published catalog only.',
      },
    ])
  ) {
    const getBlogPosts = jest.fn().mockReturnValue(blogPosts$);

    await TestBed.configureTestingModule({
      imports: [BusinessBlogPageComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(siteSlug ? { siteSlug } : {}),
            },
            paramMap: of(convertToParamMap(siteSlug ? { siteSlug } : {})),
          },
        },
        {
          provide: BusinessSiteConfigStore,
          useValue: {
            site: jest.fn(() => storeSite),
            fetch: jest.fn().mockReturnValue(of(config)),
          },
        },
        {
          provide: BusinessApiService,
          useValue: { getBlogPosts },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(BusinessBlogPageComponent);
    fixture.detectChanges();
    return { fixture, getBlogPosts };
  }

  it('renders only the catalog selected by the published capability', async () => {
    const { fixture, getBlogPosts } = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      plugins: {
        schemaVersion: 1,
        surfaceType: 'business-site',
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'public-content',
            resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
          },
        },
      },
    });

    expect(fixture.nativeElement.textContent).toContain('Catalog-only update');
    expect(getBlogPosts).toHaveBeenCalledWith('catalog-1');
    expect(
      fixture.nativeElement.querySelector('ot-blogging-business-site-runtime')
    ).toBeNull();
    expect(fixture.nativeElement.querySelector('.blog-runtime')).not.toBeNull();
  });

  it('does not expose Blog content when the capability is not publicly published', async () => {
    const { fixture, getBlogPosts } = await render({
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      plugins: {
        schemaVersion: 1,
        surfaceType: 'business-site',
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'owner',
            resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
          },
        },
      },
    });

    expect(fixture.nativeElement.textContent).toContain(
      'This blog is not available.'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'Catalog-only update'
    );
    expect(getBlogPosts).not.toHaveBeenCalled();
  });

  it('keeps the published Blog empty state when its post request fails', async () => {
    const { fixture, getBlogPosts } = await render(
      {
        ...DEFAULT_BUSINESS_SITE_CONFIG,
        plugins: {
          schemaVersion: 1,
          surfaceType: 'business-site',
          capabilities: {
            'blogging.posts': {
              enabled: true,
              placement: 'public-content',
              resourceRef: { type: 'blog-catalog', id: 'catalog-1' },
            },
          },
        },
      },
      undefined,
      undefined,
      throwError(() => new Error('Blog service unavailable'))
    );

    expect(getBlogPosts).toHaveBeenCalledWith('catalog-1');
    expect(fixture.nativeElement.textContent).toContain(
      'No posts are live in this catalog yet.'
    );
  });

  it('fetches the route tenant before loading Blog on a cold direct route', async () => {
    const warmedSite = {
      ...DEFAULT_BUSINESS_SITE_CONFIG,
      plugins: {
        ...DEFAULT_BUSINESS_SITE_CONFIG.plugins,
        capabilities: {
          'blogging.posts': {
            enabled: true,
            placement: 'public-content' as const,
            resourceRef: {
              type: 'blog-catalog' as const,
              id: 'warmed-catalog',
            },
          },
        },
      },
    };
    const tenantSite = {
      ...warmedSite,
      plugins: {
        ...warmedSite.plugins,
        capabilities: {
          'blogging.posts': {
            ...warmedSite.plugins.capabilities['blogging.posts'],
            resourceRef: {
              type: 'blog-catalog' as const,
              id: 'tenant-catalog',
            },
          },
        },
      },
    };
    const { getBlogPosts } = await render(
      tenantSite,
      warmedSite,
      'tenant-site'
    );

    expect(TestBed.inject(BusinessSiteConfigStore).fetch).toHaveBeenCalledWith(
      false,
      'tenant-site'
    );
    expect(getBlogPosts).toHaveBeenCalledWith('tenant-catalog');
    expect(getBlogPosts).not.toHaveBeenCalledWith('warmed-catalog');
  });
});
