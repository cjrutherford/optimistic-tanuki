import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';
import { ChassisService } from './chassis.service';
import { ComponentsService } from './components.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let pricingService: PricingService;
  let chassisService: jest.Mocked<ChassisService>;
  let componentsService: jest.Mocked<ComponentsService>;

  beforeEach(() => {
    chassisService = {
      findById: jest.fn().mockResolvedValue({
        id: 's-cloud',
        type: 'S',
        basePrice: 299,
      }),
      findAll: jest.fn(),
      getCompatibleComponents: jest.fn(),
    } as any;

    componentsService = {
      findById: jest.fn().mockResolvedValue({
        id: 'cpu-n100',
        sellingPrice: 150,
      }),
      findAll: jest.fn(),
    } as any;

    pricingService = new PricingService(chassisService, componentsService);
    service = new OrdersService(pricingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an order', async () => {
      const config = {
        chassisId: 's-cloud',
        chassisType: 'S',
        useCase: 'cloud',
        cpuId: 'cpu-n100',
        ramId: 'ram-8gb',
        storageIds: ['storage-512gb-nvme'],
      };

      const shippingAddress = {
        name: 'Test User',
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        country: 'USA',
      };

      const result = await service.create(
        config as any,
        shippingAddress as any,
        'test@example.com'
      );

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.id).toContain('HW-');
      expect(result.status).toBe('pending');
      expect(result.customerEmail).toBe('test@example.com');
      expect(result.priceBreakdown).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      const result = await service.findAll();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return an order by id', async () => {
      const config = {
        chassisId: 's-cloud',
        chassisType: 'S',
        useCase: 'cloud',
        cpuId: 'cpu-n100',
        ramId: 'ram-8gb',
        storageIds: ['storage-512gb-nvme'],
      };

      const shippingAddress = {
        name: 'Test User',
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        country: 'USA',
      };

      const created = await service.create(
        config as any,
        shippingAddress as any,
        'test@example.com'
      );

      const result = await service.findById(created.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(created.id);
    });

    it('should return undefined for non-existent order', async () => {
      const result = await service.findById('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const config = {
        chassisId: 's-cloud',
        chassisType: 'S',
        useCase: 'cloud',
        cpuId: 'cpu-n100',
        ramId: 'ram-8gb',
        storageIds: ['storage-512gb-nvme'],
      };

      const shippingAddress = {
        name: 'Test User',
        street: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zip: '12345',
        country: 'USA',
      };

      const created = await service.create(
        config as any,
        shippingAddress as any,
        'test@example.com'
      );

      const updated = await service.updateStatus(created.id, 'confirmed');
      expect(updated?.status).toBe('confirmed');
    });
  });
});
