import {
  AfterViewChecked,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LocalDirectoryCoverage } from '../models';
import {
  describeDirectoryState,
  DirectoryStateKind,
  DirectoryStatus,
} from '../state';

/**
 * The single place the directory explains itself: loading, failed, and every coverage state. Replaces the
 * per-page state wiring. A failed request shows generic copy only, never error details.
 */
@Component({
  selector: 'otd-directory-state-panel',
  standalone: true,
  template: `
    @if (view().kind !== 'available') {
    <section
      class="panel"
      [attr.data-testid]="
        view().kind === 'failed' ? 'directory-error' : 'coverage-state'
      "
      [attr.data-kind]="view().kind"
      [attr.role]="view().kind === 'failed' ? 'alert' : 'status'"
      [attr.aria-busy]="view().kind === 'loading' ? 'true' : null"
    >
      <p
        #title
        class="panel__title"
        role="heading"
        tabindex="-1"
        [attr.aria-level]="headingLevel()"
      >
        {{ view().title }}
      </p>
      @if (view().message) {
      <p class="panel__message">{{ view().message }}</p>
      } @if (view().kind === 'failed') {
      <button
        type="button"
        class="panel__retry"
        data-testid="directory-retry"
        (click)="retry.emit()"
      >
        Try again
      </button>
      }
    </section>
    } @if (view().withheldNote; as note) {
    <p class="note" data-testid="withheld-note">
      <strong>Some details are hidden.</strong> {{ note }}
    </p>
    }
  `,
  styleUrls: ['./directory-state-panel.component.scss'],
})
export class DirectoryStatePanelComponent implements AfterViewChecked {
  readonly status = input<DirectoryStatus>('ready');
  readonly coverage = input<LocalDirectoryCoverage | null | undefined>(null);
  readonly listingsShown = input(0);
  readonly filtersActive = input(false);
  readonly headingLevel = input(2);
  /** Move focus to the panel heading when the state changes to something the visitor must read. */
  readonly autoFocus = input(false);

  readonly retry = output<void>();

  readonly view = computed(() =>
    describeDirectoryState({
      status: this.status(),
      coverage: this.coverage(),
      listingsShown: this.listingsShown(),
      filtersActive: this.filtersActive(),
    })
  );
  readonly kind = computed<DirectoryStateKind>(() => this.view().kind);

  private readonly title = viewChild<ElementRef<HTMLElement>>('title');
  private lastKind: DirectoryStateKind | undefined;
  private pendingFocus = false;

  constructor() {
    effect(() => {
      const kind = this.kind();
      if (
        this.autoFocus() &&
        this.lastKind !== undefined &&
        kind !== this.lastKind &&
        kind !== 'loading' &&
        kind !== 'available'
      ) {
        this.pendingFocus = true;
      }
      this.lastKind = kind;
    });
  }

  /** Moves focus to the heading; safe to call from a page after a route change. */
  focus(): void {
    this.title()?.nativeElement.focus();
  }

  ngAfterViewChecked(): void {
    if (this.pendingFocus && this.title()) {
      this.pendingFocus = false;
      this.focus();
    }
  }
}
