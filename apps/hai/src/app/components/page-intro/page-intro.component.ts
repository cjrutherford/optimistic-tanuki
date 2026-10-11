import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface PageIntroLink {
  label: string;
  route: string;
  /** In-page anchor on `route`, e.g. a section id. */
  fragment?: string;
}

/**
 * Page title block: eyebrow, `h1`, summary, an optional primary action, and
 * optional links onward.
 */
@Component({
  selector: 'hai-page-intro',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './page-intro.component.html',
  styleUrl: './page-intro.component.scss',
})
export class PageIntroComponent {
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) title = '';
  @Input() summary = '';
  @Input() action?: PageIntroLink;
  @Input() links: PageIntroLink[] = [];
}
