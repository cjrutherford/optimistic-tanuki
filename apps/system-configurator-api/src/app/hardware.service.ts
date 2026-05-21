import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Chassis,
  ChassisSpecifications,
  CompatibleComponents,
  ConfigurationDto,
  CreateHardwareOrderDto,
  HardwareComponent,
  HardwareOrder,
  PriceBreakdown,
  SavedHardwareConfiguration,
  SaveHardwareConfigurationDto,
} from '@optimistic-tanuki/models';
import { ChassisEntity } from '../hardware/entities/chassis.entity';
import { HardwarePartEntity } from '../hardware/entities/hardware-part.entity';
import { HardwareOrderEntity } from '../hardware/entities/hardware-order.entity';
import { SavedConfigurationEntity } from '../hardware/entities/saved-configuration.entity';

@Injectable()
export class HardwareCatalogService {
  constructor(
    @InjectRepository(ChassisEntity)
    private readonly chassisRepository: Repository<ChassisEntity>,
    @InjectRepository(HardwarePartEntity)
    private readonly partRepository: Repository<HardwarePartEntity>,
    @InjectRepository(HardwareOrderEntity)
    private readonly orderRepository: Repository<HardwareOrderEntity>,
    @InjectRepository(SavedConfigurationEntity)
    private readonly savedConfigurationRepository: Repository<SavedConfigurationEntity>
  ) {}

  async getChassis(): Promise<Chassis[]> {
    const chassis = await this.chassisRepository.find({
      where: { isActive: true },
      order: { type: 'ASC', useCase: 'ASC', createdAt: 'ASC' },
    });
    return chassis.map((entry) => this.toChassisDto(entry));
  }

  async getChassisById(id: string): Promise<Chassis> {
    const chassis = await this.chassisRepository.findOne({
      where: { slug: id, isActive: true },
    });
    if (!chassis) {
      throw new NotFoundException(`Chassis ${id} was not found.`);
    }
    return this.toChassisDto(chassis);
  }

  async getCompatibleComponents(chassisId: string): Promise<CompatibleComponents> {
    const chassis = await this.getChassisById(chassisId);
    const parts = await this.partRepository.find({
      where: {
        isActive: true,
        inStock: true,
      },
      order: { sellingPrice: 'ASC', name: 'ASC' },
    });

    const compatible = parts.filter((part) =>
      part.compatibleChassisSlugs.includes(chassis.id)
    );

    return {
      cpu: compatible.filter((part) => part.category === 'cpu').map((part) => this.toPartDto(part)),
      ram: compatible.filter((part) => part.category === 'ram').map((part) => this.toPartDto(part)),
      storage: compatible.filter((part) => part.category === 'storage').map((part) => this.toPartDto(part)),
      gpu: compatible.filter((part) => part.category === 'gpu').map((part) => this.toPartDto(part)),
    };
  }

  async calculatePrice(configuration: ConfigurationDto): Promise<PriceBreakdown> {
    const chassis = await this.getChassisById(configuration.chassisId);
    const compatible = await this.getCompatibleComponents(chassis.id);
    const cpu = this.requireSingleSelection(compatible.cpu, configuration.cpuId, 'cpu');
    const ram = this.requireSingleSelection(compatible.ram, configuration.ramId, 'ram');
    const storage = this.requireStorageSelections(
      compatible.storage,
      configuration.storageIds
    );
    const gpu = configuration.gpuId
      ? this.requireSingleSelection(compatible.gpu, configuration.gpuId, 'gpu')
      : null;

    const storagePrice = storage.reduce(
      (total, item) => total + item.sellingPrice,
      0
    );
    const assemblyFee =
      chassis.type === 'L' ? 299 : chassis.type === 'M' ? 249 : chassis.type === 'S' ? 199 : 79;
    const accessoriesPrice = storage.length > 1 ? 39 : 0;

    return {
      chassisPrice: chassis.basePrice,
      cpuPrice: cpu.sellingPrice,
      ramPrice: ram.sellingPrice,
      storagePrice,
      gpuPrice: gpu?.sellingPrice ?? 0,
      casePrice: 0,
      accessoriesPrice,
      assemblyFee,
      totalPrice:
        Number(chassis.basePrice) +
        Number(cpu.sellingPrice) +
        Number(ram.sellingPrice) +
        storagePrice +
        Number(gpu?.sellingPrice ?? 0) +
        accessoriesPrice +
        assemblyFee,
    };
  }

  async createOrder(payload: CreateHardwareOrderDto): Promise<HardwareOrder> {
    this.validateCustomerInput(payload.customerEmail, payload.shippingAddress);
    const priceBreakdown = await this.calculatePrice(payload.configuration);
    const orderEntity = this.orderRepository.create({
      configuration: payload.configuration,
      priceBreakdown,
      shippingAddress: payload.shippingAddress,
      customerEmail: payload.customerEmail,
      paymentMethod: payload.paymentMethod,
      status:
        payload.paymentMethod === 'card'
          ? 'payment_pending'
          : 'awaiting_follow_up',
      estimatedDelivery: this.buildEstimatedDelivery(),
    } as unknown as Partial<HardwareOrderEntity>);
    const order = await this.orderRepository.save(orderEntity);

    return this.toOrderDto(order);
  }

