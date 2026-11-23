import { Component, computed, input, output, signal } from '@angular/core';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import type {
  OwnerConfirmOptions,
  OwnerConfirmResult,
} from './owner-confirm.types';

let nextId = 0;

/**
 * Accessible confirmation dialog, built on the shared modal so it keeps the
 * focus trap, scroll lock and Esc handling. Esc, the backdrop and Cancel all
 * resolve as not confirmed. Confirm stays disabled until the level's
 * requirement is met.
 *
 * Normally opened through `OwnerConfirmService`.
 */
@Component({
  selector: 'ot-owner-confirm-dialog',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './owner-confirm-dialog.component.html',
  styleUrl: './owner-confirm-dialog.component.scss',
})
export class OwnerConfirmDialogComponent {
  readonly options = input.required<OwnerConfirmOptions>();
  readonly resolved = output<OwnerConfirmResult>();

  protected readonly uid = nextId++;
  protected readonly reason = signal('');
  protected readonly typed = signal('');
  private done = false;

  protected readonly valid = computed(() => {
    const o = this.options();
    if (o.level === 'reason') return this.reason().trim().length > 0;
    if (o.level === 'typed') {
      return !!o.typedPhrase && this.typed() === o.typedPhrase;
    }
    return true;
  });

  protected confirm(): void {
    if (!this.valid()) return;
    const level = this.options().level;
    this.finish(
      level === 'reason'
        ? { confirmed: true, reason: this.reason().trim() }
        : { confirmed: true }
    );
  }

  protected cancel(): void {
    this.finish({ confirmed: false });
  }

  private finish(result: OwnerConfirmResult): void {
    if (this.done) return;
    this.done = true;
    this.resolved.emit(result);
  }
}
