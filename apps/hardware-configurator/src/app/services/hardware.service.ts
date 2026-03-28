import { Injectable } from '@angular/core';
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

export interface Order {
  id: string;
  configuration: ConfigurationDto;
  priceBreakdown: PriceBreakdown;
  shippingAddress: ShippingAddress;
  customerEmail: string;
  status: string;
  estimatedDelivery: Date | null;
  createdAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class HardwareService {
  private readonly apiUrl = '/api/hardware';

  constructor(private http: HttpClient) {}

  getChassis(): Observable<Chassis[]> {
    return this.http.get<Chassis[]>(`${this.apiUrl}/chassis`);
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
    customerEmail: string
  ): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/orders`, {
      configuration,
      shippingAddress,
      customerEmail,
    });
  }

  getOrder(orderId: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${orderId}`);
  }
}
