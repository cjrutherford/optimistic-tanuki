import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  OwnerConfirmService,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import {
  CommercialQuote,
  HAI_LABOR_RATE_PER_HOUR,
  HardwareQuotesService,
  IssueCommercialQuoteRequest,
  OperatorSupplierOffer,
} from '../services/hardware-quotes.service';

/**
 * Commerce → Hardware quotes. Issues a firm 30-day quote from live distributor
 * offers, accepts it, saves it as a lead and hands over the on-prem package.
 * Accepting and saving a proposal affect the customer, so they ask for a
 * reason; the package download asks for a plain confirmation.
 */
@Component({
  selector: 'app-hardware-quotes-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './hardware-quotes-page.component.html',
  styleUrls: ['./hardware-quotes-page.component.scss'],
})
export class HardwareQuotesPageComponent implements OnInit {
  private readonly hardware = inject(HardwareQuotesService);
  private readonly confirm = inject(OwnerConfirmService);
  readonly actionError = signal('');
  readonly successMessage = signal('');
  readonly busy = signal(false);
  readonly amazonSearchBusy = signal(false);
  readonly quote = signal<CommercialQuote | null>(null);
  readonly offers = signal<OperatorSupplierOffer[]>([]);
  readonly offersLoading = signal(false);
  readonly offersError = signal('');
  readonly eligibleOffers = computed(() =>
    this.offers().filter((offer) => this.isEligible(offer))
  );
  readonly selectedOfferIds = signal<string[]>([]);
  selectedQuantities: Record<string, number> = {};

  tierId: IssueCommercialQuoteRequest['tierId'] = 'tier1';
  readonly laborRate = HAI_LABOR_RATE_PER_HOUR;
  freightAmount = 0;
  taxAmount = 0;
  setupHours = 0;
  monthlySupportHours = 0;
  monthlyCloudCost = 0;
  monthlySmsCost = 0;
  monthlyNetworkCost = 0;
  customerName = '';
  customerEmail = '';
  customerPhone = '';
  amazonKeywords = '';
  shippingPostalCode = '';
  deploymentOrganization = '';
  deploymentContactName = '';
  deploymentImageTag = 'stable';
  deploymentGatewayUrl = '';
  deploymentGatewayWsUrl = '';
  deploymentSocketUrl = '';

  ngOnInit(): void {
    this.loadOffers();
  }

  loadOffers(): void {
    this.offersLoading.set(true);
    this.offersError.set('');
    this.hardware.getSupplierOffers().subscribe({
      next: (offers) => {
        this.offers.set(offers);
        const stillAvailable = new Set(
          offers
            .filter((offer) => this.isEligible(offer))
            .map((offer) => offer.id)
        );
        const selected = this.selectedOfferIds().filter((id) =>
          stillAvailable.has(id)
        );
        this.selectedOfferIds.set(selected);
        for (const id of Object.keys(this.selectedQuantities)) {
          if (!selected.includes(id)) delete this.selectedQuantities[id];
        }
        this.offersLoading.set(false);
      },
      error: (error: { error?: { message?: string }; message?: string }) => {
        this.offersError.set(
          error?.error?.message ??
            error?.message ??
            'Supplier offers could not be loaded.'
        );
        this.offersLoading.set(false);
      },
    });
  }

  searchAmazonOffers(): void {
    const keywords = this.amazonKeywords.trim();
    const shippingPostalCode = this.shippingPostalCode.trim();
    if (keywords.length < 2) {
      this.actionError.set('Enter at least two search characters.');
      return;
    }
    this.actionError.set('');
    this.successMessage.set('');
    this.amazonSearchBusy.set(true);
    this.hardware
      .searchAmazonBusinessOffers({
        keywords,
        ...(shippingPostalCode ? { shippingPostalCode } : {}),
      })
      .subscribe({
        next: () => {
          this.amazonSearchBusy.set(false);
          this.successMessage.set(
            'Amazon Business search completed. Supplier offers were refreshed.'
          );
          this.loadOffers();
        },
        error: () => {
          this.amazonSearchBusy.set(false);
          this.actionError.set(
            'Amazon Business live search failed. Check API account access and try again.'
          );
        },
      });
  }

  isEligible(offer: OperatorSupplierOffer): boolean {
    const observedAt = new Date(offer.observedAt).getTime();
    const age = Date.now() - observedAt;
    return (
      offer.sourceChannel === 'live-api' &&
      offer.availability === 'in_stock' &&
      offer.currency === 'USD' &&
      Number.isFinite(observedAt) &&
      age >= 0 &&
      age <= 7 * 24 * 60 * 60 * 1000
    );
  }

  eligibilityReason(offer: OperatorSupplierOffer): string {
    if (offer.sourceChannel !== 'live-api')
      return 'File imported; live API source required.';
    if (offer.availability !== 'in_stock')
      return 'Offer is not currently in stock.';
    if (offer.currency !== 'USD') return 'Offer must be priced in USD.';
    const age = Date.now() - new Date(offer.observedAt).getTime();
    if (!Number.isFinite(age) || age < 0)
      return 'Offer observation time is invalid.';
    return 'Offer is older than seven days.';
  }

  toggleOffer(offer: OperatorSupplierOffer, selected: boolean): void {
    if (!this.isEligible(offer)) return;
    const current = this.selectedOfferIds();
    this.selectedOfferIds.set(
      selected
        ? [...new Set([...current, offer.id])]
        : current.filter((id) => id !== offer.id)
    );
    if (selected) this.selectedQuantities[offer.id] ??= 1;
    else delete this.selectedQuantities[offer.id];
  }

