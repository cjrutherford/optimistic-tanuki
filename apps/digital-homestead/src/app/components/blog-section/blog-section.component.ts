import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { HeadingComponent, TileComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { BlogPostCardComponent } from '@optimistic-tanuki/blogging-ui';
import { BlogPostDto } from '@optimistic-tanuki/ui-models';
import { BlogService } from '../../blog.service';

@Component({
  selector: 'dh-blog-section',
  imports: [CommonModule, HeadingComponent, TileComponent, BlogPostCardComponent, ButtonComponent],
  templateUrl: './blog-section.component.html',
  styleUrl: './blog-section.component.scss',
})
export class BlogSectionComponent implements OnInit {
  private readonly blogService = inject(BlogService);
  private readonly router = inject(Router);

  readonly posts = signal<BlogPostDto[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPublishedPosts();
  }

  loadPublishedPosts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.blogService.getPublishedPosts().subscribe({
      next: (posts) => {
        // Take the latest 3 posts for the landing page section
        this.posts.set(posts.slice(0, 3));
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load blog posts');
        this.loading.set(false);
        console.error('Error loading blog posts:', err);
      }
    });
  }

  navigateToBlog(): void {
    this.router.navigate(['/blog']);
  }

  navigateToPost(postId: string): void {
    this.router.navigate(['/blog', postId]);
  }

  formatDate(date: Date | string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  getExcerpt(content: string, maxLength = 150): string {
    // Strip HTML tags and get plain text using a more robust approach
    // First, repeatedly strip tags until no more tags remain
    let plainText = content;
    let previousText = '';
    
    // Keep stripping tags until text stabilizes (handles nested/malformed tags)
    while (plainText !== previousText) {
      previousText = plainText;
      plainText = plainText.replace(/<[^>]*>/g, '');
    }
    
    // Additional sanitization: remove any remaining < or > characters
    plainText = plainText.replace(/[<>]/g, '');
    
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength).trim() + '...';
  }
}
