import {
  Component,
  inject,
  Input,
  Output,
  EventEmitter,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';
import { PrivacyService, ReportContentDto } from '../../privacy.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ModalComponent],
  template: `
    <otui-modal [open]="true" (close)="cancel()">
      <div class="dialog-header">
        <h2>Report {{ contentType | titlecase }}</h2>
        <button class="close-button" (click)="cancel()">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6 6 18M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <div class="dialog-content">
        <p>Why are you reporting this {{ contentType }}?</p>

        <div class="reason-options">
          @for (option of reasonOptions; track option.value) {
          <label
            class="radio-option"
            [class.selected]="selectedReason() === option.value"
          >
            <input
              type="radio"
              name="reason"
              [value]="option.value"
              [(ngModel)]="reason"
            />
            <span class="radio-label">{{ option.label }}</span>
          </label>
          }
        </div>

        <div class="form-field">
          <label class="field-label">Additional details (optional)</label>
          <textarea
            [(ngModel)]="description"
            rows="4"
            placeholder="Provide more context..."
            class="text-area"
          ></textarea>
        </div>
      </div>

      <div class="dialog-actions">
        <otui-button variant="text" (click)="cancel()">Cancel</otui-button>
        <otui-button
          variant="primary"
          (click)="submit()"
          [disabled]="!selectedReason()"
          >Submit Report</otui-button
        >
      </div>
    </otui-modal>
  `,
  styles: [
    `
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border);
      }
      .dialog-header h2 {
        margin: 0;
        font-size: 18px;
      }
      .close-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 50%;
        cursor: pointer;
        transition: background 0.2s;
      }
      .close-button:hover {
        background: var(--hover-bg);
      }
      .close-button svg {
        width: 20px;
        height: 20px;
      }
      .dialog-content {
        padding: 20px;
      }
      .reason-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 16px 0;
      }
      .radio-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .radio-option:hover {
        border-color: var(--primary);
      }
      .radio-option.selected {
        border-color: var(--primary);
        background: var(--primary-alpha, rgba(25, 118, 210, 0.1));
      }
      .radio-option input {
        display: none;
      }
      .radio-label {
        flex: 1;
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
      .text-area:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-alpha, rgba(25, 118, 210, 0.2));
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

  private privacyService = inject(PrivacyService);
  private messageService = inject(MessageService);

  reason = '';
  description = '';
  selectedReason = signal('');

  reasonOptions = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'hate_speech', label: 'Hate speech' },
    { value: 'violence', label: 'Violence' },
    { value: 'misinformation', label: 'Misinformation' },
    { value: 'inappropriate', label: 'Inappropriate content' },
    { value: 'other', label: 'Other' },
  ];

  ngOnChanges() {
    // Sync reason signal with ngModel
    this.selectedReason.set(this.reason);
  }

  submit() {
    if (!this.reason) return;

    const dto: ReportContentDto = {
      contentType: this.contentType,
      contentId: this.contentId,
      reason: this.reason,
      description: this.description,
    };

    this.privacyService.reportContent(dto).subscribe({
      next: () => {
        this.messageService.addMessage({
          content:
            'Report submitted. Thank you for helping keep our community safe.',
          type: 'success',
        });
        this.reportSubmitted.emit();
        this.cancel();
      },
      error: () => {
        this.messageService.addMessage({
          content: 'Failed to submit report. Please try again.',
          type: 'error',
        });
      },
    });
  }

  cancel() {
    this.closeDialog.emit();
  }
}
