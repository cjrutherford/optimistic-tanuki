import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrainerSiteConfigEntity } from './entities/trainer-site-config.entity';

export interface TrainerSiteConfigDto {
  leadContext?: {
    profileId?: string;
    appScope?: string;
  };
  brand?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  features?: Record<string, unknown>;
  services?: Record<string, unknown>[];
  landingPage?: Record<string, unknown>;
  clientPortal?: Record<string, unknown>;
  testimonials?: Record<string, unknown>[];
  theme?: Record<string, unknown>;
}

@Injectable()
export class TrainerConfigService {
  constructor(
    @InjectRepository(TrainerSiteConfigEntity)
    private readonly configRepository: Repository<TrainerSiteConfigEntity>,
    private readonly logger: Logger
  ) {}

  async getConfig(configKey = 'default'): Promise<TrainerSiteConfigEntity | null> {
    this.logger.log(`[TrainerConfigService] Fetching config for key: ${configKey}`);
    const config = await this.configRepository.findOne({ where: { configKey } });
    return config || null;
  }

  async createConfig(dto: TrainerSiteConfigDto, configKey = 'default'): Promise<TrainerSiteConfigEntity> {
    this.logger.log(`[TrainerConfigService] Creating config for key: ${configKey}`);
    const entity = new TrainerSiteConfigEntity();
    entity.configKey = configKey;
    entity.leadContext = dto.leadContext || { profileId: '', appScope: 'business-site' };
    entity.brand = dto.brand || {};
    entity.contact = dto.contact || {};
    entity.features = dto.features || {};
    entity.services = dto.services || [];
    entity.landingPage = dto.landingPage || {};
    entity.clientPortal = dto.clientPortal || {};
    entity.testimonials = dto.testimonials || [];
    entity.theme = dto.theme || {};
    return await this.configRepository.save(entity);
  }

  async updateConfig(id: string, dto: TrainerSiteConfigDto): Promise<TrainerSiteConfigEntity> {
    this.logger.log(`[TrainerConfigService] Updating config id: ${id}`);
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Trainer site config with ID ${id} not found`);
    }

    if (dto.leadContext !== undefined) config.leadContext = dto.leadContext;
    if (dto.brand !== undefined) config.brand = dto.brand;
    if (dto.contact !== undefined) config.contact = dto.contact;
    if (dto.features !== undefined) config.features = dto.features;
    if (dto.services !== undefined) config.services = dto.services;
    if (dto.landingPage !== undefined) config.landingPage = dto.landingPage;
    if (dto.clientPortal !== undefined) config.clientPortal = dto.clientPortal;
    if (dto.testimonials !== undefined) config.testimonials = dto.testimonials;
    if (dto.theme !== undefined) config.theme = dto.theme;
    config.updatedAt = new Date();

    return await this.configRepository.save(config);
  }

  async upsertConfig(dto: TrainerSiteConfigDto, configKey = 'default'): Promise<TrainerSiteConfigEntity> {
    this.logger.log(`[TrainerConfigService] Upserting config for key: ${configKey}`);
    const existing = await this.getConfig(configKey);
    if (existing) {
      return this.updateConfig(existing.id, dto);
    }
    return this.createConfig(dto, configKey);
  }
}
