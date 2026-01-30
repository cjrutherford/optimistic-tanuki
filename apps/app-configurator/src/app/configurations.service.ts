import { Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import {
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { 
  ServiceTokens, 
  AppScopeCommands, 
  RoleCommands 
} from '@optimistic-tanuki/constants';
import {
  CreateAppScopeDto,
  CreateRoleDto,
  AssignRoleDto,
} from '@optimistic-tanuki/models';

@Injectable()
export class ConfigurationsService {
  constructor(
    @InjectRepository(AppConfigurationEntity)
    private readonly configRepository: Repository<AppConfigurationEntity>,
    @Inject(ServiceTokens.PERMISSIONS_SERVICE)
    private readonly permissionsClient: ClientProxy,
    private readonly logger: Logger
  ) {}

  async createConfiguration(
    createDto: CreateAppConfigDto
  ): Promise<AppConfigurationEntity> {
    const entity = new AppConfigurationEntity();
    entity.name = createDto.name;
    entity.description = createDto.description || '';
    entity.domain = createDto.domain;
    entity.landingPage = createDto.landingPage as any;
    entity.routes = createDto.routes as any;
    entity.features = createDto.features as any;
    entity.theme = createDto.theme as any;
    entity.active = createDto.active ?? true;
    entity.ownerId = createDto.ownerId;

    // Create app scope if requested and ownerId is provided
    if (createDto.createAppScope && createDto.ownerId) {
      try {
        this.logger.log(`Creating app scope for configuration: ${createDto.name}`);
        
        // Sanitize app scope name
        const sanitizedName = createDto.name
          .toLowerCase()
          .trim()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        
        // Create the app scope
        const appScopeDto: CreateAppScopeDto = {
          name: sanitizedName,
          description: `App scope for ${createDto.name}`,
          active: true,
        };

        const appScope = await firstValueFrom(
          this.permissionsClient.send(
            { cmd: AppScopeCommands.Create },
            appScopeDto
          )
        );

        this.logger.log(`App scope created with ID: ${appScope.id}`);
        entity.appScopeId = appScope.id;

        // Create an owner role for this app scope
        const ownerRoleDto: CreateRoleDto = {
          name: `${sanitizedName}-owner`,
          description: `Owner role for ${createDto.name}`,
          appScopeId: appScope.id,
        };

        const ownerRole = await firstValueFrom(
          this.permissionsClient.send(
            { cmd: RoleCommands.Create },
            ownerRoleDto
          )
        );

        this.logger.log(`Owner role created with ID: ${ownerRole.id}`);

        // Assign the owner role to the creator
        const assignRoleDto: AssignRoleDto = {
          profileId: createDto.ownerId,
          roleId: ownerRole.id,
          appScopeId: appScope.id,
        };

        await firstValueFrom(
          this.permissionsClient.send(
            { cmd: RoleCommands.Assign },
            assignRoleDto
          )
        );

        this.logger.log(
          `Owner role assigned to profile ${createDto.ownerId} for app scope ${appScope.id}`
        );
      } catch (error) {
        this.logger.error('Failed to create app scope or assign owner role:', error);
        // Fail the entire operation if scope/role creation fails
        throw new Error(
          'Failed to create app with permissions. Please try again or contact support.'
        );
      }
    }
    
    return await this.configRepository.save(entity);
  }

  async getConfiguration(id: string): Promise<AppConfigurationEntity> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }
    return config;
  }

  async getConfigurationByDomain(domain: string): Promise<AppConfigurationEntity> {
    const config = await this.configRepository.findOne({ where: { domain } });
    if (!config) {
      throw new NotFoundException(
        `Configuration with domain ${domain} not found`
      );
    }
    return config;
  }

  async getConfigurationByName(name: string): Promise<AppConfigurationEntity> {
    this.logger.log(`[Service] Querying configuration by name: "${name}"`);
    const config = await this.configRepository.findOne({ where: { name } });
    if (!config) {
      this.logger.warn(`[Service] Configuration with name "${name}" not found`);
      throw new NotFoundException(`Configuration with name ${name} not found`);
    }
    this.logger.log(`[Service] Found configuration: ${config.name} (id: ${config.id})`);
    return config;
  }

  async getAllConfigurations(query: any = {}): Promise<AppConfigurationEntity[]> {
    this.logger.log(`[Service] Querying all configurations with filter:`, query);
    const configs = await this.configRepository.find({
      where: query,
      order: { createdAt: 'DESC' },
    });
    this.logger.log(`[Service] Found ${configs.length} configurations`);
    return configs;
  }

  async updateConfiguration(
    id: string,
    updateDto: UpdateAppConfigDto
  ): Promise<AppConfigurationEntity> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }

    Object.assign(config, updateDto);
    config.updatedAt = new Date();

    return await this.configRepository.save(config);
  }

  async deleteConfiguration(id: string): Promise<void> {
    const result = await this.configRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }
  }
}
