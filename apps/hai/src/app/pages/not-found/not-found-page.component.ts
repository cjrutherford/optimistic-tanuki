import { Component, RESPONSE_INIT, inject } from '@angular/core';
import {
  PageIntroComponent,
  PageIntroLink,
} from '../../components/page-intro/page-intro.component';

/**
 * Shown for any path that is not a page. The server answers with a 404 so
 * crawlers drop the URL; `SeoTitleStrategy` marks it `noindex`.
 */
@Component({
  selector: 'hai-not-found-page',
  standalone: true,
  imports: [PageIntroComponent],
  template: `
    <hai-page-intro
      eyebrow="404"
      title="Page not found"
      summary="This address doesn't match a page on our site. It may have moved, or the link may have a typo."
      [action]="home"
      [links]="links"
    ></hai-page-intro>
  `,
})
export class NotFoundPageComponent {
  readonly home: PageIntroLink = { label: 'Back to the homepage', route: '/' };
  readonly links: PageIntroLink[] = [
    { label: 'Private cloud', route: '/private-cloud' },
    { label: 'Technical support', route: '/technical-support' },
    { label: 'Contact us', route: '/contact' },
  ];

  constructor() {
    const responseInit = inject(RESPONSE_INIT, { optional: true });
    if (responseInit) {
      responseInit.status = 404;
    }
  }
}
