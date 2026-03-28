import { Injectable } from '@nestjs/common';
import {
  Chassis,
  ChassisType,
  ChassisUseCase,
} from '@optimistic-tanuki/models';
import { ComponentsService } from './components.service';

const CHASSIS_CATALOG: Chassis[] = [
  {
    id: 'xs-cloud',
    type: ChassisType.XS,
    useCase: ChassisUseCase.CLOUD,
    name: 'Cloud Node XS',
    description:
      'Compact Raspberry Pi 5 based cloud node for lightweight workloads',
    basePrice: 99.99,
    specifications: {
      formFactor: 'Raspberry Pi 5 Case',
      maxPower: '45W',
      noiseLevel: 'Silent (<20dB)',
      dimensions: '100x70x25mm',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'xs-nas',
    type: ChassisType.XS,
    useCase: ChassisUseCase.NAS,
    name: 'NAS Box XS',
    description: 'Small form factor NAS enclosure for home storage solutions',
    basePrice: 129.99,
    specifications: {
      formFactor: 'Mini NAS Case',
      maxPower: '60W',
      noiseLevel: 'Silent (<25dB)',
      dimensions: '130x100x50mm',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 's-cloud',
    type: ChassisType.S,
    useCase: ChassisUseCase.CLOUD,
    name: 'Cloud Node S',
    description: 'Mini PC form factor for moderate cloud workloads',
    basePrice: 249.99,
    specifications: {
      formFactor: 'Mini PC',
      maxPower: '120W',
      noiseLevel: 'Quiet (<30dB)',
      dimensions: '150x150x50mm',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 's-dev',
    type: ChassisType.S,
    useCase: ChassisUseCase.DEV,
    name: 'Dev Box S',
    description: 'Development workstation in a compact form factor',
    basePrice: 299.99,
    specifications: {
      formFactor: 'Mini Tower',
      maxPower: '150W',
      noiseLevel: 'Moderate (<35dB)',
      dimensions: '200x180x80mm',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'm-hybrid',
    type: ChassisType.M,
    useCase: ChassisUseCase.HYBRID,
    name: 'Hybrid Server M',
    description: 'Console-size server for hybrid cloud/NAS workloads',
    basePrice: 499.99,
    specifications: {
      formFactor: 'Console Size',
      maxPower: '250W',
      noiseLevel: 'Moderate (<40dB)',
      dimensions: '300x250x80mm',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'm-enterprise',
    type: ChassisType.M,
    useCase: ChassisUseCase.ENTERPRISE,
    name: 'Enterprise Edge M',
    description: 'Edge computing solution for enterprise deployments',
    basePrice: 699.99,
    specifications: {
      formFactor: '1U Rackmount',
      maxPower: '300W',
      noiseLevel: 'Moderate (<45dB)',
      dimensions: '430x300x44mm',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'l-enterprise',
    type: ChassisType.L,
    useCase: ChassisUseCase.ENTERPRISE,
    name: 'Enterprise Tower L',
    description: 'Full tower server for demanding enterprise workloads',
    basePrice: 999.99,
    specifications: {
      formFactor: 'Full Tower',
      maxPower: '500W',
      noiseLevel: 'Audible (<55dB)',
      dimensions: '500x400x200mm',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'l-cloud',
    type: ChassisType.L,
    useCase: ChassisUseCase.CLOUD,
    name: 'Cloud Cluster L',
    description: 'High-performance cloud node for clustering',
    basePrice: 1299.99,
    specifications: {
      formFactor: '4U Rackmount',
      maxPower: '750W',
      noiseLevel: 'Audible (<60dB)',
      dimensions: '600x430x177mm',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

@Injectable()
export class ChassisService {
  constructor(private readonly componentsService: ComponentsService) {}

  async findAll(filters?: {
    type?: ChassisType;
    useCase?: ChassisUseCase;
  }): Promise<Chassis[]> {
    let chassis = CHASSIS_CATALOG.filter((c) => c.isActive);
    if (filters?.type) {
      chassis = chassis.filter((c) => c.type === filters.type);
    }
    if (filters?.useCase) {
      chassis = chassis.filter((c) => c.useCase === filters.useCase);
    }
    return chassis;
  }

  async findById(id: string): Promise<Chassis | undefined> {
    return CHASSIS_CATALOG.find((c) => c.id === id && c.isActive);
  }

  async getCompatibleComponents(chassisId: string) {
    const chassis = await this.findById(chassisId);
    if (!chassis) {
      return { cpu: [], ram: [], storage: [], gpu: [] };
    }

    return {
      cpu: await this.componentsService.findAll('cpu', chassisId),
      ram: await this.componentsService.findAll('ram', chassisId),
      storage: await this.componentsService.findAll('storage', chassisId),
      gpu: await this.componentsService.findAll('gpu', chassisId),
    };
  }
}
