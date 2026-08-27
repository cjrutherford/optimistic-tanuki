import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AboutContentComponent } from '@optimistic-tanuki/learning-ui';
import { LearningLayoutComponent } from './learning-layout.component';

/**
 * The route for /about.
 *
 * Thin on purpose: the argument itself lives in learning-ui so it can be
 * reused or tested without the studio chrome around it. This wrapper only
 * places it inside the layout every other page uses, so an anonymous visitor
 * who has found the catalog can find their way here too.
 */
@Component({
  selector: 'learning-about',
  imports: [LearningLayoutComponent, AboutContentComponent, RouterLink],
  template: `<learning-layout>
    <a routerLink="/courses" class="back">← Catalog</a>
    <otlearn-about-content></otlearn-about-content>
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
export class AboutComponent {}
