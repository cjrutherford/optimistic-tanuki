import { Test, TestingModule } from '@nestjs/testing';
import { RssService } from './rss.service';
import { BlogPostDto } from '@optimistic-tanuki/models';

describe('RssService', () => {
  let service: RssService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RssService],
    }).compile();

    service = module.get<RssService>(RssService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateRssFeed', () => {
    it('should generate valid RSS XML', () => {
      const posts: BlogPostDto[] = [
        {
          id: '1',
          title: 'Test Post',
          content: '<p>This is test content</p>',
          authorId: 'author1',
          isDraft: false,
          publishedAt: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const blogInfo = {
        title: 'Test Blog',
        description: 'A test blog',
        link: 'https://example.com',
        feedUrl: 'https://example.com/rss',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
        },
      };

      const rssXml = service.generateRssFeed(posts, blogInfo);

      expect(rssXml.toLowerCase()).toContain(
        '<?xml version="1.0" encoding="utf-8"?>'
      );
      expect(rssXml).toContain('<rss');
      expect(rssXml).toContain('<title><![CDATA[Test Blog]]></title>');
      expect(rssXml).toContain('<title><![CDATA[Test Post]]></title>');
      expect(rssXml).toContain('This is test content');
    });

    it('should handle empty posts array', () => {
      const posts: BlogPostDto[] = [];
      const blogInfo = {
        title: 'Empty Blog',
        description: 'A blog with no posts',
        link: 'https://example.com',
        feedUrl: 'https://example.com/rss',
      };

      const rssXml = service.generateRssFeed(posts, blogInfo);

      expect(rssXml.toLowerCase()).toContain(
        '<?xml version="1.0" encoding="utf-8"?>'
      );
      expect(rssXml).toContain('<title><![CDATA[Empty Blog]]></title>');
    });

    it('should extract description from HTML content', () => {
      const posts: BlogPostDto[] = [
        {
          id: '1',
          title: 'HTML Post',
          content:
            '<p>This is a paragraph with <strong>bold text</strong> and <a href="#">a link</a>.</p>',
          authorId: 'author1',
          isDraft: false,
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const blogInfo = {
        title: 'Test Blog',
        description: 'A test blog',
        link: 'https://example.com',
        feedUrl: 'https://example.com/rss',
      };

      const rssXml = service.generateRssFeed(posts, blogInfo);

      // Should strip HTML tags in description section
      expect(rssXml).toContain(
        '<description><![CDATA[This is a paragraph with bold text'
      );
      // Content-encoded will have HTML
      expect(rssXml).toContain(
        '<content:encoded><![CDATA[<p>This is a paragraph with <strong>bold text</strong>'
      );
    });

    it('should truncate long descriptions', () => {
      const longContent = '<p>' + 'a'.repeat(500) + '</p>';
      const posts: BlogPostDto[] = [
        {
          id: '1',
          title: 'Long Post',
          content: longContent,
          authorId: 'author1',
          isDraft: false,
          publishedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const blogInfo = {
        title: 'Test Blog',
        description: 'A test blog',
        link: 'https://example.com',
        feedUrl: 'https://example.com/rss',
      };

      const rssXml = service.generateRssFeed(posts, blogInfo);

      // Description should be truncated
      expect(rssXml).toContain('...');
    });
  });
});
