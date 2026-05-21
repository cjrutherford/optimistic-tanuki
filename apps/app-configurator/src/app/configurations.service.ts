import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import {
  CreateAppConfigDto,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';

@Injectable()
export class ConfigurationsService {
  constructor(
    @InjectRepository(AppConfigurationEntity)
    private readonly configRepository: Repository<AppConfigurationEntity>,
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
