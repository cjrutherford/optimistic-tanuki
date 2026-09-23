import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { OptomisitcTanukiAPIService } from '@optimistic-tanuki/store-data-access';
import {
  CreateProductDto,
  UpdateProductDto,
  UpdateOrderDto,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ApproveAppointmentDto,
  DenyAppointmentDto,
  CreateAvailabilityDto,
  UpdateAvailabilityDto,
  Appointment,
  Availability,
  Invoice,
  Resource,
  CreateResourceDto,
  UpdateResourceDto,
} from '@optimistic-tanuki/ui-models';

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
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreCatalog {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  workspaceId: string;
  appScope: string;
}

export interface Order {
  id: string;
  userId: string;
  status: string;
  totalCents: number;
  currency: string;
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPriceCents: number;
}

export interface Donation {
  id: string;
  userId?: string;
  amountCents: number;
  currency: string;
  message?: string;
  anonymous: boolean;
  status: string;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  productId: string;
  product?: Product;
  status: string;
  interval: string;
  startDate: Date;
  endDate?: Date;
  nextBillingDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root',
})
export class StoreService {
  constructor(
    private http: HttpClient,
    private store: OptomisitcTanukiAPIService
  ) {}

  // Product management
  getProducts(catalogId?: string | null): Observable<Product[]> {
    return this.store.storeControllerFindAllProducts<Product[]>({
      catalogId: catalogId ?? undefined,
    });
  }

  getMyCatalogs(workspaceSlug: string): Observable<StoreCatalog[]> {
    return this.store.storeControllerFindMyCatalogs<StoreCatalog[]>({
      params: { workspaceSlug },
    });
  }

  getProduct(id: string): Observable<Product> {
    return this.store.storeControllerFindOneProduct<Product>(id, {});
  }

  createProduct(
    product: CreateProductDto,
    workspaceSlug?: string | null
  ): Observable<Product> {
    // ui-models allows null catalogId; the wire contract wants it absent.
    const { catalogId, ...rest } = product;
    return this.store.storeControllerCreateProduct<Product>(
      { ...rest, catalogId: catalogId ?? undefined },
      {
        params: workspaceSlug ? { workspaceSlug } : undefined,
      }
    );
  }

  updateProduct(
    id: string,
    product: UpdateProductDto,
    workspaceSlug?: string | null
  ): Observable<Product> {
    const { catalogId, ...rest } = product;
    return this.store.storeControllerUpdateProduct<Product>(
      id,
      { ...rest, catalogId: catalogId ?? undefined },
      {
        params: workspaceSlug ? { workspaceSlug } : undefined,
      }
    );
  }

  deleteProduct(id: string): Observable<void> {
    return this.store.storeControllerRemoveProduct<void>(id);
  }

  // Order management
  getOrders(): Observable<Order[]> {
    return this.store.storeControllerFindAllOrders<Order[]>();
  }

  getUserOrders(userId: string): Observable<Order[]> {
    return this.store.storeControllerFindUserOrders<Order[]>(userId);
  }

  getOrder(id: string): Observable<Order> {
    return this.store.storeControllerFindOneOrder<Order>(id);
  }

  updateOrder(id: string, order: UpdateOrderDto): Observable<Order> {
    return this.store.storeControllerUpdateOrder<Order>(id, order);
  }

  // Donation management — O14: canonical payments list (GET /api/donations).
  // Rows map onto the store Donation shape so overview displays are unchanged.
  getDonations(): Observable<Donation[]> {
    return this.http
      .get<
        Array<{
          id: string;
          userId?: string;
          amount: number;
          currency?: string;
          message?: string;
          anonymous?: boolean;
          status: string;
          createdAt: Date;
        }>
      >('/api/donations')
      .pipe(
        map((rows) =>
          (rows ?? []).map((row) => ({
            id: row.id,
            userId: row.userId,
            amountCents: Math.round(Number(row.amount ?? 0) * 100),
            currency: row.currency ?? 'USD',
            message: row.message,
            anonymous: row.anonymous ?? !row.userId,
            status: row.status,
            createdAt: row.createdAt,
          }))
        )
      );
  }

  // Subscription management
  getSubscriptions(): Observable<Subscription[]> {
    return this.store.storeControllerFindAllSubscriptions<Subscription[]>();
  }

