import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ConfigurationsService } from '../app/configurations.service';
import {
  AppConfiguration,
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';

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
  ): Promise<AppConfiguration> {
    this.logger.log(`Creating app configuration: ${createDto.name}`);
    return await this.configurationsService.createConfiguration(createDto);
  }

  @MessagePattern({ cmd: AppConfigCommands.Get })
  async getConfiguration(@Payload() id: string): Promise<AppConfiguration> {
    this.logger.log(`Getting app configuration: ${id}`);
    return await this.configurationsService.getConfiguration(id);
  }

  @MessagePattern({ cmd: AppConfigCommands.GetByDomain })
  async getConfigurationByDomain(
    @Payload('domain') domain: string
  ): Promise<AppConfiguration> {
    this.logger.log(`Getting app configuration by domain: ${domain}`);
    return await this.configurationsService.getConfigurationByDomain(domain);
  }

  @MessagePattern({ cmd: AppConfigCommands.GetByName })
  async getConfigurationByName(
    @Payload('name') name: string
  ): Promise<AppConfiguration> {
    this.logger.log(`Getting app configuration by name: ${name}`);
    return await this.configurationsService.getConfigurationByName(name);
  }

  @MessagePattern({ cmd: AppConfigCommands.GetAll })
  async getAllConfigurations(@Payload() query?: any): Promise<AppConfiguration[]> {
    this.logger.log('Getting all app configurations');
    return await this.configurationsService.getAllConfigurations(query || {});
  }

  @MessagePattern({ cmd: AppConfigCommands.Update })
  async updateConfiguration(
    @Payload() data: UpdateAppConfigDto & { id: string }
  ): Promise<AppConfiguration> {
    this.logger.log(`Updating app configuration: ${data.id}`);
    return await this.configurationsService.updateConfiguration(data.id, data);
  }

  @MessagePattern({ cmd: AppConfigCommands.Delete })
  async deleteConfiguration(@Payload() id: string): Promise<void> {
    this.logger.log(`Deleting app configuration: ${id}`);
    return await this.configurationsService.deleteConfiguration(id);
  }
}
