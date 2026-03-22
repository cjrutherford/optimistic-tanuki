import {
  Component,
  inject,
  OnInit,
  signal,
  OnDestroy,
  Input,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import { PaymentService, DonationGoal } from '../../services/payment.service';
import { AuthStateService } from '../../services/auth-state.service';

@Component({
  selector: 'app-donation-progress',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ModalComponent],
  template: `
    <div class="donation-widget" [class.compact]="compact">
      @if (!compact) {
      <div class="donation-header">
        <h3>Support Towne Square</h3>
        <p class="donation-subtitle">Help us keep this community thriving</p>
      </div>
      } @if (loading()) {
      <div class="loading-skeleton">
        <div class="skeleton-bar"></div>
        <div class="skeleton-text"></div>
      </div>
      } @else {
      <div class="progress-section">
        <div class="progress-info">
          <span class="current-amount"
            >\${{ currentAmount() | number : '1.0-0' }}</span
          >
          @if (!compact) {
          <span class="goal-amount"
            >of \${{ goal() | number : '1.0-0' }} goal</span
          >
          }
        </div>

        <div class="progress-bar-container">
          <div
            class="progress-bar"
            [style.width.%]="progressPercent()"
            [class.goal-reached]="progressPercent() >= 100"
          ></div>
        </div>

        @if (!compact) {
        <div class="progress-details">
          <span class="donor-count">{{ donorCount() }} donors this month</span>
          @if (progressPercent() >= 100) {
          <span class="goal-met">🎉 Goal reached!</span>
          }
        </div>
        }
      </div>

      @if (!compact) {
      <button
        class="donate-btn donate-btn-outline"
        (click)="showDonationModal.set(true)"
      >
        Donate to Support
      </button>

      <otui-modal
        [visible]="showDonationModal()"
        heading="Make a Donation"
        [closable]="true"
        (close)="showDonationModal.set(false)"
        size="md"
      >
        <div class="donation-options">
          <div class="preset-amounts">
            @for (amount of presetAmounts; track amount) {
            <button
              class="amount-btn"
              [class.selected]="selectedAmount() === amount"
              (click)="selectAmount(amount)"
            >
              \${{ amount }}
            </button>
            }
          </div>

          <div class="custom-amount">
            <label for="custom-amount-modal">Custom amount:</label>
            <div class="input-wrapper">
              <span class="currency">$</span>
              <input
                type="number"
                id="custom-amount-modal"
                [(ngModel)]="customAmount"
                (input)="onCustomAmountChange($event)"
                placeholder="Other amount"
                min="1"
              />
            </div>
          </div>

          <div class="donation-type">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="isRecurring" />
              <span>Make this a monthly recurring donation</span>
            </label>
          </div>

          <button
            class="donate-btn"
            [disabled]="!canDonate() || donating()"
            (click)="donate()"
          >
            @if (donating()) {
            <span class="spinner"></span> Processing... } @else { Donate \${{
              selectedAmount() || customAmount
            }}
            }
          </button>
        </div>
      </otui-modal>
      } } @if (error()) {
      <div class="error-message">{{ error() }}</div>
      } @if (!compact) {
      <div class="donation-footer">
        <a routerLink="/account/donations">View your donations</a>
        <span class="separator">•</span>
        <a (click)="openPortal()" class="manage-link">Manage recurring</a>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .donation-widget {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        font-family: inherit;
      }

      .donation-header {
        text-align: center;
        margin-bottom: 20px;
      }

      .donation-header h3 {
        margin: 0 0 4px;
        font-size: 1.25rem;
        font-weight: 600;
        font-family: var(--font-heading);
        color: var(--foreground);
      }

      .donation-subtitle {
        margin: 0;
        font-size: 0.875rem;
        color: var(--foreground-muted);
      }

      .progress-section {
        margin-bottom: 20px;
      }

      .progress-info {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 8px;
      }

      .current-amount {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--foreground);
      }

      .goal-amount {
        font-size: 0.875rem;
        color: var(--foreground-muted);
      }

      .progress-bar-container {
        height: 12px;
        background: var(--muted);
        border-radius: 6px;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background: linear-gradient(
          90deg,
          var(--primary) 0%,
          var(--success) 100%
        );
        border-radius: 6px;
        transition: width 0.5s ease-out;
      }

      .progress-bar.goal-reached {
        background: linear-gradient(90deg, var(--success) 0%, #2ecc71 100%);
      }

      .progress-details {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 0.75rem;
        color: var(--foreground-muted);
      }

      .goal-met {
        color: var(--success);
        font-weight: 600;
      }

      .donation-options {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .preset-amounts {
        display: flex;
        gap: 8px;
      }

      .amount-btn {
        flex: 1;
        padding: 10px;
        border: 2px solid var(--border);
        border-radius: 8px;
        background: var(--surface);
        font-size: 1rem;
        font-weight: 600;
        color: var(--foreground);
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .amount-btn:hover {
        border-color: var(--primary);
      }

      .amount-btn.selected {
        border-color: var(--primary);
        background: var(--primary);
        color: var(--on-primary);
      }

      .custom-amount {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .custom-amount label {
        font-size: 0.875rem;
        color: var(--foreground-muted);
      }

      .input-wrapper {
        display: flex;
        align-items: center;
        border: 2px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
      }

      .currency {
        padding: 10px 12px;
        background: var(--surface-variant);
        color: var(--foreground-muted);
        font-weight: 600;
      }

      .input-wrapper input {
        flex: 1;
        padding: 10px 12px;
        border: none;
        font-size: 1rem;
        outline: none;
        background: var(--surface);
        color: var(--foreground);
      }

      .donation-type {
        display: flex;
        align-items: center;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.875rem;
        color: var(--foreground-muted);
        cursor: pointer;
      }

      .checkbox-label input {
        width: 18px;
        height: 18px;
        accent-color: var(--primary);
      }

      .donate-btn {
        width: 100%;
        padding: 14px;
        border: none;
        border-radius: 10px;
        background: var(--primary);
        color: var(--on-primary);
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }

      .donate-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(45, 90, 74, 0.4);
      }

      .donate-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .donate-btn-outline {
        background: transparent;
        border: 2px solid var(--primary);
        color: var(--primary);
      }

      .donate-btn-outline:hover {
        background: var(--primary);
        color: var(--on-primary);
      }

      .donation-footer {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: center;
        gap: 8px;
        font-size: 0.75rem;
      }

      .donation-footer a {
        color: var(--primary);
        text-decoration: none;
        cursor: pointer;
      }

      .donation-footer a:hover {
        text-decoration: underline;
      }

      .separator {
        color: var(--border);
      }

      .error-message {
        margin-top: 12px;
        padding: 10px;
        background: var(--error-bg);
        border-radius: 8px;
        color: var(--error);
        font-size: 0.875rem;
        text-align: center;
      }

      .loading-skeleton {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .skeleton-bar {
        height: 12px;
        background: linear-gradient(
          90deg,
          var(--muted) 25%,
          var(--surface-variant) 50%,
          var(--muted) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 6px;
      }

      .skeleton-text {
        height: 20px;
        width: 60%;
        background: linear-gradient(
          90deg,
          var(--muted) 25%,
          var(--surface-variant) 50%,
          var(--muted) 75%
        );
        background-size: 200% 100%;
        animation: shimmer 1.5s infinite;
        border-radius: 4px;
      }

      @keyframes shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: white;
        animation: spin 0.8s linear infinite;
        margin-right: 8px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .donation-widget.compact {
        padding: 12px 16px;
        background: transparent;
        box-shadow: none;
        border: none;
      }

      .donation-widget.compact .progress-section {
        margin-bottom: 0;
      }

      .donation-widget.compact .progress-info {
        margin-bottom: 4px;
      }

      .donation-widget.compact .current-amount {
        font-size: 1rem;
        font-weight: 600;
      }

      .donation-widget.compact .progress-bar-container {
        height: 8px;
        border-radius: 4px;
      }

      .donation-widget.compact .progress-bar {
        border-radius: 4px;
      }
    `,
  ],
})
export class DonationProgressComponent implements OnInit, OnDestroy {
  private paymentService = inject(PaymentService);
  private authState = inject(AuthStateService);
  private platformId = inject(PLATFORM_ID);

