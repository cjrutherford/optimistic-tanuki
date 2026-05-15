import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DocsHeading } from '../models/docs.models';

@Component({
  selector: 'pg-docs-toc',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (headings.length) {
    <nav class="docs-toc" aria-label="Document table of contents">
      <span class="toc-label">On This Page</span>
      <a
        *ngFor="let heading of headings"
        class="toc-link"
        [class.depth-3]="heading.depth >= 3"
        [attr.href]="'#' + heading.id"
      >
        {{ heading.text }}
      </a>
    </nav>
    }
  `,
  styles: [
    `
      .docs-toc {
        position: sticky;
        top: 6.75rem;
        display: grid;
        gap: 0.55rem;
        padding: 1rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1.1rem;
        background: rgba(10, 16, 28, 0.78);
      }

      .toc-label {
        color: color-mix(in srgb, var(--primary) 74%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .toc-link {
        color: var(--muted);
        text-decoration: none;
        font-size: 0.9rem;
      }

      .toc-link.depth-3 {
        padding-left: 0.85rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsTocComponent {
  @Input() headings: DocsHeading[] = [];
}
