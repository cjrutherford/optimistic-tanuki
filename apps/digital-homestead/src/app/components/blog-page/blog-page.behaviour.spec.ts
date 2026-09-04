import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { API_BASE_URL, BlogPostDto } from '@optimistic-tanuki/ui-models';
import { ComponentPersistenceService } from '@optimistic-tanuki/blogging-ui';
import { BlogPageComponent } from './blog-page.component';
import { BlogService } from '../../blog.service';
import { AuthStateService } from '../../auth-state.service';
import { PermissionService } from '../../permission.service';

/**
 * The spec beside this one covers initialisation and post selection. These
 * drive the save paths -- which of create/update/publish a save resolves to
 * depends on mode, the selected post and the pending action -- plus the
 * permission gates that guard them and the auto-save debounce.
 */
describe('BlogPageComponent behaviour', () => {
  let component: BlogPageComponent;
  let fixture: ComponentFixture<BlogPageComponent>;
  let router: Router;

  interface BlogMock {
    getAllPosts: jest.Mock;
    getPost: jest.Mock;
    createPost: jest.Mock;
    updatePost: jest.Mock;
    publishPost: jest.Mock;
    publishDraft: jest.Mock;
  }
  interface PersistenceMock {
    getComponentsForPost: jest.Mock;
    extractComponentsFromContent: jest.Mock;
    saveComponents: jest.Mock;
  }

  let blog: BlogMock;
  let persistence: PersistenceMock;
  let authenticated$: BehaviorSubject<boolean>;
  let profileId: string | null;
  let fullAccess$: BehaviorSubject<boolean>;
  // currentPostId is derived from the route, not from selectedPost, so the
  // save and auto-save paths only engage when a post id is actually routed to.
  let routeParams$: BehaviorSubject<Record<string, string>>;

  const post = (overrides: Partial<BlogPostDto> = {}): BlogPostDto =>
    ({
      id: '1',
      title: 'Post 1',
      content: 'Content 1',
      authorId: 'author-1',
      isDraft: false,
      publishedAt: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      ...overrides,
    } as BlogPostDto);

  const editorData = (overrides: Record<string, unknown> = {}) =>
    ({
      title: 'A title',
      content: '<p>Body</p>',
      links: [],
      attachments: [],
      ...overrides,
    } as never);

  const build = async () => {
    await TestBed.configureTestingModule({
      imports: [BlogPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BlogService, useValue: blog },
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated$: () => authenticated$.asObservable(),
            getProfileId: () => profileId,
          },
        },
        {
          provide: PermissionService,
          useValue: {
            hasFullAccess$: () => fullAccess$.asObservable(),
            permissionsLoaded$: () => of(true),
          },
        },
        { provide: ComponentPersistenceService, useValue: persistence },
        {
          provide: ActivatedRoute,
          useValue: { params: routeParams$.asObservable() },
        },
        { provide: API_BASE_URL, useValue: '/api' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    authenticated$ = new BehaviorSubject<boolean>(true);
    fullAccess$ = new BehaviorSubject<boolean>(true);
    routeParams$ = new BehaviorSubject<Record<string, string>>({});
    profileId = 'author-1';

    blog = {
      getAllPosts: jest.fn().mockReturnValue(of([post()])),
      getPost: jest.fn().mockReturnValue(of(post())),
      createPost: jest.fn().mockReturnValue(of(post({ id: 'new-id' }))),
      updatePost: jest.fn().mockReturnValue(of(post())),
      publishPost: jest
        .fn()
        .mockReturnValue(of(post({ isDraft: false, publishedAt: new Date() }))),
      publishDraft: jest.fn().mockReturnValue(of(post({ isDraft: false }))),
    };

    persistence = {
      getComponentsForPost: jest.fn().mockReturnValue(of([])),
      extractComponentsFromContent: jest.fn().mockReturnValue([]),
      saveComponents: jest.fn().mockReturnValue(of({})),
    };

    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await build();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fixture.destroy();
  });

  describe('loadAllPosts', () => {
    it('reports a load failure and stops the spinner', () => {
      blog.getAllPosts.mockReturnValue(throwError(() => new Error('offline')));

      component.loadAllPosts();

      expect(component.error()).toBe('Failed to load posts: offline');
      expect(component.loading()).toBe(false);
    });
  });

  describe('loadPost', () => {
    it('maps stored components into the editor payload', fakeAsync(() => {
      persistence.getComponentsForPost.mockReturnValue(
        of([
          {
            instanceId: 'a-1',
            componentType: 'callout',
            componentData: { title: 'Kept' },
          },
        ])
      );

      component.loadPost('1');
      tick();

      const injected = component.editorData().injectedComponents as unknown[];
      expect(injected).toHaveLength(1);
      expect(injected[0]).toMatchObject({
        instanceId: 'a-1',
        data: { title: 'Kept' },
        componentDef: { id: 'callout' },
      });
    }));

    it('reports a failure from either request', fakeAsync(() => {
      blog.getPost.mockReturnValue(throwError(() => new Error('gone')));

      component.loadPost('1');
      tick();

      expect(component.error()).toBe('Failed to load post: gone');
      expect(component.loading()).toBe(false);
    }));
  });

  describe('selectPost', () => {
    it('refuses to open a draft for a signed-out reader', () => {
      const navigate = jest.spyOn(router, 'navigate');
      authenticated$.next(false);
      fixture.detectChanges();

      component.selectPost(post({ isDraft: true }));

      expect(component.error()).toBe(
        'You must be signed in to view draft posts.'
      );
      expect(navigate).not.toHaveBeenCalled();
    });

    it('opens a draft for a signed-in reader', () => {
      const navigate = jest.spyOn(router, 'navigate');

      component.selectPost(post({ id: '9', isDraft: true }));

      expect(navigate).toHaveBeenCalledWith(['/blog', '9']);
    });
  });

  describe('startCreatePost', () => {
    it('refuses without edit permission', () => {
      fullAccess$.next(false);
      fixture.detectChanges();

      component.startCreatePost();

      expect(component.error()).toBe(
        'You do not have permission to create blog posts.'
      );
      expect(blog.createPost).not.toHaveBeenCalled();
    });

    it('refuses without a profile id', () => {
      profileId = null;

      component.startCreatePost();

      expect(component.error()).toBe(
        'You must be logged in to create blog posts.'
      );
      expect(blog.createPost).not.toHaveBeenCalled();
    });

    it('creates an untitled draft, switches to edit and navigates', () => {
      const navigate = jest.spyOn(router, 'navigate');

      component.startCreatePost();

      expect(blog.createPost).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Untitled Draft',
          authorId: 'author-1',
          isDraft: true,
        })
      );
      expect(component.mode()).toBe('edit');
      expect(component.selectedPost()?.id).toBe('new-id');
      expect(navigate).toHaveBeenCalledWith(['/blog', 'new-id']);
      expect(component.loading()).toBe(false);
    });

    it('puts the new draft at the top of the list', () => {
      const before = component.posts().length;

      component.startCreatePost();

      expect(component.posts().length).toBe(before + 1);
    });

    it('reports a creation failure', () => {
      blog.createPost.mockReturnValue(throwError(() => new Error('rejected')));

      component.startCreatePost();

      expect(component.error()).toBe('Failed to create draft post: rejected');
      expect(component.mode()).not.toBe('edit');
    });
  });

  describe('editPost', () => {
    it('loads the post into the editor and switches mode', () => {
      component.editPost(
        post({
          title: 'Editing',
          content: '<p>Old</p>',
          links: [{ url: 'u' }],
        } as never)
      );

      expect(component.mode()).toBe('edit');
      expect(component.editorData()).toMatchObject({
        title: 'Editing',
        content: '<p>Old</p>',
        links: [{ url: 'u' }],
      });
    });

    it('defaults links to empty when the post has none', () => {
      component.editPost(post({ links: undefined } as never));

      expect(component.editorData().links).toEqual([]);
    });
  });

  describe('savePost', () => {
    it('refuses without a profile id', () => {
      profileId = null;

      component.savePost('draft');

      expect(component.error()).toBe(
        'Unable to save post: User not authenticated.'
      );
      expect(blog.updatePost).not.toHaveBeenCalled();
    });

    it('publishes an existing draft through publishDraft', () => {
      component.selectedPost.set(post({ id: '7' }));

      component.savePost('publish');

      expect(blog.publishDraft).toHaveBeenCalledWith('7');
      expect(component.mode()).toBe('view');
    });

    it('updates an existing post when the action is draft', () => {
      component.selectedPost.set(post({ id: '7' }));
      component.editorData.set(editorData({ title: 'Revised' }));

      component.savePost('draft');

      expect(blog.updatePost).toHaveBeenCalledWith(
        '7',
        expect.objectContaining({
          id: '7',
          title: 'Revised',
          authorId: 'author-1',
          isDraft: true,
        })
      );
      expect(component.mode()).toBe('view');
    });

    it('creates when nothing is selected', () => {
      component.selectedPost.set(null);
      component.editorData.set(editorData({ title: 'Brand new' }));

      component.savePost('publish');

      expect(blog.createPost).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Brand new', isDraft: false })
      );
    });

    it('reports each failure with its own message', () => {
      component.selectedPost.set(post({ id: '7' }));
      blog.publishDraft.mockReturnValue(throwError(() => new Error('nope')));
      component.savePost('publish');
      expect(component.error()).toBe('Failed to publish post: nope');

      blog.updatePost.mockReturnValue(throwError(() => new Error('nope')));
      component.savePost('draft');
      expect(component.error()).toBe('Failed to update post: nope');

      component.selectedPost.set(null);
      blog.createPost.mockReturnValue(throwError(() => new Error('nope')));
      component.savePost('draft');
      expect(component.error()).toBe('Failed to save post: nope');
    });
  });

  describe('cancelEdit', () => {
    it('reloads the post it was editing', () => {
      routeParams$.next({ id: '1' });
      const load = jest.spyOn(component, 'loadPost');

      component.cancelEdit();

      expect(component.mode()).toBe('view');
      expect(load).toHaveBeenCalledWith('1');
    });

    it('returns to the index when there was no post', () => {
      const navigate = jest.spyOn(router, 'navigate');
      routeParams$.next({});

      component.cancelEdit();

      expect(navigate).toHaveBeenCalledWith(['/blog']);
    });
  });

  describe('save buttons', () => {
    it('record the pending action and submit the editor', () => {
      const submit = jest.fn();
      (component as unknown as { blogCompose: unknown }).blogCompose = {
        onPostSubmit: submit,
      };

      component.saveAsDraft();
      expect(component.pendingSaveAction()).toBe('draft');
      expect(submit).toHaveBeenCalledTimes(1);

      component.publishPost();
      expect(component.pendingSaveAction()).toBe('publish');
      expect(submit).toHaveBeenCalledTimes(2);
    });

    it('still record the action when no editor is mounted', () => {
      (component as unknown as { blogCompose: unknown }).blogCompose =
        undefined;

      expect(() => component.publishPost()).not.toThrow();
      expect(component.pendingSaveAction()).toBe('publish');
    });
  });

  describe('publishDraft', () => {
    it('refuses when nothing is selected', () => {
      component.selectedPost.set(null);

      component.publishDraft();

      expect(component.error()).toBe('No post selected to publish.');
      expect(blog.publishPost).not.toHaveBeenCalled();
    });

    it('refuses to publish someone else’s post', () => {
      component.selectedPost.set(post({ id: '7', authorId: 'someone-else' }));

      component.publishDraft();

      expect(component.error()).toBe('You can only publish your own posts.');
      expect(blog.publishPost).not.toHaveBeenCalled();
    });

    it('publishes and swaps the post in the list', () => {
      component.selectedPost.set(post({ id: '1', authorId: 'author-1' }));
      blog.publishPost.mockReturnValue(
        of(post({ id: '1', title: 'Published now', isDraft: false }))
      );

      component.publishDraft();

      expect(blog.publishPost).toHaveBeenCalledWith('1');
      expect(component.selectedPost()?.title).toBe('Published now');
      expect(component.posts().find((p) => p.id === '1')?.title).toBe(
        'Published now'
      );
      expect(component.loading()).toBe(false);
    });

    it('reports a publish failure', () => {
      component.selectedPost.set(post({ id: '1', authorId: 'author-1' }));
      blog.publishPost.mockReturnValue(throwError(() => new Error('locked')));

      component.publishDraft();

      expect(component.error()).toBe('Failed to publish post: locked');
      expect(component.loading()).toBe(false);
    });
  });

  describe('onPostSubmitted', () => {
    it('refuses without edit permission', () => {
      fullAccess$.next(false);
      fixture.detectChanges();

      component.onPostSubmitted(editorData());

      expect(component.error()).toBe(
        'You do not have permission to create or edit blog posts.'
      );
      expect(blog.createPost).not.toHaveBeenCalled();
    });

    it('refuses without a profile id', () => {
      profileId = null;

      component.onPostSubmitted(editorData());

      expect(component.error()).toBe(
        'You must be logged in to create or edit blog posts.'
      );
      expect(blog.createPost).not.toHaveBeenCalled();
    });

    it('creates directly when the post carries no components', () => {
      component.selectedPost.set(null);
      component.mode.set('create');

      component.onPostSubmitted(editorData({ title: 'Plain post' }));

      expect(blog.createPost).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Plain post' })
      );
    });
  });

  describe('auto-save', () => {
    it('ignores editor changes while viewing', fakeAsync(() => {
      component.mode.set('view');

      component.onEditorChange(editorData({ content: 'x' }));
      tick(1500);

      expect(persistence.saveComponents).not.toHaveBeenCalled();
    }));

    it('saves components after the debounce settles', fakeAsync(() => {
      component.mode.set('edit');
      routeParams$.next({ id: '1' });
      component.selectedPost.set(post({ id: '1', authorId: 'author-1' }));
      persistence.extractComponentsFromContent.mockReturnValue([
        { instanceId: 'a-1' },
      ]);

      component.onEditorChange(
        editorData({ content: '<div data-angular-component></div>' })
      );
      tick(1500);

      expect(persistence.saveComponents).toHaveBeenCalledWith('1', [
        { instanceId: 'a-1' },
      ]);
    }));

    it('debounces a burst into a single save', fakeAsync(() => {
      component.mode.set('edit');
      routeParams$.next({ id: '1' });
      component.selectedPost.set(post({ id: '1', authorId: 'author-1' }));
      persistence.extractComponentsFromContent.mockReturnValue([
        { instanceId: 'a-1' },
      ]);
      const content = '<div data-angular-component></div>';

      component.onEditorChange(editorData({ content }));
      tick(200);
      component.onEditorChange(editorData({ content }));
      tick(200);
      component.onEditorChange(editorData({ content }));
      tick(1500);

      expect(persistence.saveComponents).toHaveBeenCalledTimes(1);
    }));

    it('does not save content that carries no components', fakeAsync(() => {
      component.mode.set('edit');
      routeParams$.next({ id: '1' });
      component.selectedPost.set(post({ id: '1', authorId: 'author-1' }));

      component.onEditorChange(editorData({ content: '<p>Plain</p>' }));
      tick(1500);

      expect(persistence.saveComponents).not.toHaveBeenCalled();
    }));

    it('does not save someone else’s post', fakeAsync(() => {
      component.mode.set('edit');
      routeParams$.next({ id: '1' });
      component.selectedPost.set(post({ id: '1', authorId: 'someone-else' }));
      persistence.extractComponentsFromContent.mockReturnValue([
        { instanceId: 'a-1' },
      ]);

      component.onEditorChange(
        editorData({ content: '<div data-angular-component></div>' })
      );
      tick(1500);

      expect(persistence.saveComponents).not.toHaveBeenCalled();
    }));

    it('survives a failing save', fakeAsync(() => {
      component.mode.set('edit');
      routeParams$.next({ id: '1' });
      component.selectedPost.set(post({ id: '1', authorId: 'author-1' }));
      persistence.extractComponentsFromContent.mockReturnValue([
        { instanceId: 'a-1' },
      ]);
      persistence.saveComponents.mockReturnValue(
        throwError(() => new Error('conflict'))
      );

      component.onEditorChange(
        editorData({ content: '<div data-angular-component></div>' })
      );

      expect(() => tick(1500)).not.toThrow();
    }));

    it('stops listening once destroyed', () => {
      component.ngOnDestroy();

      expect(
        (component as unknown as { autoSaveSub: { closed: boolean } })
          .autoSaveSub.closed
      ).toBe(true);
    });
  });

  describe('cleanInjectedContent', () => {
    it('re-serialises a valid data attribute', () => {
      const html =
        '<div class="angular-component-node" data=\'{"title":"Kept"}\'></div>';

      const result = component.cleanInjectedContent(html);

      expect(result).toContain('angular-component-node');
      expect(result).toContain('Kept');
    });

    it('leaves a node whose data will not parse', () => {
      const html = '<div class="angular-component-node" data="not json"></div>';

      expect(() => component.cleanInjectedContent(html)).not.toThrow();
    });

    it('passes through content with no component nodes', () => {
      expect(component.cleanInjectedContent('<p>Body</p>')).toContain(
        '<p>Body</p>'
      );
    });
  });

  describe('formatDate', () => {
    it('is blank for a missing date', () => {
      expect(component.formatDate(null)).toBe('');
    });

    it('formats a Date and an ISO string the same way', () => {
      const iso = '2024-03-04T00:00:00.000Z';

      expect(component.formatDate(new Date(iso))).toBe(
        component.formatDate(iso)
      );
      expect(component.formatDate(iso)).toMatch(/2024/);
    });
  });

  describe('small state toggles', () => {
    it('dismisses the error banner', () => {
      component.error.set('Something went wrong');

      component.dismissError();

      expect(component.error()).toBeNull();
    });

    it('toggles the theme designer', () => {
      const before = component.showThemeDesigner();

      component.toggleThemeDesigner();
      expect(component.showThemeDesigner()).toBe(!before);

      component.toggleThemeDesigner();
      expect(component.showThemeDesigner()).toBe(before);
    });
  });
});