  @Input() monthlyGoal = 5000;
  @Input() compact = false;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly donating = signal(false);

  readonly goal = signal(5000);
  readonly currentAmount = signal(0);
  readonly donorCount = signal(0);

  readonly showDonationOptions = signal(false);
  readonly showDonationModal = signal(false);
  readonly selectedAmount = signal<number | null>(null);
  readonly isRecurring = signal(false);

  readonly presetAmounts = [5, 10, 25, 50];
  customAmount = 0;

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.goal.set(this.monthlyGoal);

    if (isPlatformBrowser(this.platformId)) {
      this.loadDonationProgress();

      this.refreshInterval = setInterval(() => {
        this.loadDonationProgress();
      }, 60000);
    }
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  progressPercent(): number {
    if (this.goal() <= 0) return 0;
    return Math.min(100, (this.currentAmount() / this.goal()) * 100);
  }

  canDonate(): boolean {
    return (this.selectedAmount() ?? this.customAmount) > 0;
  }

  selectAmount(amount: number): void {
    this.selectedAmount.set(amount);
    this.customAmount = 0;
  }

  onCustomAmountChange(event: Event): void {
    this.selectedAmount.set(null);
    const value = (event.target as HTMLInputElement).valueAsNumber;
    if (!isNaN(value)) {
      this.customAmount = value;
    }
  }

  async donate(): Promise<void> {
    const amount = this.selectedAmount() ?? this.customAmount;
    if (!amount || amount <= 0) return;

    this.donating.set(true);
    this.error.set(null);

    try {
      const { checkoutUrl } = await this.paymentService.createDonationCheckout(
        amount,
        this.isRecurring()
      );
      window.location.href = checkoutUrl;
    } catch (err: any) {
      this.error.set(
        err.error?.message || 'Failed to create donation. Please try again.'
      );
    } finally {
      this.donating.set(false);
    }
  }

  async openPortal(): Promise<void> {
    try {
      const { url } = await this.paymentService.getLemonSqueezyPortalUrl();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to open portal:', err);
    }
  }

  private async loadDonationProgress(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const now = new Date();
      const goal = await this.paymentService.getDonationGoal(
        now.getMonth() + 1,
        now.getFullYear()
      );

      this.goal.set(goal.monthlyGoal);
      this.currentAmount.set(goal.currentAmount);
      this.donorCount.set(goal.donorCount);
    } catch (err) {
      console.error('Failed to load donation progress:', err);
    } finally {
      this.loading.set(false);
    }
  }
}
