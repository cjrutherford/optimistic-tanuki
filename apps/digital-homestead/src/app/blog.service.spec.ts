import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { BlogService } from './blog.service';
import {
  BlogPostDto,
  CreateBlogPostDto,
  UpdateBlogPostDto,
} from '@optimistic-tanuki/ui-models';

describe('BlogService', () => {
  let service: BlogService;
  let httpMock: HttpTestingController;

  const mockBlogPost: BlogPostDto = {
    id: '123',
    title: 'Test Post',
    content: '<p>Test content</p>',
    authorId: 'author-1',
    isDraft: false,
    publishedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BlogService],
    });

    service = TestBed.inject(BlogService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('createPost', () => {
    it('should create a new post', () => {
      const newPost: CreateBlogPostDto = {
        title: 'New Post',
        content: '<p>New content</p>',
        authorId: 'author-1',
        isDraft: true,
      };

      service.createPost(newPost).subscribe((post) => {
        expect(post).toEqual(mockBlogPost);
      });

      const req = httpMock.expectOne('/api/post');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(newPost);
      req.flush(mockBlogPost);
    });
  });

  describe('getAllPosts', () => {
    it('should get all posts', () => {
      const posts = [mockBlogPost];

      service.getAllPosts().subscribe((result) => {
        expect(result).toEqual(posts);
      });

      const req = httpMock.expectOne('/api/post/find');
      expect(req.request.method).toBe('POST');
      req.flush(posts);
    });

    it('should pass query parameters', () => {
      const query = { title: 'Test', authorId: 'author-1' };

      service.getAllPosts(query).subscribe();

      const req = httpMock.expectOne('/api/post/find');
      expect(req.request.body).toEqual(query);
      req.flush([]);
    });
  });

  describe('getPublishedPosts', () => {
    it('should get only published posts', () => {
      const posts = [mockBlogPost];

      service.getPublishedPosts().subscribe((result) => {
        expect(result).toEqual(posts);
      });

      const req = httpMock.expectOne('/api/post/published');
      expect(req.request.method).toBe('GET');
      req.flush(posts);
    });
  });

  describe('getDraftsByAuthor', () => {
    it('should get drafts for an author', () => {
      const authorId = 'author-1';
      const drafts = [{ ...mockBlogPost, isDraft: true }];

      service.getDraftsByAuthor(authorId).subscribe((result) => {
        expect(result).toEqual(drafts);
      });

      const req = httpMock.expectOne(`/api/post/drafts/${authorId}`);
      expect(req.request.method).toBe('GET');
      req.flush(drafts);
    });
  });

  describe('getPost', () => {
    it('should get a single post by id', () => {
      const postId = '123';

      service.getPost(postId).subscribe((result) => {
        expect(result).toEqual(mockBlogPost);
      });

      const req = httpMock.expectOne(`/api/post/${postId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockBlogPost);
    });
  });

  describe('updatePost', () => {
    it('should update a post', () => {
      const postId = '123';
      const updateData: UpdateBlogPostDto = {
        id: postId,
        title: 'Updated Title',
      };

      service.updatePost(postId, updateData).subscribe((result) => {
        expect(result).toEqual(mockBlogPost);
      });

      const req = httpMock.expectOne(`/api/post/${postId}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateData);
      req.flush(mockBlogPost);
    });
  });

  describe('publishPost', () => {
    it('should publish a draft post', () => {
      const postId = '123';

      service.publishPost(postId).subscribe((result) => {
        expect(result).toEqual(mockBlogPost);
      });

      const req = httpMock.expectOne(`/api/post/${postId}/publish`);
      expect(req.request.method).toBe('POST');
      req.flush(mockBlogPost);
    });
  });

  describe('saveDraft', () => {
    it('should save a post as draft', () => {
      const draftData: CreateBlogPostDto = {
        title: 'Draft Post',
        content: '<p>Draft content</p>',
        authorId: 'author-1',
      };

      service.saveDraft(draftData).subscribe((result) => {
        expect(result).toEqual(mockBlogPost);
      });

      const req = httpMock.expectOne('/api/post');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ ...draftData, isDraft: true });
      req.flush(mockBlogPost);
    });
  });

  describe('deletePost', () => {
    it('should delete a post', () => {
      const postId = '123';

      service.deletePost(postId).subscribe();

      const req = httpMock.expectOne(`/api/post/${postId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('searchPosts', () => {
    it('should search posts by term', () => {
      const searchTerm = 'typescript';
      const results = [mockBlogPost];

      service.searchPosts(searchTerm).subscribe((result) => {
        expect(result).toEqual(results);
      });

      const req = httpMock.expectOne(`/api/post/search?q=${searchTerm}`);
      expect(req.request.method).toBe('GET');
      req.flush(results);
    });

    it('should handle empty search term', () => {
      const searchTerm = '';

      service.searchPosts(searchTerm).subscribe((result) => {
        expect(result).toEqual([]);
      });

      const req = httpMock.expectOne(`/api/post/search?q=`);
      req.flush([]);
    });
  });

  describe('getRssFeedUrl', () => {
    it('should return RSS feed URL without base URL', () => {
      const url = service.getRssFeedUrl();
      expect(url).toBe('/api/post/rss/feed.xml');
    });

    it('should return RSS feed URL with base URL', () => {
      const baseUrl = 'https://blog.example.com';
      const url = service.getRssFeedUrl(baseUrl);
      expect(url).toBe(
        `/api/post/rss/feed.xml?baseUrl=${encodeURIComponent(baseUrl)}`
      );
    });
  });

  describe('getSeoMetadata', () => {
    it('should get SEO metadata for a post', () => {
      const postId = '123';
      const seoData = {
        title: 'Test Post',
        description: 'Test description',
        ogTitle: 'Test Post',
        twitterCard: 'summary_large_image',
      };

      service.getSeoMetadata(postId).subscribe((result) => {
        expect(result).toEqual(seoData);
      });

      const req = httpMock.expectOne(`/api/post/${postId}/seo`);
      expect(req.request.method).toBe('GET');
      req.flush(seoData);
    });

    it('should include base URL in query params', () => {
      const postId = '123';
      const baseUrl = 'https://blog.example.com';

      service.getSeoMetadata(postId, baseUrl).subscribe();

      const req = httpMock.expectOne((request) => {
        return (
          request.url === `/api/post/${postId}/seo` &&
          request.params.get('baseUrl') === baseUrl
        );
      });
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getSitemapUrl', () => {
    it('should return sitemap URL without base URL', () => {
      const url = service.getSitemapUrl();
      expect(url).toBe('/api/blog/sitemap.xml');
    });

    it('should return sitemap URL with base URL', () => {
      const baseUrl = 'https://blog.example.com';
      const url = service.getSitemapUrl(baseUrl);
      expect(url).toBe(
        `/api/blog/sitemap.xml?baseUrl=${encodeURIComponent(baseUrl)}`
      );
    });
  });
});
