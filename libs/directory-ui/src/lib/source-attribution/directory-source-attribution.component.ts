import { Component, computed, input } from '@angular/core';
import { describeSourceFreshness } from '../source-freshness';
import { DIRECTORY_LIMITATION_TEXT } from '../state';
import { LocalDirectorySourceFreshness } from '../models';
import { DirectorySourceSummary } from '../source-summary';

/** Where a listing's data came from, how old it is, and the honest limits of the directory. */
@Component({
  selector: 'otd-directory-source-attribution',
  standalone: true,
  template: `
    <section class="source" [attr.aria-label]="ariaLabel()">
      @if (freshnessLabel(); as label) {
      <p
        class="source__freshness"
        data-testid="source-freshness"
        [attr.data-state]="freshness()?.state"
      >
        {{ label }}
      </p>
      } @if (sources().length > 0) {
      <h2 class="source__title">Sources</h2>
      <ul class="source__list" data-testid="source-list">
        @for (src of sources(); track src.credit) {
        <li class="source__item">
          {{ src.credit }}@if (src.licenses.length > 0) {
          <span class="source__license">
            (@for (lic of src.licenses; track lic.name; let last = $last) { @if
            (lic.url) {<a
              [href]="lic.url"
              target="_blank"
              rel="noopener noreferrer"
              >{{ lic.name }}</a
            >} @else {{{ lic.name }}}@if (!last) {, }})
          </span>
          }
        </li>
        }
      </ul>
      } @for (credit of attribution(); track $index) {
      <p class="source__credit">{{ credit }}</p>
      } @for (notice of notices(); track $index) {
      <p class="source__notice">{{ notice }}</p>
      } @for (terms of termsUrls(); track $index) {
      <p class="source__terms">
        <a [href]="terms" target="_blank" rel="noopener noreferrer">{{
          terms
        }}</a>
      </p>
      } @if (showLimitation()) {
      <p class="source__limitation" data-testid="source-limitation">
        {{ limitation }}
      </p>
      }
    </section>
  `,
  styleUrls: ['./directory-source-attribution.component.scss'],
})
export class DirectorySourceAttributionComponent {
  readonly attribution = input<readonly string[]>([]);
  readonly notices = input<readonly string[]>([]);
  readonly termsUrls = input<readonly string[]>([]);
  /** Deduplicated credits for a whole page of listings; see summarizeSources. */
  readonly sources = input<readonly DirectorySourceSummary[]>([]);
  readonly freshness = input<LocalDirectorySourceFreshness | null>(null);
  readonly showLimitation = input(true);
  readonly ariaLabel = input('Data source');

  readonly limitation = DIRECTORY_LIMITATION_TEXT;
  readonly freshnessLabel = computed(() =>
    describeSourceFreshness(this.freshness())
  );
}
