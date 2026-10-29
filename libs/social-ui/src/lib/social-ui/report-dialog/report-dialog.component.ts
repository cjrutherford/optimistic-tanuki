import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import {
  PrivacyReportService,
  ReportContentDto,
} from '@optimistic-tanuki/social-data-access';

@Component({
  selector: 'lib-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ModalComponent],
  template: `
    <otui-modal
      [visible]="true"
      [heading]="'Report ' + (contentType | titlecase)"
      [ariaDescribedBy]="'report-dialog-instructions'"
      [closable]="false"
      [closeOnEscape]="submissionState() !== 'pending'"
      [closeOnBackdrop]="submissionState() !== 'pending'"
      (close)="cancel()"
    >
      <div class="dialog-header">
        <button
          type="button"
          class="close-button"
          aria-label="Close report"
          [disabled]="submissionState() === 'pending'"
          (click)="cancel()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="dialog-content">
        <p>
          Choose the reason that best describes your concern. Reports are
          reviewed under the same community safety policy.
        </p>

        <fieldset
          class="reason-options"
          [disabled]="submissionState() === 'pending'"
          [attr.aria-invalid]="showReasonError()"
        >
          <legend>Why are you reporting this {{ contentType }}?</legend>
          @for (option of reasonOptions; track option.value) {
          <label
            class="radio-option"
            [class.selected]="reason === option.value"
          >
            <input
              type="radio"
              name="report-reason"
              [value]="option.value"
              [(ngModel)]="reason"
              (ngModelChange)="onReasonChange()"
            />
            <span class="radio-label">{{ option.label }}</span>
          </label>
          }
        </fieldset>
        @if (showReasonError()) {
        <p class="field-error" role="alert">
          Choose a reason before submitting.
        </p>
        }

        <div class="form-field">
          <label class="field-label" for="report-details">
            Additional details (optional)
          </label>
          <textarea
            id="report-details"
            [(ngModel)]="description"
            rows="4"
            placeholder="Provide more context..."
            class="text-area"
            [disabled]="submissionState() === 'pending'"
          ></textarea>
        </div>

        <p
          class="submission-status"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          @switch (submissionState()) { @case ('pending') { Submitting report… }
          @case ('success') { Report submitted. Thank you for helping keep our
          community safe. } @case ('error') { Failed to submit report. Your
          reason and details are saved; try again. } }
        </p>
      </div>

      <div class="dialog-actions">
        <otui-button
          variant="text"
          (action)="cancel()"
          [disabled]="submissionState() === 'pending'"
          >Close</otui-button
        >
        <otui-button
          variant="primary"
          (action)="submit()"
          [disabled]="
            submissionState() === 'pending' || submissionState() === 'success'
          "
          >Submit Report</otui-button
        >
      </div>
    </otui-modal>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        justify-content: flex-end;
        padding: 8px 20px 0;
      }
      .close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border: 1px solid transparent;
        background: transparent;
        border-radius: 50%;
        color: var(--foreground);
        cursor: pointer;
      }
      .close-button:hover {
        background: var(--hover-bg);
      }
      .close-button:focus-visible,
      .radio-option:focus-within,
      .text-area:focus-visible {
        outline: 3px solid var(--foreground);
        outline-offset: 3px;
      }
      .close-button svg {
        width: 20px;
        height: 20px;
      }
      .dialog-content {
        padding: 16px 20px 20px;
      }
      .reason-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 16px 0 8px;
        padding: 0;
        border: 0;
      }
      .reason-options legend {
        margin-bottom: 8px;
        font-weight: 600;
      }
      .radio-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
      }
      .radio-option:hover,
      .radio-option.selected {
        border-color: var(--primary);
      }
      .radio-option input {
        width: 18px;
        height: 18px;
        accent-color: var(--primary);
      }
      .radio-label {
        flex: 1;
      }
      .field-error {
        margin: 8px 0;
        color: var(--danger, #a61b1b);
      }
      .form-field {
        margin-top: 16px;
      }
      .field-label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
      }
      .text-area {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        color: var(--foreground);
        font-size: 14px;
        font-family: inherit;
        resize: vertical;
        min-height: 100px;
      }
      .submission-status {
        min-height: 1.5em;
        margin: 12px 0 0;
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 20px;
        border-top: 1px solid var(--border);
      }
    `,
  ],
})
export class ReportDialogComponent {
  @Input() contentType:
    | 'post'
    | 'comment'
    | 'profile'
    | 'community'
    | 'message' = 'post';
  @Input() contentId!: string;
  @Output() closeDialog = new EventEmitter<void>();
  @Output() reportSubmitted = new EventEmitter<void>();

  private readonly privacyReports = inject(PrivacyReportService);

  readonly submissionState = signal<'idle' | 'pending' | 'success' | 'error'>(
    'idle'
  );
  readonly attemptedSubmit = signal(false);
  reason = '';
  description = '';

  readonly reasonOptions = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'hate_speech', label: 'Hate speech' },
    { value: 'violence', label: 'Violence' },
    { value: 'misinformation', label: 'Misinformation' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'other', label: 'Other' },
  ];

  showReasonError(): boolean {
    return this.attemptedSubmit() && !this.reason;
  }

  onReasonChange(): void {
    this.attemptedSubmit.set(false);
    if (this.submissionState() === 'error') this.submissionState.set('idle');
  }

  submit(): void {
    if (
      this.submissionState() === 'pending' ||
      this.submissionState() === 'success'
    ) {
      return;
    }
    if (!this.reason) {
      this.attemptedSubmit.set(true);
      return;
    }

    const dto: ReportContentDto = {
      contentType: this.contentType,
      contentId: this.contentId,
      reason: this.reason,
      description: this.description,
    };
    this.submissionState.set('pending');
    this.privacyReports.reportContent(dto).subscribe({
      next: () => {
        this.submissionState.set('success');
        this.reportSubmitted.emit();
      },
      error: () => this.submissionState.set('error'),
    });
  }

  cancel(): void {
    if (this.submissionState() === 'pending') return;
    this.closeDialog.emit();
  }
}
