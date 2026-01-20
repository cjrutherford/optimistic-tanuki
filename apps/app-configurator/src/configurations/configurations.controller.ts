import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ConfigurationsService } from '../app/configurations.service';
import {
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { AppConfigurationEntity } from './entities/app-configuration.entity';

export const AppConfigCommands = {
  Create: 'app-config.create',
  Get: 'app-config.get',
  GetByDomain: 'app-config.getByDomain',
  GetByName: 'app-config.getByName',
  GetAll: 'app-config.getAll',
  Update: 'app-config.update',
  Delete: 'app-config.delete',
};

@Controller('configurations')
export class ConfigurationsController {
  constructor(
    private readonly configurationsService: ConfigurationsService,
    private readonly logger: Logger
  ) {}

  @MessagePattern({ cmd: AppConfigCommands.Create })
  async createConfiguration(
    @Payload() createDto: CreateAppConfigDto
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Creating app configuration: ${createDto.name}`);
    return await this.configurationsService.createConfiguration(createDto);
  }

  @MessagePattern({ cmd: AppConfigCommands.Get })
  async getConfiguration(@Payload() id: string): Promise<AppConfigurationEntity> {
    this.logger.log(`Getting app configuration: ${id}`);
    return await this.configurationsService.getConfiguration(id);
  }

  @MessagePattern({ cmd: AppConfigCommands.GetByDomain })
  async getConfigurationByDomain(
    @Payload() data: { domain: string }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Getting app configuration by domain: ${data.domain}`);
    return await this.configurationsService.getConfigurationByDomain(data.domain);
  }

  @MessagePattern({ cmd: AppConfigCommands.GetByName })
  async getConfigurationByName(
    @Payload() data: { name: string }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Getting app configuration by name: ${data.name}`);
    return await this.configurationsService.getConfigurationByName(data.name);
  }

  @MessagePattern({ cmd: AppConfigCommands.GetAll })
  async getAllConfigurations(@Payload() query?: any): Promise<AppConfigurationEntity[]> {
    this.logger.log('Getting all app configurations');
    return await this.configurationsService.getAllConfigurations(query || {});
  }

  @MessagePattern({ cmd: AppConfigCommands.Update })
  async updateConfiguration(
    @Payload() data: UpdateAppConfigDto & { id: string }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Updating app configuration: ${data.id}`);
    return await this.configurationsService.updateConfiguration(data.id, data);
  }

  @MessagePattern({ cmd: AppConfigCommands.Delete })
  async deleteConfiguration(@Payload() id: string): Promise<void> {
    this.logger.log(`Deleting app configuration: ${id}`);
    return await this.configurationsService.deleteConfiguration(id);
  }
}
