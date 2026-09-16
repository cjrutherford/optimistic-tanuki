import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocsContentComponent } from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';

/**
 * The route for /docs.
 *
 * One page with anchored sections, wrapped in the same studio layout as
 * every other route, so it is reachable from wherever that layout's nav
 * links point rather than living off on its own.
 */
@Component({
  selector: 'learning-docs',
  imports: [LearningLayoutComponent, DocsContentComponent, RouterLink],
  template: `<learning-layout>
    <a routerLink="/courses" class="back">← Catalog</a>
    <otlearn-docs-content></otlearn-docs-content>
  </learning-layout>`,
  styles: [
    `
      .back {
        display: inline-block;
        margin-bottom: 1rem;
        color: var(--lx-text-muted);
        font: var(--lx-btn-weight, 800) 0.72rem var(--lx-font-mono, monospace);
        letter-spacing: 0.04em;
        text-decoration: none;
        text-transform: var(--lx-btn-transform, uppercase);
        transition: var(--lx-btn-transition);
      }
      .back:hover {
        color: var(--lx-text);
      }
      .back:focus-visible {
        outline: var(--lx-border-width) solid var(--lx-focus);
        outline-offset: 3px;
      }
    `,
  ],
})
export class DocsComponent {}
