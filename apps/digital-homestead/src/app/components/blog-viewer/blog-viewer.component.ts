import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'dh-blog-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article class="blog-viewer">
      <header class="blog-header">
        <h1 class="blog-title">{{ title }}</h1>
        <div class="blog-meta">
          <span class="blog-author">By {{ authorId }}</span>
          <span class="blog-date" *ngIf="createdAt">{{ createdAt | date:'medium' }}</span>
        </div>
      </header>
      <div class="blog-content" [innerHTML]="sanitizedContent"></div>
    </article>
  `,
  styles: [`
    .blog-viewer {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }

    .blog-header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 2px solid var(--local-border-color, #e0e0e0);
    }

    .blog-title {
      font-size: 2.5rem;
      margin: 0 0 1rem 0;
      color: var(--local-foreground, #333);
    }

    .blog-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.9rem;
      color: var(--local-foreground, #666);
    }

    .blog-author {
      font-weight: 600;
    }

    .blog-content {
      font-size: 1.1rem;
      line-height: 1.8;
      color: var(--local-foreground, #333);
    }

    .blog-content :deep(h1) {
      font-size: 2rem;
      margin: 2rem 0 1rem 0;
    }

    .blog-content :deep(h2) {
      font-size: 1.75rem;
      margin: 1.75rem 0 0.75rem 0;
    }

    .blog-content :deep(h3) {
      font-size: 1.5rem;
      margin: 1.5rem 0 0.5rem 0;
    }

    .blog-content :deep(p) {
      margin: 1rem 0;
    }

    .blog-content :deep(img) {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1.5rem 0;
    }

    .blog-content :deep(blockquote) {
      border-left: 4px solid var(--local-accent, #007bff);
      padding-left: 1rem;
      margin: 1.5rem 0;
      font-style: italic;
      color: var(--local-foreground, #555);
    }

    .blog-content :deep(code) {
      background: var(--local-background, #f5f5f5);
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }

    .blog-content :deep(pre) {
      background: var(--local-background, #f5f5f5);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
    }

    .blog-content :deep(pre code) {
      background: none;
      padding: 0;
    }

    .blog-content :deep(ul),
    .blog-content :deep(ol) {
      margin: 1rem 0;
      padding-left: 2rem;
    }

    .blog-content :deep(li) {
      margin: 0.5rem 0;
    }

    .blog-content :deep(table) {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
    }

    .blog-content :deep(th),
    .blog-content :deep(td) {
      border: 1px solid var(--local-border-color, #ddd);
      padding: 0.75rem;
      text-align: left;
    }

    .blog-content :deep(th) {
      background: var(--local-background, #f5f5f5);
      font-weight: 600;
    }
  `]
})
export class BlogViewerComponent implements OnInit {
  @Input() title = '';
  @Input() content = '';
  @Input() authorId = '';
  @Input() createdAt?: Date;
  
  sanitizedContent: SafeHtml = '';
  
  private sanitizer = inject(DomSanitizer);

  ngOnInit() {
    this.sanitizedContent = this.sanitizer.bypassSecurityTrustHtml(this.content);
  }

  ngOnChanges() {
    this.sanitizedContent = this.sanitizer.bypassSecurityTrustHtml(this.content);
  }
}
