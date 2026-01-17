import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import {
  AppConfiguration,
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
  ): Promise<AppConfiguration> {
    const config = this.configRepository.create({
      ...createDto,
      active: createDto.active ?? true,
    });
    const saved = await this.configRepository.save(config);
    return this.mapEntityToDto(saved);
  }

  async getConfiguration(id: string): Promise<AppConfiguration> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }
    return this.mapEntityToDto(config);
  }

  async getConfigurationByDomain(domain: string): Promise<AppConfiguration> {
    const config = await this.configRepository.findOne({ where: { domain } });
    if (!config) {
      throw new NotFoundException(
        `Configuration with domain ${domain} not found`
      );
    }
    return this.mapEntityToDto(config);
  }

  async getConfigurationByName(name: string): Promise<AppConfiguration> {
    const config = await this.configRepository.findOne({ where: { name } });
    if (!config) {
      throw new NotFoundException(`Configuration with name ${name} not found`);
    }
    return this.mapEntityToDto(config);
  }

  async getAllConfigurations(query: any = {}): Promise<AppConfiguration[]> {
    const configs = await this.configRepository.find({
      where: query,
      order: { createdAt: 'DESC' },
    });
    return configs.map((config) => this.mapEntityToDto(config));
  }

  async updateConfiguration(
    id: string,
    updateDto: UpdateAppConfigDto
  ): Promise<AppConfiguration> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }

    Object.assign(config, updateDto);
    config.updatedAt = new Date();

    const updated = await this.configRepository.save(config);
    return this.mapEntityToDto(updated);
  }

  async deleteConfiguration(id: string): Promise<void> {
    const result = await this.configRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }
  }

  private mapEntityToDto(entity: AppConfigurationEntity): AppConfiguration {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      domain: entity.domain,
      landingPage: entity.landingPage as any,
      routes: entity.routes as any,
      features: entity.features as any,
      theme: entity.theme as any,
      active: entity.active,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
