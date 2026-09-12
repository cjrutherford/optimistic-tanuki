import { Controller, HttpException, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
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
import { AppConfigCommands } from '@optimistic-tanuki/constants';
import {
  AppConfigContextResolutionRequest,
  ResolvedAppConfigRequestContext,
} from './app-config-context.contract';
import type { AppAccessPolicy } from '@optimistic-tanuki/app-config-models';

@Controller('configurations')
export class ConfigurationsController {
  constructor(
    private readonly configurationsService: ConfigurationsService,
    private readonly logger: Logger
  ) {}

  @MessagePattern({ cmd: AppConfigCommands.ResolveContext })
  async resolveContext(
    @Payload() data: AppConfigContextResolutionRequest
  ): Promise<ResolvedAppConfigRequestContext> {
    this.logger.log('Resolving authoritative app configuration context');
    return await this.sendMutation(() =>
      this.configurationsService.resolveContext(data)
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.Create })
  async createConfiguration(
    @Payload()
    data: {
      dto: CreateAppConfigDto;
      context: AppConfigRequestContext;
    }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Creating app configuration: ${data.dto.name}`);
    return await this.sendMutation(() =>
      this.configurationsService.createConfiguration(data.dto, data.context)
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.Get })
  async getConfiguration(
    @Payload() data: { id: string; context: AppConfigRequestContext }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Getting app configuration: ${data.id}`);
    return await this.sendMutation(() =>
      this.configurationsService.getConfiguration(data.id, data.context)
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.GetPublishedByDomain })
  async getPublishedConfigurationByDomain(
    @Payload() data: { domain: string }
  ): Promise<PublishedAppConfiguration> {
    this.logger.log(`Getting app configuration by domain: ${data.domain}`);
    return await this.sendMutation(() =>
      this.configurationsService.getPublishedConfigurationByDomain(data.domain)
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.DiscoverPublishedApps })
  async discoverPublishedApps(
    @Payload()
    data: {
      identity?: { userId: string; profileId: string } | null;
      query?: { search?: string; accessPolicy?: AppAccessPolicy };
    }
  ): Promise<Array<Record<string, unknown>>> {
    return await this.sendMutation(() =>
      this.configurationsService.discoverPublishedApps(
        data?.identity,
        data?.query
      )
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.ResolvePublishedApp })
  async resolvePublishedApp(
    @Payload()
    data: {
      id: string;
      identity?: { userId: string; profileId: string } | null;
    }
  ): Promise<PublishedAppConfiguration> {
    return await this.sendMutation(() =>
      this.configurationsService.resolvePublishedApp(data.id, data.identity)
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.JoinPublishedApp })
  async joinPublishedApp(
    @Payload()
    data: {
      id: string;
      identity: { userId: string; profileId: string };
    }
  ): Promise<Record<string, unknown>> {
    return await this.sendMutation(() =>
      this.configurationsService.joinPublishedApp(data.id, data.identity)
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.RequestPublishedApp })
  async requestPublishedApp(
    @Payload()
    data: {
      id: string;
      identity: { userId: string; profileId: string };
    }
  ): Promise<Record<string, unknown>> {
    return await this.sendMutation(() =>
      this.configurationsService.requestPublishedApp(data.id, data.identity)
    );
  }

  /** Internal gateway-only projection for domain-bound product reads. */
  @MessagePattern({ cmd: AppConfigCommands.GetPublishedContextByDomain })
  async getPublishedContextByDomain(
    @Payload() data: { domain: string }
  ): Promise<unknown> {
    this.logger.log(`Getting published app context by domain: ${data.domain}`);
    return await this.sendMutation(() =>
      this.configurationsService.getPublishedConfigurationContextByDomain(
        data.domain
      )
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.GetByName })
  async getConfigurationByName(
    @Payload() data: { name: string; context: AppConfigRequestContext }
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`Getting app configuration by name: ${data.name}`);
    return await this.sendMutation(() =>
      this.configurationsService.getConfigurationByName(data.name, data.context)
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.GetByContext })
  async getConfigurationByContext(
    @Payload() data: { context: AppConfigRequestContext }
  ): Promise<AppConfigurationEntity> {
    this.logger.log('Getting app configuration by authoritative context');
    return await this.sendMutation(() =>
      this.configurationsService.getConfigurationByContext(data.context)
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.GetAll })
  async getAllConfigurations(
    @Payload() data: { context: AppConfigRequestContext; query?: any }
  ): Promise<AppConfigurationEntity[]> {
    this.logger.log('Getting all app configurations');
    return await this.sendMutation(() =>
      this.configurationsService.getAllConfigurations(
        data.context,
        data.query || {}
      )
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
    return await this.sendMutation(() =>
      this.configurationsService.updateConfiguration(
        data.id,
        data.dto,
        data.context
      )
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
    return await this.sendMutation(() =>
      this.configurationsService.publishConfiguration(
        data.id,
        data.dto,
        data.context
      )
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
    return await this.sendMutation(() =>
      this.configurationsService.rollbackConfiguration(
        data.id,
        data.dto,
        data.context
      )
    );
  }

  @MessagePattern({ cmd: AppConfigCommands.Delete })
  async deleteConfiguration(
    @Payload() data: { id: string; context: AppConfigRequestContext }
  ): Promise<{ deleted: true }> {
    this.logger.log(`Deleting app configuration: ${data.id}`);
    return await this.sendMutation(() =>
      this.configurationsService.deleteConfiguration(data.id, data.context)
    );
  }

  private async sendMutation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw new RpcException(error.getResponse());
      }

      throw error;
    }
  }
}
