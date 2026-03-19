import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../services/auth-state.service';
import {
  PaymentService,
  Offer,
  Payment,
  EarningsSummary,
  PayoutRequest,
  SellerWallet,
} from '../../services/payment.service';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';
import {
  ClassifiedService,
  ClassifiedAdDto,
} from '@optimistic-tanuki/classified-ui';
import { MessageService } from '@optimistic-tanuki/message-ui';

@Component({
  selector: 'app-seller-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, CurrencyPipe, RouterModule, FormsModule],
  template: `
    <div class="seller-dashboard">
      <div class="dashboard-header">
        <h1>Seller Dashboard</h1>
        <p>Manage your listings, offers, and payments</p>
      </div>

      @if (loading()) {
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading dashboard...</p>
      </div>
      } @else {

      <!-- Stats Overview -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{{ myListings().length }}</span>
          <span class="stat-label">Active Listings</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ sellerPendingOffers().length }}</span>
          <span class="stat-label">Pending Offers</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ sellerAcceptedOffers().length }}</span>
          <span class="stat-label">Accepted Offers</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ totalEarnings() | currency }}</span>
          <span class="stat-label">Total Earnings</span>
        </div>
      </div>

      <!-- Earnings & Wallet Section -->
      @if (earningsSummary()) {
      <section class="dashboard-section">
        <h2>Earnings & Wallet</h2>
        <div class="earnings-grid">
          <div class="earning-card available">
            <span class="earning-label">Available Balance</span>
            <span class="earning-value">{{
              earningsSummary()!.availableBalance | currency
            }}</span>
            @if (earningsSummary()!.availableBalance > 0) {
            <button class="btn btn-primary" (click)="openCashoutModal()">
              Request Cashout
            </button>
            }
          </div>
          <div class="earning-card pending">
            <span class="earning-label">Pending</span>
            <span class="earning-value">{{
              earningsSummary()!.pendingBalance | currency
            }}</span>
          </div>
          <div class="earning-card total">
            <span class="earning-label">Total Earned</span>
            <span class="earning-value">{{
              earningsSummary()!.totalEarned | currency
            }}</span>
          </div>
          <div class="earning-card payouts">
            <span class="earning-label">Total Paid Out</span>
            <span class="earning-value">{{
              earningsSummary()!.totalPaidOut | currency
            }}</span>
          </div>
        </div>
      </section>
      }

      <!-- Payout History -->
      @if (payoutRequests().length > 0) {
      <section class="dashboard-section">
        <h2>Payout Requests</h2>
        <div class="payouts-list">
          @for (payout of payoutRequests(); track payout.id) {
          <div class="payout-card">
            <div class="payout-info">
              <span class="payout-amount">{{ payout.amount | currency }}</span>
              <span class="payout-method">{{
                payout.payoutMethod | titlecase
              }}</span>
              <span class="payout-date">{{
                payout.createdAt | date : 'short'
              }}</span>
            </div>
            <span class="payout-status" [class]="'status-' + payout.status">
              {{ payout.status }}
            </span>
            @if (payout.status === 'pending') {
            <button class="btn btn-reject" (click)="cancelPayout(payout)">
              Cancel
            </button>
            }
          </div>
          }
        </div>
      </section>
      }

      <!-- Pending Offers -->
      @if (sellerPendingOffers().length > 0) {
      <section class="dashboard-section">
        <h2>Pending Offers</h2>
        <div class="offers-list">
          @for (offer of sellerPendingOffers(); track offer.id) {
          <div class="offer-card">
            <div class="offer-info">
              <span class="listing-title">{{
                getListingTitle(offer.classifiedId)
              }}</span>
              <span class="offer-amount">{{
                offer.offeredAmount | currency
              }}</span>
              @if (offer.message) {
              <p class="offer-message">"{{ offer.message }}"</p>
              }
              <span class="offer-date">{{
                offer.createdAt | date : 'short'
              }}</span>
            </div>
            <div class="offer-actions">
              <button class="btn btn-accept" (click)="acceptOffer(offer)">
                Accept
              </button>
              <button class="btn btn-reject" (click)="rejectOffer(offer)">
                Reject
              </button>
              <button class="btn btn-counter" (click)="openCounterModal(offer)">
                Counter
              </button>
            </div>
          </div>
          }
        </div>
      </section>
      }

      <!-- My Listings -->
      <section class="dashboard-section">
        <h2>My Listings</h2>
        @if (myListings().length === 0) {
        <div class="empty-state">
          <p>You haven't posted any listings yet.</p>
          <a routerLink="/communities" class="btn btn-primary"
            >Browse Communities</a
          >
        </div>
        } @else {
        <div class="listings-table">
          <div class="table-header">
            <span>Listing</span>
            <span>Price</span>
            <span>Status</span>
            <span>Offers</span>
            <span>Actions</span>
          </div>
          @for (listing of myListings(); track listing.id) {
          <div class="table-row">
            <span class="listing-name">{{ listing.title }}</span>
            <span class="listing-price">{{ listing.price | currency }}</span>
            <span class="status-badge" [class]="'status-' + listing.status">{{
              listing.status
            }}</span>
            <span class="offer-count">{{ getOfferCount(listing.id) }}</span>
            <span class="row-actions">
              <a [routerLink]="getListingRoute(listing)" class="btn-link"
                >View</a
              >
              @if (listing.status === 'active') {
              <button class="btn-link" (click)="markListingSold(listing)">
                Mark Sold
              </button>
              }
              <button class="btn-link danger" (click)="deleteListing(listing)">
                Delete
              </button>
            </span>
          </div>
          }
        </div>
        }
      </section>

      <!-- Recent Payments -->
      <section class="dashboard-section">
        <h2>Recent Payments</h2>
        @if (recentPayments().length === 0) {
        <p class="empty-text">No payments yet</p>
        } @else {
        <div class="payments-list">
          @for (payment of recentPayments(); track payment.id) {
          <div class="payment-card">
            <div class="payment-info">
              <span class="payment-amount">{{
                payment.sellerReceivesAmount | currency
              }}</span>
              <span class="payment-fee"
                >({{ payment.platformFeeAmount | currency }} fee)</span
              >
            </div>
            <span class="payment-status" [class]="'status-' + payment.status">{{
              payment.status
            }}</span>
            <span class="payment-date">{{
              payment.createdAt | date : 'short'
            }}</span>
          </div>
          }
        </div>
        }
      </section>
      }
    </div>

    <!-- Counter Modal -->
    @if (showCounterModal()) {
    <div class="modal-overlay" (click)="closeCounterModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Counter Offer</h3>
          <button class="close-btn" (click)="closeCounterModal()">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Your Counter Amount</label>
            <input
              type="number"
              [(ngModel)]="counterAmount"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>Message (optional)</label>
            <textarea
              [(ngModel)]="counterMessage"
              rows="3"
              class="form-input"
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeCounterModal()">
            Cancel
          </button>
          <button class="btn btn-primary" (click)="submitCounter()">
            Send Counter
          </button>
        </div>
      </div>
    </div>
    }

    <!-- Cashout Modal -->
    @if (showCashoutModal()) {
    <div class="modal-overlay" (click)="closeCashoutModal()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>Request Cashout</h3>
          <button class="close-btn" (click)="closeCashoutModal()">×</button>
        </div>
        <div class="modal-body">
          <p class="modal-balance">
            Available: {{ earningsSummary()?.availableBalance | currency }}
          </p>
          <div class="form-group">
            <label>Amount</label>
            <input
              type="number"
              [(ngModel)]="cashoutAmount"
              class="form-input"
              [max]="earningsSummary()?.availableBalance ?? 0"
              min="1"
              step="0.01"
            />
          </div>
          <div class="form-group">
            <label>Payout Method</label>
            <select [(ngModel)]="payoutMethod" class="form-input">
              <option value="paypal">PayPal</option>
              <option value="venmo">Venmo</option>
              <option value="zelle">Zelle</option>
              <option value="bank-transfer">Bank Transfer</option>
            </select>
          </div>
          <div class="form-group">
            <label>Payout Email / Account</label>
            <input
              type="text"
              [(ngModel)]="payoutEmail"
              class="form-input"
              placeholder="email@example.com"
            />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeCashoutModal()">
            Cancel
          </button>
          <button
            class="btn btn-primary"
            (click)="submitCashout()"
            [disabled]="!cashoutAmount || cashoutAmount <= 0"
          >
            Request Payout
          </button>
        </div>
      </div>
    </div>
    }
  `,
  styles: [
    `
      .seller-dashboard {
        max-width: 1000px;
        margin: 0 auto;
        padding: 2rem 1rem;
      }

      .dashboard-header {
        margin-bottom: 2rem;
      }

      .dashboard-header h1 {
        margin: 0 0 0.5rem;
        font-size: 1.75rem;
      }

      .dashboard-header p {
        margin: 0;
        color: var(--foreground-muted);
      }

      .loading-state {
        text-align: center;
        padding: 3rem;
      }

      .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--border);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        margin: 0 auto 1rem;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }

      .stat-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 1.25rem;
        text-align: center;
      }

      .stat-value {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--primary);
      }

      .stat-label {
        font-size: 0.8125rem;
        color: var(--foreground-muted);
      }

      .earnings-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
      }

      .earning-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 1.25rem;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .earning-card.available {
        border-color: #10b981;
        background: linear-gradient(to bottom right, var(--surface), #10b98110);
      }

      .earning-card.available .earning-value {
        color: #10b981;
      }

      .earning-label {
        font-size: 0.8125rem;
        color: var(--foreground-muted);
      }

      .earning-value {
        font-size: 1.5rem;
        font-weight: 700;
      }

      .payouts-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .payout-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
      }

      .payout-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .payout-amount {
        font-weight: 600;
      }

      .payout-method,
      .payout-date {
        font-size: 0.75rem;
        color: var(--foreground-muted);
      }

      .payout-status {
        font-size: 0.75rem;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
      }

      .modal-balance {
        text-align: center;
        font-size: 1.125rem;
        font-weight: 600;
        color: #10b981;
        margin-bottom: 1rem;
      }

      .dashboard-section {
        margin-bottom: 2rem;
      }

      .dashboard-section h2 {
        font-size: 1.125rem;
        margin: 0 0 1rem;
      }

      .offers-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .offer-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      }

      .offer-info {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .listing-title {
        font-weight: 600;
      }

      .offer-amount {
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--primary);
      }

      .offer-message {
        font-style: italic;
        color: var(--foreground-muted);
        font-size: 0.875rem;
        margin: 0;
      }

      .offer-date {
        font-size: 0.75rem;
        color: var(--foreground-muted);
      }

      .offer-actions {
        display: flex;
        gap: 0.5rem;
      }

      .btn {
        padding: 0.5rem 1rem;
        border-radius: 6px;
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: opacity 0.2s;
      }

      .btn:hover {
        opacity: 0.9;
      }
      .btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-accept {
        background: #10b981;
        color: white;
      }
      .btn-reject {
        background: var(--surface-variant);
        color: var(--foreground);
      }
      .btn-counter {
        background: var(--primary);
        color: white;
      }
      .btn-primary {
        background: var(--primary);
        color: white;
      }
      .btn-secondary {
        background: var(--surface-variant);
        color: var(--foreground);
      }

      .listings-table {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        overflow: hidden;
      }

      .table-header,
      .table-row {
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 0.5fr 1fr;
        gap: 1rem;
        padding: 0.75rem 1rem;
        align-items: center;
      }

      .table-header {
        background: var(--surface-variant);
        font-weight: 600;
        font-size: 0.8125rem;
      }

      .table-row {
        border-top: 1px solid var(--border);
      }

      .status-badge {
        display: inline-block;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        text-transform: capitalize;
      }

      .status-active {
        background: #d1fae5;
        color: #065f46;
      }
      .status-sold {
        background: #dbeafe;
        color: #1e40af;
      }
      .status-pending {
        background: #fef3c7;
        color: #92400e;
      }

      .btn-link {
        color: var(--primary);
        background: transparent;
        border: none;
        cursor: pointer;
        text-decoration: none;
        font-size: 0.8125rem;
      }

      .btn-link:hover {
        text-decoration: underline;
      }

      .btn-link.danger {
        color: #c81e1e;
      }

      .row-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .empty-state,
      .empty-text {
        text-align: center;
        padding: 2rem;
        color: var(--foreground-muted);
      }

      .payments-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .payment-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 8px;
      }

      .payment-info {
        flex: 1;
      }

      .payment-amount {
        font-weight: 600;
      }

      .payment-fee {
        font-size: 0.75rem;
        color: var(--foreground-muted);
        margin-left: 0.5rem;
      }

      .payment-status {
        font-size: 0.75rem;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
      }

      .payment-date {
        font-size: 0.75rem;
        color: var(--foreground-muted);
      }

      /* Modal */
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
      }

      .modal-content {
        background: var(--surface);
        border-radius: 12px;
        width: 100%;
        max-width: 400px;
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border);
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

      .form-input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 1rem;
      }

      .modal-footer {
        display: flex;
        gap: 0.75rem;
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border);
        justify-content: flex-end;
      }
    `,
  ],
})
export class SellerDashboardComponent implements OnInit {
  private authState = inject(AuthStateService);
  private paymentService = inject(PaymentService);
  private classifiedService = inject(ClassifiedService);
  private communityService = inject(CommunityService);
  private messageService = inject(MessageService);
  private router = inject(Router);

