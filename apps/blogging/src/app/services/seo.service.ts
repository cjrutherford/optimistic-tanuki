import { Injectable } from '@nestjs/common';
import { BlogPostDto, BlogDto } from '@optimistic-tanuki/models';

export interface SeoMetadata {
  title: string;
  description: string;
  keywords?: string[];
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
}

@Injectable()
export class SeoService {
  /**
   * Generate SEO metadata for a blog post
   */
  generatePostMetadata(
    post: BlogPostDto,
    baseUrl: string,
    defaultImage?: string
  ): SeoMetadata {
    const description = this.extractDescription(post.content);
    const url = `${baseUrl}/post/${post.id}`;

    return {
      title: post.title,
      description,
      author: post.authorId,
      publishedTime: post.publishedAt
        ? new Date(post.publishedAt).toISOString()
        : undefined,
      modifiedTime: new Date(post.updatedAt).toISOString(),
      ogTitle: post.title,
      ogDescription: description,
      ogUrl: url,
      ogType: 'article',
      ogImage: defaultImage,
      twitterCard: 'summary_large_image',
      twitterTitle: post.title,
      twitterDescription: description,
      twitterImage: defaultImage,
    };
  }

  /**
   * Generate SEO metadata for a blog
   */
  generateBlogMetadata(
    blog: BlogDto,
    baseUrl: string,
    defaultImage?: string
  ): SeoMetadata {
    const url = `${baseUrl}/blog/${blog.id}`;

    return {
      title: blog.name,
      description: blog.description,
      ogTitle: blog.name,
      ogDescription: blog.description,
      ogUrl: url,
      ogType: 'website',
      ogImage: defaultImage,
      twitterCard: 'summary',
      twitterTitle: blog.name,
      twitterDescription: blog.description,
      twitterImage: defaultImage,
    };
  }

  /**
   * Extract description from HTML content
   */
  private extractDescription(content: string, maxLength = 160): string {
    const stripped = content.replace(/<[^>]*>/g, '').trim();
    return stripped.length > maxLength
      ? stripped.substring(0, maxLength - 3) + '...'
      : stripped;
  }
}
