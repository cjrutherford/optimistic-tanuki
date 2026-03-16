import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthStateService } from '../../services/auth-state.service';
import { PaymentService, Offer, Payment } from '../../services/payment.service';
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

      <!-- Pending Offers -->
      @if (sellerPendingOffers().length > 0) {
      <section class="dashboard-section">
        <h2>Pending Offers</h2>
        <div class="offers-list">
          @for (offer of sellerPendingOffers(); track offer.id) {
          <div class="offer-card">
            <div class="offer-info">
              <span class="listing-title">{{ getListingTitle(offer.classifiedId) }}</span>
              <span class="offer-amount">{{ offer.offeredAmount | currency }}</span>
              @if (offer.message) {
              <p class="offer-message">"{{ offer.message }}"</p>
              }
              <span class="offer-date">{{ offer.createdAt | date:'short' }}</span>
            </div>
            <div class="offer-actions">
              <button class="btn btn-accept" (click)="acceptOffer(offer)">Accept</button>
              <button class="btn btn-reject" (click)="rejectOffer(offer)">Reject</button>
              <button class="btn btn-counter" (click)="openCounterModal(offer)">Counter</button>
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
          <a routerLink="/communities" class="btn btn-primary">Browse Communities</a>
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
            <span class="status-badge" [class]="'status-' + listing.status">{{ listing.status }}</span>
            <span class="offer-count">{{ getOfferCount(listing.id) }}</span>
            <span class="row-actions">
              <a [routerLink]="getListingRoute(listing)" class="btn-link">View</a>
              @if (listing.status === 'active') {
              <button class="btn-link" (click)="markListingSold(listing)">Mark Sold</button>
              }
              <button class="btn-link danger" (click)="deleteListing(listing)">Delete</button>
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
              <span class="payment-amount">{{ payment.sellerReceivesAmount | currency }}</span>
              <span class="payment-fee">({{ payment.platformFeeAmount | currency }} fee)</span>
            </div>
            <span class="payment-status" [class]="'status-' + payment.status">{{ payment.status }}</span>
            <span class="payment-date">{{ payment.createdAt | date:'short' }}</span>
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
            <input type="number" [(ngModel)]="counterAmount" class="form-input" />
          </div>
          <div class="form-group">
            <label>Message (optional)</label>
            <textarea [(ngModel)]="counterMessage" rows="3" class="form-input"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" (click)="closeCounterModal()">Cancel</button>
          <button class="btn btn-primary" (click)="submitCounter()">Send Counter</button>
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

  showCounterModal = signal(false);
  selectedOffer: Offer | null = null;
  counterAmount: number | null = null;
  counterMessage = '';

  async ngOnInit(): Promise<void> {
    const profileId = this.authState.getActingProfileId();
    if (!profileId) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      const [offers, payments, listings, communities] = await Promise.all([
        this.paymentService.getUserOffers(),
        this.paymentService.getUserPayments(),
        this.classifiedService.myAds(),
        this.communityService.getCommunities(),
      ]);

      this.myListings.set(listings);
      this.sellerOffers.set(offers.asSeller);
      this.userPayments.set(payments);
      this.communityById.set(new Map(communities.map((c) => [c.id, c])));
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

  private async refreshData(): Promise<void> {
    const [offers, listings] = await Promise.all([
      this.paymentService.getUserOffers(),
      this.classifiedService.myAds(),
    ]);
    this.sellerOffers.set(offers.asSeller);
    this.myListings.set(listings);
  }
}
