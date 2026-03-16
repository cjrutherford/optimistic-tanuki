import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

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

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/payments';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async getDonationGoal(month?: number, year?: number): Promise<DonationGoal> {
    const params = new URLSearchParams();
    if (month) params.set('month', month.toString());
    if (year) params.set('year', year.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return firstValueFrom(
      this.http.get<DonationGoal>(`${this.baseUrl}/donations/goal${query}`)
    );
  }

  async getMonthlyDonations(
    month?: number,
    year?: number
  ): Promise<Donation[]> {
    const params = new URLSearchParams();
    if (month) params.set('month', month.toString());
    if (year) params.set('year', year.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return firstValueFrom(
      this.http.get<Donation[]>(`${this.baseUrl}/donations${query}`)
    );
  }

  async createDonationCheckout(
    amount: number,
    isRecurring: boolean
  ): Promise<{ checkoutUrl: string }> {
    return firstValueFrom(
      this.http.post<{ checkoutUrl: string }>(
        `${this.baseUrl}/donations/checkout`,
        {
          amount,
          isRecurring,
        }
      )
    );
  }

  async getUserDonations(): Promise<Donation[]> {
    return firstValueFrom(
      this.http.get<Donation[]>(`${this.baseUrl}/donations/user`)
    );
  }

  async cancelRecurringDonation(subscriptionId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `${this.baseUrl}/donations/subscription/${subscriptionId}`
      )
    );
  }

  async createClassifiedPayment(
    classifiedId: string,
    paymentMethod: string
  ): Promise<Payment> {
    return firstValueFrom(
      this.http.post<Payment>(`${this.baseUrl}/classifieds/payment`, {
        classifiedId,
        paymentMethod,
      })
    );
  }

  async confirmOutOfPlatformPayment(
    paymentId: string,
    proofImageUrl?: string
  ): Promise<Payment> {
    return firstValueFrom(
      this.http.post<Payment>(
        `${this.baseUrl}/classifieds/payment/${paymentId}/confirm`,
        {
          proofImageUrl,
        }
      )
    );
  }

  async confirmPaymentReceived(paymentId: string): Promise<Payment> {
    return firstValueFrom(
      this.http.post<Payment>(
        `${this.baseUrl}/classifieds/payment/${paymentId}/release`,
        {}
      )
    );
  }

  async disputePayment(paymentId: string, reason: string): Promise<Payment> {
    return firstValueFrom(
      this.http.post<Payment>(
        `${this.baseUrl}/classifieds/payment/${paymentId}/dispute`,
        {
          reason,
        }
      )
    );
  }

  async getPayment(paymentId: string): Promise<Payment> {
    return firstValueFrom(
      this.http.get<Payment>(`${this.baseUrl}/classifieds/payment/${paymentId}`)
    );
  }

  async getUserPayments(): Promise<Payment[]> {
    return firstValueFrom(
      this.http.get<Payment[]>(`${this.baseUrl}/classifieds/payments/user`)
    );
  }

  async createBusinessPage(
    communityId: string,
    tier: string
  ): Promise<{ checkoutUrl: string }> {
    return firstValueFrom(
      this.http.post<{ checkoutUrl: string }>(
        `${this.baseUrl}/business/checkout`,
        {
          communityId,
          tier,
        }
      )
    );
  }

  async getBusinessPage(communityId: string): Promise<BusinessPage | null> {
    return firstValueFrom(
      this.http.get<BusinessPage | null>(
        `${this.baseUrl}/business/${communityId}`
      )
    ).then((page) => {
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
    });
  }

  async updateBusinessPage(
    communityId: string,
    data: Partial<BusinessPage>
  ): Promise<BusinessPage> {
    return firstValueFrom(
      this.http.patch<
        { success: boolean; businessPage: BusinessPage } | BusinessPage
      >(`${this.baseUrl}/business/${communityId}`, data)
    ).then((result) => {
      const page =
        (result as { success: boolean; businessPage: BusinessPage })
          .businessPage ?? (result as BusinessPage);

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
    });
  }

  async cancelBusinessSubscription(communityId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        `${this.baseUrl}/business/${communityId}/subscription`
      )
    );
  }

  async createSponsorship(
    communityId: string,
    type: string,
    adContent?: string
  ): Promise<{ checkoutUrl: string }> {
    return firstValueFrom(
      this.http.post<{ checkoutUrl: string }>(
        `${this.baseUrl}/sponsorship/checkout`,
        {
          communityId,
          type,
          adContent,
        }
      )
    );
  }

  async getActiveSponsorships(
    communityId: string
  ): Promise<CommunitySponsorship[]> {
    return firstValueFrom(
      this.http.get<CommunitySponsorship[]>(
        `${this.baseUrl}/sponsorship/${communityId}/active`
      )
    );
  }

  async getCityBusinesses(cityId: string): Promise<BusinessPage[]> {
    return firstValueFrom(
      this.http.get<BusinessPage[]>(`${this.baseUrl}/business/city/${cityId}`)
    );
  }

  async getUserSponsorships(): Promise<CommunitySponsorship[]> {
    return firstValueFrom(
      this.http.get<CommunitySponsorship[]>(`${this.baseUrl}/sponsorship/user`)
    );
  }

  async getTransactions(): Promise<Transaction[]> {
    return firstValueFrom(
      this.http.get<Transaction[]>(`${this.baseUrl}/transactions`)
    );
  }

  async getLemonSqueezyPortalUrl(): Promise<{ url: string }> {
    return firstValueFrom(
      this.http.get<{ url?: string; portalUrl?: string }>(
        `${this.baseUrl}/portal`
      )
    ).then((result) => ({
      url: result.url || result.portalUrl || '',
    }));
  }

  async createOffer(
    classifiedId: string,
    sellerId: string,
    amount: number,
    message?: string
  ): Promise<Offer> {
    return firstValueFrom(
      this.http.post<Offer>(`${this.baseUrl}/offers`, {
        classifiedId,
        sellerId,
        amount,
        message,
      })
    );
  }

  async acceptOffer(
    offerId: string
  ): Promise<{ offer: Offer; payment: Payment }> {
    return firstValueFrom(
      this.http.patch<{ offer: Offer; payment: Payment }>(
        `${this.baseUrl}/offers/${offerId}/accept`,
        {}
      )
    );
  }

  async rejectOffer(offerId: string): Promise<Offer> {
    return firstValueFrom(
      this.http.patch<Offer>(`${this.baseUrl}/offers/${offerId}/reject`, {})
    );
  }

  async counterOffer(
    offerId: string,
    counterAmount: number,
    message?: string
  ): Promise<Offer> {
    return firstValueFrom(
      this.http.patch<Offer>(`${this.baseUrl}/offers/${offerId}/counter`, {
        counterAmount,
        message,
      })
    );
  }

  async withdrawOffer(offerId: string): Promise<Offer> {
    return firstValueFrom(
      this.http.patch<Offer>(`${this.baseUrl}/offers/${offerId}/withdraw`, {})
    );
  }

  async getOffersForClassified(classifiedId: string): Promise<Offer[]> {
    return firstValueFrom(
      this.http.get<Offer[]>(
        `${this.baseUrl}/offers/classified/${classifiedId}`
      )
    );
  }

  async getUserOffers(): Promise<UserOffers> {
    return firstValueFrom(
      this.http.get<UserOffers>(`${this.baseUrl}/offers/user`)
    );
  }
}
