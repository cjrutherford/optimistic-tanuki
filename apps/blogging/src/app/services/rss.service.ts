import { Injectable } from '@nestjs/common';
import { Feed } from 'feed';
import { BlogPostDto } from '@optimistic-tanuki/models';

@Injectable()
export class RssService {
  /**
   * Generate RSS feed from published blog posts
   * @param posts - Array of published blog posts
   * @param blogInfo - Information about the blog
   */
  generateRssFeed(
    posts: BlogPostDto[],
    blogInfo: {
      title: string;
      description: string;
      link: string;
      feedUrl: string;
      author?: {
        name: string;
        email: string;
        link?: string;
      };
    }
  ): string {
    const feed = new Feed({
      title: blogInfo.title,
      description: blogInfo.description,
      id: blogInfo.link,
      link: blogInfo.link,
      language: 'en',
      favicon: `${blogInfo.link}/favicon.ico`,
      copyright: `All rights reserved ${new Date().getFullYear()}`,
      updated: posts.length > 0 ? new Date(posts[0].updatedAt) : new Date(),
      generator: 'Optimistic Tanuki Blog',
      feedLinks: {
        rss2: blogInfo.feedUrl,
      },
      author: blogInfo.author,
    });

    // Add each post to the feed
    posts.forEach((post) => {
      feed.addItem({
        title: post.title,
        id: post.id,
        link: `${blogInfo.link}/post/${post.id}`,
        description: this.extractDescription(post.content),
        content: post.content,
        author: [
          {
            name: post.authorId,
          },
        ],
        date: post.publishedAt
          ? new Date(post.publishedAt)
          : new Date(post.createdAt),
      });
    });

    return feed.rss2();
  }

  /**
   * Extract a description from HTML content (first 200 chars)
   */
  private extractDescription(content: string): string {
    // Strip HTML tags and get first 200 characters
    const stripped = content.replace(/<[^>]*>/g, '').trim();
    return stripped.length > 200
      ? stripped.substring(0, 197) + '...'
      : stripped;
  }
}
