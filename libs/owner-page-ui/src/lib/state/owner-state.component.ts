import { Component, computed, input, output } from '@angular/core';

export type OwnerStateKind = 'loading' | 'empty' | 'error';

/**
 * One component for the three non-data states of a page or panel.
 *
 * An error is never drawn like an empty list: it has its own heading, an
 * alert role and a Retry button. Empty may carry an optional call to action.
 */
@Component({
  selector: 'ot-owner-state',
  standalone: true,
  templateUrl: './owner-state.component.html',
  styleUrl: './owner-state.component.scss',
  host: {
    '[attr.data-kind]': 'kind()',
    '[attr.role]': "kind() === 'error' ? 'alert' : 'status'",
    '[attr.aria-busy]': "kind() === 'loading' ? 'true' : null",
  },
})
export class OwnerStateComponent {
  readonly kind = input.required<OwnerStateKind>();
  /** Overrides the default text for the state. */
  readonly message = input<string>();
  /** Label of the optional call to action on the empty state. */
  readonly actionLabel = input<string>();

  /** Emitted by the Retry button on the error state. */
  readonly retry = output<void>();
  /** Emitted by the call to action on the empty state. */
  readonly action = output<void>();

  protected readonly heading = computed(() => {
    switch (this.kind()) {
      case 'loading':
        return 'Loading';
      case 'empty':
        return 'Nothing here';
      case 'error':
        return 'Unavailable';
    }
  });

  protected readonly text = computed(
    () =>
      this.message() ??
      (this.kind() === 'loading'
        ? 'Loading…'
        : this.kind() === 'empty'
        ? 'There is nothing to show yet.'
        : 'This could not be loaded.')
  );
}
