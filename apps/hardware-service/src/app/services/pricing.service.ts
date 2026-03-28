import { Injectable } from '@nestjs/common';
import {
  ConfigurationDto,
  PriceBreakdown,
  Chassis,
  Component,
} from '@optimistic-tanuki/models';
import { ChassisService } from './chassis.service';
import { ComponentsService } from './components.service';

const MARKUPS = {
  chassis: 0.25,
  cpu: 0.15,
  ram: 0.2,
  storage: 0.25,
  gpu: 0.1,
  accessories: 0.3,
};

const ASSEMBLY_FEES: Record<string, number> = {
  xs: 25,
  s: 50,
  m: 50,
  l: 100,
};

@Injectable()
export class PricingService {
  constructor(
    private readonly chassisService: ChassisService,
    private readonly componentsService: ComponentsService
  ) {}

  async calculatePrice(config: ConfigurationDto): Promise<PriceBreakdown> {
    const chassis = await this.chassisService.findById(config.chassisId);
    const cpu = await this.componentsService.findById(config.cpuId);
    const ram = await this.componentsService.findById(config.ramId);

    let storagePrice = 0;
    for (const id of config.storageIds || []) {
      const s = await this.componentsService.findById(id);
      if (s) {
        storagePrice += Number(s.sellingPrice);
      }
    }

    const gpu = config.gpuId
      ? await this.componentsService.findById(config.gpuId)
      : null;

    const chassisType = config.chassisType?.toLowerCase() || 'm';
    const assemblyFee = ASSEMBLY_FEES[chassisType] || 50;

    const chassisPrice = chassis
      ? Number(chassis.basePrice) * (1 + MARKUPS.chassis)
      : 0;
    const cpuPrice = cpu ? Number(cpu.sellingPrice) : 0;
    const ramPrice = ram ? Number(ram.sellingPrice) : 0;
    const gpuPrice = gpu ? Number(gpu.sellingPrice) : 0;

    const totalPrice =
      chassisPrice +
      cpuPrice +
      ramPrice +
      storagePrice +
      gpuPrice +
      assemblyFee;

    return {
      chassisPrice: Math.round(chassisPrice * 100) / 100,
      cpuPrice: Math.round(cpuPrice * 100) / 100,
      ramPrice: Math.round(ramPrice * 100) / 100,
      storagePrice: Math.round(storagePrice * 100) / 100,
      gpuPrice: Math.round(gpuPrice * 100) / 100,
      casePrice: 0,
      accessoriesPrice: 0,
      assemblyFee,
      totalPrice: Math.round(totalPrice * 100) / 100,
    };
  }
}
