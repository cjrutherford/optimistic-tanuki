import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OptomisitcTanukiAPIService as PaymentsAPIService } from '@optimistic-tanuki/payments-ui-data-access';
import { OptomisitcTanukiAPIService as StoreAPIService } from '@optimistic-tanuki/store-data-access';

export interface Product {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  type: string;
  imageUrl?: string;
  stock: number;
  active: boolean;
  catalogId?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CartItem {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string;
}

export interface Order {
  id?: string;
  userId: string;
  items: OrderItem[];
  totalCents: number;
  currency: string;
  status?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

// Backend-facing donation payload; amountCents mirrors CreateDonationDto.
// The donation form (DonationRequest from @optimistic-tanuki/store-ui)
// collects a dollar amount, which callers must convert before invoking
// createDonation.
export interface CreateDonationRequest {
  amountCents: number;
  message?: string;
  anonymous: boolean;
  currency?: string;
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  description?: string;
  location?: string;
  capacity?: number;
  amenities?: string[];
  hourlyRate?: number;
  isActive: boolean;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Appointment {
  id?: string;
  userId: string;
  resourceId?: string;
  resource?: Resource;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  status?: string;
  isFreeConsultation?: boolean;
  hourlyRate?: number;
  totalCost?: number;
  notes?: string;
}

export interface CreateAppointmentRequest {
  userId: string;
  resourceId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isFreeConsultation?: boolean;
  notes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  constructor(
    private http: HttpClient,
    private payments: PaymentsAPIService,
    private store: StoreAPIService
  ) {}

  // Product operations
  getProducts(catalogId?: string): Observable<Product[]> {
    return this.store.storeControllerFindAllProducts<Product[]>({
      catalogId: catalogId ?? undefined,
    });
  }

  getProduct(id: string): Observable<Product> {
    return this.store.storeControllerFindOneProduct<Product>(id, {});
  }

  // Order operations
  createOrder(order: Order): Observable<Order> {
    return this.store.storeControllerCreateOrder<Order>(order);
  }

  getUserOrders(userId: string): Observable<Order[]> {
    return this.store.storeControllerFindUserOrders<Order[]>(userId);
  }

  // Donation operations — O14: canonical direct-record route
  // (POST /api/payments/donations preserves anonymous gifts).
  createDonation(donation: CreateDonationRequest): Observable<any> {
    return this.payments.paymentsControllerRecordDonation({
      amount: donation.amountCents / 100,
      message: donation.message,
      anonymous: donation.anonymous,
      currency: donation.currency || 'USD',
    });
  }

  // Resource operations
  getResources(): Observable<Resource[]> {
    return this.store.storeControllerFindAllResources<Resource[]>();
  }

  getResource(id: string): Observable<Resource> {
    return this.store.storeControllerFindOneResource<Resource>(id);
  }

  getResourcesByType(type: string): Observable<Resource[]> {
    return this.store.storeControllerFindResourcesByType<Resource[]>(type);
  }

  checkResourceAvailability(
    resourceId: string,
    startTime: Date,
    endTime: Date
  ): Observable<boolean> {
    return this.store.storeControllerCheckResourceAvailability<boolean>(
      resourceId,
      {
        startTime: toWireDate(startTime),
        endTime: toWireDate(endTime),
      }
    );
  }

  // Appointment operations
  createAppointment(
    appointment: CreateAppointmentRequest
  ): Observable<Appointment> {
    return this.store.storeControllerCreateAppointment<Appointment>({
      ...appointment,
      startTime: toWireDate(appointment.startTime),
      endTime: toWireDate(appointment.endTime),
    });
  }

  getUserAppointments(userId: string): Observable<Appointment[]> {
    return this.store.storeControllerFindUserAppointments<Appointment[]>(
      userId
    );
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.store.storeControllerFindOneAppointment<Appointment>(id);
  }

  cancelAppointment(id: string): Observable<Appointment> {
    return this.store.storeControllerCancelAppointment<Appointment>(id);
  }
}

function toWireDate(value: Date): string;
function toWireDate(value: undefined): undefined;
function toWireDate(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}
