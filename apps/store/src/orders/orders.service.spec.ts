import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { ProductEntity } from '../products/entities/product.entity';
import { CreateOrderDto } from '@optimistic-tanuki/models';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: Repository<OrderEntity>;
  let orderItemRepository: Repository<OrderItemEntity>;
  let productRepository: Repository<ProductEntity>;

  const productsById: Record<string, Partial<ProductEntity>> = {};

  beforeEach(async () => {
    for (const key of Object.keys(productsById)) {
      delete productsById[key];
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(OrderEntity),
          useValue: {
            create: jest.fn((data) => data),
            save: jest.fn((data) =>
              Promise.resolve({ id: 'order-1', ...data })
            ),
            find: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItemEntity),
          useValue: {
            create: jest.fn((data) => data),
          },
        },
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: {
            findOne: jest.fn(({ where: { id } }) =>
              Promise.resolve(productsById[id] ?? null)
            ),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get<Repository<OrderEntity>>(
      getRepositoryToken(OrderEntity)
    );
    orderItemRepository = module.get<Repository<OrderItemEntity>>(
      getRepositoryToken(OrderItemEntity)
    );
    productRepository = module.get<Repository<ProductEntity>>(
      getRepositoryToken(ProductEntity)
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('computes the total in cents for a single item', async () => {
      productsById['prod-1'] = { id: 'prod-1', priceCents: 500 };

      const dto: CreateOrderDto = {
        userId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 3 }],
      };

      const result = await service.create(dto);

      expect(result.totalCents).toBe(1500);
      expect(orderItemRepository.create).toHaveBeenCalledWith({
        productId: 'prod-1',
        quantity: 3,
        unitPriceCents: 500,
      });
    });

    it('sums a multi-item order in exact integer cents, proving no float drift', async () => {
      // Priced in dollars this would be 10.10 * 3 + 20.20 * 1 = 50.50, but
      // 10.10 * 3 in IEEE-754 double math yields 30.299999999999997, which
      // would corrupt the total under the old `Number(price) * qty` approach.
      productsById['prod-a'] = { id: 'prod-a', priceCents: 1010 };
      productsById['prod-b'] = { id: 'prod-b', priceCents: 2020 };

      const dto: CreateOrderDto = {
        userId: 'user-1',
        items: [
          { productId: 'prod-a', quantity: 3 },
          { productId: 'prod-b', quantity: 1 },
        ],
      };

      const result = await service.create(dto);

      expect(result.totalCents).toBe(5050);
      expect(Number.isInteger(result.totalCents)).toBe(true);
    });

    it('demonstrates why dollar-float accumulation is unsafe for money, even when a given case rounds out', () => {
      // IEEE-754 doubles cannot represent most decimal fractions exactly:
      // 10.10 * 3 alone already drifts off the exact cent value.
      expect(10.1 * 3).not.toBe(30.3);
      expect(10.1 * 3).toBeCloseTo(30.3, 10);
      // Whether a *particular* multi-item sum happens to round back to the
      // right answer is luck, not a guarantee — integer cent math has no
      // such luck-dependence, which is why totalCents must be computed as
      // pure integer arithmetic (as asserted above) rather than
      // `Number(price) * quantity` accumulation in dollars.
    });

    it('handles a zero-price item without affecting the total', async () => {
      productsById['prod-free'] = { id: 'prod-free', priceCents: 0 };
      productsById['prod-paid'] = { id: 'prod-paid', priceCents: 1500 };

      const dto: CreateOrderDto = {
        userId: 'user-1',
        items: [
          { productId: 'prod-free', quantity: 2 },
          { productId: 'prod-paid', quantity: 1 },
        ],
      };

      const result = await service.create(dto);

      expect(result.totalCents).toBe(1500);
    });

    it('carries product priceCents and requested quantity onto each order item', async () => {
      productsById['prod-1'] = { id: 'prod-1', priceCents: 799 };

      const dto: CreateOrderDto = {
        userId: 'user-1',
        items: [{ productId: 'prod-1', quantity: 5 }],
      };

      await service.create(dto);

      expect(orderItemRepository.create).toHaveBeenCalledWith({
        productId: 'prod-1',
        quantity: 5,
        unitPriceCents: 799,
      });
    });

    it('throws when a referenced product does not exist', async () => {
      const dto: CreateOrderDto = {
        userId: 'user-1',
        items: [{ productId: 'missing-product', quantity: 1 }],
      };

      await expect(service.create(dto)).rejects.toThrow(
        'Product missing-product not found'
      );
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('rejects an order whose computed total is negative', async () => {
      // Defends against corrupted/negative priceCents reaching the total,
      // even though upstream DTO validation should already block this.
      productsById['prod-bad'] = { id: 'prod-bad', priceCents: -500 };

      const dto: CreateOrderDto = {
        userId: 'user-1',
        items: [{ productId: 'prod-bad', quantity: 1 }],
      };

      await expect(service.create(dto)).rejects.toThrow(
        'Order total cannot be negative'
      );
      expect(orderRepository.save).not.toHaveBeenCalled();
    });
  });
});
