import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto, UpdateOrderDto } from '@optimistic-tanuki/models';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { ProductEntity } from '../products/entities/product.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<OrderEntity> {
    let totalCents = 0;

    // Calculate total and create order items using integer cent arithmetic
    // to avoid floating-point accumulation error across multiple line items.
    const orderItems: OrderItemEntity[] = [];
    for (const item of createOrderDto.items) {
      const product = await this.productRepository.findOne({
        where: { id: item.productId },
      });
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const orderItem = this.orderItemRepository.create({
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: product.priceCents,
      });
      orderItems.push(orderItem);
      totalCents += product.priceCents * item.quantity;
    }

    if (totalCents < 0) {
      throw new Error('Order total cannot be negative');
    }

    // Create order
    const order = this.orderRepository.create({
      userId: createOrderDto.userId,
      status: 'pending',
      totalCents,
      currency: 'USD',
      items: orderItems,
    });

    return this.orderRepository.save(order);
  }

  async findAll(): Promise<OrderEntity[]> {
    return this.orderRepository.find({
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<OrderEntity[]> {
    return this.orderRepository.find({
      where: { userId },
      relations: ['items', 'items.product'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<OrderEntity> {
    return this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'items.product'],
    });
  }

  async update(
    id: string,
    updateOrderDto: UpdateOrderDto
  ): Promise<OrderEntity> {
    await this.orderRepository.update(id, updateOrderDto);
    return this.findOne(id);
  }
}
