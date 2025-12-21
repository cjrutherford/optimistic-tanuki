import { Injectable } from '@nestjs/common';
import { BlogPostDto, BlogDto } from '@optimistic-tanuki/models';

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

@Injectable()
export class SitemapService {
  /**
   * Generate sitemap XML from blog posts and blogs
   */
  generateSitemap(
    baseUrl: string,
    posts: BlogPostDto[],
    blogs?: BlogDto[]
  ): string {
    const urls: SitemapUrl[] = [];

    // Add homepage
    urls.push({
      loc: baseUrl,
      changefreq: 'daily',
      priority: 1.0,
    });

    // Add blog posts
    posts.forEach((post) => {
      urls.push({
        loc: `${baseUrl}/post/${post.id}`,
        lastmod: post.publishedAt ? new Date(post.publishedAt).toISOString().split('T')[0] : new Date(post.updatedAt).toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
      });
    });

    // Add blogs if provided
    if (blogs) {
      blogs.forEach((blog) => {
        urls.push({
          loc: `${baseUrl}/blog/${blog.id}`,
          lastmod: new Date(blog.updatedAt).toISOString().split('T')[0],
          changefreq: 'weekly',
          priority: 0.7,
        });
      });
    }

    return this.buildSitemapXml(urls);
  }

  /**
   * Build sitemap XML from URL entries
   */
  private buildSitemapXml(urls: SitemapUrl[]): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    urls.forEach((url) => {
      xml += '  <url>\n';
      xml += `    <loc>${this.escapeXml(url.loc)}</loc>\n`;
      if (url.lastmod) {
        xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
      }
      if (url.changefreq) {
        xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
      }
      if (url.priority !== undefined) {
        xml += `    <priority>${url.priority.toFixed(1)}</priority>\n`;
      }
      xml += '  </url>\n';
    });

    xml += '</urlset>';
    return xml;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
