import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { TrainerConfigCommands } from '@optimistic-tanuki/constants';
import {
  TrainerConfigService,
  PublicTrainerSiteSummary,
  TrainerSiteConfigDto,
} from './trainer-config.service';

@Controller()
export class TrainerConfigController {
  constructor(private readonly trainerConfigService: TrainerConfigService) {}

  @MessagePattern(TrainerConfigCommands.GET_CONFIG)
  async getConfig(
    @Payload()
    payload: {
      configKey?: string;
      slug?: string;
      profileId?: string;
    }
  ) {
    const configKey = payload?.configKey || 'default';
    const config = payload?.slug
      ? await this.trainerConfigService.getConfigBySiteSlug(payload.slug)
      : payload?.profileId
      ? await this.trainerConfigService.getConfigByOwnerProfileId(
          payload.profileId
        )
      : await this.trainerConfigService.getConfig(configKey);
    if (!config) {
      return { configId: null, config: null };
    }
    return {
      configId: config.id,
      config: {
        businessType: config.businessType,
        site: config.site,
        leadContext: config.leadContext,
        brand: config.brand,
        contact: config.contact,
        features: config.features,
        serviceCatalog: config.serviceCatalog,
        services: config.services,
        landingPage: config.landingPage,
        clientPortal: config.clientPortal,
        testimonials: config.testimonials,
        theme: config.theme,
      },
    };
  }

  @MessagePattern(TrainerConfigCommands.LIST_PUBLIC_SITE_SUMMARIES)
  async listPublicSiteSummaries(): Promise<PublicTrainerSiteSummary[]> {
    return this.trainerConfigService.listPublicSiteSummaries();
  }

  @MessagePattern(TrainerConfigCommands.CREATE_CONFIG)
  async createConfig(
    @Payload() payload: TrainerSiteConfigDto & { configKey?: string }
  ) {
    const { configKey = 'default', ...dto } = payload;
    const config = await this.trainerConfigService.createConfig(dto, configKey);
    return {
      id: config.id,
      configKey: config.configKey,
      config: {
        businessType: config.businessType,
        site: config.site,
        leadContext: config.leadContext,
        brand: config.brand,
        contact: config.contact,
        features: config.features,
        serviceCatalog: config.serviceCatalog,
        services: config.services,
        landingPage: config.landingPage,
        clientPortal: config.clientPortal,
        testimonials: config.testimonials,
        theme: config.theme,
      },
    };
  }

  @MessagePattern(TrainerConfigCommands.UPDATE_CONFIG)
  async updateConfig(
    @Payload() payload: { id: string; config: TrainerSiteConfigDto }
  ) {
    const config = await this.trainerConfigService.updateConfig(
      payload.id,
      payload.config
    );
    return {
      id: config.id,
      configKey: config.configKey,
      config: {
        businessType: config.businessType,
        site: config.site,
        leadContext: config.leadContext,
        brand: config.brand,
        contact: config.contact,
        features: config.features,
        serviceCatalog: config.serviceCatalog,
        services: config.services,
        landingPage: config.landingPage,
        clientPortal: config.clientPortal,
        testimonials: config.testimonials,
        theme: config.theme,
      },
    };
  }

  @MessagePattern(TrainerConfigCommands.UPSERT_CONFIG)
  async upsertConfig(
    @Payload() payload: TrainerSiteConfigDto & { configKey?: string }
  ) {
    const { configKey = 'default', ...dto } = payload;
    const config = await this.trainerConfigService.upsertConfig(dto, configKey);
    return {
      id: config.id,
      configKey: config.configKey,
      config: {
        businessType: config.businessType,
        site: config.site,
        leadContext: config.leadContext,
        brand: config.brand,
        contact: config.contact,
        features: config.features,
        serviceCatalog: config.serviceCatalog,
        services: config.services,
        landingPage: config.landingPage,
        clientPortal: config.clientPortal,
        testimonials: config.testimonials,
        theme: config.theme,
      },
    };
  }
}
