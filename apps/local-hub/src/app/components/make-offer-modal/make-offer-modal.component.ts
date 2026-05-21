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
import { PaymentService, Offer } from '../../services/payment.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import {
  PLATFORM_FEE_PERCENTAGE,
  LEMON_SQUEEZY_FEE_PERCENTAGE,
  LEMON_SQUEEZY_FLAT_FEE,
} from '@optimistic-tanuki/payment-fees';

@Component({
  selector: 'app-make-offer-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="onClose()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Make an Offer</h3>
          <button class="close-btn" (click)="onClose()" aria-label="Close">
            &times;
          </button>
        </div>

        <div class="modal-body">
          <p class="listing-info">
            Offer for: <strong>{{ listingTitle }}</strong>
          </p>
          <p class="asking-price">
            Asking price: <strong>\${{ askingPrice }}</strong>
          </p>

          <div class="form-group">
            <label for="offerAmount">Your Offer *</label>
            <div class="input-wrapper">
              <span class="currency">$</span>
              <input
                type="number"
                id="offerAmount"
                [(ngModel)]="offerAmount"
                placeholder="Enter amount"
                min="1"
                step="0.01"
                [disabled]="loading()"
              />
            </div>
            <p class="fee-notice" *ngIf="offerAmount && offerAmount > 0">
              Platform fee (10% + $0.50): <strong>\${{ getTotalFee() | number : '1.2-2' }}</strong><br />
              Seller receives: <strong>\${{ getSellerReceives() | number : '1.2-2' }}</strong>
            </p>
          </div>

          <div class="form-group">
            <label for="message">Message (optional)</label>
            <textarea
              id="message"
              [(ngModel)]="message"
              placeholder="Add a message to the seller..."
              rows="3"
              [disabled]="loading()"
            ></textarea>
          </div>

          <p class="error" *ngIf="error()">{{ error() }}</p>
        </div>

        <div class="modal-footer">
          <button
            class="btn-secondary"
            (click)="onClose()"
            [disabled]="loading()"
          >
            Cancel
          </button>
          <button
            class="btn-primary"
            (click)="onSubmit()"
            [disabled]="loading() || !offerAmount || offerAmount <= 0"
          >
            {{ loading() ? 'Submitting...' : 'Submit Offer' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
      }

      .modal-content {
        background: var(--bg-primary, #fff);
        border-radius: 12px;
        width: 100%;
        max-width: 420px;
        max-height: 90vh;
        overflow-y: auto;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }

      .modal-header h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        color: var(--text-secondary, #6b7280);
      }

      .modal-body {
        padding: 1.5rem;
      }

      .listing-info,
      .asking-price {
        margin: 0 0 0.5rem;
        color: var(--text-secondary, #6b7280);
      }

      .asking-price {
        margin-bottom: 1.5rem;
      }

      .form-group {
        margin-bottom: 1rem;
      }

      .form-group label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        font-size: 0.875rem;
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .currency {
        position: absolute;
        left: 0.75rem;
        color: var(--text-secondary, #6b7280);
      }

      .input-wrapper input {
        padding-left: 1.75rem;
      }

      input,
      textarea {
        width: 100%;
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--border-color, #d1d5db);
        border-radius: 6px;
        font-size: 1rem;
        transition: border-color 0.2s, box-shadow 0.2s;
      }

      input:focus,
      textarea:focus {
        outline: none;
        border-color: var(--primary-color, #3b82f6);
        box-shadow: 0 0 0 3px
          var(--primary-color-alpha, rgba(59, 130, 246, 0.1));
      }

      .fee-notice {
        margin: 0.5rem 0 0;
        font-size: 0.8125rem;
        color: var(--text-secondary, #6b7280);
      }

      .error {
        color: var(--error-color, #ef4444);
        font-size: 0.875rem;
        margin: 0.5rem 0 0;
      }

      .modal-footer {
        display: flex;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color, #e5e7eb);
        justify-content: flex-end;
      }

      button {
        padding: 0.625rem 1.25rem;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
      }

      .btn-secondary {
        background: var(--bg-secondary, #f3f4f6);
        border: 1px solid var(--border-color, #d1d5db);
        color: var(--text-primary, #374151);
      }

      .btn-secondary:hover:not(:disabled) {
        background: var(--bg-hover, #e5e7eb);
      }

      .btn-primary {
        background: var(--primary-color, #3b82f6);
        border: 1px solid var(--primary-color, #3b82f6);
        color: white;
      }

      .btn-primary:hover:not(:disabled) {
        background: var(--primary-hover, #2563eb);
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class MakeOfferModalComponent {
  @Input() classifiedId = '';
  @Input() sellerId = '';
  @Input() listingTitle = '';
  @Input() askingPrice = 0;
  @Output() offerSubmitted = new EventEmitter<Offer>();
  @Output() closed = new EventEmitter<void>();

  private paymentService = inject(PaymentService);
  private messageService = inject(MessageService);

  offerAmount: number | null = null;
  message = '';
  loading = signal(false);
  error = signal<string | null>(null);

  getTotalFee(): number {
    if (!this.offerAmount) return 0;
    const percentageFee =
      this.offerAmount * (PLATFORM_FEE_PERCENTAGE + LEMON_SQUEEZY_FEE_PERCENTAGE);
    return Math.round((percentageFee + LEMON_SQUEEZY_FLAT_FEE) * 100) / 100;
  }

  getSellerReceives(): number {
    if (!this.offerAmount) return 0;
    return Math.round((this.offerAmount - this.getTotalFee()) * 100) / 100;
  }

  onClose(): void {
    this.closed.emit();
  }

  async onSubmit(): Promise<void> {
    if (!this.offerAmount || this.offerAmount <= 0) {
      this.error.set('Please enter a valid offer amount');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const offer = await this.paymentService.createOffer(
        this.classifiedId,
        this.sellerId,
        this.offerAmount,
        this.message || undefined
      );
      this.messageService.addMessage({
        content: 'Your offer has been submitted!',
        type: 'success',
      });
      this.offerSubmitted.emit(offer);
      this.closed.emit();
    } catch (err) {
      this.error.set('Failed to submit offer. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
