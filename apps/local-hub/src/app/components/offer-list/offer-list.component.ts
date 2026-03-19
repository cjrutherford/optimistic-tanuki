import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService, Offer } from '../../services/payment.service';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-offer-list',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe, FormsModule],
  template: `
    <div class="offer-list">
      <div class="header">
        <h3>Offers</h3>
        <span class="count">{{ offers().length }}</span>
      </div>

      <div class="offers-container">
        <div *ngIf="loading()" class="loading">Loading offers...</div>

        <div *ngIf="!loading() && offers().length === 0" class="empty">
          No offers yet
        </div>

        <div
          *ngFor="let offer of offers()"
          class="offer-card"
          [class.pending]="offer.status === 'pending'"
          [class.countered]="offer.status === 'countered'"
          [class.accepted]="offer.status === 'accepted'"
          [class.rejected]="offer.status === 'rejected'"
          [class.withdrawn]="offer.status === 'withdrawn'"
          [class.expired]="offer.status === 'expired'"
        >
          <div class="offer-header">
            <span class="amount"
              >\${{ offer.offeredAmount | number : '1.2-2' }}</span
            >
            <span class="status-badge" [attr.data-status]="offer.status">
              {{ formatStatus(offer.status) }}
            </span>
          </div>

          <div class="offer-details">
            <p *ngIf="offer.message" class="message">"{{ offer.message }}"</p>

            <div
              *ngIf="offer.status === 'countered' && offer.counterOfferAmount"
              class="counter-offer"
            >
              <strong>Counter offer:</strong> \${{
                offer.counterOfferAmount | number : '1.2-2'
              }}
              <p *ngIf="offer.counterMessage" class="counter-message">
                "{{ offer.counterMessage }}"
              </p>
            </div>

            <p class="meta">
              <span class="date">{{ offer.createdAt | date : 'short' }}</span>
              <span class="expires"
                >Expires: {{ offer.expiresAt | date : 'shortDate' }}</span
              >
            </p>
          </div>

          <div class="offer-actions" *ngIf="canRespond(offer)">
            <button
              class="btn-accept"
              (click)="onAccept(offer)"
              [disabled]="actionLoading()"
            >
              Accept
            </button>
            <button
              class="btn-reject"
              (click)="onReject(offer)"
              [disabled]="actionLoading()"
            >
              Reject
            </button>
            <button
              class="btn-counter"
              (click)="onCounter(offer)"
              [disabled]="actionLoading()"
            >
              Counter
            </button>
          </div>

          <div
            class="payment-info"
            *ngIf="offer.status === 'accepted' && offer.acceptedPaymentId"
          >
            <p>
              Payment pending.
              <a (click)="viewPayment.emit(offer.acceptedPaymentId)"
                >View payment details</a
              >
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Counter Modal -->
    <div
      class="modal-overlay"
      *ngIf="showCounterModal()"
      (click)="closeCounterModal()"
    >
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Counter Offer</h3>
          <button class="close-btn" (click)="closeCounterModal()">
            &times;
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Your Counter Amount</label>
            <div class="input-wrapper">
              <span class="currency">$</span>
              <input
                type="number"
                [(ngModel)]="counterAmount"
                placeholder="Enter amount"
                min="1"
              />
            </div>
            <p class="fee-notice" *ngIf="counterAmount && counterAmount > 0">
              Buyer will pay: \${{ counterAmount | number : '1.2-2' }}<br />
              Platform fee (5%): \${{ counterAmount * 0.05 | number : '1.2-2'
              }}<br />
              Seller receives: \${{ counterAmount * 0.95 | number : '1.2-2' }}
            </p>
          </div>
          <div class="form-group">
            <label>Message (optional)</label>
            <textarea
              [(ngModel)]="counterMessage"
              rows="3"
              placeholder="Add a message..."
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" (click)="closeCounterModal()">
            Cancel
          </button>
          <button
            class="btn-primary"
            (click)="submitCounter()"
            [disabled]="!counterAmount || actionLoading()"
          >
            {{ actionLoading() ? 'Submitting...' : 'Send Counter' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .offer-list {
        background: var(--bg-primary, #fff);
        border-radius: 8px;
        overflow: hidden;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }

      .header h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }

      .count {
        background: var(--primary-color, #3b82f6);
        color: white;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 500;
      }

      .loading,
      .empty {
        padding: 2rem;
        text-align: center;
        color: var(--text-secondary, #6b7280);
      }

      .offer-card {
        padding: 1rem;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
        transition: background 0.2s;
      }

      .offer-card:last-child {
        border-bottom: none;
      }

      .offer-card:hover {
        background: var(--bg-hover, #f9fafb);
      }

      .offer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }

      .amount {
        font-size: 1.25rem;
        font-weight: 600;
      }

      .status-badge {
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        text-transform: capitalize;
      }

      .status-badge[data-status='pending'] {
        background: #fef3c7;
        color: #92400e;
      }

      .status-badge[data-status='countered'] {
        background: #dbeafe;
        color: #1e40af;
      }

      .status-badge[data-status='accepted'] {
        background: #d1fae5;
        color: #065f46;
      }

      .status-badge[data-status='rejected'],
      .status-badge[data-status='withdrawn'],
      .status-badge[data-status='expired'] {
        background: #f3f4f6;
        color: #6b7280;
      }

      .offer-details .message {
        font-style: italic;
        color: var(--text-secondary, #6b7280);
        margin: 0.5rem 0;
      }

      .counter-offer {
        background: #dbeafe;
        padding: 0.75rem;
        border-radius: 6px;
        margin: 0.5rem 0;
      }

      .counter-message {
        font-style: italic;
        margin: 0.25rem 0 0;
        font-size: 0.875rem;
      }

      .meta {
        display: flex;
        gap: 1rem;
        font-size: 0.75rem;
        color: var(--text-secondary, #6b7280);
        margin: 0.5rem 0 0;
      }

      .offer-actions {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.75rem;
      }

      .offer-actions button {
        padding: 0.375rem 0.75rem;
        border-radius: 4px;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid;
      }

      .btn-accept {
        background: #10b981;
        border-color: #10b981;
        color: white;
      }

      .btn-accept:hover:not(:disabled) {
        background: #059669;
      }

      .btn-reject {
        background: white;
        border-color: #d1d5db;
        color: #374151;
      }

      .btn-reject:hover:not(:disabled) {
        background: #f3f4f6;
      }

      .btn-counter {
        background: #3b82f6;
        border-color: #3b82f6;
        color: white;
      }

      .btn-counter:hover:not(:disabled) {
        background: #2563eb;
      }

      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .payment-info {
        margin-top: 0.75rem;
        font-size: 0.8125rem;
      }

      .payment-info a {
        color: var(--primary-color, #3b82f6);
        cursor: pointer;
        text-decoration: underline;
      }

      /* Modal styles */
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
        max-width: 400px;
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
      }

      .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
      }

      .modal-body {
        padding: 1.5rem;
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
      }

      .currency {
        position: absolute;
        left: 0.75rem;
        top: 50%;
        transform: translateY(-50%);
      }

      .input-wrapper input {
        padding-left: 1.5rem;
      }

      input,
      textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--border-color, #d1d5db);
        border-radius: 6px;
      }

      .fee-notice {
        margin: 0.5rem 0 0;
        font-size: 0.8125rem;
        color: var(--text-secondary, #6b7280);
      }

      .modal-footer {
        display: flex;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color, #e5e7eb);
        justify-content: flex-end;
      }

      .btn-secondary {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        background: white;
        cursor: pointer;
      }

      .btn-primary {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        border: none;
        background: var(--primary-color, #3b82f6);
        color: white;
        cursor: pointer;
      }
    `,
  ],
})
export class OfferListComponent {
  @Input() offers = signal<Offer[]>([]);
  @Input() loading = signal(false);
  @Input() canManage = false;
  @Output() acceptOffer = new EventEmitter<Offer>();
  @Output() rejectOffer = new EventEmitter<Offer>();
  @Output() counterOffer = new EventEmitter<{
    offer: Offer;
    amount: number;
    message?: string;
  }>();
  @Output() viewPayment = new EventEmitter<string>();

