import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  type: string;
  imageUrl?: string;
  stock: number;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Order {
  id?: string;
  userId: string;
  items: OrderItem[];
  total: number;
  currency: string;
  status?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export interface DonationRequest {
  amount: number;
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
  private readonly API_URL = '/api/store';

  constructor(private http: HttpClient) {}

  // Product operations
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API_URL}/products`);
  }

  getProduct(id: string): Observable<Product> {
    return this.http.get<Product>(`${this.API_URL}/products/${id}`);
  }

  // Order operations
  createOrder(order: Order): Observable<Order> {
    return this.http.post<Order>(`${this.API_URL}/orders`, order);
  }

  getUserOrders(userId: string): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.API_URL}/orders/user/${userId}`);
  }

  // Donation operations
  createDonation(donation: DonationRequest): Observable<any> {
    return this.http.post(`${this.API_URL}/donations`, {
      ...donation,
      currency: donation.currency || 'USD',
    });
  }

  // Resource operations
  getResources(): Observable<Resource[]> {
    return this.http.get<Resource[]>(`${this.API_URL}/resources`);
  }

  getResource(id: string): Observable<Resource> {
    return this.http.get<Resource>(`${this.API_URL}/resources/${id}`);
  }

  getResourcesByType(type: string): Observable<Resource[]> {
    return this.http.get<Resource[]>(`${this.API_URL}/resources/type/${type}`);
  }

  checkResourceAvailability(
    resourceId: string,
    startTime: Date,
    endTime: Date
  ): Observable<boolean> {
    return this.http.post<boolean>(
      `${this.API_URL}/resources/${resourceId}/check-availability`,
      { startTime, endTime }
    );
  }

  // Appointment operations
  createAppointment(appointment: CreateAppointmentRequest): Observable<Appointment> {
    return this.http.post<Appointment>(`${this.API_URL}/appointments`, appointment);
  }

  getUserAppointments(userId: string): Observable<Appointment[]> {
    return this.http.get<Appointment[]>(`${this.API_URL}/appointments/user/${userId}`);
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.http.get<Appointment>(`${this.API_URL}/appointments/${id}`);
  }

  cancelAppointment(id: string): Observable<Appointment> {
    return this.http.put<Appointment>(`${this.API_URL}/appointments/${id}/cancel`, {});
  }
}