  issueQuote(): void {
    const items = this.selectedOfferIds().map((offerId) => ({
      offerId,
      quantity: Number(this.selectedQuantities[offerId]),
    }));
    if (
      !items.length ||
      items.some(
        (item) =>
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 1000
      )
    ) {
      this.actionError.set(
        'Select at least one eligible offer and enter a whole quantity from 1 to 1,000.'
      );
      return;
    }

    const request: IssueCommercialQuoteRequest = {
      tierId: this.tierId,
      items,
      freightAmount: Number(this.freightAmount),
      taxAmount: Number(this.taxAmount),
      setupHours: Number(this.setupHours),
      monthlySupportHours: Number(this.monthlySupportHours),
      monthlyCloudCost: Number(this.monthlyCloudCost),
      monthlySmsCost: Number(this.monthlySmsCost),
      monthlyNetworkCost: Number(this.monthlyNetworkCost),
      idempotencyKey: `hai-${this.tierId}-${createIdempotencySuffix()}`,
    };
    this.runAction(
      () => this.hardware.issueCommercialQuote(request),
      'Firm quote issued.'
    );
  }

  async acceptQuote(): Promise<void> {
    const quote = this.quote();
    if (!quote) return;
    const { confirmed } = await this.confirm.confirm({
      level: 'reason',
      title: 'Accept this quote?',
      body: `Accepting quote ${quote.id} locks its pricing for the customer.`,
      confirmLabel: 'Accept quote',
    });
    if (!confirmed) return;
    this.runAction(
      () => this.hardware.acceptCommercialQuote(quote.id),
      'Quote accepted.'
    );
  }

  async commitProposal(): Promise<void> {
    const quote = this.quote();
    if (!quote || quote.state !== 'accepted') return;
    const { confirmed } = await this.confirm.confirm({
      level: 'reason',
      title: 'Save this proposal as a lead?',
      body: `The customer ${this.customerName.trim()} will see this proposal's price and terms.`,
      confirmLabel: 'Save proposal',
    });
    if (!confirmed) return;
    this.runAction(
      () =>
        this.hardware.commitCommercialProposal(quote.id, {
          customerName: this.customerName.trim(),
          ...(this.customerEmail.trim()
            ? { customerEmail: this.customerEmail.trim() }
            : {}),
          ...(this.customerPhone.trim()
            ? { customerPhone: this.customerPhone.trim() }
            : {}),
        }),
      'Proposal saved to Lead Tracker.'
    );
  }

  deploymentFormValid(): boolean {
    return Boolean(
      this.deploymentOrganization.trim() &&
        this.deploymentContactName.trim() &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(this.deploymentImageTag) &&
        isHttpUrl(this.deploymentGatewayUrl) &&
        isSocketUrl(this.deploymentGatewayWsUrl) &&
        isHttpUrl(this.deploymentSocketUrl)
    );
  }

  async downloadBundle(): Promise<void> {
    const quote = this.quote();
    if (!quote || quote.state !== 'accepted' || !this.deploymentFormValid())
      return;
    const { confirmed } = await this.confirm.confirm({
      level: 'plain',
      title: 'Generate deployment package?',
      body: 'The archive includes freshly generated customer credentials. Store it securely.',
      confirmLabel: 'Download package',
    });
    if (!confirmed) return;
    this.actionError.set('');
    this.successMessage.set('');
    this.busy.set(true);
    this.hardware
      .downloadClientDeploymentArtifacts(quote.id, {
        organization: this.deploymentOrganization.trim(),
        contactName: this.deploymentContactName.trim(),
        imageTag: this.deploymentImageTag,
        gatewayUrl: this.deploymentGatewayUrl,
        gatewayWsUrl: this.deploymentGatewayWsUrl,
        socketUrl: this.deploymentSocketUrl,
      })
      .subscribe({
        next: (archive) => {
          try {
            saveArchive(
              archive,
              `hai-computer-${
                quote.id.replace(/[^a-zA-Z0-9-]/g, '') || 'quote'
              }.tar.gz`
            );
            this.successMessage.set(
              'HAI Computer deployment package download started. Store the archive securely.'
            );
          } catch {
            this.actionError.set(
              'The deployment package was prepared, but this browser could not start the download.'
            );
          }
          this.busy.set(false);
        },
        error: () => {
          this.actionError.set(
            'The HAI Computer deployment package could not be prepared. Check the accepted quote and entered deployment settings.'
          );
          this.busy.set(false);
        },
      });
  }

  private runAction<T extends CommercialQuote | unknown>(
    request: () => import('rxjs').Observable<T>,
    message: string
  ): void {
    this.actionError.set('');
    this.successMessage.set('');
    this.busy.set(true);
    request().subscribe({
      next: (result) => {
        if (
          result &&
          typeof result === 'object' &&
          'pricingSnapshot' in result
        ) {
          this.quote.set(result as unknown as CommercialQuote);
        }
        this.successMessage.set(message);
        this.busy.set(false);
      },
      error: (error: { error?: { message?: string }; message?: string }) => {
        this.actionError.set(
          error?.error?.message ?? error?.message ?? 'The request failed.'
        );
        this.busy.set(false);
      },
    });
  }
}

function createIdempotencySuffix(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSocketUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function saveArchive(archive: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(archive);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
