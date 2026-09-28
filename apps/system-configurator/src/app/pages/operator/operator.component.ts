import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CommercialQuote,
  HardwareService,
  IssueCommercialQuoteRequest,
  OperatorSupplierOffer,
} from '../../services/hardware.service';

@Component({
  selector: 'app-hardware-operator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <main class="operator-shell">
      <header>
        <p class="eyebrow">HAI Computer · Owner workflow</p>
        <h1>Commercial proposals</h1>
        <p>
          Issue a 30-day quote from current, verified distributor offers, accept
          it, then commit the proposal to Lead Tracker.
        </p>
      </header>

      <p *ngIf="checkingAccess()" role="status">
        Checking Owner Console access…
      </p>
      <section class="notice error" *ngIf="accessError()" role="alert">
        {{ accessError() }}
      </section>
      <section
        class="notice"
        *ngIf="!checkingAccess() && !accessError() && !ownerAccess()"
      >
        This workflow requires a signed-in Owner Console owner. Sign in with an
        owner account, then reload this page.
      </section>

      <ng-container *ngIf="ownerAccess()">
        <section class="notice sourcing" aria-label="Sourcing requirement">
          <strong>Live sourcing requirement</strong>
          <span
            >Only current USD offers marked as in stock and sourced from a live
            distributor API can be quoted. Structured feed imports are fallback
            data and cannot be used for firm quotes.</span
          >
        </section>

        <form
          class="sourcing-form"
          (ngSubmit)="searchAmazonOffers()"
          aria-label="Search live Amazon Business offers"
        >
          <h2>Search Amazon Business</h2>
          <p>
            Run a live catalog search with the approved Amazon Business account.
            Matching offers are saved to the supplier list for review.
          </p>
          <label
            >Search keywords<input
              name="amazonKeywords"
              [(ngModel)]="amazonKeywords"
              minlength="2"
              maxlength="120"
              required
          /></label>
          <label
            >Shipping ZIP code (optional)<input
              name="shippingPostalCode"
              [(ngModel)]="shippingPostalCode"
              inputmode="numeric"
              pattern="[0-9]{5}(-[0-9]{4})?"
          /></label>
          <button
            type="submit"
            [disabled]="
              amazonSearchBusy() || busy() || amazonKeywords.trim().length < 2
            "
          >
            {{ amazonSearchBusy() ? 'Searching…' : 'Search and sync offers' }}
          </button>
        </form>

        <form class="quote-form" (ngSubmit)="issueQuote()">
          <h2>Issue firm quote</h2>
          <p>
            Select the live supplier offers for this build. Offers must be in
            stock, priced in USD, and observed within the last seven days.
          </p>
          <div class="offer-heading">
            <h3>Supplier offers</h3>
            <button
              type="button"
              class="secondary"
              (click)="loadOffers()"
              [disabled]="offersLoading()"
            >
              {{ offersLoading() ? 'Refreshing…' : 'Refresh offers' }}
            </button>
          </div>
          <p *ngIf="offersLoading()" role="status">Loading supplier offers…</p>
          <p *ngIf="offersError()" class="error" role="alert">
            {{ offersError() }}
          </p>
          <p
            *ngIf="
              !offersLoading() &&
              !offersError() &&
              eligibleOffers().length === 0
            "
            role="status"
          >
            No eligible live API offers are available. Configure a distributor
            API connection and refresh the list.
          </p>
          <div class="offer-list" *ngIf="eligibleOffers().length > 0">
            <article
              class="offer-row"
              *ngFor="let offer of offers()"
              [class.ineligible]="!isEligible(offer)"
            >
              <label class="offer-choice">
                <input
                  type="checkbox"
                  [checked]="selectedOfferIds().includes(offer.id)"
                  [disabled]="!isEligible(offer)"
                  (change)="toggleOffer(offer, $any($event.target).checked)"
                />
                <span>
                  <strong>{{ offer.productName }}</strong>
                  <small
                    >{{ offer.vendor }} · SKU {{ offer.sourceSku }} ·
                    {{ offer.availability }} · {{ offer.sourceChannel }}</small
                  >
                  <small
                    >Observed {{ offer.observedAt | date : 'medium' }}</small
                  >
                </span>
                <strong>{{ offer.amount | currency : offer.currency }}</strong>
              </label>
              <label
                class="quantity"
                *ngIf="selectedOfferIds().includes(offer.id)"
              >
                Quantity
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="1"
                  [name]="'quantity-' + offer.id"
                  [(ngModel)]="selectedQuantities[offer.id]"
                />
              </label>
              <p class="ineligible-reason" *ngIf="!isEligible(offer)">
                {{ eligibilityReason(offer) }}
              </p>
            </article>
          </div>
          <label>
            Commercial tier
            <select name="tierId" [(ngModel)]="tierId">
              <option value="tier1">Tier 1</option>
              <option value="tier2">Tier 2</option>
              <option value="tier3">Tier 3</option>
            </select>
          </label>
          <fieldset>
            <legend>Monthly retainer margin inputs (USD)</legend>
            <label
              >Retainer revenue<input
                type="number"
                name="revenue"
                min="0.01"
                step="0.01"
                [(ngModel)]="monthlyRetainerRevenue"
                required
            /></label>
            <label
              >Cloud cost<input
                type="number"
                name="cloud"
                min="0"
                step="0.01"
                [(ngModel)]="monthlyCloudCost"
                required
            /></label>
            <label
              >SMS cost<input
                type="number"
                name="sms"
                min="0"
                step="0.01"
                [(ngModel)]="monthlySmsCost"
                required
            /></label>
            <label
              >Network cost<input
                type="number"
                name="network"
                min="0"
                step="0.01"
                [(ngModel)]="monthlyNetworkCost"
                required
            /></label>
          </fieldset>
          <button
            type="submit"
            [disabled]="
              busy() || offersLoading() || selectedOfferIds().length === 0
            "
          >
            {{ busy() ? 'Issuing…' : 'Issue 30-day quote' }}
          </button>
        </form>

        <section
          class="quote-result"
          *ngIf="quote() as issuedQuote"
          aria-live="polite"
        >
          <h2>Quote {{ issuedQuote.id }}</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd>{{ issuedQuote.state }}</dd>
            </div>
            <div>
              <dt>Internal source cost</dt>
              <dd>
                {{ issuedQuote.sourceCost | currency : issuedQuote.currency }}
              </dd>
            </div>
            <div>
              <dt>Customer price</dt>
              <dd>
                {{
                  issuedQuote.pricingSnapshot['outrightPrice']
                    | currency : issuedQuote.currency
                }}
              </dd>
            </div>
            <div>
              <dt>Valid until</dt>
              <dd>{{ issuedQuote.validUntil | date : 'medium' }}</dd>
            </div>
          </dl>
          <button
            type="button"
            (click)="acceptQuote()"
            [disabled]="busy() || issuedQuote.state !== 'issued'"
          >
            Accept quote
          </button>

          <form
            class="commit-form"
            (ngSubmit)="commitProposal()"
            *ngIf="issuedQuote.state === 'accepted'"
          >
            <h3>Commit proposal to Lead Tracker</h3>
            <label
              >Customer name<input
                name="customerName"
                [(ngModel)]="customerName"
                required
            /></label>
            <label
              >Customer email<input
                name="customerEmail"
                type="email"
                [(ngModel)]="customerEmail"
            /></label>
            <label
              >Customer phone<input
                name="customerPhone"
                type="tel"
                [(ngModel)]="customerPhone"
            /></label>
            <button type="submit" [disabled]="busy() || !customerName.trim()">
              {{ busy() ? 'Saving…' : 'Save proposal as lead' }}
            </button>
          </form>

          <form
            class="deployment-form"
            (ngSubmit)="downloadBundle()"
            *ngIf="issuedQuote.state === 'accepted'"
          >
            <h3>Download HAI Computer on-prem package</h3>
            <p>
              This package contains the HAI Computer portal and its required
              services. Generated credentials are included in the downloaded
              archive; store it securely.
            </p>
            <label
              >Customer organization<input
                name="deploymentOrganization"
                [(ngModel)]="deploymentOrganization"
                maxlength="255"
                required
            /></label>
            <label
              >Customer contact<input
                name="deploymentContactName"
                [(ngModel)]="deploymentContactName"
                maxlength="255"
                required
            /></label>
            <label
              >HAI Computer image tag<input
                name="deploymentImageTag"
                [(ngModel)]="deploymentImageTag"
                pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,127}"
                required
            /></label>
            <label
              >Gateway URL<input
                name="deploymentGatewayUrl"
                type="url"
                [(ngModel)]="deploymentGatewayUrl"
                required
            /></label>
            <label
              >Gateway WebSocket URL<input
                name="deploymentGatewayWsUrl"
                type="url"
                [(ngModel)]="deploymentGatewayWsUrl"
                required
            /></label>
            <label
              >Socket URL<input
                name="deploymentSocketUrl"
                type="url"
                [(ngModel)]="deploymentSocketUrl"
                required
            /></label>
            <button type="submit" [disabled]="busy() || !deploymentFormValid()">
              {{ busy() ? 'Preparing…' : 'Download deployment package' }}
            </button>
          </form>
        </section>
        <p class="notice error" *ngIf="actionError()" role="alert">
          {{ actionError() }}
        </p>
        <p class="notice success" *ngIf="successMessage()" role="status">
          {{ successMessage() }}
        </p>
      </ng-container>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
        background: var(--config-operator-background);
        color: var(--config-operator-foreground);
      }
      .operator-shell {
        width: min(100% - 2rem, 920px);
        margin: 0 auto;
        padding: 3rem 0 5rem;
      }
      header {
        margin-bottom: 2rem;
      }
      h1 {
        margin: 0.3rem 0 0.75rem;
        font-size: clamp(2rem, 5vw, 3.5rem);
      }
      h2 {
        margin-top: 0;
      }
      .eyebrow {
        color: var(--config-operator-accent);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .notice,
      .quote-form,
      .quote-result,
      .sourcing-form {
        margin: 1.25rem 0;
        padding: 1.25rem;
        border: 1px solid var(--config-operator-border);
        border-radius: 1rem;
        background: white;
      }
      .sourcing {
        display: grid;
        gap: 0.4rem;
        border-left: 5px solid var(--config-operator-sourcing);
      }
      .error {
        color: var(--config-operator-error);
        border-color: var(--config-operator-error-border);
      }
      .success {
        color: var(--config-operator-success);
      }
      .offer-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
      }
      .offer-heading h3 {
        margin: 0;
      }
      .offer-list {
        display: grid;
        gap: 0.7rem;
        max-height: 28rem;
        overflow: auto;
      }
      .offer-row {
        padding: 0.85rem;
        border: 1px solid var(--config-operator-border);
        border-radius: 0.65rem;
        background: var(--config-operator-surface);
      }
      .offer-choice {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 0.8rem;
        align-items: center;
        cursor: pointer;
      }
      .offer-choice input {
        width: 1.1rem;
        height: 1.1rem;
      }
      .offer-choice span {
        display: grid;
        gap: 0.2rem;
      }
      .offer-choice small {
        color: var(--config-operator-muted);
        font-weight: 400;
      }
      .ineligible {
        opacity: 0.65;
      }
      .ineligible-reason {
        margin: 0.5rem 0 0 2rem;
        color: var(--config-operator-warning);
        font-size: 0.9rem;
      }
      .quantity {
        grid-template-columns: auto 6rem;
        align-items: center;
        width: fit-content;
        margin: 0.65rem 0 0 2rem;
      }
      .quantity input {
        padding: 0.45rem;
      }
      .secondary {
        border: 1px solid var(--config-operator-action);
        background: white;
        color: var(--config-operator-action);
      }
      form {
        display: grid;
        gap: 1rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-weight: 600;
      }
      input,
      select,
      textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 0.7rem;
        border: 1px solid var(--config-operator-border-muted);
        border-radius: 0.5rem;
        font: inherit;
      }
      fieldset {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 0.85rem;
        border: 1px solid var(--config-operator-border);
        border-radius: 0.7rem;
        padding: 1rem;
      }
      legend {
        padding: 0 0.35rem;
        font-weight: 700;
      }
      button {
        width: fit-content;
        border: 0;
        border-radius: 2rem;
        padding: 0.75rem 1.15rem;
        background: var(--config-operator-action);
        color: white;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      button:disabled {
        cursor: wait;
        opacity: 0.55;
      }
      dl {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.8rem;
      }
      dl div {
        padding: 0.75rem;
        background: var(--config-operator-surface-muted);
        border-radius: 0.5rem;
      }
      dt {
        font-size: 0.85rem;
        color: var(--config-operator-muted);
      }
      dd {
        margin: 0.25rem 0 0;
        font-weight: 700;
      }
    `,
  ],
})
export class OperatorComponent implements OnInit {
  private readonly hardware = inject(HardwareService);
  readonly checkingAccess = signal(true);
  readonly ownerAccess = signal(false);
  readonly accessError = signal('');
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
  monthlyRetainerRevenue = 0;
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
    this.hardware.probeOperatorAccess().subscribe({
      next: () => {
        this.ownerAccess.set(true);
        this.checkingAccess.set(false);
        this.loadOffers();
      },
      error: () => {
        this.ownerAccess.set(false);
        this.accessError.set(
          'Owner Console access could not be verified for this session.'
        );
        this.checkingAccess.set(false);
      },
    });
  }

  loadOffers(): void {
    this.offersLoading.set(true);
    this.offersError.set('');
    this.hardware.getOperatorSupplierOffers().subscribe({
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
      monthlyRetainerRevenue: Number(this.monthlyRetainerRevenue),
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

  acceptQuote(): void {
    const quote = this.quote();
    if (!quote) return;
    this.runAction(
      () => this.hardware.acceptCommercialQuote(quote.id),
      'Quote accepted.'
    );
  }

  commitProposal(): void {
    const quote = this.quote();
    if (!quote || quote.state !== 'accepted') return;
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

  downloadBundle(): void {
    const quote = this.quote();
    if (!quote || quote.state !== 'accepted' || !this.deploymentFormValid())
      return;
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
