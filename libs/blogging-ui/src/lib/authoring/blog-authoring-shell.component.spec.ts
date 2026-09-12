import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import {
  BlogAuthoringCatalog,
  BlogAuthoringDataService,
  BlogAuthoringPost,
} from '@optimistic-tanuki/blogging-data-access';
import { BlogAuthoringShellComponent } from './blog-authoring-shell.component';

describe('BlogAuthoringShellComponent', () => {
  let fixture: ComponentFixture<BlogAuthoringShellComponent>;
  let dataAccess: jest.Mocked<BlogAuthoringDataService>;

  beforeEach(async () => {
    dataAccess = {
      listCatalogs: jest.fn().mockReturnValue(of([])),
      createCatalog: jest.fn().mockReturnValue(of({})),
      listPosts: jest.fn().mockReturnValue(of([])),
      createPost: jest.fn().mockReturnValue(of({})),
      publishPost: jest.fn().mockReturnValue(of({})),
    } as unknown as jest.Mocked<BlogAuthoringDataService>;
    await TestBed.configureTestingModule({
      imports: [BlogAuthoringShellComponent],
      providers: [{ provide: BlogAuthoringDataService, useValue: dataAccess }],
    }).compileComponents();
    fixture = TestBed.createComponent(BlogAuthoringShellComponent);
  });

  it('renders a denied state without receiving authorization authority', () => {
    fixture.componentRef.setInput('workspaceId', 'workspace-north-star');
    fixture.componentRef.setInput('state', 'denied');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('not available');
    expect(
      fixture.nativeElement.querySelector('[data-authoring-denied]')
    ).toBeTruthy();
  });

  it('loads workspace catalogs and posts into a selectable authoring surface', () => {
    const catalogs: BlogAuthoringCatalog[] = [
      { id: 'catalog-1', name: 'Insights', description: 'Owner notes' },
    ];
    const posts: BlogAuthoringPost[] = [
      {
        id: 'post-1',
        title: 'First note',
        content: '<p>Content</p>',
        authorId: 'author-1',
        isDraft: true,
      },
    ];
    dataAccess.listCatalogs.mockReturnValue(of(catalogs));
    dataAccess.listPosts.mockReturnValue(of(posts));

    fixture.componentRef.setInput('workspaceId', 'workspace-1');
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.componentRef.setInput('appScope', 'configurable-client');
    fixture.componentRef.setInput('state', 'ready');
    fixture.detectChanges();

    expect(dataAccess.listCatalogs).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      workspaceSlug: 'north-star',
      appScope: 'configurable-client',
    });
    expect(dataAccess.listPosts).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        workspaceSlug: 'north-star',
        appScope: 'configurable-client',
      },
      'catalog-1'
    );
    expect(fixture.nativeElement.textContent).toContain('Insights');
    expect(fixture.nativeElement.textContent).toContain('First note');
    expect(
      fixture.nativeElement.querySelector('[data-blog-authoring-ready]')
    ).toBeTruthy();
  });

  it('creates a draft and publishes it from the selected workspace', () => {
    dataAccess.listCatalogs.mockReturnValue(
      of([{ id: 'catalog-1', name: 'Insights' }])
    );
    dataAccess.listPosts.mockReturnValue(of([]));
    dataAccess.createPost.mockReturnValue(
      of({
        id: 'post-2',
        title: 'New note',
        content: '<p>Long enough content.</p>',
        authorId: 'author-1',
        isDraft: true,
      })
    );
    dataAccess.publishPost.mockReturnValue(
      of({
        id: 'post-2',
        title: 'New note',
        content: '<p>Long enough content.</p>',
        authorId: 'author-1',
        isDraft: false,
      })
    );

    fixture.componentRef.setInput('workspaceId', 'workspace-1');
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.componentRef.setInput('appScope', 'business-site');
    fixture.componentRef.setInput('state', 'ready');
    fixture.detectChanges();

    fixture.componentInstance.authorId = 'author-1';
    fixture.componentInstance.postTitle = 'New note';
    fixture.componentInstance.postContent = '<p>Long enough content.</p>';
    fixture.detectChanges();

    fixture.componentInstance.createPost(new Event('submit'));
    fixture.detectChanges();

    expect(dataAccess.createPost).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        workspaceSlug: 'north-star',
        appScope: 'business-site',
      },
      {
        title: 'New note',
        content: '<p>Long enough content.</p>',
        authorId: 'author-1',
        selectedCatalogId: 'catalog-1',
        isDraft: true,
      }
    );

    fixture.componentInstance.publishPost({
      id: 'post-2',
      title: 'New note',
      content: '<p>Long enough content.</p>',
      authorId: 'author-1',
      isDraft: true,
    });
    expect(dataAccess.publishPost).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        workspaceSlug: 'north-star',
        appScope: 'business-site',
      },
      'post-2'
    );
  });

  it('ignores catalog responses from a previous workspace context', () => {
    const oldCatalogs = new Subject<BlogAuthoringCatalog[]>();
    const currentCatalogs = new Subject<BlogAuthoringCatalog[]>();
    dataAccess.listCatalogs
      .mockReturnValueOnce(oldCatalogs.asObservable())
      .mockReturnValueOnce(currentCatalogs.asObservable());

    fixture.componentRef.setInput('workspaceId', 'workspace-1');
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.componentRef.setInput('appScope', 'business-site');
    fixture.componentRef.setInput('state', 'ready');
    fixture.detectChanges();

    fixture.componentRef.setInput('workspaceSlug', 'south-star');
    fixture.detectChanges();

    oldCatalogs.next([{ id: 'old', name: 'Old workspace' }]);
    expect(fixture.componentInstance.catalogs).toEqual([]);

    currentCatalogs.next([{ id: 'current', name: 'Current workspace' }]);
    expect(fixture.componentInstance.catalogs).toEqual([
      { id: 'current', name: 'Current workspace' },
    ]);
  });

  it('stops all in-flight authoring subscriptions when destroyed', () => {
    const catalogs = new Subject<BlogAuthoringCatalog[]>();
    const posts = new Subject<BlogAuthoringPost[]>();
    const createdCatalog = new Subject<BlogAuthoringCatalog>();
    const createdPost = new Subject<BlogAuthoringPost>();
    const publishedPost = new Subject<BlogAuthoringPost>();
    dataAccess.listCatalogs.mockReturnValue(catalogs.asObservable());
    dataAccess.listPosts.mockReturnValue(posts.asObservable());
    dataAccess.createCatalog.mockReturnValue(createdCatalog.asObservable());
    dataAccess.createPost.mockReturnValue(createdPost.asObservable());
    dataAccess.publishPost.mockReturnValue(publishedPost.asObservable());

    fixture.componentRef.setInput('workspaceId', 'workspace-1');
    fixture.componentRef.setInput('workspaceSlug', 'north-star');
    fixture.componentRef.setInput('appScope', 'business-site');
    fixture.componentRef.setInput('state', 'ready');
    fixture.detectChanges();
    fixture.componentInstance.catalogName = 'New catalog';
    fixture.componentInstance.authorId = 'author-1';
    fixture.componentInstance.postTitle = 'New note';
    fixture.componentInstance.postContent = '<p>Content</p>';
    fixture.componentInstance.createCatalog(new Event('submit'));
    fixture.componentInstance.createPost(new Event('submit'));
    fixture.componentInstance.publishPost({
      id: 'post-1',
      title: 'Existing note',
      content: '<p>Content</p>',
      authorId: 'author-1',
      isDraft: true,
    });

    fixture.destroy();
    catalogs.next([{ id: 'catalog-1', name: 'Catalog' }]);
    posts.next([
      {
        id: 'post-1',
        title: 'Post',
        content: '<p>Post</p>',
        authorId: 'author-1',
        isDraft: true,
      },
    ]);
    createdCatalog.next({ id: 'catalog-2', name: 'Created catalog' });
    createdPost.next({
      id: 'post-2',
      title: 'Created post',
      content: '<p>Post</p>',
      authorId: 'author-1',
      isDraft: true,
    });
    publishedPost.next({
      id: 'post-1',
      title: 'Published',
      content: '<p>Post</p>',
      authorId: 'author-1',
      isDraft: false,
    });

    expect(catalogs.observers).toHaveLength(0);
    expect(posts.observers).toHaveLength(0);
    expect(createdCatalog.observers).toHaveLength(0);
    expect(createdPost.observers).toHaveLength(0);
    expect(publishedPost.observers).toHaveLength(0);
  });
});
