import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface SearchAmazonBusinessOffersRequest {
  keywords: string;
  shippingPostalCode?: string;
}

export interface ClientDeploymentRequest {
  organization: string;
  contactName: string;
  imageTag: string;
  gatewayUrl: string;
  gatewayWsUrl: string;
  socketUrl: string;
}

/**
 * Published labor rate in US dollars per hour (HAI D019). Kept equal to
 * `HAI_LABOR_RATE_PER_HOUR` in system-configurator-api and the HAI website by
 * `apps/hai/src/app/labor-rate-sync.spec.ts`.
 */
export const HAI_LABOR_RATE_PER_HOUR = 65;

export interface CommercialQuote {
  id: string;
  sourceCost: number;
  currency: string;
  pricingSnapshot: { outrightPrice: number; [key: string]: unknown };
  issuedAt: string | Date;
  validUntil: string | Date;
  version: string;
  state: 'issued' | 'accepted' | 'expired' | 'withdrawn';
}

export interface IssueCommercialQuoteRequest {
  tierId: 'tier1' | 'tier2' | 'tier3';
  items: Array<{ offerId: string; quantity: number }>;
  freightAmount: number;
  taxAmount: number;
  setupHours: number;
  monthlySupportHours: number;
  monthlyCloudCost: number;
  monthlySmsCost: number;
  monthlyNetworkCost: number;
  idempotencyKey: string;
}

export interface OperatorSupplierOffer {
  id: string;
  vendor: string;
  sourceSku: string;
  productName: string;
  amount: number;
  currency: string;
  availability: 'in_stock' | 'backorder' | 'out_of_stock' | 'unknown';
  observedAt: string | Date;
  sourceChannel: 'live-api' | 'file-import';
}

/**
 * Owner-only hardware quote routes on the gateway. The owner console proxy
 * stamps the owner-console app scope on every request, and the gateway checks
 * the signed-in owner's roles and the `hardware.operate` permission.
 */
@Injectable({ providedIn: 'root' })
export class HardwareQuotesService {
  private readonly apiUrl = '/api/hardware/operator';
  private readonly http = inject(HttpClient);

  getSupplierOffers(): Observable<OperatorSupplierOffer[]> {
    return this.http.get<OperatorSupplierOffer[]>(
      `${this.apiUrl}/supplier-offers`
    );
  }

  searchAmazonBusinessOffers(
    request: SearchAmazonBusinessOffersRequest
  ): Observable<OperatorSupplierOffer[]> {
    return this.http.post<OperatorSupplierOffer[]>(
      `${this.apiUrl}/supplier-offers/amazon/search`,
      request
    );
  }

  issueCommercialQuote(
    request: IssueCommercialQuoteRequest
  ): Observable<CommercialQuote> {
    return this.http.post<CommercialQuote>(`${this.apiUrl}/quotes`, request);
  }

  acceptCommercialQuote(quoteId: string): Observable<CommercialQuote> {
    return this.http.post<CommercialQuote>(
      `${this.apiUrl}/quotes/${encodeURIComponent(quoteId)}/accept`,
      {}
    );
  }

  commitCommercialProposal(
    quoteId: string,
    customer: {
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
    }
  ): Observable<unknown> {
    return this.http.post(
      `${this.apiUrl}/quotes/${encodeURIComponent(quoteId)}/commit`,
      customer
    );
  }

  downloadClientDeploymentArtifacts(
    quoteId: string,
    request: ClientDeploymentRequest
  ): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/quotes/${encodeURIComponent(
        quoteId
      )}/deployment-artifacts`,
      request,
      { responseType: 'blob' }
    );
  }
}
