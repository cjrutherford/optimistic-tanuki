import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrainerSiteConfigEntity } from './entities/trainer-site-config.entity';

export interface TrainerSiteConfigDto {
  businessType?: string;
  site?: Record<string, unknown>;
  leadContext?: {
    profileId?: string;
    appScope?: string;
  };
  brand?: Record<string, unknown>;
  contact?: Record<string, unknown>;
  features?: Record<string, unknown>;
  serviceCatalog?: Record<string, unknown>;
  services?: Record<string, unknown>[];
  landingPage?: Record<string, unknown>;
  clientPortal?: Record<string, unknown>;
  testimonials?: Record<string, unknown>[];
  theme?: Record<string, unknown>;
}

export interface PublicTrainerSiteSummary {
  slug: string;
  businessName: string;
  tagline: string;
  location: string;
  businessType: string;
}

@Injectable()
export class TrainerConfigService {
  constructor(
    @InjectRepository(TrainerSiteConfigEntity)
    private readonly configRepository: Repository<TrainerSiteConfigEntity>,
    private readonly logger: Logger
  ) {}

  async getConfig(
    configKey = 'default'
  ): Promise<TrainerSiteConfigEntity | null> {
    this.logger.log(
      `[TrainerConfigService] Fetching config for key: ${configKey}`
    );
    const config = await this.configRepository.findOne({
      where: { configKey },
    });
    return config || null;
  }

  async getConfigBySiteSlug(
    slug: string
  ): Promise<TrainerSiteConfigEntity | null> {
    this.logger.log(
      `[TrainerConfigService] Fetching config for site slug: ${slug}`
    );
    const config = await this.configRepository
      .createQueryBuilder('config')
      .where(`config.site ->> 'slug' = :slug`, { slug })
      .getOne();

    return config || null;
  }

  async getConfigByOwnerProfileId(
    profileId: string
  ): Promise<TrainerSiteConfigEntity | null> {
    this.logger.log(
      `[TrainerConfigService] Fetching config for owner profile: ${profileId}`
    );

    const config = await this.configRepository
      .createQueryBuilder('config')
      .where(`config.leadContext ->> 'profileId' = :profileId`, { profileId })
      .getOne();

    return config || null;
  }

  async listPublicSiteSummaries(): Promise<PublicTrainerSiteSummary[]> {
    this.logger.log('[TrainerConfigService] Listing public site summaries');

    const configs = await this.configRepository
      .createQueryBuilder('config')
      .where(`config.site ->> 'status' = :status`, { status: 'published' })
      .andWhere(`coalesce(config.site ->> 'slug', '') <> ''`)
      .orderBy(`config.brand ->> 'businessName'`, 'ASC')
      .getMany();

    return configs.map((config) => ({
      slug: String(config.site?.['slug'] ?? ''),
      businessName: String(config.brand?.['businessName'] ?? ''),
      tagline: String(config.brand?.['tagline'] ?? ''),
      location: String(config.contact?.['location'] ?? ''),
      businessType: String(config.businessType ?? 'general'),
    }));
  }

  async createConfig(
    dto: TrainerSiteConfigDto,
    configKey = 'default'
  ): Promise<TrainerSiteConfigEntity> {
    this.logger.log(
      `[TrainerConfigService] Creating config for key: ${configKey}`
    );
    const entity = new TrainerSiteConfigEntity();
    entity.configKey = configKey;
    entity.businessType = dto.businessType || 'general';
    entity.site = dto.site || {};
    entity.leadContext = dto.leadContext || {
      profileId: '',
      appScope: 'business-site',
    };
    entity.brand = dto.brand || {};
    entity.contact = dto.contact || {};
    entity.features = dto.features || {};
    entity.serviceCatalog = dto.serviceCatalog || {};
    entity.services = dto.services || [];
    entity.landingPage = dto.landingPage || {};
    entity.clientPortal = dto.clientPortal || {};
    entity.testimonials = dto.testimonials || [];
    entity.theme = dto.theme || {};
    return await this.configRepository.save(entity);
  }

  async updateConfig(
    id: string,
    dto: TrainerSiteConfigDto,
    requesterProfileId?: string
  ): Promise<TrainerSiteConfigEntity> {
    this.logger.log(`[TrainerConfigService] Updating config id: ${id}`);
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(
        `Trainer site config with ID ${id} not found`
      );
    }

    // A config's owner is recorded in leadContext.profileId at creation
    // time. Once a config has a recorded owner, only that owner may
    // mutate it -- callers must not be able to overwrite another
    // tenant's site by supplying an arbitrary configId. Configs without
    // a recorded owner (legacy/unclaimed rows) are left unrestricted.
    const existingOwnerProfileId = config.leadContext?.profileId;
    if (
      requesterProfileId &&
      existingOwnerProfileId &&
      existingOwnerProfileId !== requesterProfileId
    ) {
      throw new ForbiddenException(
        'You do not have permission to modify this business site configuration.'
      );
    }

    if (dto.businessType !== undefined) config.businessType = dto.businessType;
    if (dto.site !== undefined) config.site = dto.site;
    if (dto.leadContext !== undefined) config.leadContext = dto.leadContext;
    if (dto.brand !== undefined) config.brand = dto.brand;
    if (dto.contact !== undefined) config.contact = dto.contact;
    if (dto.features !== undefined) config.features = dto.features;
    if (dto.serviceCatalog !== undefined) {
      config.serviceCatalog = dto.serviceCatalog;
    }
    if (dto.services !== undefined) config.services = dto.services;
    if (dto.landingPage !== undefined) config.landingPage = dto.landingPage;
    if (dto.clientPortal !== undefined) config.clientPortal = dto.clientPortal;
    if (dto.testimonials !== undefined) config.testimonials = dto.testimonials;
    if (dto.theme !== undefined) config.theme = dto.theme;
    config.updatedAt = new Date();

    return await this.configRepository.save(config);
  }

  async upsertConfig(
    dto: TrainerSiteConfigDto,
    configKey = 'default'
  ): Promise<TrainerSiteConfigEntity> {
    this.logger.log(
      `[TrainerConfigService] Upserting config for key: ${configKey}`
    );
    const existing = await this.getConfig(configKey);
    if (existing) {
      return this.updateConfig(existing.id, dto);
    }
    return this.createConfig(dto, configKey);
  }
}
