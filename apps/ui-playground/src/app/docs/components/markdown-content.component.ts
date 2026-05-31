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
        font-size: 0.92em;
      }

      .markdown-content :not(pre) > code {
        padding: 0.1rem 0.4rem;
        border-radius: 0.4rem;
        background: rgba(129, 168, 222, 0.12);
        border: 1px solid rgba(129, 168, 222, 0.18);
        color: color-mix(in srgb, var(--primary) 60%, white);
      }

      .markdown-content ul,
      .markdown-content ol {
        padding-left: 1.35rem;
        margin: 0.6rem 0 1rem;
      }

      .markdown-content li + li {
        margin-top: 0.25rem;
      }

      .markdown-content strong {
        color: color-mix(in srgb, var(--foreground) 96%, white);
        font-weight: 650;
      }

      .markdown-content em {
        color: color-mix(in srgb, var(--foreground) 88%, white);
      }

      .markdown-content del {
        color: color-mix(in srgb, var(--muted) 70%, transparent);
      }

      .markdown-content blockquote {
        margin: 1rem 0;
        padding: 0.8rem 1rem;
        border-left: 3px solid var(--primary);
        border-radius: 0 0.6rem 0.6rem 0;
        background: rgba(63, 81, 181, 0.08);
      }

      .markdown-content blockquote p {
        margin: 0.25rem 0;
      }

      .markdown-content .docs-hr {
        margin: 2rem 0;
        border: 0;
        height: 1px;
        background: linear-gradient(
          to right,
          transparent,
          rgba(129, 168, 222, 0.35),
          transparent
        );
      }

      .markdown-content .docs-table-wrap {
        margin: 1.2rem 0;
        overflow-x: auto;
        border: 1px solid rgba(129, 168, 222, 0.14);
        border-radius: 0.85rem;
        background: rgba(5, 10, 18, 0.45);
      }

      .markdown-content .docs-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;
      }

      .markdown-content .docs-table th,
      .markdown-content .docs-table td {
        padding: 0.65rem 0.9rem;
        text-align: left;
        border-bottom: 1px solid rgba(129, 168, 222, 0.1);
        vertical-align: top;
      }

      .markdown-content .docs-table thead th {
        background: rgba(129, 168, 222, 0.08);
        font-family: var(--font-heading);
        font-weight: 600;
        letter-spacing: -0.01em;
        color: color-mix(in srgb, var(--foreground) 95%, white);
      }

      .markdown-content .docs-table tbody tr:last-child td {
        border-bottom: 0;
      }

      .markdown-content .docs-table tbody tr:hover {
        background: rgba(129, 168, 222, 0.04);
      }

      .markdown-content .docs-align-left {
        text-align: left;
      }
      .markdown-content .docs-align-center {
        text-align: center;
      }
      .markdown-content .docs-align-right {
        text-align: right;
      }

      .markdown-content .docs-image {
        max-width: 100%;
        height: auto;
        border-radius: 0.5rem;
      }

      .markdown-content p > .docs-image {
        display: inline-block;
        vertical-align: middle;
        margin: 0 0.15rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarkdownContentComponent {
  @Input({ required: true }) html = '';
}
