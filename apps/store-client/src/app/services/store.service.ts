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
}
