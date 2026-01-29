import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { BlogPageComponent } from './blog-page.component';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController,
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { BlogService } from '../../blog.service';
import { AuthStateService } from '../../auth-state.service';
import { PermissionService } from '../../permission.service';
import { of, BehaviorSubject, throwError } from 'rxjs';
import { BlogPostDto } from '@optimistic-tanuki/ui-models';

describe('BlogPageComponent', () => {
  let component: BlogPageComponent;
  let fixture: ComponentFixture<BlogPageComponent>;
  let httpMock: HttpTestingController;
  let blogService: jest.Mocked<Partial<BlogService>>;
  let authStateService: jest.Mocked<Partial<AuthStateService>>;
  let permissionService: jest.Mocked<Partial<PermissionService>>;
  let router: Router;

  const mockPosts: BlogPostDto[] = [
    {
      id: '1',
      title: 'Post 1',
      content: 'Content 1',
      authorId: 'author-1',
      isDraft: false,
      publishedAt: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      title: 'Post 2',
      content: 'Content 2',
      authorId: 'author-1',
      isDraft: true,
      publishedAt: null,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  let isAuthenticated$: BehaviorSubject<boolean>;

  beforeEach(async () => {
    isAuthenticated$ = new BehaviorSubject<boolean>(true);
    blogService = {
      getAllPosts: jest.fn(() => of(mockPosts)),
      getPost: jest.fn((id) => of(mockPosts.find(p => p.id === id) || mockPosts[0])),
      createPost: jest.fn((dto) => of({ ...dto, id: 'new-id', createdAt: new Date(), updatedAt: new Date() } as any)),
      updatePost: jest.fn((id, dto) => of({ ...dto, id, createdAt: new Date(), updatedAt: new Date() } as any)),
      publishPost: jest.fn((id) => of({ ...mockPosts[1], isDraft: false, publishedAt: new Date() })),
    };

    authStateService = {
      isAuthenticated$: jest.fn(() => isAuthenticated$.asObservable()),
      getProfileId: jest.fn(() => 'author-1'),
    };

    permissionService = {
      hasFullAccess$: jest.fn(() => of(true)),
      permissionsLoaded$: jest.fn(() => of(true)),
    };

    await TestBed.configureTestingModule({
      imports: [BlogPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: BlogService, useValue: blogService },
        { provide: AuthStateService, useValue: authStateService },
        { provide: PermissionService, useValue: permissionService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogPageComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should load all posts on init', () => {
      expect(blogService.getAllPosts).toHaveBeenCalled();
      expect(component.posts().length).toBeGreaterThan(0);
    });
  });

  describe('Post selection and loading', () => {
    it('should load specific post when loadPost is called', () => {
      component.loadPost('1');
      expect(blogService.getPost).toHaveBeenCalledWith('1');
      expect(component.selectedPost()?.id).toBe('1');
    });

    it('should navigate when selectPost is called', () => {
      const spy = jest.spyOn(router, 'navigate');
      component.selectPost(mockPosts[0]);
      expect(spy).toHaveBeenCalledWith(['/blog', '1']);
    });

    it('should set error if trying to view draft while unauthenticated', fakeAsync(() => {
        isAuthenticated$.next(false);
        tick();
        fixture.detectChanges();
        
        component.selectPost(mockPosts[1]); // Post 2 is draft
        expect(component.error()).toBe('You must be signed in to view draft posts.');
    }));
  });

  describe('Creating and Editing', () => {
    it('startCreatePost should change mode and reset editor data', () => {
      component.startCreatePost();
      expect(component.mode()).toBe('create');
      expect(component.editorData().title).toBe('');
    });

    it('editPost should change mode and set editor data', () => {
      component.editPost(mockPosts[0]);
      expect(component.mode()).toBe('edit');
      expect(component.editorData().title).toBe(mockPosts[0].title);
    });

    it('cancelEdit should return to view mode', () => {
        component.mode.set('edit');
        component.cancelEdit();
        expect(component.mode()).toBe('view');
    });
  });

  describe('Submission', () => {
    it('onPostSubmitted should create new post in create mode', () => {
      component.mode.set('create');
      component.pendingSaveAction.set('draft');
      const postData = { title: 'New', content: 'Content', links: [], attachments: [] };
      
      component.onPostSubmitted(postData);
      
      expect(blogService.createPost).toHaveBeenCalledWith(expect.objectContaining({
          title: 'New',
          isDraft: true
      }));
      expect(component.mode()).toBe('view');
    });

    it('onPostSubmitted should update post in edit mode', () => {
        component.mode.set('edit');
        component.selectedPost.set(mockPosts[0]);
        // Mock currentPostId to return '1'
        jest.spyOn(component, 'currentPostId').mockReturnValue('1');
        
        const postData = { title: 'Updated', content: 'Content', links: [], attachments: [] };
        component.onPostSubmitted(postData);
        
        expect(blogService.updatePost).toHaveBeenCalledWith('1', expect.objectContaining({
            title: 'Updated'
        }));
    });

    it('publishDraft should call blogService.publishPost', () => {
        component.selectedPost.set(mockPosts[1]);
        component.publishDraft();
        expect(blogService.publishPost).toHaveBeenCalledWith('2');
    });
  });

  describe('Utilities', () => {
    it('formatDate should format date correctly', () => {
      const date = new Date('2024-05-20T12:00:00Z');
      expect(component.formatDate(date)).toContain('2024');
    });

    it('formatDate should return empty string for null', () => {
        expect(component.formatDate(null)).toBe('');
    });

    it('dismissError should clear error', () => {
        component.error.set('Some error');
        component.dismissError();
        expect(component.error()).toBeNull();
    });

    it('toggleThemeDesigner should toggle signal', () => {
        const initial = component.showThemeDesigner();
        component.toggleThemeDesigner();
        expect(component.showThemeDesigner()).toBe(!initial);
    });
  });
});