  async getOrder(orderId: string): Promise<HardwareOrder> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} was not found.`);
    }
    return this.toOrderDto(order);
  }

  async saveConfiguration(
    payload: SaveHardwareConfigurationDto
  ): Promise<SavedHardwareConfiguration> {
    if (!payload.label.trim()) {
      throw new BadRequestException('Configuration label is required.');
    }
    this.validateCustomerInput(payload.customerEmail);

    const savedEntity = this.savedConfigurationRepository.create({
      label: payload.label,
      customerEmail: payload.customerEmail,
      configuration: payload.configuration,
      priceBreakdown: await this.calculatePrice(payload.configuration),
    } as unknown as Partial<SavedConfigurationEntity>);
    const saved = await this.savedConfigurationRepository.save(savedEntity);

    return this.toSavedConfigurationDto(saved);
  }

  async getConfiguration(
    configurationId: string
  ): Promise<SavedHardwareConfiguration> {
    const configuration = await this.savedConfigurationRepository.findOne({
      where: { id: configurationId },
    });
    if (!configuration) {
      throw new NotFoundException(
        `Configuration ${configurationId} was not found.`
      );
    }
    return this.toSavedConfigurationDto(configuration);
  }

  private requireSingleSelection<T extends { id: string }>(
    candidates: T[],
    selectedId: string,
    label: string
  ): T {
    const item = candidates.find((entry) => entry.id === selectedId);
    if (!item) {
      throw new BadRequestException(`Invalid ${label} selection.`);
    }
    return item;
  }

  private requireStorageSelections<T extends { id: string; sellingPrice: number }>(
    candidates: T[],
    selectedIds: string[]
  ): T[] {
    if (!selectedIds.length) {
      throw new BadRequestException('At least one storage device is required.');
    }

    return selectedIds.map((storageId) => {
      const item = candidates.find((entry) => entry.id === storageId);
      if (!item) {
        throw new BadRequestException(
          `Invalid storage selection ${storageId}.`
        );
      }
      return item;
    });
  }

  private validateCustomerInput(
    customerEmail: string,
    shippingAddress?: CreateHardwareOrderDto['shippingAddress']
  ): void {
    if (!customerEmail.trim()) {
      throw new BadRequestException('Customer email is required.');
    }

    if (!shippingAddress) {
      return;
    }

    const requiredFields: Array<keyof typeof shippingAddress> = [
      'name',
      'street',
      'city',
      'state',
      'zip',
      'country',
    ];

    const missingField = requiredFields.find(
      (field) => !String(shippingAddress[field] || '').trim()
    );
    if (missingField) {
      throw new BadRequestException(`Shipping ${missingField} is required.`);
    }
  }

  private buildEstimatedDelivery(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 21);
    return date;
  }

  private toChassisDto(entity: ChassisEntity): Chassis {
    return {
      id: entity.slug,
      type: entity.type as Chassis['type'],
      useCase: entity.useCase as Chassis['useCase'],
      name: entity.name,
      description: entity.description,
      basePrice: Number(entity.basePrice),
      specifications:
        entity.specifications as unknown as ChassisSpecifications,
      isActive: entity.isActive,
    };
  }

  private toPartDto(entity: HardwarePartEntity): HardwareComponent {
    return {
      id: entity.slug,
      type: entity.category as 'cpu' | 'ram' | 'storage' | 'gpu',
      name: entity.name,
      description: entity.description || '',
      basePrice: Number(entity.basePrice),
      sellingPrice: Number(entity.sellingPrice),
      specs: entity.specs as unknown as Record<string, string | number>,
      compatibleWith: entity.compatibleChassisSlugs,
      inStock: entity.inStock,
      isActive: entity.isActive,
    };
  }

  private toOrderDto(entity: HardwareOrderEntity): HardwareOrder {
    return {
      id: entity.id,
      configuration: entity.configuration as unknown as ConfigurationDto,
      priceBreakdown: entity.priceBreakdown as unknown as PriceBreakdown,
      shippingAddress:
        entity.shippingAddress as unknown as CreateHardwareOrderDto['shippingAddress'],
      customerEmail: entity.customerEmail,
      paymentMethod: entity.paymentMethod as HardwareOrder['paymentMethod'],
      status: entity.status,
      estimatedDelivery: entity.estimatedDelivery,
      createdAt: entity.createdAt,
    };
  }

  private toSavedConfigurationDto(
    entity: SavedConfigurationEntity
  ): SavedHardwareConfiguration {
    return {
      id: entity.id,
      label: entity.label,
      customerEmail: entity.customerEmail,
      configuration: entity.configuration as unknown as ConfigurationDto,
      priceBreakdown: entity.priceBreakdown as unknown as PriceBreakdown,
      createdAt: entity.createdAt,
    };
  }
}
