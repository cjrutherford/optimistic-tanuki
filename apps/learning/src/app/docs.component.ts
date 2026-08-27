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
        margin-bottom: 1.25rem;
        color: var(--lx-text-muted);
        font-size: 0.85rem;
        text-decoration: none;
      }
    `,
  ],
})
export class DocsComponent {}
