import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HardwareCatalogService } from './hardware.service';
import { ChassisEntity } from '../hardware/entities/chassis.entity';
import { HardwarePartEntity } from '../hardware/entities/hardware-part.entity';
import { HardwareOrderEntity } from '../hardware/entities/hardware-order.entity';
import { SavedConfigurationEntity } from '../hardware/entities/saved-configuration.entity';
import { ConfigurationDto } from '@optimistic-tanuki/models';

type MockRepository<T extends { id?: string }> = {
  find: jest.Mock<Promise<T[]>, [unknown?]>;
  findOne: jest.Mock<Promise<T | null>, [unknown?]>;
  create: jest.Mock<T, [Partial<T>]>;
  save: jest.Mock<Promise<T>, [T]>;
};

const createRepository = <T extends { id?: string }>(
  initialRows: T[] = []
): MockRepository<T> => {
  const rows = [...initialRows];

  return {
    find: jest.fn(async (options?: unknown) => {
      if (!options || typeof options !== 'object') {
        return [...rows];
      }

      const where = (options as { where?: Record<string, unknown> }).where;
      if (!where || Array.isArray(where)) {
        return [...rows];
      }

      return rows.filter((row) =>
        Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value)
      );
    }),
    findOne: jest.fn(async (options?: unknown) => {
      if (!options || typeof options !== 'object') {
        return null;
      }

      const where = (options as { where?: Record<string, unknown> | Array<Record<string, unknown>> }).where;
      if (!where) {
        return null;
      }

      const predicates = Array.isArray(where) ? where : [where];
      return (
        rows.find((row) =>
          predicates.some((predicate) =>
            Object.entries(predicate).every(
              ([key, value]) => (row as Record<string, unknown>)[key] === value
            )
          )
        ) ?? null
      );
    }),
    create: jest.fn((payload: Partial<T>) => payload as T),
    save: jest.fn(async (entity: T) => {
      const id = entity.id || `generated-${rows.length + 1}`;
      const persisted = { ...entity, id } as T;
      rows.push(persisted);
      return persisted;
    }),
  };
};

