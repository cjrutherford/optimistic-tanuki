import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface RelatedLink {
  label: string;
  route: string;
}

/** One sentence of lead-in followed by a few links onward to related pages. */
@Component({
  selector: 'hai-related-links',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="related-links" [attr.aria-label]="prompt">
      <p class="related-prompt">{{ prompt }}</p>
      <p class="related-actions">
        @for (link of links; track link.route) {
        <a [routerLink]="link.route">{{ link.label }}</a>
        }
      </p>
    </nav>
  `,
  styleUrl: './related-links.component.scss',
})
export class RelatedLinksComponent {
  @Input({ required: true }) prompt = '';
  @Input({ required: true }) links: RelatedLink[] = [];
}
