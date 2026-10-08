import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, ModalComponent } from '@optimistic-tanuki/common-ui';

export interface SafetyReportSubmission {
  contentType: 'classified' | 'seller';
  contentId: string;
  reason: string;
  description?: string;
}

@Component({
  selector: 'app-safety-report-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ModalComponent],
  template: `
    <otui-modal [visible]="true" (close)="cancel.emit()">
      <section class="report-dialog" aria-labelledby="safety-report-title">
        <h2 id="safety-report-title">
          Report {{ contentType === 'classified' ? 'listing' : 'seller' }}
        </h2>
        <label for="safety-report-reason">Reason</label>
        <select id="safety-report-reason" [(ngModel)]="reason" required>
          <option value="" disabled>Select a reason</option>
          <option value="spam">Spam or scam</option>
          <option value="harassment">Harassment</option>
          <option value="hate_speech">Hate speech</option>
          <option value="violence">Violence or threats</option>
          <option value="misinformation">Misleading information</option>
          <option value="inappropriate">Inappropriate content</option>
          <option value="other">Other</option>
        </select>
        <label for="safety-report-description">Details (optional)</label>
        <textarea
          id="safety-report-description"
          [(ngModel)]="description"
          maxlength="2000"
          rows="4"
          aria-describedby="safety-report-count"
        ></textarea>
        <p id="safety-report-count">{{ description.length }}/2000</p>
        <div class="report-actions">
          <otui-button variant="text" (click)="cancel.emit()"
            >Cancel</otui-button
          >
          <otui-button variant="primary" [disabled]="!reason" (click)="submit()"
            >Send for review</otui-button
          >
        </div>
      </section>
    </otui-modal>
  `,
  styles: [
    `
      .report-dialog {
        display: grid;
        gap: 12px;
        min-width: min(28rem, 80vw);
        padding: 20px;
      }
      h2 {
        margin: 0 0 4px;
      }
      label {
        font-weight: 600;
      }
      select,
      textarea {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--border, #aaa);
        border-radius: 8px;
        background: var(--surface, #fff);
        color: var(--foreground, #222);
        font: inherit;
      }
      textarea {
        resize: vertical;
      }
      #safety-report-count {
        margin: -8px 0 0;
        text-align: right;
        font-size: 0.8rem;
      }
      .report-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 8px;
      }
    `,
  ],
})
export class SafetyReportDialogComponent {
  @Input({ required: true }) contentType: 'classified' | 'seller' =
    'classified';
  @Input({ required: true }) contentId = '';
  @Output() cancel = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<SafetyReportSubmission>();

  reason = '';
  description = '';

  submit(): void {
    if (!this.reason || !this.contentId.trim()) return;
    this.submitted.emit({
      contentType: this.contentType,
      contentId: this.contentId,
      reason: this.reason,
      ...(this.description.trim()
        ? { description: this.description.trim() }
        : {}),
    });
  }
}