describe('HardwareCatalogService', () => {
  let service: HardwareCatalogService;
  let chassisRepository: MockRepository<ChassisEntity>;
  let partRepository: MockRepository<HardwarePartEntity>;
  let orderRepository: MockRepository<HardwareOrderEntity>;
  let savedConfigurationRepository: MockRepository<SavedConfigurationEntity>;
  let baseConfiguration: ConfigurationDto;

  beforeEach(() => {
    chassisRepository = createRepository<ChassisEntity>([
      {
        id: 'db-xs-cloud',
        slug: 'xs-cloud',
        type: 'XS',
        useCase: 'cloud',
        name: 'HAI XS Cloud Node',
        description: 'Compact Raspberry Pi cloud node.',
        basePrice: 16,
        specifications: {
          formFactor: 'Pi 5 enclosure',
          maxPower: '27W',
          noiseLevel: 'Passive',
          dimensions: 'Compact',
        },
        isActive: true,
        sourceType: 'research',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    partRepository = createRepository<HardwarePartEntity>([
      {
        id: 'db-cpu-1',
        slug: 'xs-pi5-8gb',
        category: 'cpu',
        vendor: 'Raspberry Pi',
        name: 'Raspberry Pi 5 8GB',
        description: 'Pi CPU board',
        basePrice: 80,
        sellingPrice: 80,
        specs: { cores: 4 },
        compatibleChassisSlugs: ['xs-cloud'],
        inStock: true,
        isActive: true,
        sourceType: 'curated',
        externalSource: null,
        externalId: null,
        sourceUrl: null,
        lastSyncedAt: null,
        syncStatus: 'seeded',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'db-ram-1',
        slug: 'xs-ram-8gb-onboard',
        category: 'ram',
        vendor: 'Raspberry Pi',
        name: '8GB LPDDR4X Onboard',
        description: 'Integrated memory',
        basePrice: 0,
        sellingPrice: 0,
        specs: { capacity: '8GB' },
        compatibleChassisSlugs: ['xs-cloud'],
        inStock: true,
        isActive: true,
        sourceType: 'curated',
        externalSource: null,
        externalId: null,
        sourceUrl: null,
        lastSyncedAt: null,
        syncStatus: 'seeded',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'db-storage-1',
        slug: 'xs-storage-256-nvme',
        category: 'storage',
        vendor: 'Generic',
        name: '256GB NVMe for Pi HAT+',
        description: 'Compact storage',
        basePrice: 35,
        sellingPrice: 35,
        specs: { capacity: '256GB' },
        compatibleChassisSlugs: ['xs-cloud'],
        inStock: true,
        isActive: true,
        sourceType: 'curated',
        externalSource: null,
        externalId: null,
        sourceUrl: null,
        lastSyncedAt: null,
        syncStatus: 'seeded',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'db-gpu-1',
        slug: 'xs-gpu-none',
        category: 'gpu',
        vendor: 'Raspberry Pi',
        name: 'Integrated VideoCore',
        description: 'No discrete GPU',
        basePrice: 0,
        sellingPrice: 0,
        specs: { vram: 'Shared' },
        compatibleChassisSlugs: ['xs-cloud'],
        inStock: true,
        isActive: true,
        sourceType: 'curated',
        externalSource: null,
        externalId: null,
        sourceUrl: null,
        lastSyncedAt: null,
        syncStatus: 'seeded',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    orderRepository = createRepository<HardwareOrderEntity>();
    savedConfigurationRepository = createRepository<SavedConfigurationEntity>();

    service = new HardwareCatalogService(
      chassisRepository as never,
      partRepository as never,
      orderRepository as never,
      savedConfigurationRepository as never
    );

    baseConfiguration = {
      chassisId: 'xs-cloud',
      chassisType: 'XS',
      useCase: 'cloud',
      cpuId: 'xs-pi5-8gb',
      ramId: 'xs-ram-8gb-onboard',
      storageIds: ['xs-storage-256-nvme'],
      gpuId: 'xs-gpu-none',
    };
  });

  it('returns active chassis families', async () => {
    const chassis = await service.getChassis();

    expect(chassis).toHaveLength(1);
    expect(chassis[0].id).toBe('xs-cloud');
    expect(chassis.every((entry) => entry.isActive)).toBe(true);
  });

  it('returns compatible components for a chassis', async () => {
    const compatible = await service.getCompatibleComponents('xs-cloud');

    expect(compatible.cpu).toHaveLength(1);
    expect(compatible.ram).toHaveLength(1);
    expect(compatible.storage).toHaveLength(1);
    expect(compatible.gpu).toHaveLength(1);
    expect(compatible.cpu[0].compatibleWith).toContain('xs-cloud');
  });

  it('returns a chassis by slug without attempting uuid lookup semantics', async () => {
    const chassis = await service.getChassisById('xs-cloud');

    expect(chassis.id).toBe('xs-cloud');
    expect(chassis.name).toBe('HAI XS Cloud Node');
  });

  it('calculates price for a valid configuration', async () => {
    const price = await service.calculatePrice(baseConfiguration);

    expect(price.chassisPrice).toBe(16);
    expect(price.cpuPrice).toBe(80);
    expect(price.storagePrice).toBe(35);
    expect(price.totalPrice).toBeGreaterThan(price.chassisPrice);
  });

  it('creates and retrieves persisted hardware orders', async () => {
    const order = await service.createOrder({
      configuration: baseConfiguration,
      shippingAddress: {
        name: 'Alex Integrator',
        street: '204 Deployment Lane',
        city: 'Savannah',
        state: 'Georgia',
        zip: '31401',
        country: 'USA',
      },
      customerEmail: 'alex@hai.example',
      paymentMethod: 'card',
    });

    const loaded = await service.getOrder(order.id);

    expect(loaded.id).toBe(order.id);
    expect(loaded.paymentMethod).toBe('card');
    expect(loaded.status).toBe('payment_pending');
  });

  it('saves and retrieves tracked system configurations', async () => {
    const configuration = await service.saveConfiguration({
      configuration: baseConfiguration,
      label: 'Build bench alpha',
      customerEmail: 'alex@hai.example',
    });

    const loaded = await service.getConfiguration(configuration.id);

    expect(loaded.id).toBe(configuration.id);
    expect(loaded.label).toBe('Build bench alpha');
  });

  it('rejects invalid pricing requests', async () => {
    await expect(
      service.calculatePrice({
        ...baseConfiguration,
        cpuId: 'missing',
        storageIds: [],
      })
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when unknown configurations are requested', async () => {
    await expect(service.getConfiguration('missing-config')).rejects.toThrow(
      NotFoundException
    );
  });
});
