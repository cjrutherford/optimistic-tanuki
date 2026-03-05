import { Injectable } from '@nestjs/common';
import { BlogPostDto } from '@optimistic-tanuki/models';

@Injectable()
export class RssService {
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
    const pubDate =
      posts.length > 0
        ? this.formatDate(new Date(posts[0].updatedAt))
        : this.formatDate(new Date());

    const items = posts
      .map((post) => {
        const itemPubDate = post.publishedAt
          ? this.formatDate(new Date(post.publishedAt))
          : this.formatDate(new Date(post.createdAt));

        return `
    <item>
      <title><![CDATA[${this.escapeXml(post.title)}]]></title>
      <link>${this.escapeXml(`${blogInfo.link}/post/${post.id}`)}</link>
      <guid isPermaLink="true">${this.escapeXml(
        `${blogInfo.link}/post/${post.id}`
      )}</guid>
      <description><![CDATA[${this.extractDescription(
        post.content
      )}]]></description>
      <content:encoded><![CDATA[${post.content}]]></content:encoded>
      <author>${this.escapeXml(post.authorId)}</author>
      <pubDate>${itemPubDate}</pubDate>
    </item>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[${this.escapeXml(blogInfo.title)}]]></title>
    <description><![CDATA[${this.escapeXml(
      blogInfo.description
    )}]]></description>
    <link>${this.escapeXml(blogInfo.link)}</link>
    <language>en</language>
    <lastBuildDate>${pubDate}</lastBuildDate>
    <generator>Optimistic Tanuki Blog</generator>
    <copyright>All rights reserved ${new Date().getFullYear()}</copyright>
    ${
      blogInfo.author
        ? `<managingEditor>${this.escapeXml(
            blogInfo.author.email
          )} (${this.escapeXml(blogInfo.author.name)})</managingEditor>`
        : ''
    }
    ${items}
  </channel>
</rss>`;
  }

  private formatDate(date: Date): string {
    return date.toUTCString();
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private extractDescription(content: string): string {
    const stripped = content.replace(/<[^>]*>/g, '').trim();
    return stripped.length > 200
      ? stripped.substring(0, 197) + '...'
      : stripped;
  }
}
