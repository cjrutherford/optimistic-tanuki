import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { HardwareCommands } from '@optimistic-tanuki/constants';
import {
  ConfigurationDto,
  CreateHardwareOrderDto,
  SaveHardwareConfigurationDto,
} from '@optimistic-tanuki/models';
import { HardwareCatalogService } from './hardware.service';

@Controller()
export class HardwareController {
  constructor(private readonly hardwareService: HardwareCatalogService) {}

  @MessagePattern({ cmd: HardwareCommands.GET_CHASSIS })
  getChassis() {
    return this.hardwareService.getChassis();
  }

  @MessagePattern({ cmd: HardwareCommands.GET_CHASSIS_BY_ID })
  getChassisById(@Payload() payload: { id: string }) {
    return this.hardwareService.getChassisById(payload.id);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_COMPATIBLE_COMPONENTS })
  getCompatibleComponents(@Payload() payload: { chassisId: string }) {
    return this.hardwareService.getCompatibleComponents(payload.chassisId);
  }

  @MessagePattern({ cmd: HardwareCommands.CALCULATE_PRICE })
  calculatePrice(@Payload() configuration: ConfigurationDto) {
    return this.hardwareService.calculatePrice(configuration);
  }

  @MessagePattern({ cmd: HardwareCommands.CREATE_ORDER })
  createOrder(@Payload() payload: CreateHardwareOrderDto) {
    return this.hardwareService.createOrder(payload);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_ORDER })
  getOrder(@Payload() payload: { orderId: string }) {
    return this.hardwareService.getOrder(payload.orderId);
  }

  @MessagePattern({ cmd: HardwareCommands.SAVE_CONFIGURATION })
  saveConfiguration(@Payload() payload: SaveHardwareConfigurationDto) {
    return this.hardwareService.saveConfiguration(payload);
  }

  @MessagePattern({ cmd: HardwareCommands.GET_CONFIGURATION })
  getConfiguration(@Payload() payload: { configurationId: string }) {
    return this.hardwareService.getConfiguration(payload.configurationId);
  }
}
