import { Injectable } from '@nestjs/common';
import {
  Order,
  ConfigurationDto,
  PriceBreakdown,
  ShippingAddress,
  OrderStatus,
} from '@optimistic-tanuki/models';
import { PricingService } from './pricing.service';

const orders: Map<string, Order> = new Map();

@Injectable()
export class OrdersService {
  constructor(private readonly pricingService: PricingService) {}

  async create(
    configuration: ConfigurationDto,
    shippingAddress: ShippingAddress,
    customerEmail: string,
    ownerId?: string
  ): Promise<Order> {
    const priceBreakdown = await this.pricingService.calculatePrice(
      configuration
    );

    const order: Order = {
      id: this.generateId(),
      configuration,
      priceBreakdown,
      shippingAddress,
      customerEmail,
      status: OrderStatus.PENDING,
      estimatedDelivery: this.calculateDeliveryDate(),
      ownerId: ownerId || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    orders.set(order.id, order);
    return order;
  }

  async findAll(): Promise<Order[]> {
    return Array.from(orders.values());
  }

  async findById(id: string): Promise<Order | undefined> {
    return orders.get(id);
  }

  async updateStatus(id: string, status: string): Promise<Order | undefined> {
    const order = orders.get(id);
    if (!order) return undefined;

    order.status = status as OrderStatus;
    order.updatedAt = new Date();
    orders.set(id, order);
    return order;
  }

  private generateId(): string {
    return `HW-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
  }

  private calculateDeliveryDate(): Date {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 14);
    return deliveryDate;
  }
}
