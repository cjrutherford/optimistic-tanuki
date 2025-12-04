import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';

import { BlogSectionComponent } from './blog-section.component';
import { BlogService } from '../../blog.service';
import { BlogPostDto } from '@optimistic-tanuki/ui-models';

describe('BlogSectionComponent', () => {
  let component: BlogSectionComponent;
  let fixture: ComponentFixture<BlogSectionComponent>;
  let blogService: jest.Mocked<BlogService>;

  const mockPosts: BlogPostDto[] = [
    {
      id: 'post-1',
      title: 'Test Post 1',
      content: '<p>This is the first test post content</p>',
      authorId: 'author-1',
      isDraft: false,
      publishedAt: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'post-2',
      title: 'Test Post 2',
      content: '<p>This is the second test post content</p>',
      authorId: 'author-1',
      isDraft: false,
      publishedAt: new Date('2024-01-02'),
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(async () => {
    const blogServiceMock = {
      getPublishedPosts: jest.fn().mockReturnValue(of(mockPosts)),
      getAllPosts: jest.fn().mockReturnValue(of(mockPosts)),
      getPost: jest.fn(),
      createPost: jest.fn(),
      updatePost: jest.fn(),
      deletePost: jest.fn(),
      getDraftsByAuthor: jest.fn(),
      publishPost: jest.fn(),
      saveDraft: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [BlogSectionComponent, RouterTestingModule, HttpClientTestingModule],
      providers: [
        { provide: BlogService, useValue: blogServiceMock }
      ]
    }).compileComponents();

    blogService = TestBed.inject(BlogService) as jest.Mocked<BlogService>;
    fixture = TestBed.createComponent(BlogSectionComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load published posts on init', fakeAsync(() => {
    fixture.detectChanges();
    tick();
    
    expect(blogService.getPublishedPosts).toHaveBeenCalled();
    expect(component.posts().length).toBe(2);
    expect(component.loading()).toBe(false);
  }));

  it('should set loading state while fetching posts', () => {
    component.loading.set(true);
    expect(component.loading()).toBe(true);
  });

  it('should handle error when loading posts fails', fakeAsync(() => {
    blogService.getPublishedPosts.mockReturnValue(throwError(() => new Error('Failed to load')));
    
    fixture.detectChanges();
    tick();
    
    expect(component.error()).toBe('Failed to load blog posts');
    expect(component.loading()).toBe(false);
  }));

  it('should limit posts to 3 on the landing page', fakeAsync(() => {
    const manyPosts: BlogPostDto[] = [
      { ...mockPosts[0], id: 'post-a' },
      { ...mockPosts[1], id: 'post-b' },
      { ...mockPosts[0], id: 'post-c' },
      { ...mockPosts[1], id: 'post-d' },
      { ...mockPosts[0], id: 'post-e' },
    ];
    blogService.getPublishedPosts.mockReturnValue(of(manyPosts));
    
    fixture.detectChanges();
    tick();
    
    expect(component.posts().length).toBe(3);
  }));

  it('should format date correctly', () => {
    const date = new Date('2024-06-15');
    const formatted = component.formatDate(date);
    
    expect(formatted).toContain('June');
    expect(formatted).toContain('15');
    expect(formatted).toContain('2024');
  });

  it('should return empty string for null date', () => {
    const formatted = component.formatDate(null);
    expect(formatted).toBe('');
  });

  it('should strip HTML tags from content for excerpt', () => {
    const content = '<p>This is <strong>bold</strong> text</p>';
    const excerpt = component.getExcerpt(content);
    
    expect(excerpt).not.toContain('<p>');
    expect(excerpt).not.toContain('<strong>');
    expect(excerpt).toContain('This is bold text');
  });

  it('should truncate long content in excerpt', () => {
    const longContent = 'A'.repeat(200);
    const excerpt = component.getExcerpt(longContent, 150);
    
    expect(excerpt.length).toBeLessThanOrEqual(153); // 150 + '...'
    expect(excerpt).toContain('...');
  });

  it('should not truncate short content', () => {
    const shortContent = 'Short text';
    const excerpt = component.getExcerpt(shortContent);
    
    expect(excerpt).toBe('Short text');
    expect(excerpt).not.toContain('...');
  });
});

