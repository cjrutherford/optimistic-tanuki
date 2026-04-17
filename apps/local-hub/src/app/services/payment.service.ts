import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

export interface Donation {
  id: string;
  userId: string;
  profileId?: string;
  amount: number;
  currency: string;
  type: 'one-time' | 'recurring';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  lemonSqueezyOrderId?: string;
  subscriptionId?: string;
  createdAt: string;
  month: number;
  year: number;
}

export interface DonationGoal {
  monthlyGoal: number;
  currentAmount: number;
  donorCount: number;
  month: number;
  year: number;
}

export interface Payment {
  id: string;
  classifiedId: string;
  buyerId: string;
  sellerId: string;
  checkoutUrl?: string;
  amount: number;
  platformFeeAmount: number;
  sellerReceivesAmount: number;
  currency: string;
  paymentMethod: 'card' | 'cash-app' | 'venmo' | 'zelle' | 'cash';
  status:
    | 'pending'
    | 'confirmed'
    | 'released'
    | 'disputed'
    | 'refunded'
    | 'cancelled';
  proofImageUrl?: string;
  completedAt?: string;
  createdAt: string;
}

export interface BusinessPage {
  id: string;
  userId: string;
  ownerId?: string;
  /** The root locality (city/town/neighborhood) this business belongs to. */
  localityId?: string;
  /** Legacy/compat field kept for API responses that still return communityId. */
  communityId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  tier: 'basic' | 'pro' | 'enterprise';
  stripeSubscriptionId?: string;
  status: 'active' | 'past-due' | 'canceled' | 'trial';
  subscriptionStatus?: 'active' | 'inactive' | 'cancelled' | 'past-due';
  pinnedPostId?: string;
  badge?: string;
  locations: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunitySponsorship {
  id: string;
  communityId: string;
  sponsorUserId: string;
  type: 'sticky-ad' | 'banner' | 'featured';
  amount: number;
  currency: string;
  status: 'active' | 'expired' | 'cancelled';
  adContent?: string;
  adImageUrl?: string;
  paidAt: string;
  expiresAt: string;
}

export interface Transaction {
  id: string;
  type:
    | 'donation'
    | 'classified-payment'
    | 'business-page'
    | 'sponsorship'
    | 'payout';
  amount: number;
  platformFee?: number;
  netAmount?: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  description: string;
  relatedId?: string;
  userId: string;
  createdAt: string;
}

export interface Offer {
  id: string;
  classifiedId: string;
  buyerId: string;
  sellerId: string;
  offeredAmount: number;
  status:
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'countered'
    | 'withdrawn'
    | 'expired';
  message?: string;
  counterOfferAmount?: number;
  counterMessage?: string;
  expiresAt: string;
  acceptedPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserOffers {
  asBuyer: Offer[];
  asSeller: Offer[];
}

export interface SellerWallet {
  id: string;
  sellerId: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalPaidOut: number;
  payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle' | null;
  payoutEmail: string | null;
  bankAccountLast4: string | null;
  bankRoutingLast4: string | null;
  createdAt: string;
  lastPayoutAt: string | null;
}

export interface PayoutRequest {
  id: string;
  sellerId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
  payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle';
  payoutEmail: string | null;
  bankAccountLast4: string | null;
  bankRoutingLast4: string | null;
  transactionId: string | null;
  rejectionReason: string | null;
  processedBy: string | null;
  createdAt: string;
  processedAt: string | null;
}

export interface EarningsSummary {
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalPaidOut: number;
  salesCount: number;
  payoutMethod: string | null;
  payoutEmail: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiBaseUrl}/payments`;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Begin a request: clear previous error and set loading. */
  private begin(): void {
    this.error.set(null);
    this.loading.set(true);
  }

  /** End a request: always clear loading. */
  private end(): void {
    this.loading.set(false);
  }

  /** Handle an error: set the error signal, clear loading, re-throw. */
  private fail(err: unknown): never {
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.';
    this.error.set(message);
    this.loading.set(false);
    throw err;
  }

  async getDonationGoal(month?: number, year?: number): Promise<DonationGoal> {
    const params = new URLSearchParams();
    if (month) params.set('month', month.toString());
    if (year) params.set('year', year.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<DonationGoal>(`${this.apiBaseUrl}/donations/goal${query}`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getMonthlyDonations(
    month?: number,
    year?: number
  ): Promise<Donation[]> {
    const params = new URLSearchParams();
    if (month) params.set('month', month.toString());
    if (year) params.set('year', year.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<Donation[]>(`${this.apiBaseUrl}/donations${query}`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async createDonationCheckout(
    amount: number,
    isRecurring: boolean
  ): Promise<{ checkoutUrl: string }> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<{ checkoutUrl: string }>(
          `${this.baseUrl}/donations/checkout`,
          { amount, isRecurring }
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getUserDonations(): Promise<Donation[]> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<Donation[]>(`${this.baseUrl}/donations/user`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async cancelRecurringDonation(subscriptionId: string): Promise<void> {
    this.begin();
    try {
      await firstValueFrom(
        this.http.delete<void>(
          `${this.baseUrl}/donations/subscription/${subscriptionId}`
        )
      );
      this.end();
    } catch (err) {
      return this.fail(err);
    }
  }

  async createClassifiedPayment(
    classifiedId: string,
    paymentMethod: string
  ): Promise<Payment> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<Payment>(`${this.baseUrl}/classifieds/payment`, {
          classifiedId,
          paymentMethod,
        })
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async confirmOutOfPlatformPayment(
    paymentId: string,
    proofImageUrl?: string
  ): Promise<Payment> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<Payment>(
          `${this.baseUrl}/classifieds/payment/${paymentId}/confirm`,
          { proofImageUrl }
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async confirmPaymentReceived(paymentId: string): Promise<Payment> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<Payment>(
          `${this.baseUrl}/classifieds/payment/${paymentId}/release`,
          {}
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async disputePayment(paymentId: string, reason: string): Promise<Payment> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<Payment>(
          `${this.baseUrl}/classifieds/payment/${paymentId}/dispute`,
          { reason }
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getPayment(paymentId: string): Promise<Payment> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<Payment>(
          `${this.baseUrl}/classifieds/payment/${paymentId}`
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getUserPayments(): Promise<Payment[]> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<Payment[]>(`${this.baseUrl}/classifieds/payments/user`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  /**
   * Start the business-page checkout flow.
   * `localityId` should be the root locality (city/town/neighborhood) that the
   * business belongs to. `communityId` is kept as an alias for API compat.
   */
  async createBusinessPage(
    localityId: string,
    tier: string
  ): Promise<{ checkoutUrl: string }> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<{ checkoutUrl: string }>(
          `${this.baseUrl}/business/checkout`,
          { localityId, communityId: localityId, tier }
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getBusinessPage(communityId: string): Promise<BusinessPage | null> {
    this.begin();
    try {
      const page = await firstValueFrom(
        this.http.get<BusinessPage | null>(
          `${this.baseUrl}/business/${communityId}`
        )
      );
      this.end();
      if (!page) return null;
      return {
        ...page,
        userId: page.userId || page.ownerId || '',
        status:
          page.status ||
          (page.subscriptionStatus === 'cancelled'
            ? 'canceled'
            : page.subscriptionStatus === 'inactive'
            ? 'trial'
            : 'active'),
      } as BusinessPage;
    } catch (err) {
      return this.fail(err);
    }
  }

  async updateBusinessPage(
    communityId: string,
    data: Partial<BusinessPage>
  ): Promise<BusinessPage> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.patch<
          { success: boolean; businessPage: BusinessPage } | BusinessPage
        >(`${this.baseUrl}/business/${communityId}`, data)
      );
      const page =
        (result as { success: boolean; businessPage: BusinessPage })
          .businessPage ?? (result as BusinessPage);
      this.end();
      return {
        ...page,
        userId: page.userId || page.ownerId || '',
        status:
          page.status ||
          (page.subscriptionStatus === 'cancelled'
            ? 'canceled'
            : page.subscriptionStatus === 'inactive'
            ? 'trial'
            : 'active'),
      } as BusinessPage;
    } catch (err) {
      return this.fail(err);
    }
  }

  async cancelBusinessSubscription(communityId: string): Promise<void> {
    this.begin();
    try {
      await firstValueFrom(
        this.http.delete<void>(
          `${this.baseUrl}/business/${communityId}/subscription`
        )
      );
      this.end();
    } catch (err) {
      return this.fail(err);
    }
  }

  async createSponsorship(
    communityId: string,
    type: string,
    adContent?: string
  ): Promise<{ checkoutUrl: string }> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<{ checkoutUrl: string }>(
          `${this.baseUrl}/sponsorship/checkout`,
          { communityId, type, adContent }
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getActiveSponsorships(
    communityId: string
  ): Promise<CommunitySponsorship[]> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<CommunitySponsorship[]>(
          `${this.baseUrl}/sponsorship/${communityId}/active`
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getCityBusinesses(
    cityId: string,
    communityIds: string[] = []
  ): Promise<BusinessPage[]> {
    this.begin();
    try {
      const params = new URLSearchParams();
      if (communityIds.length > 0) {
        params.set('communityIds', communityIds.join(','));
      }
      const query = params.toString() ? `?${params.toString()}` : '';
      const result = await firstValueFrom(
        this.http.get<BusinessPage[]>(
          `${this.baseUrl}/business/city/${cityId}${query}`
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getUserSponsorships(): Promise<CommunitySponsorship[]> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<CommunitySponsorship[]>(
          `${this.baseUrl}/sponsorship/user`
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getTransactions(): Promise<Transaction[]> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<Transaction[]>(`${this.baseUrl}/transactions`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getLemonSqueezyPortalUrl(): Promise<{ url: string }> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<{ url?: string; portalUrl?: string }>(
          `${this.baseUrl}/portal`
        )
      );
      this.end();
      return { url: result.url || result.portalUrl || '' };
    } catch (err) {
      return this.fail(err);
    }
  }

  async createOffer(
    classifiedId: string,
    sellerId: string,
    amount: number,
    message?: string
  ): Promise<Offer> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<Offer>(`${this.baseUrl}/offers`, {
          classifiedId,
          sellerId,
          amount,
          message,
        })
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async acceptOffer(
    offerId: string
  ): Promise<{ offer: Offer; payment: Payment }> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.patch<{ offer: Offer; payment: Payment }>(
          `${this.baseUrl}/offers/${offerId}/accept`,
          {}
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async rejectOffer(offerId: string): Promise<Offer> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.patch<Offer>(`${this.baseUrl}/offers/${offerId}/reject`, {})
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async counterOffer(
    offerId: string,
    counterAmount: number,
    message?: string
  ): Promise<Offer> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.patch<Offer>(`${this.baseUrl}/offers/${offerId}/counter`, {
          counterAmount,
          message,
        })
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async withdrawOffer(offerId: string): Promise<Offer> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.patch<Offer>(`${this.baseUrl}/offers/${offerId}/withdraw`, {})
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getOffersForClassified(classifiedId: string): Promise<Offer[]> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<Offer[]>(
          `${this.baseUrl}/offers/classified/${classifiedId}`
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getUserOffers(): Promise<UserOffers> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<UserOffers>(`${this.baseUrl}/offers/user`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getSellerWallet(): Promise<SellerWallet | null> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<SellerWallet>(`${this.baseUrl}/seller/wallet`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async updateSellerPayoutInfo(
    payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle',
    payoutEmail?: string,
    bankAccountLast4?: string,
    bankRoutingLast4?: string
  ): Promise<SellerWallet> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.patch<SellerWallet>(
          `${this.baseUrl}/seller/wallet/payout-info`,
          {
            payoutMethod,
            payoutEmail,
            bankAccountLast4,
            bankRoutingLast4,
          }
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async createPayoutRequest(
    amount: number,
    payoutMethod: 'paypal' | 'bank-transfer' | 'venmo' | 'zelle',
    payoutEmail?: string,
    bankAccountLast4?: string,
    bankRoutingLast4?: string
  ): Promise<PayoutRequest> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.post<PayoutRequest>(`${this.baseUrl}/seller/payout`, {
          amount,
          payoutMethod,
          payoutEmail,
          bankAccountLast4,
          bankRoutingLast4,
        })
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getSellerPayoutRequests(): Promise<PayoutRequest[]> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<PayoutRequest[]>(`${this.baseUrl}/seller/payouts`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async cancelPayoutRequest(payoutRequestId: string): Promise<PayoutRequest> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.delete<PayoutRequest>(
          `${this.baseUrl}/seller/payout/${payoutRequestId}`
        )
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }

  async getSellerEarningsSummary(): Promise<EarningsSummary> {
    this.begin();
    try {
      const result = await firstValueFrom(
        this.http.get<EarningsSummary>(`${this.baseUrl}/seller/earnings`)
      );
      this.end();
      return result;
    } catch (err) {
      return this.fail(err);
    }
  }
}
