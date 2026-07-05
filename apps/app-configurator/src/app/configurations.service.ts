import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import {
  AppConfigReleaseRevision,
  AppConfigReleaseState,
  AppConfigurationSnapshot,
  CreateAppConfigDto,
  PublishAppConfigDto,
  RollbackAppConfigDto,
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
    entity.release = this.createInitialReleaseState(entity);

    return await this.configRepository.save(entity);
  }

  async getConfiguration(id: string): Promise<AppConfigurationEntity> {
    const config = await this.configRepository.findOne({ where: { id } });
    if (!config) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }
    return config;
  }

  async getConfigurationByDomain(
    domain: string
  ): Promise<AppConfigurationEntity> {
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
    this.logger.log(
      `[Service] Found configuration: ${config.name} (id: ${config.id})`
    );
    return config;
  }

  async getAllConfigurations(
    query: any = {}
  ): Promise<AppConfigurationEntity[]> {
    this.logger.log(
      `[Service] Querying all configurations with filter:`,
      query
    );
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
    config.release = this.buildUpdatedReleaseState(config);
    config.updatedAt = new Date();

    return await this.configRepository.save(config);
  }

  async publishConfiguration(
    id: string,
    publishDto: PublishAppConfigDto
  ): Promise<AppConfigurationEntity> {
    const config = await this.getConfiguration(id);
    const version = (config.release?.publishedVersion ?? 0) + 1;
    const snapshot = this.toSnapshot(config);
    const revision: AppConfigReleaseRevision = {
      version,
      action: 'publish',
      releasedAt: new Date(),
      releaseNotes: publishDto.releaseNotes,
      changeSummary: publishDto.changeSummary,
      snapshot,
    };

    config.release = {
      ...(config.release ?? this.createInitialReleaseState(config)),
      status: 'published',
      publishedVersion: version,
      releaseNotes: publishDto.releaseNotes,
      changeSummary: publishDto.changeSummary,
      previewUrl: this.buildPreviewUrl(config.domain),
      publishedSnapshot: snapshot,
      history: [...(config.release?.history ?? []), revision],
    };
    config.updatedAt = new Date();

    return await this.configRepository.save(config);
  }

  async rollbackConfiguration(
    id: string,
    rollbackDto: RollbackAppConfigDto
  ): Promise<AppConfigurationEntity> {
    const config = await this.getConfiguration(id);
    const history = config.release?.history ?? [];
    const targetRevision = history.find(
      (revision) => revision.version === rollbackDto.version
    );

    if (!targetRevision) {
      throw new NotFoundException(
        `Release revision ${rollbackDto.version} not found for configuration ${id}`
      );
    }

    const restored = targetRevision.snapshot;
    config.name = restored.name;
    config.description = restored.description || '';
    config.domain = restored.domain;
    config.landingPage = restored.landingPage as any;
    config.routes = restored.routes as any;
    config.features = restored.features as any;
    config.theme = restored.theme as any;
    config.active = restored.active;

    const version =
      Math.max(rollbackDto.version, config.release?.publishedVersion ?? 0) + 1;
    const rollbackRevision: AppConfigReleaseRevision = {
      version,
      action: 'rollback',
      releasedAt: new Date(),
      releaseNotes: rollbackDto.releaseNotes,
      changeSummary: `Rollback to revision ${rollbackDto.version}`,
      snapshot: this.toSnapshot(config),
    };

    config.release = {
      ...(config.release ?? this.createInitialReleaseState(config)),
      status: 'published',
      publishedVersion: version,
      releaseNotes: rollbackDto.releaseNotes,
      changeSummary: rollbackRevision.changeSummary,
      previewUrl: this.buildPreviewUrl(config.domain),
      publishedSnapshot: rollbackRevision.snapshot,
      history: [...history, rollbackRevision],
    };
    config.updatedAt = new Date();

    return await this.configRepository.save(config);
  }

  async deleteConfiguration(id: string): Promise<void> {
    const result = await this.configRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }
  }

  private createInitialReleaseState(
    config: Pick<
      AppConfigurationEntity,
      | 'name'
      | 'description'
      | 'domain'
      | 'landingPage'
      | 'routes'
      | 'features'
      | 'theme'
      | 'active'
    >
  ): AppConfigReleaseState {
    return {
      status: 'draft',
      publishedVersion: null,
      previewUrl: this.buildPreviewUrl(config.domain),
      publishedSnapshot: null,
      history: [],
    };
  }

  private buildUpdatedReleaseState(
    config: AppConfigurationEntity
  ): AppConfigReleaseState {
    const current = config.release ?? this.createInitialReleaseState(config);
    const publishedSnapshot = current.publishedSnapshot;
    const nextSnapshot = this.toSnapshot(config);
    const hasPublishedSnapshot = !!publishedSnapshot;
    const status = !hasPublishedSnapshot
      ? 'draft'
      : this.snapshotsEqual(publishedSnapshot, nextSnapshot)
      ? 'published'
      : 'changes-pending';

    return {
      ...current,
      status,
      previewUrl: this.buildPreviewUrl(config.domain),
    };
  }

  private toSnapshot(config: AppConfigurationEntity): AppConfigurationSnapshot {
    return {
      name: config.name,
      description: config.description || '',
      domain: config.domain,
      landingPage: config.landingPage as any,
      routes: config.routes as any,
      features: config.features as any,
      theme: config.theme as any,
      active: config.active,
    };
  }

  private snapshotsEqual(
    left: AppConfigurationSnapshot | null | undefined,
    right: AppConfigurationSnapshot
  ): boolean {
    if (!left) {
      return false;
    }

    return JSON.stringify(left) === JSON.stringify(right);
  }

  private buildPreviewUrl(domain?: string): string | undefined {
    if (!domain) {
      return undefined;
    }

    return domain.startsWith('http://') || domain.startsWith('https://')
      ? domain
      : `https://${domain}`;
  }
}
