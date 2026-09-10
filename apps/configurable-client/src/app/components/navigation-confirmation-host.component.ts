import { Component, inject } from '@angular/core';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import { NavigationConfirmationService } from '../services/navigation-confirmation.service';

@Component({
  selector: 'app-navigation-confirmation-host',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <otui-modal
      [visible]="confirmation.isPending()"
      heading="Leave this configuration?"
      [closable]="true"
      [backdrop]="true"
      [closeOnBackdrop]="true"
      [closeOnEscape]="true"
      ariaLabelledBy="navigation-confirmation-title"
      ariaDescribedBy="navigation-confirmation-description"
      (close)="stay()"
    >
      <span modal-title id="navigation-confirmation-title" class="sr-only">
        Leave this configuration?
      </span>
      <p id="navigation-confirmation-description">
        You have unsaved changes. Stay here to keep editing, or leave and
        discard this local draft.
      </p>
      <div modal-footer class="navigation-confirmation-actions">
        <button
          type="button"
          data-action="stay-unsaved-navigation"
          (click)="stay()"
        >
          Stay
        </button>
        <button
          type="button"
          data-action="leave-unsaved-navigation"
          (click)="leave()"
        >
          Leave without saving
        </button>
      </div>
    </otui-modal>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
      .navigation-confirmation-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      .navigation-confirmation-actions button {
        min-height: 2.6rem;
        padding: 0.55rem 0.9rem;
        border: 1px solid var(--border, #c8c2b8);
        background: var(--surface, #f8f6f1);
        color: var(--foreground, #1b1d1a);
        font: 700 0.82rem ui-monospace, monospace;
        cursor: pointer;
      }
      .navigation-confirmation-actions button:last-child {
        border-color: var(--foreground, #1b1d1a);
        background: var(--accent, #d4f34a);
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
})
export class NavigationConfirmationHostComponent {
  readonly confirmation = inject(NavigationConfirmationService);

  stay(): void {
    this.confirmation.stay();
  }

  leave(): void {
    this.confirmation.leave();
  }
}