  private messageService = inject(MessageService);

  actionLoading = signal(false);
  showCounterModal = signal(false);
  selectedOffer: Offer | null = null;
  counterAmount: number | null = null;
  counterMessage = '';

  formatStatus(status: string): string {
    return status;
  }

  canRespond(offer: Offer): boolean {
    if (!this.canManage) return false;
    return offer.status === 'pending' || offer.status === 'countered';
  }

  onAccept(offer: Offer): void {
    if (confirm('Accept this offer?')) {
      this.acceptOffer.emit(offer);
    }
  }

  onReject(offer: Offer): void {
    if (confirm('Reject this offer?')) {
      this.rejectOffer.emit(offer);
    }
  }

  onCounter(offer: Offer): void {
    this.selectedOffer = offer;
    this.counterAmount = offer.counterOfferAmount || offer.offeredAmount;
    this.counterMessage = '';
    this.showCounterModal.set(true);
  }

  closeCounterModal(): void {
    this.showCounterModal.set(false);
    this.selectedOffer = null;
  }

  async submitCounter(): Promise<void> {
    if (!this.selectedOffer || !this.counterAmount) return;

    this.counterOffer.emit({
      offer: this.selectedOffer,
      amount: this.counterAmount,
      message: this.counterMessage || undefined,
    });
    this.closeCounterModal();
  }
}
