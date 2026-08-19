import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ConfigurationsService } from '../app/configurations.service';
import {
  CreateAppConfigDto,
  AppConfigRequestContext,
  PublishedAppConfiguration,
  PublishAppConfigDto,
  RollbackAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { AppConfigurationEntity } from './entities/app-configuration.entity';

export const AppConfigCommands = {
  Create: 'app-config.create',
  Get: 'app-config.get',
  GetPublishedByDomain: 'app-config.getPublishedByDomain',
  GetByName: 'app-config.getByName',
  GetAll: 'app-config.getAll',
  Update: 'app-config.update',
  Publish: 'app-config.publish',
  Rollback: 'app-config.rollback',
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
    @Payload()
    data: {
      dto: CreateAppConfigDto;
      context: AppConfigRequestContext;
    }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Creating app configuration: ${data.dto.name}`);
    return await this.configurationsService.createConfiguration(
      data.dto,
      data.context
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.Get })
  async getConfiguration(
    @Payload() data: { id: string; context: AppConfigRequestContext }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Getting app configuration: ${data.id}`);
    return await this.configurationsService.getConfiguration(
      data.id,
      data.context
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.GetPublishedByDomain })
  async getPublishedConfigurationByDomain(
    @Payload() data: { domain: string }
  ): Promise<PublishedAppConfiguration> {
    this.logger.log(`Getting app configuration by domain: ${data.domain}`);
    return await this.configurationsService.getPublishedConfigurationByDomain(
      data.domain
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.GetByName })
  async getConfigurationByName(
    @Payload() data: { name: string; context: AppConfigRequestContext }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Getting app configuration by name: ${data.name}`);
    return await this.configurationsService.getConfigurationByName(
      data.name,
      data.context
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.GetAll })
  async getAllConfigurations(
    @Payload() data: { context: AppConfigRequestContext; query?: any }
  ): Promise<AppConfigurationEntity[]> {
    this.logger.log('Getting all app configurations');
    return await this.configurationsService.getAllConfigurations(
      data.context,
      data.query || {}
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.Update })
  async updateConfiguration(
    @Payload()
    data: {
      id: string;
      dto: UpdateAppConfigDto;
      context: AppConfigRequestContext;
    }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Updating app configuration: ${data.id}`);
    return await this.configurationsService.updateConfiguration(
      data.id,
      data.dto,
      data.context
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.Publish })
  async publishConfiguration(
    @Payload()
    data: {
      id: string;
      dto: PublishAppConfigDto;
      context: AppConfigRequestContext;
    }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Publishing app configuration: ${data.id}`);
    return await this.configurationsService.publishConfiguration(
      data.id,
      data.dto,
      data.context
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.Rollback })
  async rollbackConfiguration(
    @Payload()
    data: {
      id: string;
      dto: RollbackAppConfigDto;
      context: AppConfigRequestContext;
    }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Rolling back app configuration: ${data.id}`);
    return await this.configurationsService.rollbackConfiguration(
      data.id,
      data.dto,
      data.context
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.Delete })
  async deleteConfiguration(
    @Payload() data: { id: string; context: AppConfigRequestContext }
  ): Promise<void> {
    this.logger.log(`Deleting app configuration: ${data.id}`);
    return await this.configurationsService.deleteConfiguration(
      data.id,
      data.context
    );
  }
}
