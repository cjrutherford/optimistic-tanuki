import { Test, TestingModule } from '@nestjs/testing';
import { SitemapService } from './sitemap.service';

describe('SitemapService', () => {
  let service: SitemapService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SitemapService],
    }).compile();

    service = module.get<SitemapService>(SitemapService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateSitemap should return XML', () => {
    const posts = [
      { id: '1', updatedAt: new Date(), publishedAt: new Date() }
    ] as any;
    const blogs = [
      { id: '1', updatedAt: new Date() }
    ] as any;
    
    const result = service.generateSitemap('https://example.com', posts, blogs);
    expect(result).toContain('<?xml');
    expect(result).toContain('<urlset');
    expect(result).toContain('https://example.com/post/1');
    expect(result).toContain('https://example.com/blog/1');
  });

  it('escapeXml should escape special characters', () => {
      const input = '< " & \' >';
      const result = (service as any).escapeXml(input);
      expect(result).toBe('&lt; &quot; &amp; &apos; &gt;');
  });
});