  loading = signal(true);
  myListings = signal<ClassifiedAdDto[]>([]);
  sellerOffers = signal<Offer[]>([]);
  userPayments = signal<Payment[]>([]);
  communityById = signal<Map<string, LocalCommunity>>(new Map());
  earningsSummary = signal<EarningsSummary | null>(null);
  payoutRequests = signal<PayoutRequest[]>([]);

  showCounterModal = signal(false);
  showCashoutModal = signal(false);
  selectedOffer: Offer | null = null;
  counterAmount: number | null = null;
  counterMessage = '';

  cashoutAmount: number | null = null;
  payoutMethod: 'paypal' | 'venmo' | 'zelle' | 'bank-transfer' = 'paypal';
  payoutEmail = '';

  async ngOnInit(): Promise<void> {
    const profileId = this.authState.getActingProfileId();
    if (!profileId) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const [offers, payments, listings, communities, earnings, payouts] =
        await Promise.all([
          this.paymentService.getUserOffers(),
          this.paymentService.getUserPayments(),
          this.classifiedService.myAds(),
          this.communityService.getCommunities(),
          this.paymentService.getSellerEarningsSummary().catch(() => null),
          this.paymentService.getSellerPayoutRequests().catch(() => []),
        ]);

      this.myListings.set(listings);
      this.sellerOffers.set(offers.asSeller);
      this.userPayments.set(payments);
      this.communityById.set(new Map(communities.map((c) => [c.id, c])));
      this.earningsSummary.set(earnings);
      this.payoutRequests.set(payouts);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      this.messageService.addMessage({
        content: 'Failed to load seller dashboard. Please refresh.',
        type: 'error',
      });
    } finally {
      this.loading.set(false);
    }
  }

  sellerPendingOffers(): Offer[] {
    return this.sellerOffers().filter(
      (o) => o.status === 'pending' || o.status === 'countered'
    );
  }

  sellerAcceptedOffers(): Offer[] {
    return this.sellerOffers().filter((o) => o.status === 'accepted');
  }

  totalEarnings(): number {
    return this.userPayments()
      .filter((p) => p.status === 'released' || p.status === 'confirmed')
      .reduce((sum, p) => sum + Number(p.sellerReceivesAmount || 0), 0);
  }

  recentPayments(): Payment[] {
    return this.userPayments()
      .filter((p) => p.sellerId === this.authState.getActingProfileId())
      .slice(0, 10);
  }

  getListingTitle(classifiedId: string): string {
    return `Listing #${classifiedId.slice(0, 8)}`;
  }

  getOfferCount(classifiedId: string): number {
    return this.sellerOffers().filter((o) => o.classifiedId === classifiedId)
      .length;
  }

  getListingRoute(listing: ClassifiedAdDto): string[] {
    const slug = listing.communityId
      ? this.communityById().get(listing.communityId)?.slug
      : undefined;

    if (!slug) {
      return ['/communities'];
    }

    return ['/c', slug, 'classifieds', listing.id];
  }

  async markListingSold(listing: ClassifiedAdDto): Promise<void> {
    try {
      const updated = await this.classifiedService.markSold(listing.id);
      this.myListings.update((listings) =>
        listings.map((l) => (l.id === updated.id ? updated : l))
      );
      this.messageService.addMessage({
        content: 'Listing marked as sold.',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to mark listing as sold.',
        type: 'error',
      });
    }
  }

  async deleteListing(listing: ClassifiedAdDto): Promise<void> {
    const confirmed = confirm(
      `Delete "${listing.title}"? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    try {
      await this.classifiedService.remove(listing.id);
      this.myListings.update((listings) =>
        listings.filter((l) => l.id !== listing.id)
      );
      this.messageService.addMessage({
        content: 'Listing deleted.',
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to delete listing.',
        type: 'error',
      });
    }
  }

  async acceptOffer(offer: Offer): Promise<void> {
    try {
      await this.paymentService.acceptOffer(offer.id);
      this.messageService.addMessage({
        content: 'Offer accepted!',
        type: 'success',
      });
      this.refreshData();
    } catch {
      this.messageService.addMessage({
        content: 'Failed to accept offer',
        type: 'error',
      });
    }
  }

  async rejectOffer(offer: Offer): Promise<void> {
    try {
      await this.paymentService.rejectOffer(offer.id);
      this.messageService.addMessage({
        content: 'Offer rejected',
        type: 'info',
      });
      this.refreshData();
    } catch {
      this.messageService.addMessage({
        content: 'Failed to reject offer',
        type: 'error',
      });
    }
  }

  openCounterModal(offer: Offer): void {
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

    try {
      await this.paymentService.counterOffer(
        this.selectedOffer.id,
        this.counterAmount,
        this.counterMessage || undefined
      );
      this.messageService.addMessage({
        content: 'Counter offer sent!',
        type: 'success',
      });
      this.closeCounterModal();
      this.refreshData();
    } catch {
      this.messageService.addMessage({
        content: 'Failed to send counter',
        type: 'error',
      });
    }
  }

  openCashoutModal(): void {
    const summary = this.earningsSummary();
    if (summary) {
      this.cashoutAmount = summary.availableBalance;
    }
    this.payoutEmail = summary?.payoutEmail || '';
    this.payoutMethod = (summary?.payoutMethod as any) || 'paypal';
    this.showCashoutModal.set(true);
  }

  closeCashoutModal(): void {
    this.showCashoutModal.set(false);
    this.cashoutAmount = null;
    this.payoutEmail = '';
  }

  async submitCashout(): Promise<void> {
    if (!this.cashoutAmount || this.cashoutAmount <= 0) return;

    try {
      await this.paymentService.createPayoutRequest(
        this.cashoutAmount,
        this.payoutMethod,
        this.payoutEmail || undefined
      );
      this.messageService.addMessage({
        content: 'Payout request submitted!',
        type: 'success',
      });
      this.closeCashoutModal();
      this.refreshWalletData();
    } catch (err: any) {
      this.messageService.addMessage({
        content: err.message || 'Failed to submit payout request',
        type: 'error',
      });
    }
  }

  async cancelPayout(payout: PayoutRequest): Promise<void> {
    const confirmed = confirm('Cancel this payout request?');
    if (!confirmed) return;

    try {
      await this.paymentService.cancelPayoutRequest(payout.id);
      this.messageService.addMessage({
        content: 'Payout request cancelled.',
        type: 'success',
      });
      this.refreshWalletData();
    } catch {
      this.messageService.addMessage({
        content: 'Failed to cancel payout request',
        type: 'error',
      });
    }
  }

  private async refreshWalletData(): Promise<void> {
    try {
      const [earnings, payouts] = await Promise.all([
        this.paymentService.getSellerEarningsSummary().catch(() => null),
        this.paymentService.getSellerPayoutRequests().catch(() => []),
      ]);
      this.earningsSummary.set(earnings);
      this.payoutRequests.set(payouts);
    } catch (err) {
      console.error('Failed to refresh wallet data:', err);
    }
  }

  private async refreshData(): Promise<void> {
    const [offers, listings] = await Promise.all([
      this.paymentService.getUserOffers(),
      this.classifiedService.myAds(),
    ]);
    this.sellerOffers.set(offers.asSeller);
    this.myListings.set(listings);
  }
}
