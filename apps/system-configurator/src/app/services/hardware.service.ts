import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ChassisSpecifications {
  formFactor: string;
  maxPower: string;
  noiseLevel: string;
  dimensions: string;
}

export interface Chassis {
  id: string;
  type: 'XS' | 'S' | 'M' | 'L';
  useCase: 'cloud' | 'nas' | 'dev' | 'hybrid' | 'enterprise';
  name: string;
  description: string;
  basePrice: number;
  specifications: ChassisSpecifications;
  isActive: boolean;
}

/** Public catalog fields safe to display before an owner issues a firm quote. */
export interface HardwareTier {
  id: string;
  tierNumber: number;
  name: string;
  formFactor: string;
  hardware: string;
  ram: string;
  storage: string;
  network: string;
  powerAndProtection: string;
  aiAccelerator?: string;
  targetUsers: string;
  configuratorPreset: string;
}

export interface Component {
  id: string;
  type: 'cpu' | 'ram' | 'storage' | 'gpu';
  name: string;
  description: string;
  basePrice: number;
  sellingPrice: number;
  specs: Record<string, string | number>;
  compatibleWith: string[];
  inStock: boolean;
  isActive: boolean;
}

export interface CompatibleComponents {
  cpu: Component[];
  ram: Component[];
  storage: Component[];
  gpu: Component[];
}

export interface ConfigurationDto {
  chassisId: string;
  chassisType: string;
  useCase: string;
  cpuId: string;
  ramId: string;
  storageIds: string[];
  gpuId?: string;
}

export interface PriceBreakdown {
  chassisPrice: number;
  cpuPrice: number;
  ramPrice: number;
  storagePrice: number;
  gpuPrice: number;
  casePrice: number;
  accessoriesPrice: number;
  assemblyFee: number;
  totalPrice: number;
}

export interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

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

export type PaymentMethod = 'card' | 'cash-app' | 'venmo' | 'zelle' | 'cash';

export interface Order {
  id: string;
  configuration: ConfigurationDto;
  priceBreakdown: PriceBreakdown;
  shippingAddress: ShippingAddress;
  customerEmail: string;
  paymentMethod: PaymentMethod;
  status: string;
  estimatedDelivery: Date | null;
  createdAt: Date;
}

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
  monthlyRetainerRevenue: number;
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

@Injectable({
  providedIn: 'root',
})
export class HardwareService {
  private readonly apiUrl = '/api/hardware';
  private readonly http = inject(HttpClient);

  getChassis(): Observable<Chassis[]> {
    return this.http.get<Chassis[]>(`${this.apiUrl}/chassis`);
  }

  getTiers(): Observable<HardwareTier[]> {
    return this.http.get<HardwareTier[]>(`${this.apiUrl}/tiers`);
  }

  getChassisById(id: string): Observable<Chassis> {
    return this.http.get<Chassis>(`${this.apiUrl}/chassis/${id}`);
  }

  getCompatibleComponents(chassisId: string): Observable<CompatibleComponents> {
    return this.http.get<CompatibleComponents>(
      `${this.apiUrl}/chassis/${chassisId}/compatible`
    );
  }

  calculatePrice(config: ConfigurationDto): Observable<PriceBreakdown> {
    return this.http.post<PriceBreakdown>(
      `${this.apiUrl}/pricing/calculate`,
      config
    );
  }

  createOrder(
    configuration: ConfigurationDto,
    shippingAddress: ShippingAddress,
    customerEmail: string,
    paymentMethod: PaymentMethod
  ): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/orders`, {
      configuration,
      shippingAddress,
      customerEmail,
      paymentMethod,
    });
  }

  getOrder(orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${orderId}`);
  }

  probeOperatorAccess(): Observable<{ available: true; service: string }> {
    return this.http.get<{ available: true; service: string }>(
      `${this.apiUrl}/operator/access`,
      { headers: { 'X-ot-appscope': 'owner-console' } }
    );
  }

  getOperatorSupplierOffers(): Observable<OperatorSupplierOffer[]> {
    return this.http.get<OperatorSupplierOffer[]>(
      `${this.apiUrl}/operator/supplier-offers`,
      { headers: { 'X-ot-appscope': 'owner-console' } }
    );
  }

  searchAmazonBusinessOffers(
    request: SearchAmazonBusinessOffersRequest
  ): Observable<OperatorSupplierOffer[]> {
    return this.http.post<OperatorSupplierOffer[]>(
      `${this.apiUrl}/operator/supplier-offers/amazon/search`,
      request,
      { headers: { 'X-ot-appscope': 'owner-console' } }
    );
  }

  issueCommercialQuote(
    request: IssueCommercialQuoteRequest
  ): Observable<CommercialQuote> {
    return this.http.post<CommercialQuote>(
      `${this.apiUrl}/operator/quotes`,
      request,
      { headers: { 'X-ot-appscope': 'owner-console' } }
    );
  }

  acceptCommercialQuote(quoteId: string): Observable<CommercialQuote> {
    return this.http.post<CommercialQuote>(
      `${this.apiUrl}/operator/quotes/${encodeURIComponent(quoteId)}/accept`,
      {},
      { headers: { 'X-ot-appscope': 'owner-console' } }
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
      `${this.apiUrl}/operator/quotes/${encodeURIComponent(quoteId)}/commit`,
      customer,
      { headers: { 'X-ot-appscope': 'owner-console' } }
    );
  }

  downloadClientDeploymentArtifacts(
    quoteId: string,
    request: ClientDeploymentRequest
  ): Observable<Blob> {
    return this.http.post(
      `${this.apiUrl}/operator/quotes/${encodeURIComponent(
        quoteId
      )}/deployment-artifacts`,
      request,
      {
        headers: { 'X-ot-appscope': 'owner-console' },
        responseType: 'blob',
      }
    );
  }
}
