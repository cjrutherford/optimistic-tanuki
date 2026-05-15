import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'pg-markdown-content',
  standalone: true,
  imports: [CommonModule],
  template: ` <article class="markdown-content" [innerHTML]="html"></article> `,
  styles: [
    `
      .markdown-content {
        color: color-mix(in srgb, var(--foreground) 92%, white);
        line-height: 1.75;
      }

      .markdown-content :where(h1, h2, h3, h4) {
        margin: 1.4rem 0 0.7rem;
        font-family: var(--font-heading);
        line-height: 1.05;
        letter-spacing: -0.04em;
      }

      .markdown-content :where(h1, h2) {
        scroll-margin-top: 7rem;
      }

      .markdown-content h1 {
        font-size: clamp(2rem, 4vw, 3.4rem);
      }

      .markdown-content h2 {
        font-size: clamp(1.45rem, 2.8vw, 2.1rem);
      }

      .markdown-content p,
      .markdown-content li {
        color: var(--muted);
      }

      .markdown-content a {
        color: color-mix(in srgb, var(--primary) 78%, white);
      }

      .markdown-content pre {
        overflow-x: auto;
        padding: 1rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1rem;
        background: rgba(5, 10, 18, 0.88);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
      }

      .markdown-content code {
        font-family: 'IBM Plex Mono', monospace;
      }

      .markdown-content ul,
      .markdown-content ol {
        padding-left: 1.35rem;
      }

      .markdown-content blockquote {
        margin: 1rem 0;
        padding: 0.8rem 1rem;
        border-left: 3px solid var(--primary);
        background: rgba(63, 81, 181, 0.08);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownContentComponent {
  @Input({ required: true }) html = '';
}
