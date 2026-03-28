import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStateService } from '../../services/auth-state.service';
import {
  CommunityService,
  LocalCommunity,
} from '../../services/community.service';
import {
  PaymentService,
  Donation,
  Transaction,
  BillingProfile,
  SavedPaymentMethod,
} from '../../services/payment.service';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { Personality } from '@optimistic-tanuki/theme-models';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  private authState = inject(AuthStateService);
  private communityService = inject(CommunityService);
  private paymentService = inject(PaymentService);
  private messageService = inject(MessageService);
  private themeService = inject(ThemeService);
  readonly router = inject(Router);

  myCommunities = signal<LocalCommunity[]>([]);
  donations = signal<Donation[]>([]);
  transactions = signal<Transaction[]>([]);
  billingProfile = signal<BillingProfile | null>(null);
  savedPaymentMethods = signal<SavedPaymentMethod[]>([]);
  loadingCommunities = signal(true);
  loadingBilling = signal(true);
  savingBillingProfile = signal(false);
  refundingDonationId = signal<string | null>(null);
  refundingTransactionId = signal<string | null>(null);
  leavingId = signal<string | null>(null);
  billingError = signal<string | null>(null);
  billingProfileName = signal('');
  billingProfileEmail = signal('');
  billingProfileDefaultPaymentMethodId = signal('');
  donationRefundReasons = signal<Record<string, string>>({});
  transactionRefundReasons = signal<Record<string, string>>({});
  availablePersonalities = signal<Personality[]>([]);
  currentPersonalityId = signal<string>('bold');

  ngOnInit(): void {
    this.loadMyCommunities();
    this.loadPersonalities();
    this.loadBillingData();
  }

  totalCompletedDonations(): number {
    return this.donations()
      .filter((donation) => donation.status === 'completed')
      .reduce((sum, donation) => sum + Number(donation.amount || 0), 0);
  }

  totalProcessedTransactions(): number {
    return this.transactions()
      .filter((transaction) => transaction.status === 'completed')
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  }

  recentBillingActivity(): Array<Donation | Transaction> {
    return [...this.transactions(), ...this.donations()]
      .sort(
        (left, right) =>
          new Date((right as { createdAt: string }).createdAt).getTime() -
          new Date((left as { createdAt: string }).createdAt).getTime()
      )
      .slice(0, 6);
  }

  defaultPaymentMethodLabel(): string {
    const defaultMethod = this.savedPaymentMethods().find((method) => method.isDefault);

    if (!defaultMethod) {
      return 'No saved payment method';
    }

    return `${defaultMethod.brand || 'Card'} ending in ${defaultMethod.last4 || '----'}`;
  }

  canRefundDonation(donation: Donation): boolean {
    return (
      donation.status === 'completed' &&
      !donation.isRecurring &&
      donation.externalProvider === 'helcim' &&
      Boolean(donation.externalTransactionId)
    );
  }

  canRefundTransaction(transaction: Transaction): boolean {
    return (
      transaction.type === 'classified_payment' &&
      transaction.status === 'completed' &&
      transaction.externalProvider === 'helcim' &&
      Boolean(transaction.referenceId)
    );
  }

  donationRefundReason(donationId: string): string {
    return this.donationRefundReasons()[donationId] || '';
  }

  transactionRefundReason(transactionId: string): string {
    return this.transactionRefundReasons()[transactionId] || '';
  }

  updateDonationRefundReason(donationId: string, reason: string): void {
    this.donationRefundReasons.update((state) => ({
      ...state,
      [donationId]: reason,
    }));
  }

  updateTransactionRefundReason(transactionId: string, reason: string): void {
    this.transactionRefundReasons.update((state) => ({
      ...state,
      [transactionId]: reason,
    }));
  }

  clearDonationRefundReason(donationId: string): void {
    this.donationRefundReasons.update((state) => {
      const nextState = { ...state };
      delete nextState[donationId];
      return nextState;
    });
  }

  clearTransactionRefundReason(transactionId: string): void {
    this.transactionRefundReasons.update((state) => {
      const nextState = { ...state };
      delete nextState[transactionId];
      return nextState;
    });
  }

  private syncBillingProfileForm(profile: BillingProfile | null): void {
    const userData = this.authState.getUserData();
    this.billingProfileName.set(profile?.name || userData?.name || '');
    this.billingProfileEmail.set(profile?.email || userData?.email || '');
    this.billingProfileDefaultPaymentMethodId.set(
      profile?.defaultPaymentMethodId ||
      this.savedPaymentMethods().find((method) => method.isDefault)
        ?.externalPaymentMethodId ||
      ''
    );
  }

  private loadPersonalities(): void {
    this.themeService.availablePersonalities$.subscribe((personalities) => {
      this.availablePersonalities.set(personalities);
    });
    this.currentPersonalityId.set(this.themeService.getCurrentPersonality().id);
  }

  async changeTheme(personalityId: string): Promise<void> {
    await this.themeService.setPersonality(personalityId);
    this.currentPersonalityId.set(personalityId);
    this.messageService.addMessage({
      content: `Theme changed to ${personalityId}`,
      type: 'success',
    });
  }

  async loadMyCommunities(): Promise<void> {
    try {
      const communities = await this.communityService.getMyMemberships();
      this.myCommunities.set(communities);
    } catch {
      // non-fatal — user may not be a member of any community yet
    } finally {
      this.loadingCommunities.set(false);
    }
  }

  async loadBillingData(): Promise<void> {
    this.loadingBilling.set(true);
    this.billingError.set(null);

    try {
      const [donations, transactions, billingProfile, savedPaymentMethods] = await Promise.all([
        this.paymentService.getUserDonations(),
        this.paymentService.getTransactions(),
        this.paymentService.getBillingProfile(),
        this.paymentService.getSavedPaymentMethods(),
      ]);
      this.donations.set(donations);
      this.transactions.set(transactions);
      this.billingProfile.set(billingProfile);
      this.savedPaymentMethods.set(savedPaymentMethods);
      this.syncBillingProfileForm(billingProfile);
    } catch {
      this.billingError.set(
        'Unable to load your billing activity right now. Please try again.'
      );
    } finally {
      this.loadingBilling.set(false);
    }
  }

  async saveBillingProfile(): Promise<void> {
    this.savingBillingProfile.set(true);
    this.billingError.set(null);

    try {
      const profile = await this.paymentService.updateBillingProfile({
        name: this.billingProfileName().trim(),
        email: this.billingProfileEmail().trim(),
        defaultPaymentMethodId: this.billingProfileDefaultPaymentMethodId().trim() || undefined,
      });

      this.billingProfile.set(profile);
      await this.loadBillingData();
      this.messageService.addMessage({
        content: 'Billing profile updated.',
        type: 'success',
      });
    } catch {
      this.billingError.set(
        'Unable to save your billing profile right now. Please try again.'
      );
    } finally {
      this.savingBillingProfile.set(false);
    }
  }

  async refundDonation(donation: Donation): Promise<void> {
    const refundReason = this.donationRefundReason(donation.id).trim();

    if (!refundReason) {
      this.billingError.set('Please add a refund reason before refunding a donation.');
      return;
    }

    this.refundingDonationId.set(donation.id);
    this.billingError.set(null);

    try {
      await this.paymentService.refundDonation(donation.id, refundReason);
      this.clearDonationRefundReason(donation.id);
      await this.loadBillingData();
      this.messageService.addMessage({
        content: 'Donation refunded.',
        type: 'success',
      });
    } catch {
      this.billingError.set(
        'Unable to refund that donation right now. Please try again.'
      );
    } finally {
      this.refundingDonationId.set(null);
    }
  }

  async refundTransaction(transaction: Transaction): Promise<void> {
    if (!transaction.referenceId) {
      return;
    }

    const refundReason = this.transactionRefundReason(transaction.id).trim();

    if (!refundReason) {
      this.billingError.set('Please add a refund reason before refunding a payment.');
      return;
    }

    this.refundingTransactionId.set(transaction.id);
    this.billingError.set(null);

    try {
      await this.paymentService.refundClassifiedPayment(
        transaction.referenceId,
        refundReason
      );
      this.clearTransactionRefundReason(transaction.id);
      await this.loadBillingData();
      this.messageService.addMessage({
        content: 'Payment refunded.',
        type: 'success',
      });
    } catch {
      this.billingError.set(
        'Unable to refund that payment right now. Please try again.'
      );
    } finally {
      this.refundingTransactionId.set(null);
    }
  }

  navigateToCommunity(slug: string): void {
    this.router.navigate(['/c', slug]);
  }

  async leaveCommunity(community: LocalCommunity): Promise<void> {
    this.leavingId.set(community.id);
    try {
      await this.communityService.leaveCommunity(community.id);
      this.myCommunities.update((list) =>
        list.filter((c) => c.id !== community.id)
      );
      this.messageService.addMessage({
        content: `You have left ${community.name}.`,
        type: 'success',
      });
    } catch {
      this.messageService.addMessage({
        content: 'Failed to leave community. Please try again.',
        type: 'error',
      });
    } finally {
      this.leavingId.set(null);
    }
  }

  logout(): void {
    this.authState.logout();
    this.router.navigate(['/']);
  }
}
