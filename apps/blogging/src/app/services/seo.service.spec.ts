import { Test, TestingModule } from '@nestjs/testing';
import { SeoService } from './seo.service';

describe('SeoService', () => {
  let service: SeoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeoService],
    }).compile();

    service = module.get<SeoService>(SeoService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generatePostMetadata should return correct metadata', () => {
    const post = {
      id: '1',
      title: 'Post Title',
      content: '<p>Post content that is long enough to test description extraction logic.</p>',
      authorId: 'author-1',
      updatedAt: new Date(),
      publishedAt: new Date(),
    } as any;
    
    const result = service.generatePostMetadata(post, 'https://example.com');
    expect(result.title).toBe(post.title);
    expect(result.ogType).toBe('article');
    expect(result.ogUrl).toContain('https://example.com/post/1');
  });

  it('generateBlogMetadata should return correct metadata', () => {
    const blog = {
      id: '1',
      name: 'Blog Name',
      description: 'Blog description',
    } as any;
    
    const result = service.generateBlogMetadata(blog, 'https://example.com');
    expect(result.title).toBe(blog.name);
    expect(result.ogType).toBe('website');
  });

  it('extractDescription should strip HTML and truncate', () => {
      const content = '<p>' + 'a'.repeat(200) + '</p>';
      const description = (service as any).extractDescription(content);
      expect(description).toHaveLength(160);
      expect(description.endsWith('...')).toBe(true);
      expect(description).not.toContain('<p>');
  });
});
