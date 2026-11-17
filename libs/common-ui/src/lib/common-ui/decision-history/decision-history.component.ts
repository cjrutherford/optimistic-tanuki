import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';
import { BadgeComponent } from '../badge.component';

export interface DecisionHistoryEntry {
  id: string;
  /** What was decided, already worded for a person ("Merge", "Approve"). */
  label: string;
  actor: string;
  at: string;
  reason?: string | null;
  /** The entry was reversed by a later undo. */
  undone?: boolean;
  /** This entry records an undo; it cannot itself be undone. */
  isUndo?: boolean;
  /** Only the latest non-undone decision is reversible. */
  reversible?: boolean;
}

export interface DecisionUndoRequest {
  entry: DecisionHistoryEntry;
  reason: string;
}

/**
 * An ordered, append-only decision history with an Undo on the one entry that
 * can be reversed. Undo asks for a confirmation and a required reason inside
 * the panel; the host performs the write and reloads.
 */
@Component({
  selector: 'otui-decision-history',
  standalone: true,
  imports: [CommonModule, ButtonComponent, BadgeComponent],
  template: `
    <ol class="decision-history" [attr.aria-label]="label">
      @for (entry of entries; track entry.id) {
      <li class="decision-history__entry">
        <span class="decision-history__label">{{ entry.label }}</span>
        <span class="decision-history__meta"
          >by <code>{{ entry.actor }}</code> at {{ entry.at }}</span
        >
        @if (entry.reason) {
        <span class="decision-history__reason">{{ entry.reason }}</span>
        } @if (entry.undone) {
        <otui-badge tone="neutral" size="sm">Undone</otui-badge>
        } @if (entry.isUndo) {
        <otui-badge tone="neutral" size="sm">Undo</otui-badge>
        } @if (entry.reversible && !entry.undone) {
        <otui-button
          size="sm"
          tone="warning"
          emphasis="outline"
          (click)="start(entry)"
        >
          Undo
        </otui-button>
        }
      </li>
      } @if (!entries.length) {
      <li class="decision-history__empty">No decisions recorded.</li>
      }
    </ol>
    @if (pending; as target) {
    <div
      class="decision-history__confirm"
      role="alertdialog"
      aria-label="Confirm undo"
    >
      <p class="decision-history__title">
        Undo this {{ target.label }} decision?
      </p>
      <label class="decision-history__field">
        <span>Reason (required)</span>
        <textarea
          class="decision-history__control"
          rows="2"
          maxlength="1024"
          [value]="reason"
          (input)="reason = $any($event.target).value"
        ></textarea>
      </label>
      @if (error) {
      <p class="decision-history__error" role="alert">{{ error }}</p>
      }
      <div class="decision-history__actions">
        <otui-button
          size="sm"
          tone="warning"
          emphasis="solid"
          [disabled]="busy"
          (click)="confirm()"
        >
          Confirm undo
        </otui-button>
        <otui-button
          size="sm"
          tone="neutral"
          emphasis="ghost"
          (click)="cancel()"
        >
          Cancel
        </otui-button>
      </div>
    </div>
    }
  `,
  styleUrls: ['./decision-history.component.scss'],
})
export class DecisionHistoryComponent {
  @Input() entries: DecisionHistoryEntry[] = [];
  @Input() label = 'Decision history';
  /** True while the host is writing the undo. */
  @Input() busy = false;
  @Output() undoConfirmed = new EventEmitter<DecisionUndoRequest>();

  pending: DecisionHistoryEntry | null = null;
  reason = '';
  error = '';

  start(entry: DecisionHistoryEntry): void {
    this.pending = entry;
    this.reason = '';
    this.error = '';
  }

  cancel(): void {
    this.pending = null;
    this.error = '';
  }

  confirm(): void {
    const reason = this.reason.trim();
    if (!this.pending) return;
    if (!reason || reason.length > 1024) {
      this.error = 'Enter a reason of up to 1024 characters.';
      return;
    }
    const entry = this.pending;
    this.pending = null;
    this.error = '';
    this.undoConfirmed.emit({ entry, reason });
  }
}
