import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { BlogPostDto } from '@optimistic-tanuki/ui-models';
import { BlogSectionComponent } from './blog-section.component';
import { BlogService } from '../../blog.service';

/**
 * The spec beside this one covers loading and the text helpers. These drive
 * the navigation and write paths — create, delete, publish — each of which
 * reloads the section on success and only logs on failure.
 */
describe('BlogSectionComponent behaviour', () => {
  let component: BlogSectionComponent;
  let fixture: ComponentFixture<BlogSectionComponent>;
  let blog: BlogServiceMock;
  let navigate: jest.Mock;

  interface BlogServiceMock {
    getPublishedPosts: jest.Mock;
    createPost: jest.Mock;
    deletePost: jest.Mock;
    publishDraft: jest.Mock;
  }

  const post: BlogPostDto = {
    id: 'post-1',
    title: 'Test Post',
    content: '<p>Body</p>',
    authorId: 'author-1',
    isDraft: false,
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    blog = {
      getPublishedPosts: jest.fn().mockReturnValue(of([post])),
      createPost: jest.fn().mockReturnValue(of(post)),
      deletePost: jest.fn().mockReturnValue(of(undefined)),
      publishDraft: jest.fn().mockReturnValue(of(post)),
    };
    navigate = jest.fn();

    await TestBed.configureTestingModule({
      imports: [BlogSectionComponent],
      providers: [
        { provide: BlogService, useValue: blog },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BlogSectionComponent);
    component = fixture.componentInstance;

    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    fixture.detectChanges();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('navigation', () => {
    it('goes to the blog index', () => {
      component.navigateToBlog();

      expect(navigate).toHaveBeenCalledWith(['/blog']);
    });

    it('goes to a single post', () => {
      component.navigateToPost('post-9');

      expect(navigate).toHaveBeenCalledWith(['/blog', 'post-9']);
    });
  });

  describe('createPost', () => {
    it('sends the placeholder post and reloads the section', fakeAsync(() => {
      blog.getPublishedPosts.mockClear();

      component.createPost();
      tick();

      expect(blog.createPost).toHaveBeenCalledWith({
        title: 'New Blog Post',
        content: 'This is a new blog post.',
        authorId: 'current-user-id',
      });
      expect(blog.getPublishedPosts).toHaveBeenCalled();
    }));

    it('leaves the list alone when the create fails', fakeAsync(() => {
      blog.createPost.mockReturnValue(throwError(() => new Error('rejected')));
      blog.getPublishedPosts.mockClear();

      component.createPost();
      tick();

      expect(blog.getPublishedPosts).not.toHaveBeenCalled();
    }));
  });

  describe('deletePost', () => {
    it('deletes then reloads the section', fakeAsync(() => {
      blog.getPublishedPosts.mockClear();

      component.deletePost('post-1');
      tick();

      expect(blog.deletePost).toHaveBeenCalledWith('post-1');
      expect(blog.getPublishedPosts).toHaveBeenCalled();
    }));

    it('leaves the list alone when the delete fails', fakeAsync(() => {
      blog.deletePost.mockReturnValue(throwError(() => new Error('nope')));
      blog.getPublishedPosts.mockClear();

      component.deletePost('post-1');
      tick();

      expect(blog.getPublishedPosts).not.toHaveBeenCalled();
    }));
  });

  describe('publishDraft', () => {
    it('publishes then reloads the section', fakeAsync(() => {
      blog.getPublishedPosts.mockClear();

      component.publishDraft('draft-1');
      tick();

      expect(blog.publishDraft).toHaveBeenCalledWith('draft-1');
      expect(blog.getPublishedPosts).toHaveBeenCalled();
    }));

    it('leaves the list alone when the publish fails', fakeAsync(() => {
      blog.publishDraft.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 403 }))
      );
      blog.getPublishedPosts.mockClear();

      component.publishDraft('draft-1');
      tick();

      expect(blog.getPublishedPosts).not.toHaveBeenCalled();
    }));
  });
});
