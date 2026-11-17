import {
  AfterViewChecked,
  Component,
  computed,
  ElementRef,
  input,
  output,
  TemplateRef,
  viewChildren,
} from '@angular/core';
import { DirectoryCardComponent } from '../card/directory-card.component';
import { LocalDirectoryListing } from '../models';

/**
 * Results for one search. Announces the result count politely, marks itself busy while loading and, after
 * "Show more", moves focus to the first newly loaded item so keyboard and screen-reader users keep their place.
 */
@Component({
  selector: 'otd-directory-list',
  standalone: true,
  imports: [DirectoryCardComponent],
  template: `
    <section class="list" [attr.aria-labelledby]="headingId">
      <h2 class="list__heading" [id]="headingId">{{ heading() }}</h2>
      <div
        class="list__announce"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="result-announcement"
      >
        {{ announcement() }}
      </div>
      <ul class="list__items" [attr.aria-busy]="loading() ? 'true' : 'false'">
        @for (listing of listings(); track listing.id ?? listing.reference ??
        $index) {
        <li class="list__item" #item tabindex="-1">
          <otd-directory-card
            [listing]="listing"
            [detailLink]="detailLinkFor()(listing)"
            [detailQueryParams]="detailQueryParams()"
            [detailState]="detailState()"
            [businessPage]="businessPageFor()(listing)"
            [extras]="cardExtras()"
          ></otd-directory-card>
        </li>
        }
      </ul>
      @if (hasMore()) {
      <div class="list__actions">
        <button
          type="button"
          class="list__more"
          data-testid="load-more"
          [disabled]="loading()"
          (click)="onLoadMore()"
        >
          {{ loading() ? 'Loading more businesses…' : 'Show more businesses' }}
        </button>
      </div>
      }
    </section>
  `,
  styleUrls: ['./directory-list.component.scss'],
})
export class DirectoryListComponent implements AfterViewChecked {
  private static nextId = 0;
  readonly headingId = `otd-list-${DirectoryListComponent.nextId++}`;

  readonly listings = input<readonly LocalDirectoryListing[]>([]);
  readonly loading = input(false);
  readonly hasMore = input(false);
  readonly heading = input('Businesses');
  readonly detailLinkFor = input<
    (listing: LocalDirectoryListing) => readonly unknown[] | null
  >(() => null);
  readonly detailQueryParams = input<Record<string, string> | undefined>(
    undefined
  );
  readonly detailState = input<Record<string, unknown> | undefined>(undefined);
  readonly businessPageFor = input<(listing: LocalDirectoryListing) => boolean>(
    () => false
  );
  readonly cardExtras = input<TemplateRef<{
    $implicit: LocalDirectoryListing;
  }> | null>(null);

  readonly loadMore = output<void>();

  private readonly items = viewChildren<ElementRef<HTMLElement>>('item');
  /** Index of the first item that did not exist when "Show more" was pressed. */
  private focusFrom: number | null = null;

  readonly announcement = computed(() => {
    if (this.loading()) return 'Loading businesses';
    const count = this.listings().length;
    if (count === 0) return '';
    const noun = count === 1 ? 'business' : 'businesses';
    return `${count} ${noun} shown${this.hasMore() ? ', more available' : ''}`;
  });

  onLoadMore(): void {
    this.focusFrom = this.listings().length;
    this.loadMore.emit();
  }

  ngAfterViewChecked(): void {
    if (this.focusFrom === null) return;
    const items = this.items();
    if (items.length > this.focusFrom) {
      items[this.focusFrom].nativeElement.focus();
      this.focusFrom = null;
    }
  }
}
