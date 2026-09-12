import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  BLOGGING_API_BASE_URL,
  BlogAuthoringDataService,
  CreateBlogAuthoringPost,
  BlogAuthoringWorkspace,
} from './blog-authoring-data.service';

describe('BlogAuthoringDataService', () => {
  let service: BlogAuthoringDataService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BlogAuthoringDataService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BLOGGING_API_BASE_URL, useValue: '/api' },
      ],
    });
    service = TestBed.inject(BlogAuthoringDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requires a workspace ID before listing catalogs', () => {
    expect(() =>
      service.listCatalogs({
        workspaceId: '',
        workspaceSlug: 'north-star',
        appScope: 'business-site',
      })
    ).toThrow('Blog authoring requires a workspaceId');
  });

  it('requires a workspace slug and never substitutes the workspace ID', () => {
    const workspace: BlogAuthoringWorkspace = {
      workspaceId: 'workspace-1',
      workspaceSlug: '',
      appScope: 'business-site',
    };

    expect(() => service.listCatalogs(workspace)).toThrow(
      'Blog authoring requires a workspaceSlug'
    );
  });

  it('requires an app scope from the resolved workspace context', () => {
    expect(() =>
      service.listCatalogs({
        workspaceId: 'workspace-1',
        workspaceSlug: 'north-star',
        appScope: '',
      })
    ).toThrow('Blog authoring requires an appScope');
  });

  it('rejects app scopes that are not supported by the authoring contract', () => {
    expect(() =>
      service.listCatalogs({
        workspaceId: 'workspace-1',
        workspaceSlug: 'north-star',
        appScope: 'unknown-app',
      })
    ).toThrow('Blog authoring does not support appScope unknown-app');
  });

  it.each([
    ['community', 'configurable-client'],
    ['business-site', 'business-site'],
  ])(
    'lists catalogs for a %s resolved workspace using its app scope',
    (_kind, appScope) => {
      service
        .listCatalogs({
          workspaceId: 'workspace-1',
          workspaceSlug: 'north-star',
          appScope,
        })
        .subscribe();

      const request = httpMock.expectOne(
        '/api/blog/catalogs/mine?workspaceSlug=north-star'
      );
      expect(request.request.method).toBe('GET');
      expect(request.request.headers.get('x-ot-appscope')).toBe(appScope);
      expect(request.request.headers.get('X-ot-workspace-id')).toBe(
        'workspace-1'
      );
      request.flush([]);
    }
  );

  it.each([
    ['community', 'configurable-client'],
    ['business-site', 'business-site'],
  ])(
    'creates a catalog using the %s resolved workspace app scope',
    (_kind, appScope) => {
      service
        .createCatalog(
          { workspaceId: 'workspace-1', workspaceSlug: 'north-star', appScope },
          'Insights',
          'Owner notes'
        )
        .subscribe();

      const request = httpMock.expectOne(
        '/api/blog/catalogs?workspaceSlug=north-star'
      );
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('x-ot-appscope')).toBe(appScope);
      expect(request.request.headers.get('X-ot-workspace-id')).toBe(
        'workspace-1'
      );
      expect(request.request.body).toEqual({
        name: 'Insights',
        description: 'Owner notes',
      });
      request.flush({ id: 'catalog-1', name: 'Insights' });
    }
  );

  it('creates a draft post with the API-required author ID', () => {
    const post: CreateBlogAuthoringPost = {
      title: 'A useful note',
      content: '<p>Long enough content.</p>',
      authorId: 'author-1',
      selectedCatalogId: 'catalog-1',
    };
    service
      .createPost(
        {
          workspaceId: 'workspace-1',
          workspaceSlug: 'north-star',
          appScope: 'business-site',
        },
        post
      )
      .subscribe();

    const request = httpMock.expectOne('/api/post?workspaceSlug=north-star');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-ot-appscope')).toBe('business-site');
    expect(request.request.headers.get('X-ot-workspace-id')).toBe(
      'workspace-1'
    );
    expect(request.request.body).toEqual({ ...post, isDraft: true });
    request.flush({ id: 'post-1', ...post, isDraft: true });
  });

  it('lists posts with the same workspace selector and app scope', () => {
    service
      .listPosts(
        {
          workspaceId: 'workspace-1',
          workspaceSlug: 'north-star',
          appScope: 'configurable-client',
        },
        'catalog-1'
      )
      .subscribe();

    const request = httpMock.expectOne(
      '/api/blog/catalogs/catalog-1/posts?workspaceSlug=north-star'
    );
    expect(request.request.headers.get('x-ot-appscope')).toBe(
      'configurable-client'
    );
    expect(request.request.headers.get('X-ot-workspace-id')).toBe(
      'workspace-1'
    );
    request.flush([]);
  });

  it('publishes a post while retaining workspace context', () => {
    service
      .publishPost(
        {
          workspaceId: 'workspace-1',
          workspaceSlug: 'north-star',
          appScope: 'business-site',
        },
        'post-1'
      )
      .subscribe();

    const request = httpMock.expectOne(
      '/api/post/post-1/publish?workspaceSlug=north-star'
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('x-ot-appscope')).toBe('business-site');
    expect(request.request.headers.get('X-ot-workspace-id')).toBe(
      'workspace-1'
    );
    request.flush({ id: 'post-1', isDraft: false });
  });
});
