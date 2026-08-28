import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * The approval gate, as a thing a person actually uses.
 *
 * A project can require that changes are approved before they happen. That
 * flag existed for a while and was read by nothing, and there was nowhere in
 * the app to see a proposal or answer one, so an agent's work either happened
 * silently or sat in a table nobody could reach.
 *
 * The design rule here is that a reviewer must be able to see what they are
 * agreeing to. A row saying "task.create" and nothing else asks somebody to
 * approve a shape rather than a change, so the payload is rendered field by
 * field, and the operation is named in words.
 */

export interface AiChange {
  id: string;
  operation: string;
  payload: Record<string, unknown>;
  /** Why it was proposed. A payload says what; this says why. */
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  proposedBy?: string;
  reviewedBy?: string;
  reviewNote?: string;
  applied?: boolean;
  appliedEntityId?: string;
  applyError?: string;
  createdAt?: string;
}

export interface AiChangeDecision {
  id: string;
  status: 'APPROVED' | 'REJECTED';
  reviewNote?: string;
}

@Component({
  selector: 'lib-ai-change-review',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-change-review.component.html',
  styleUrl: './ai-change-review.component.scss',
})
export class AiChangeReviewComponent {
  @Input() changes: AiChange[] = [];
  @Input() busyId: string | null = null;
  /** True while a model is being asked what the project needs. */
  @Input() asking = false;
  @Output() decided = new EventEmitter<AiChangeDecision>();
  @Output() suggestionsRequested = new EventEmitter<void>();

  notes: Record<string, string> = {};

  get pending(): AiChange[] {
    return this.changes.filter((change) => change.status === 'PENDING');
  }

  get settled(): AiChange[] {
    return this.changes.filter((change) => change.status !== 'PENDING');
  }

  /**
   * The operation in words.
   *
   * "task.create" is the wire name. Asking somebody to approve that is asking
   * them to read a command rather than a decision.
   */
  describe(operation: string): string {
    const words: Record<string, string> = {
      'task.create': 'Create a task',
      'task.update': 'Change a task',
      'risk.create': 'Record a risk',
      'change.create': 'Record a change',
      'projectJournal.create': 'Add a journal entry',
      'taskNote.create': 'Add a note to a task',
    };
    return words[operation] ?? operation;
  }

  /** The payload as rows, so a reviewer sees the actual values. */
  fields(change: AiChange): { key: string; value: string }[] {
    return Object.entries(change.payload ?? {})
      .filter(([key]) => !['projectId', 'requestingUserId'].includes(key))
      .filter(
        ([, value]) => value !== null && value !== undefined && value !== ''
      )
      .map(([key, value]) => ({
        key: this.label(key),
        value:
          typeof value === 'object' ? JSON.stringify(value) : String(value),
      }));
  }

  private label(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (first) => first.toUpperCase())
      .trim();
  }

  approve(change: AiChange): void {
    this.decided.emit({
      id: change.id,
      status: 'APPROVED',
      reviewNote: this.notes[change.id]?.trim() || undefined,
    });
  }

  reject(change: AiChange): void {
    this.decided.emit({
      id: change.id,
      status: 'REJECTED',
      reviewNote: this.notes[change.id]?.trim() || undefined,
    });
  }

  noteChanged(id: string, event: Event): void {
    this.notes[id] = (event.target as HTMLInputElement).value;
  }

  /**
   * What became of a change that was already decided.
   *
   * Approved and applied is not the same as approved and failed, and a
   * reviewer who sees only "APPROVED" will reasonably believe the board
   * changed.
   */
  outcome(change: AiChange): string {
    if (change.status === 'REJECTED') return 'Rejected';
    if (change.applied) return 'Approved and done';
    if (change.applyError) return `Approved, but it did not go through`;
    return 'Approved';
  }
}
