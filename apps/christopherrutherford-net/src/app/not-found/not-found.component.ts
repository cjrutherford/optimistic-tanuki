import { DOCUMENT } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit,
  RESPONSE_INIT,
  inject,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

export const NOT_FOUND_TITLE = 'Page not found — Christopher Rutherford';

/**
 * Unknown URLs get a real 404 instead of a copy of the landing page, so
 * search engines do not index them as duplicates of the homepage.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent implements OnInit, OnDestroy {
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);

  private previousTitle = '';
  private canonical: HTMLLinkElement | null = null;

  ngOnInit(): void {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }
    this.previousTitle = this.title.getTitle();
    this.title.setTitle(NOT_FOUND_TITLE);
    this.meta.updateTag({ name: 'robots', content: 'noindex' });
    // The static canonical points at the homepage; a 404 must not claim it.
    this.canonical = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    this.canonical?.remove();
  }

  ngOnDestroy(): void {
    this.meta.removeTag('name="robots"');
    this.title.setTitle(this.previousTitle);
    if (this.canonical) {
      this.document.head.appendChild(this.canonical);
    }
  }
}