  getUserSubscriptions(userId: string): Observable<Subscription[]> {
    return this.store.storeControllerFindUserSubscriptions<Subscription[]>(
      userId
    );
  }

  cancelSubscription(id: string): Observable<Subscription> {
    return this.store.storeControllerCancelSubscription<Subscription>(id);
  }

  // Appointment management
  getAppointments(): Observable<Appointment[]> {
    return this.store.storeControllerFindAllAppointments<Appointment[]>();
  }

  getUserAppointments(userId: string): Observable<Appointment[]> {
    return this.store.storeControllerFindUserAppointments<Appointment[]>(
      userId
    );
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.store.storeControllerFindOneAppointment<Appointment>(id);
  }

  createAppointment(
    appointment: CreateAppointmentDto
  ): Observable<Appointment> {
    // Domain DTOs carry Dates; the wire wants ISO strings (identical bytes
    // to the old HttpClient JSON serialization). Non-Date values pass
    // through so malformed payloads still fail server-side, as before.
    return this.store.storeControllerCreateAppointment<Appointment>({
      ...appointment,
      startTime: toWireDate(appointment.startTime),
      endTime: toWireDate(appointment.endTime),
    });
  }

  updateAppointment(
    id: string,
    appointment: UpdateAppointmentDto
  ): Observable<Appointment> {
    const { startTime, endTime, ...rest } = appointment;
    return this.store.storeControllerUpdateAppointment<Appointment>(id, {
      ...rest,
      startTime: startTime === undefined ? undefined : toWireDate(startTime),
      endTime: endTime === undefined ? undefined : toWireDate(endTime),
    });
  }

  approveAppointment(
    id: string,
    approveDto: ApproveAppointmentDto
  ): Observable<Appointment> {
    return this.store.storeControllerApproveAppointment<Appointment>(
      id,
      approveDto
    );
  }

  denyAppointment(
    id: string,
    denyDto: DenyAppointmentDto
  ): Observable<Appointment> {
    return this.store.storeControllerDenyAppointment<Appointment>(id, denyDto);
  }

  cancelAppointment(id: string): Observable<Appointment> {
    return this.store.storeControllerCancelAppointment<Appointment>(id);
  }

  completeAppointment(id: string): Observable<Appointment> {
    return this.store.storeControllerCompleteAppointment<Appointment>(id);
  }

  generateInvoice(appointmentId: string): Observable<Invoice> {
    return this.store.storeControllerGenerateInvoice<Invoice>(appointmentId);
  }

  // Availability management
  getAvailabilities(): Observable<Availability[]> {
    return this.store.storeControllerFindAllAvailabilities<Availability[]>();
  }

  getOwnerAvailabilities(ownerId: string): Observable<Availability[]> {
    return this.store.storeControllerFindOwnerAvailabilities<Availability[]>(
      ownerId
    );
  }

  getAvailability(id: string): Observable<Availability> {
    return this.store.storeControllerFindOneAvailability<Availability>(id);
  }

  createAvailability(
    availability: CreateAvailabilityDto
  ): Observable<Availability> {
    return this.store.storeControllerCreateAvailability<Availability>(
      availability
    );
  }

  updateAvailability(
    id: string,
    availability: UpdateAvailabilityDto
  ): Observable<Availability> {
    return this.store.storeControllerUpdateAvailability<Availability>(
      id,
      availability
    );
  }

  deleteAvailability(id: string): Observable<void> {
    return this.store.storeControllerRemoveAvailability<void>(id);
  }

  // Resource management
  getResources(): Observable<Resource[]> {
    return this.store.storeControllerFindAllResources<Resource[]>();
  }

  getResourcesByType(type: string): Observable<Resource[]> {
    return this.store.storeControllerFindResourcesByType<Resource[]>(type);
  }

  getResource(id: string): Observable<Resource> {
    return this.store.storeControllerFindOneResource<Resource>(id);
  }

  createResource(resource: CreateResourceDto): Observable<Resource> {
    return this.store.storeControllerCreateResource<Resource>(resource);
  }

  updateResource(
    id: string,
    resource: UpdateResourceDto
  ): Observable<Resource> {
    return this.store.storeControllerUpdateResource<Resource>(id, resource);
  }

  deleteResource(id: string): Observable<void> {
    return this.store.storeControllerRemoveResource<void>(id);
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
}

function toWireDate(value: Date): string;
function toWireDate(value: undefined): undefined;
function toWireDate(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value;
}
