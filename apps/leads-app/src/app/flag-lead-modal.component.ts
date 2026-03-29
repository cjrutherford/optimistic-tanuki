import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Lead, LeadFlagReason, FLAG_REASON_LABELS } from './leads.types';

@Component({
    selector: 'app-flag-lead-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div>
            <h2>Flag Lead</h2>
            <p class="flag-lead-name">{{ lead?.name }} <span *ngIf="lead?.company">— {{ lead?.company }}</span></p>
          </div>
          <button class="close-btn" (click)="close.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <label class="section-label">Select Reasons</label>
          <div class="reason-grid">
            <button
              *ngFor="let reason of reasons"
              class="reason-chip"
              [class.selected]="selectedReasons.has(reason)"
              (click)="toggleReason(reason)"
            >
              <svg *ngIf="selectedReasons.has(reason)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ reasonLabels[reason] }}
            </button>
          </div>

          <div class="notes-group">
            <label class="section-label">Additional Notes (optional)</label>
            <textarea
              [(ngModel)]="notes"
              name="flagNotes"
              rows="3"
              placeholder="Any additional context..."
            ></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="close.emit()">Cancel</button>
          <button
            class="btn btn-danger"
            [disabled]="selectedReasons.size === 0"
            (click)="submitFlag()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            Flag Lead
          </button>
        </div>
      </div>
    </div>
  `,
    styles: [`
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-content {
      background: var(--app-surface);
      border-radius: var(--radius-lg);
      width: 90%;
      max-width: 520px;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 1.5rem;
      border-bottom: 1px solid var(--app-border);

      h2 {
        font-size: 1.25rem;
        font-weight: 600;
        margin: 0;
        color: var(--app-foreground);
      }
    }

    .flag-lead-name {
      font-size: 0.8125rem;
      color: var(--app-muted);
      margin: 0.25rem 0 0;
    }

    .close-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      border-radius: var(--radius-sm);
      color: var(--app-muted);
      cursor: pointer;
      flex-shrink: 0;

      svg { width: 20px; height: 20px; }
      &:hover { background: var(--app-muted); }
    }

    .modal-body {
      padding: 1.5rem;
    }

    .section-label {
      display: block;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--app-foreground);
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .reason-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }

    .reason-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.5rem 0.875rem;
      font-size: 0.8125rem;
      font-weight: 500;
      border: 1px solid var(--app-border);
      border-radius: var(--radius-md);
      background: var(--app-background);
      color: var(--app-foreground);
      cursor: pointer;
      transition: all var(--transition-fast);

      svg { width: 14px; height: 14px; }

      &:hover {
        border-color: var(--app-danger);
        color: var(--app-danger);
      }

      &.selected {
        background: var(--app-danger);
        border-color: var(--app-danger);
        color: white;
      }
    }

    .notes-group {
      textarea {
        width: 100%;
        padding: 0.625rem 0.875rem;
        font-size: 0.875rem;
        border: 1px solid var(--app-border);
        border-radius: var(--radius-md);
        background: var(--app-background);
        color: var(--app-foreground);
        resize: vertical;
        font-family: inherit;
        transition: border-color var(--transition-fast);

        &:focus { outline: none; border-color: var(--app-primary); }
        &::placeholder { color: var(--app-muted); }
      }
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--app-border);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: var(--radius-md);
      border: none;
      cursor: pointer;
      transition: all var(--transition-fast);

      svg { width: 16px; height: 16px; }

      &-secondary {
        background: var(--app-surface);
        color: var(--app-foreground);
        border: 1px solid var(--app-border);
      }

      &-danger {
        background: var(--app-danger);
        color: white;

        &:hover { filter: brightness(1.1); transform: translateY(-1px); }
        &:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      }
    }
  `],
})
export class FlagLeadModalComponent {
    @Input() lead: Lead | null = null;
    @Output() close = new EventEmitter<void>();
    @Output() flagged = new EventEmitter<{ reasons: LeadFlagReason[]; notes?: string }>();

    reasons = Object.values(LeadFlagReason);
    reasonLabels = FLAG_REASON_LABELS;
    selectedReasons = new Set<LeadFlagReason>();
    notes = '';

    toggleReason(reason: LeadFlagReason) {
        if (this.selectedReasons.has(reason)) {
            this.selectedReasons.delete(reason);
        } else {
            this.selectedReasons.add(reason);
        }
    }

    submitFlag() {
        if (this.selectedReasons.size === 0) return;
        this.flagged.emit({
            reasons: Array.from(this.selectedReasons),
            notes: this.notes.trim() || undefined,
        });
    }
}
