import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  PageIntroComponent,
  PageIntroLink,
} from '../../components/page-intro/page-intro.component';

export interface PlaceholderPageData {
  eyebrow: string;
  title: string;
  summary: string;
  links: PageIntroLink[];
}

/**
 * Stand-in for a route whose content has not been written yet. Everything it
 * shows comes from the route's `data`.
 */
@Component({
  selector: 'hai-placeholder-page',
  standalone: true,
  imports: [PageIntroComponent],
  template: `
    <hai-page-intro
      [eyebrow]="page.eyebrow"
      [title]="page.title"
      [summary]="page.summary"
      [links]="page.links"
    ></hai-page-intro>
  `,
})
export class PlaceholderPageComponent {
  readonly page = inject(ActivatedRoute).snapshot.data as PlaceholderPageData;
}
