import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
} from '@optimistic-tanuki/ui-models';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  type: string;
  imageUrl?: string;
  stock: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  userId: string;
  status: string;
  total: number;
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
  price: number;
}

export interface Donation {
  id: string;
  userId?: string;
  amount: number;
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
  private readonly API_URL = '/api/store';

  constructor(private http: HttpClient) {}

  // Product management
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API_URL}/products`);
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.API_URL}/products/${id}`);
  }

  createProduct(product: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(`${this.API_URL}/products`, product);
  }

  updateProduct(id: string, product: UpdateProductDto): Observable<Product> {
    return this.http.put<Product>(`${this.API_URL}/products/${id}`, product);
  }

  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/products/${id}`);
  }

  // Order management
  getOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.API_URL}/orders`);
  }

  getUserOrders(userId: string): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.API_URL}/orders/user/${userId}`);
  }

  getOrder(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.API_URL}/orders/${id}`);
  }

  updateOrder(id: string, order: UpdateOrderDto): Observable<Order> {
    return this.http.put<Order>(`${this.API_URL}/orders/${id}`, order);
  }

  // Donation management
  getDonations(): Observable<Donation[]> {
    return this.http.get<Donation[]>(`${this.API_URL}/donations`);
  }

  // Subscription management
  getSubscriptions(): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(`${this.API_URL}/subscriptions`);
  }

  getUserSubscriptions(userId: string): Observable<Subscription[]> {
    return this.http.get<Subscription[]>(
      `${this.API_URL}/subscriptions/user/${userId}`
    );
  }

  cancelSubscription(id: string): Observable<Subscription> {
    return this.http.put<Subscription>(
      `${this.API_URL}/subscriptions/${id}/cancel`,
      {}
    );
  }

  // Appointment management
  getAppointments(): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.API_URL}/appointments`);
  }

  getUserAppointments(userId: string): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(
      `${this.API_URL}/appointments/user/${userId}`
    );
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.API_URL}/appointments/${id}`);
  }

  createAppointment(
    appointment: CreateAppointmentDto
  ): Observable<Appointment> {
    return this.http.post<Appointment>(
      `${this.API_URL}/appointments`,
      appointment
    );
  }

  updateAppointment(
    id: string,
    appointment: UpdateAppointmentDto
  ): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${this.API_URL}/appointments/${id}`,
      appointment
    );
  }

  approveAppointment(
    id: string,
    approveDto: ApproveAppointmentDto
  ): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${this.API_URL}/appointments/${id}/approve`,
      approveDto
    );
  }

  denyAppointment(
    id: string,
    denyDto: DenyAppointmentDto
  ): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${this.API_URL}/appointments/${id}/deny`,
      denyDto
    );
  }

  cancelAppointment(id: string): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${this.API_URL}/appointments/${id}/cancel`,
      {}
    );
  }

  completeAppointment(id: string): Observable<Appointment> {
    return this.http.put<Appointment>(
      `${this.API_URL}/appointments/${id}/complete`,
      {}
    );
  }

  generateInvoice(appointmentId: string): Observable<Invoice> {
    return this.http.post<Invoice>(
      `${this.API_URL}/appointments/${appointmentId}/invoice`,
      {}
    );
  }

  // Availability management
  getAvailabilities(): Observable<Availability[]> {
    return this.http.get<Availability[]>(`${this.API_URL}/availabilities`);
  }

  getOwnerAvailabilities(ownerId: string): Observable<Availability[]> {
    return this.http.get<Availability[]>(
      `${this.API_URL}/availabilities/owner/${ownerId}`
    );
  }

  getAvailability(id: string): Observable<Availability> {
    return this.http.get<Availability>(`${this.API_URL}/availabilities/${id}`);
  }

  createAvailability(
    availability: CreateAvailabilityDto
  ): Observable<Availability> {
    return this.http.post<Availability>(
      `${this.API_URL}/availabilities`,
      availability
    );
  }

  updateAvailability(
    id: string,
    availability: UpdateAvailabilityDto
  ): Observable<Availability> {
    return this.http.put<Availability>(
      `${this.API_URL}/availabilities/${id}`,
      availability
    );
  }

  deleteAvailability(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/availabilities/${id}`);
  }
}
