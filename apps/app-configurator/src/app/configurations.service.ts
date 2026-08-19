import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import {
  AppConfigReleaseRevision,
  AppConfigReleaseState,
  AppConfigRequestContext,
  PublishedAppConfiguration,
  AppConfigurationSnapshot,
  CreateAppConfigDto,
  PublishAppConfigDto,
  RollbackAppConfigDto,
  UpdateAppConfigDto,
  isConfigurablePluginManifest,
} from '@optimistic-tanuki/app-config-models';

@Injectable()
export class ConfigurationsService {
  constructor(
    @InjectRepository(AppConfigurationEntity)
    private readonly configRepository: Repository<AppConfigurationEntity>,
    private readonly logger: Logger
  ) {}

  async createConfiguration(
    createDto: CreateAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    this.assertManifest(createDto.manifest);
    const entity = new AppConfigurationEntity();
    entity.name = createDto.name;
    entity.ownerUserId = context.ownerUserId;
    entity.ownerProfileId = context.ownerProfileId;
    entity.appScope = context.appScope;
    entity.description = createDto.description || '';
    entity.domain = createDto.domain;
    entity.landingPage = createDto.landingPage as any;
    entity.routes = createDto.routes as any;
    entity.features = createDto.features as any;
    entity.theme = createDto.theme as any;
    entity.manifest = createDto.manifest;
    entity.active = createDto.active ?? true;
    entity.release = this.createInitialReleaseState(entity);

    return await this.configRepository.save(entity);
  }

  async getConfiguration(
    id: string,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    const config = await this.configRepository.findOne({
      where: { id, ...context },
    });
    if (!config) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }
    return config;
  }

  async getPublishedConfigurationByDomain(
    domain: string
  ): Promise<PublishedAppConfiguration> {
    const config = await this.configRepository.findOne({
      where: { domain, active: true },
    });
    if (!config) {
      throw new NotFoundException(
        `Configuration with domain ${domain} not found`
      );
    }
    const snapshot = config.release?.publishedSnapshot;
    const publishedVersion = config.release?.publishedVersion;
    if (!snapshot || !publishedVersion || config.release?.status === 'draft') {
      throw new NotFoundException(
        `Published configuration with domain ${domain} not found`
      );
    }
    return {
      id: config.id,
      ...snapshot,
      publishedVersion,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async getConfigurationByName(
    name: string,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`[Service] Querying configuration by name: "${name}"`);
    const config = await this.configRepository.findOne({
      where: { name, ...context },
    });
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
    context: AppConfigRequestContext,
    query: any = {}
  ): Promise<AppConfigurationEntity[]> {
    this.logger.log(
      `[Service] Querying all configurations with filter:`,
      query
    );
    const configs = await this.configRepository.find({
      where: { ...query, ...context },
      order: { createdAt: 'DESC' },
    });
    this.logger.log(`[Service] Found ${configs.length} configurations`);
    return configs;
  }

  async updateConfiguration(
    id: string,
    updateDto: UpdateAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    this.assertManifest(updateDto.manifest);
    const config = await this.getConfiguration(id, context);

    Object.assign(config, updateDto);
    config.release = this.buildUpdatedReleaseState(config);
    config.updatedAt = new Date();

    return await this.configRepository.save(config);
  }

  async publishConfiguration(
    id: string,
    publishDto: PublishAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    const config = await this.getConfiguration(id, context);
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
    rollbackDto: RollbackAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    const config = await this.getConfiguration(id, context);
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
    config.manifest = restored.manifest;
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

  async deleteConfiguration(
    id: string,
    context: AppConfigRequestContext
  ): Promise<void> {
    const result = await this.configRepository.delete({ id, ...context });
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
      manifest: config.manifest,
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

  private assertManifest(manifest: unknown): void {
    if (manifest !== undefined && !isConfigurablePluginManifest(manifest)) {
      throw new BadRequestException(
        'manifest must use the supported configurable manifest schema'
      );
    }
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
