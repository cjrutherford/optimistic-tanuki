import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AppConfigurationEntity } from '../configurations/entities/app-configuration.entity';
import { AppInstanceEntity } from '../configurations/entities/app-instance.entity';
import { AppMembershipEntity } from '../configurations/entities/app-membership.entity';
import {
  AppConfigReleaseRevision,
  AppConfigReleaseState,
  APP_ACCESS_POLICIES,
  AppAccessPolicy,
  AppConfigRequestContext,
  PublishedAppConfiguration,
  AppConfigurationSnapshot,
  CreateAppConfigDto,
  PublishAppConfigDto,
  RollbackAppConfigDto,
  UpdateAppConfigDto,
  isConfigurablePluginManifest,
} from '@optimistic-tanuki/app-config-models';
import { validateConfigurableCapabilityManifest } from '@optimistic-tanuki/configurable-plugin-contracts';
import {
  AppConfigContextResolutionRequest,
  ResolvedAppConfigRequestContext,
} from '../configurations/app-config-context.contract';

@Injectable()
export class ConfigurationsService {
  constructor(
    @InjectRepository(AppConfigurationEntity)
    private readonly configRepository: Repository<AppConfigurationEntity>,
    @InjectRepository(AppInstanceEntity)
    private readonly appInstanceRepository: Repository<AppInstanceEntity>,
    @InjectRepository(AppMembershipEntity)
    private readonly membershipRepository: Repository<AppMembershipEntity>,
    private readonly logger: Logger
  ) {}

  /**
   * Resolve the persisted app instance and membership for a trusted owner
   * identity. Authoritative IDs and lifecycle values are never read from the
   * request, including unknown extra properties supplied by a client.
   */
  async resolveContext(
    request: AppConfigContextResolutionRequest
  ): Promise<ResolvedAppConfigRequestContext> {
    const { ownerUserId, ownerProfileId, workspaceId, appScope } =
      request ?? ({} as AppConfigContextResolutionRequest);
    this.assertContextResolutionInput({
      ownerUserId,
      ownerProfileId,
      workspaceId,
      appScope,
    });

    const appInstance = await this.appInstanceRepository.findOne({
      where: { workspaceId, appScope },
    });
    if (!appInstance) {
      throw new NotFoundException(
        'No app instance exists for the canonical workspace and app scope'
      );
    }

    if (
      appInstance.ownerUserId !== ownerUserId ||
      appInstance.ownerProfileId !== ownerProfileId
    ) {
      throw new ForbiddenException(
        'The app instance is not owned by the requesting identity'
      );
    }
    if (appInstance.status !== 'active') {
      throw new ForbiddenException('App instance is not active');
    }

    const membership = await this.membershipRepository.findOne({
      where: {
        workspaceId,
        appInstanceId: appInstance.id,
        appScope,
        userId: ownerUserId,
        profileId: ownerProfileId,
      },
    });
    if (!membership) {
      throw new ForbiddenException(
        'No membership exists for the requesting owner identity'
      );
    }
    if (membership.role !== 'owner') {
      throw new ForbiddenException('An owner membership is required');
    }
    if (membership.status !== 'active') {
      throw new ForbiddenException('Owner membership is not active');
    }

    return {
      ownerUserId,
      ownerProfileId,
      appScope,
      workspaceId,
      appInstanceId: appInstance.id,
      membershipId: membership.id,
      membershipRole: membership.role,
      membershipStatus: membership.status,
    };
  }

  async createConfiguration(
    createDto: CreateAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    this.assertManifest(createDto.manifest);
    this.assertOwnerContextShape(context);
    if (
      context.membershipRole !== 'owner' ||
      context.membershipStatus !== 'active'
    ) {
      throw new ForbiddenException('An active owner membership is required');
    }

    return await this.configRepository.manager.transaction(async (manager) => {
      const appInstanceRepository = manager.getRepository(AppInstanceEntity);
      const membershipRepository = manager.getRepository(AppMembershipEntity);
      const configRepository = manager.getRepository(AppConfigurationEntity);

      await this.ensureActiveAppInstance(
        context,
        appInstanceRepository,
        true,
        true
      );
      await this.ensureActiveOwnerMembership(
        context,
        membershipRepository,
        true,
        true
      );

      const entity = this.createConfigurationEntity(createDto, context);
      await this.insertIgnoringConflicts(
        configRepository,
        AppConfigurationEntity,
        entity
      );
      const existing = await configRepository.findOne({
        where: {
          appInstanceId: context.appInstanceId,
          name: createDto.name,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing) {
        this.assertConfigurationScope(existing, context);
        this.assertConfigurationEquivalent(existing, entity);
        return existing;
      }

      throw new ConflictException(
        `Configuration ${createDto.name} could not be read after insertion`
      );
    });
  }

  /**
   * Reconcile an operator-owned seed without treating an existing row as a
   * create conflict. The natural key is scoped to the authoritative app
   * instance; identity, workspace, and app-scope columns are never mutable
   * seed fields.
   */
  async reconcileSeedConfiguration(
    seedDto: CreateAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    this.assertManifest(seedDto.manifest);
    this.assertActiveOwnerContextShape(context);

    return await this.configRepository.manager.transaction(async (manager) => {
      const appInstanceRepository = manager.getRepository(AppInstanceEntity);
      const membershipRepository = manager.getRepository(AppMembershipEntity);
      const configRepository = manager.getRepository(AppConfigurationEntity);

      const appInstance = await this.ensureActiveAppInstance(
        context,
        appInstanceRepository,
        true,
        true,
        true
      );
      const effectiveContext = {
        ...context,
        appInstanceId: appInstance.id,
      };
      const membership = await this.ensureActiveOwnerMembership(
        effectiveContext,
        membershipRepository,
        true,
        true
      );
      const authorizedContext = {
        ...effectiveContext,
        membershipId: membership.id,
      };

      const naturalKey = {
        workspaceId: authorizedContext.workspaceId,
        appInstanceId: authorizedContext.appInstanceId,
        name: seedDto.name,
      };
      let existing = await configRepository.findOne({
        where: naturalKey,
        lock: { mode: 'pessimistic_write' },
      });

      if (!existing) {
        const requested = this.createConfigurationEntity(
          seedDto,
          authorizedContext
        );
        await this.insertIgnoringConflicts(
          configRepository,
          AppConfigurationEntity,
          requested
        );
        existing = await configRepository.findOne({
          where: naturalKey,
          lock: { mode: 'pessimistic_write' },
        });
        if (!existing) {
          throw new ConflictException(
            `Configuration ${seedDto.name} could not be read after reconciliation`
          );
        }
      }

      this.assertConfigurationScope(existing, authorizedContext);
      const requested = this.createConfigurationEntity(
        seedDto,
        authorizedContext
      );
      if (this.configurationMatchesSeed(existing, requested)) {
        return existing;
      }

      Object.assign(existing, this.seedConfigurationChanges(seedDto));
      existing.release = this.buildUpdatedReleaseState(existing);
      existing.updatedAt = new Date();
      return await this.persistMutation(
        configRepository,
        existing,
        existing.revision,
        authorizedContext
      );
    });
  }

  async getConfiguration(
    id: string,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    return await this.withAuthorizedConfigurationTransaction(
      id,
      context,
      async ({ configRepository }) => {
        const config = await this.findConfiguration(
          configRepository,
          id,
          context
        );
        if (!config) {
          throw new NotFoundException(`Configuration with ID ${id} not found`);
        }
        return this.normalizeConfigurationForRead(config);
      },
      false
    );
  }

  async getPublishedConfigurationByDomain(
    domain: string
  ): Promise<PublishedAppConfiguration> {
    const normalizedDomain = this.normalizeCommittedDomain(domain);
    if (!normalizedDomain) {
      throw new NotFoundException(
        `Published configuration with domain ${domain} not found`
      );
    }
    // The editable row is intentionally not part of this lookup. Owners may
    // stage a new domain or deactivate the draft without moving the currently
    // committed public release. Resolve the immutable published snapshot and
    // then require its matching history entry before exposing it.
    const configurations = await this.configRepository.find();
    const matches = configurations.filter((candidate) => {
      const snapshot = candidate.release?.publishedSnapshot;
      return (
        this.hasConfirmedPublication(candidate.release) &&
        this.normalizeCommittedDomain(snapshot?.domain) === normalizedDomain &&
        snapshot.active === true
      );
    });
    // A legacy duplicate is ambiguous: never choose a winner based on row
    // order, which could expose the wrong tenant's public experience.
    if (matches.length !== 1) {
      throw new NotFoundException(
        `Published configuration with domain ${domain} not found`
      );
    }
    const config = matches[0];
    const snapshot = config.release?.publishedSnapshot;
    const publishedVersion = config.release?.publishedVersion;
    if (!snapshot || !publishedVersion) {
      throw new NotFoundException(
        `Published configuration with domain ${domain} not found`
      );
    }
    // Domain-bound resolution is anonymous and is used by public product
    // routes. Non-public policies must never become discoverable through a
    // domain probe; callers use the authenticated app-id flow instead.
    if (this.accessPolicyOf(snapshot) !== 'public') {
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

  /**
   * Public directory projection. Only committed snapshots participate in
   * discovery; drafts and inactive releases are deliberately invisible.
   */
  async discoverPublishedApps(
    identity?: { userId: string; profileId: string } | null,
    query: { search?: string; accessPolicy?: AppAccessPolicy } = {}
  ): Promise<Array<Record<string, unknown>>> {
    const configurations = await this.configRepository.find();
    const results: Array<Record<string, unknown>> = [];
    const search = query.search?.trim().toLowerCase();
    for (const config of configurations) {
      const snapshot = this.confirmedSnapshot(config);
      if (!snapshot || snapshot.active !== true) continue;
      const accessPolicy = this.accessPolicyOf(snapshot);
      if (query.accessPolicy && accessPolicy !== query.accessPolicy) continue;
      const isPrivate = accessPolicy === 'private';
      const membership = identity
        ? await this.membershipRepository.findOne({
            where: {
              appInstanceId: config.appInstanceId,
              userId: identity.userId,
              profileId: identity.profileId,
            },
          })
        : null;
      if (isPrivate && membership?.status !== 'active') continue;
      const name = snapshot.name || config.name;
      const description = snapshot.description || '';
      if (search && !`${name} ${description}`.toLowerCase().includes(search)) {
        continue;
      }
      results.push({
        appId: config.id,
        name,
        description,
        domain: snapshot.domain,
        accessPolicy,
        publishedVersion: config.release?.publishedVersion,
        membershipRole: membership?.role ?? null,
        membershipStatus: membership?.status ?? null,
        canOpen: accessPolicy === 'public' || membership?.status === 'active',
        canJoin: accessPolicy === 'joinable' && !membership,
        canRequest: accessPolicy === 'request-only' && !membership,
      });
    }
    return results;
  }

  /** Resolve a published app only when the caller is allowed to open it. */
  async resolvePublishedApp(
    id: string,
    identity?: { userId: string; profileId: string } | null
  ): Promise<PublishedAppConfiguration> {
    const config = await this.findPublishedConfigurationById(id);
    const snapshot = this.confirmedSnapshot(config);
    if (!snapshot || snapshot.active !== true) {
      throw new NotFoundException('Published app not found');
    }
    const accessPolicy = this.accessPolicyOf(snapshot);
    const membership = identity
      ? await this.membershipRepository.findOne({
          where: {
            appInstanceId: config.appInstanceId,
            userId: identity.userId,
            profileId: identity.profileId,
          },
        })
      : null;
    if (accessPolicy !== 'public' && membership?.status !== 'active') {
      throw new NotFoundException('Published app not found');
    }
    return {
      id: config.id,
      ...snapshot,
      accessPolicy,
      publishedVersion: config.release?.publishedVersion as number,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async joinPublishedApp(
    id: string,
    identity: { userId: string; profileId: string }
  ): Promise<Record<string, unknown>> {
    return this.enrollPublishedApp(id, identity, 'active', 'joinable');
  }

  async requestPublishedApp(
    id: string,
    identity: { userId: string; profileId: string }
  ): Promise<Record<string, unknown>> {
    return this.enrollPublishedApp(id, identity, 'pending', 'request-only');
  }

  private async enrollPublishedApp(
    id: string,
    identity: { userId: string; profileId: string },
    status: 'active' | 'pending',
    requiredPolicy: 'joinable' | 'request-only'
  ): Promise<Record<string, unknown>> {
    if (!identity?.userId || !identity?.profileId) {
      throw new BadRequestException('A verified platform identity is required');
    }
    const config = await this.findPublishedConfigurationById(id);
    const snapshot = this.confirmedSnapshot(config);
    if (
      !snapshot ||
      snapshot.active !== true ||
      this.accessPolicyOf(snapshot) !== requiredPolicy
    ) {
      throw new NotFoundException('Published app not found');
    }
    try {
      return await this.configRepository.manager.transaction(
        async (manager) => {
          const memberships = manager.getRepository(AppMembershipEntity);
          // Match the database uniqueness boundary exactly. userId is checked
          // separately so a malformed/cross-account profile can never receive
          // another identity's membership projection.
          const existing = await memberships.findOne({
            where: {
              appInstanceId: config.appInstanceId,
              profileId: identity.profileId,
            },
          });
          if (existing) {
            if (existing.userId !== identity.userId) {
              throw new ForbiddenException(
                'The profile is not available for this identity'
              );
            }
            return this.membershipProjection(existing, config);
          }
          const membership = new AppMembershipEntity();
          membership.workspaceId = config.workspaceId;
          membership.appInstanceId = config.appInstanceId;
          membership.appScope = config.appScope;
          membership.userId = identity.userId;
          membership.profileId = identity.profileId;
          membership.role = 'member';
          membership.status = status;
          const saved = await memberships.save(membership);
          return this.membershipProjection(saved, config);
        }
      );
    } catch (error) {
      // PostgreSQL aborts the current transaction after a unique violation;
      // querying through `memberships` there would fail with "current
      // transaction is aborted". Read only after TypeORM rolls it back.
      if (!this.isUniqueViolation(error)) throw error;
      const concurrent = await this.membershipRepository.findOne({
        where: {
          appInstanceId: config.appInstanceId,
          profileId: identity.profileId,
        },
      });
      if (!concurrent) throw error;
      if (concurrent.userId !== identity.userId) {
        throw new ForbiddenException(
          'The profile is not available for this identity'
        );
      }
      return this.membershipProjection(concurrent, config);
    }
  }

  private async findPublishedConfigurationById(
    id: string
  ): Promise<AppConfigurationEntity> {
    const configurations = await this.configRepository.find();
    const config = configurations.find((candidate) => candidate.id === id);
    if (!config || !this.confirmedSnapshot(config)) {
      throw new NotFoundException('Published app not found');
    }
    return config;
  }

  private confirmedSnapshot(
    config: AppConfigurationEntity
  ): AppConfigurationSnapshot | null {
    const snapshot = config.release?.publishedSnapshot;
    return this.hasConfirmedPublication(config.release) && snapshot
      ? snapshot
      : null;
  }

  private accessPolicyOf(snapshot: AppConfigurationSnapshot): AppAccessPolicy {
    return APP_ACCESS_POLICIES.includes(
      snapshot.accessPolicy as AppAccessPolicy
    )
      ? (snapshot.accessPolicy as AppAccessPolicy)
      : 'public';
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    );
  }

  private membershipProjection(
    membership: AppMembershipEntity,
    config: AppConfigurationEntity
  ): Record<string, unknown> {
    return {
      appId: config.id,
      role: membership.role,
      status: membership.status,
    };
  }

  /** Server-only projection used to bind public product reads to a release. */
  async getPublishedConfigurationContextByDomain(domain: string): Promise<{
    configuration: PublishedAppConfiguration;
    context: { workspaceId: string; appScope: string };
  }> {
    const normalizedDomain = this.normalizeCommittedDomain(domain);
    if (!normalizedDomain) {
      throw new NotFoundException(
        `Published configuration with domain ${domain} not found`
      );
    }
    const configurations = await this.configRepository.find();
    const matches = configurations.filter((candidate) => {
      const snapshot = candidate.release?.publishedSnapshot;
      return (
        this.hasConfirmedPublication(candidate.release) &&
        this.normalizeCommittedDomain(snapshot?.domain) === normalizedDomain &&
        snapshot.active === true
      );
    });
    if (matches.length !== 1) {
      throw new NotFoundException(
        `Published configuration with domain ${domain} not found`
      );
    }
    const config = matches[0];
    const snapshot = config.release?.publishedSnapshot;
    const publishedVersion = config.release?.publishedVersion;
    if (!snapshot || !publishedVersion) {
      throw new NotFoundException(
        `Published configuration with domain ${domain} not found`
      );
    }
    if (this.accessPolicyOf(snapshot) !== 'public') {
      throw new NotFoundException(
        `Published configuration with domain ${domain} not found`
      );
    }
    return {
      configuration: {
        id: config.id,
        ...snapshot,
        publishedVersion,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
      context: { workspaceId: config.workspaceId, appScope: config.appScope },
    };
  }

  async getConfigurationByName(
    name: string,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    this.logger.log(`[Service] Querying configuration by name: "${name}"`);
    return await this.withAuthorizedTransaction(
      context,
      async ({ configRepository }) => {
        const config = await configRepository.findOne({
          where: { name, ...this.configurationScope(context) },
        });
        if (!config) {
          this.logger.warn(
            `[Service] Configuration with name "${name}" not found`
          );
          throw new NotFoundException(
            `Configuration with name ${name} not found`
          );
        }
        this.logger.log(
          `[Service] Found configuration: ${config.name} (id: ${config.id})`
        );
        return this.normalizeConfigurationForRead(config);
      },
      false
    );
  }

  async getConfigurationByContext(
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    return await this.withAuthorizedTransaction(
      context,
      async ({ configRepository }) => {
        const config = await configRepository.findOne({
          where: this.configurationScope(context),
          order: { createdAt: 'DESC' },
        });
        if (!config) {
          throw new NotFoundException(
            'Configuration not found for the authoritative app context'
          );
        }
        return this.normalizeConfigurationForRead(config);
      },
      false
    );
  }

  async getAllConfigurations(
    context: AppConfigRequestContext,
    query: any = {}
  ): Promise<AppConfigurationEntity[]> {
    this.logger.log(
      `[Service] Querying all configurations with filter:`,
      query
    );
    return await this.withAuthorizedTransaction(
      context,
      async ({ configRepository }) => {
        const configs = await configRepository.find({
          where: { ...query, ...this.configurationScope(context) },
          order: { createdAt: 'DESC' },
        });
        this.logger.log(`[Service] Found ${configs.length} configurations`);
        return configs.map((config) =>
          this.normalizeConfigurationForRead(config)
        );
      },
      false
    );
  }

  async updateConfiguration(
    id: string,
    updateDto: UpdateAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    const { expectedRevision } = updateDto;
    const changes = this.configurationChanges(updateDto);
    this.assertExpectedRevision(expectedRevision);
    this.assertManifest(changes.manifest);
    return await this.withAuthorizedConfigurationTransaction(
      id,
      context,
      async ({ configRepository }) => {
        const config = await this.findRequiredConfiguration(
          configRepository,
          id,
          context
        );
        Object.assign(config, changes);
        config.release = this.buildUpdatedReleaseState(config);
        config.updatedAt = new Date();
        return await this.persistMutation(
          configRepository,
          config,
          expectedRevision,
          context
        );
      }
    );
  }

  async publishConfiguration(
    id: string,
    publishDto: PublishAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    this.assertExpectedRevision(publishDto.expectedRevision);
    return await this.withAuthorizedConfigurationTransaction(
      id,
      context,
      async ({ configRepository }) => {
        const config = await this.findRequiredConfiguration(
          configRepository,
          id,
          context
        );
        // Publication is the boundary at which an owner draft becomes public.
        // Validate the complete persisted draft before constructing a release so
        // an invalid draft can never replace the last known-good snapshot.
        this.assertPublishableConfiguration(config);
        const version = (config.release?.publishedVersion ?? 0) + 1;
        const snapshot = this.toSnapshot(config);
        await this.assertCommittedDomainAvailable(
          configRepository,
          config.id,
          snapshot
        );
        const revision: AppConfigReleaseRevision = {
          version,
          action: 'publish',
          releasedAt: new Date(),
          releasedByUserId: context.ownerUserId,
          releasedByProfileId: context.ownerProfileId,
          appScope: context.appScope,
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

        return await this.persistMutation(
          configRepository,
          config,
          publishDto.expectedRevision,
          context
        );
      }
    );
  }

  async rollbackConfiguration(
    id: string,
    rollbackDto: RollbackAppConfigDto,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    this.assertExpectedRevision(rollbackDto.expectedRevision);
    return await this.withAuthorizedConfigurationTransaction(
      id,
      context,
      async ({ configRepository }) => {
        const config = await this.findRequiredConfiguration(
          configRepository,
          id,
          context
        );
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
        await this.assertCommittedDomainAvailable(
          configRepository,
          config.id,
          restored
        );
        config.name = restored.name;
        config.description = restored.description || '';
        config.domain = restored.domain;
        config.landingPage = restored.landingPage as any;
        config.routes = restored.routes as any;
        config.features = restored.features as any;
        config.theme = restored.theme as any;
        config.manifest = restored.manifest;
        config.accessPolicy = this.accessPolicyOf(restored);
        config.active = restored.active;

        const version =
          Math.max(rollbackDto.version, config.release?.publishedVersion ?? 0) +
          1;
        const rollbackRevision: AppConfigReleaseRevision = {
          version,
          action: 'rollback',
          releasedAt: new Date(),
          releasedByUserId: context.ownerUserId,
          releasedByProfileId: context.ownerProfileId,
          appScope: context.appScope,
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

        return await this.persistMutation(
          configRepository,
          config,
          rollbackDto.expectedRevision,
          context
        );
      }
    );
  }

  async deleteConfiguration(
    id: string,
    context: AppConfigRequestContext
  ): Promise<{ deleted: true }> {
    await this.withAuthorizedConfigurationTransaction(
      id,
      context,
      async ({ configRepository }) => {
        const result = await configRepository.delete({
          id,
          ...this.configurationScope(context),
        });
        if (result.affected === 0) {
          throw new NotFoundException(`Configuration with ID ${id} not found`);
        }
      }
    );

    // TCP RPC responses with an undefined value are treated as a completed
    // stream without a value by Nest, which makes the gateway's firstValueFrom
    // reject after the transaction has already committed. Always acknowledge
    // a successful delete with a defined payload.
    return { deleted: true };
  }

  private configurationScope(
    context: AppConfigRequestContext
  ): Pick<
    AppConfigurationEntity,
    | 'workspaceId'
    | 'appInstanceId'
    | 'ownerUserId'
    | 'ownerProfileId'
    | 'appScope'
  > {
    return {
      workspaceId: context.workspaceId,
      appInstanceId: context.appInstanceId,
      ownerUserId: context.ownerUserId,
      ownerProfileId: context.ownerProfileId,
      appScope: context.appScope,
    };
  }

  private assertOwnerContextShape(context: AppConfigRequestContext): void {
    const requiredFields: Array<keyof AppConfigRequestContext> = [
      'ownerUserId',
      'ownerProfileId',
      'appScope',
      'workspaceId',
      'appInstanceId',
      'membershipId',
      'membershipRole',
      'membershipStatus',
    ];
    if (
      !context ||
      requiredFields.some(
        (field) =>
          typeof context[field] !== 'string' ||
          (context[field] as string).trim().length === 0
      )
    ) {
      throw new ForbiddenException(
        'A complete app configuration context is required'
      );
    }

    const persistedIds: Array<keyof AppConfigRequestContext> = [
      'ownerUserId',
      'ownerProfileId',
      'workspaceId',
      'appInstanceId',
      'membershipId',
    ];
    for (const field of persistedIds) {
      if (!this.isUuid(context[field] as string)) {
        throw new BadRequestException(`${field} must be a valid UUID`);
      }
    }
  }

  private assertContextResolutionInput(
    request: AppConfigContextResolutionRequest
  ): void {
    const requiredFields: Array<keyof AppConfigContextResolutionRequest> = [
      'ownerUserId',
      'ownerProfileId',
      'workspaceId',
      'appScope',
    ];
    if (
      requiredFields.some(
        (field) =>
          typeof request[field] !== 'string' ||
          (request[field] as string).trim().length === 0
      )
    ) {
      throw new BadRequestException(
        'owner identity, canonical workspace, and app scope are required'
      );
    }

    for (const field of [
      'ownerUserId',
      'ownerProfileId',
      'workspaceId',
    ] as const) {
      if (!this.isUuid(request[field])) {
        throw new BadRequestException(`${field} must be a valid UUID`);
      }
    }
    if (request.appScope === request.workspaceId) {
      throw new BadRequestException('appScope must differ from workspaceId');
    }
  }

  private assertActiveOwnerContextShape(
    context: AppConfigRequestContext
  ): void {
    this.assertOwnerContextShape(context);
    if (
      context.membershipRole !== 'owner' ||
      context.membershipStatus !== 'active'
    ) {
      throw new ForbiddenException('An active owner membership is required');
    }
  }

  private async withAuthorizedTransaction<T>(
    context: AppConfigRequestContext,
    operation: (repositories: {
      configRepository: Repository<AppConfigurationEntity>;
      appInstanceRepository: Repository<AppInstanceEntity>;
      membershipRepository: Repository<AppMembershipEntity>;
    }) => Promise<T>,
    lockRows = true
  ): Promise<T> {
    this.assertActiveOwnerContextShape(context);

    return await this.configRepository.manager.transaction(async (manager) => {
      const repositories = {
        configRepository: manager.getRepository(AppConfigurationEntity),
        appInstanceRepository: manager.getRepository(AppInstanceEntity),
        membershipRepository: manager.getRepository(AppMembershipEntity),
      };
      await this.ensureActiveAppInstance(
        context,
        repositories.appInstanceRepository,
        false,
        lockRows
      );
      await this.ensureActiveOwnerMembership(
        context,
        repositories.membershipRepository,
        false,
        lockRows
      );
      return await operation(repositories);
    });
  }

  private async withAuthorizedConfigurationTransaction<T>(
    id: string,
    context: AppConfigRequestContext,
    operation: (repositories: {
      configRepository: Repository<AppConfigurationEntity>;
      appInstanceRepository: Repository<AppInstanceEntity>;
      membershipRepository: Repository<AppMembershipEntity>;
    }) => Promise<T>,
    lockRows = true
  ): Promise<T> {
    if (!this.isUuid(id)) {
      throw new BadRequestException('Configuration ID must be a valid UUID');
    }

    return await this.withAuthorizedTransaction(context, operation, lockRows);
  }

  private async ensureActiveAppInstance(
    context: AppConfigRequestContext,
    repository: Repository<AppInstanceEntity>,
    allowBootstrap: boolean,
    lockRows: boolean,
    adoptExistingId = false
  ): Promise<AppInstanceEntity> {
    const appInstance = await repository.findOne({
      where: { workspaceId: context.workspaceId },
      ...(lockRows ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    if (!appInstance) {
      if (!allowBootstrap) {
        throw new ForbiddenException(
          'App instance does not belong to the workspace'
        );
      }

      if (adoptExistingId) {
        const requested = await repository.findOne({
          where: { id: context.appInstanceId },
          ...(lockRows ? { lock: { mode: 'pessimistic_write' as const } } : {}),
        });
        if (requested) {
          if (requested.workspaceId !== context.workspaceId) {
            throw new ForbiddenException(
              'Requested app instance belongs to another workspace'
            );
          }
          return this.assertAppInstanceMatch(requested, context);
        }
      }

      const created = new AppInstanceEntity();
      created.id = context.appInstanceId;
      created.workspaceId = context.workspaceId;
      created.appScope = context.appScope;
      created.ownerUserId = context.ownerUserId;
      created.ownerProfileId = context.ownerProfileId;
      created.status = 'active';
      await this.insertIgnoringConflicts(
        repository,
        AppInstanceEntity,
        created
      );
      const authoritative = await repository.findOne({
        where: { workspaceId: context.workspaceId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!authoritative) {
        throw new ConflictException(
          'The app instance could not be read after insertion'
        );
      }
      return this.assertAppInstanceMatch(
        authoritative,
        context,
        adoptExistingId
      );
    }

    if (adoptExistingId && appInstance.id !== context.appInstanceId) {
      const requested = await repository.findOne({
        where: { id: context.appInstanceId },
        ...(lockRows ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      });
      if (requested && requested.workspaceId !== context.workspaceId) {
        throw new ForbiddenException(
          'Requested app instance belongs to another workspace'
        );
      }
      return this.assertAppInstanceMatch(appInstance, context, true);
    }

    return this.assertAppInstanceMatch(appInstance, context);
  }

  private async ensureActiveOwnerMembership(
    context: AppConfigRequestContext,
    repository: Repository<AppMembershipEntity>,
    allowBootstrap: boolean,
    lockRows: boolean
  ): Promise<AppMembershipEntity> {
    const membership = await repository.findOne({
      where: {
        appInstanceId: context.appInstanceId,
        profileId: context.ownerProfileId,
      },
      ...(lockRows ? { lock: { mode: 'pessimistic_write' as const } } : {}),
    });

    if (!membership) {
      if (!allowBootstrap) {
        throw new ForbiddenException(
          'Owner membership does not belong to the app instance'
        );
      }

      const created = new AppMembershipEntity();
      created.id = context.membershipId;
      created.workspaceId = context.workspaceId;
      created.appInstanceId = context.appInstanceId;
      created.appScope = context.appScope;
      created.userId = context.ownerUserId;
      created.profileId = context.ownerProfileId;
      created.role = 'owner';
      created.status = 'active';
      await this.insertIgnoringConflicts(
        repository,
        AppMembershipEntity,
        created
      );
      const authoritative = await repository.findOne({
        where: {
          appInstanceId: context.appInstanceId,
          profileId: context.ownerProfileId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!authoritative) {
        const requested = await repository.findOne({
          where: { id: context.membershipId },
          ...(lockRows ? { lock: { mode: 'pessimistic_write' as const } } : {}),
        });
        if (requested) {
          throw new ConflictException(
            'Requested owner membership ID is already used by another membership'
          );
        }
        throw new ConflictException(
          'The owner membership could not be read after insertion'
        );
      }
      return this.assertMembershipMatch(authoritative, context);
    }

    if (membership.id !== context.membershipId) {
      const requested = await repository.findOne({
        where: { id: context.membershipId },
        ...(lockRows ? { lock: { mode: 'pessimistic_write' as const } } : {}),
      });
      if (requested && requested.id !== membership.id) {
        throw new ConflictException(
          'Requested owner membership ID is already used by another membership'
        );
      }

      return this.assertMembershipMatch(membership, context, true);
    }

    return this.assertMembershipMatch(membership, context);
  }

  private assertAppInstanceMatch(
    appInstance: AppInstanceEntity,
    context: AppConfigRequestContext,
    allowIdMismatch = false
  ): AppInstanceEntity {
    if (
      (!allowIdMismatch && appInstance.id !== context.appInstanceId) ||
      appInstance.workspaceId !== context.workspaceId ||
      appInstance.appScope !== context.appScope ||
      appInstance.ownerUserId !== context.ownerUserId ||
      appInstance.ownerProfileId !== context.ownerProfileId
    ) {
      throw new ForbiddenException(
        'App instance does not match the request context'
      );
    }
    if (appInstance.status !== 'active') {
      throw new ForbiddenException('App instance is not active');
    }

    return appInstance;
  }

  private assertMembershipMatch(
    membership: AppMembershipEntity,
    context: AppConfigRequestContext,
    allowIdMismatch = false
  ): AppMembershipEntity {
    if (
      (!allowIdMismatch && membership.id !== context.membershipId) ||
      membership.workspaceId !== context.workspaceId ||
      membership.appInstanceId !== context.appInstanceId ||
      membership.appScope !== context.appScope ||
      membership.userId !== context.ownerUserId ||
      membership.profileId !== context.ownerProfileId ||
      membership.role !== 'owner'
    ) {
      throw new ForbiddenException(
        'Owner membership does not match the request context'
      );
    }
    if (membership.status !== 'active') {
      throw new ForbiddenException('Owner membership is not active');
    }

    return membership;
  }

  private assertConfigurationScope(
    config: AppConfigurationEntity,
    context: AppConfigRequestContext
  ): void {
    const scope = this.configurationScope(context);
    if (
      Object.entries(scope).some(
        ([field, value]) => config[field as keyof typeof scope] !== value
      )
    ) {
      throw new ForbiddenException(
        'Configuration does not belong to the request context'
      );
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

  private normalizeConfigurationForRead(
    config: AppConfigurationEntity
  ): AppConfigurationEntity {
    if (!this.hasConfirmedPublication(config.release)) {
      config.release = this.createInitialReleaseState(config);
    }
    if (!Number.isInteger(config.revision) || config.revision < 1) {
      config.revision = 1;
    }
    return config;
  }

  private hasConfirmedPublication(
    release: AppConfigReleaseState | null | undefined
  ): boolean {
    if (
      !release ||
      (release.status !== 'published' &&
        release.status !== 'changes-pending') ||
      !Number.isInteger(release.publishedVersion) ||
      (release.publishedVersion as number) < 1 ||
      !release.publishedSnapshot ||
      !Array.isArray(release.history) ||
      release.history.length === 0
    ) {
      return false;
    }

    return release.history.some(
      (revision) =>
        (revision.action === 'publish' || revision.action === 'rollback') &&
        revision.version === release.publishedVersion &&
        this.snapshotsEqual(
          revision.snapshot,
          release.publishedSnapshot as AppConfigurationSnapshot
        )
    );
  }

  private async persistMutation(
    configRepository: Repository<AppConfigurationEntity>,
    config: AppConfigurationEntity,
    expectedRevision: number,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    const nextRevision = expectedRevision + 1;
    const result = await configRepository.update(
      {
        id: config.id,
        ...this.configurationScope(context),
        revision: expectedRevision,
      },
      {
        name: config.name,
        description: config.description,
        domain: config.domain,
        landingPage: config.landingPage,
        routes: config.routes,
        features: config.features,
        theme: config.theme,
        manifest: config.manifest,
        accessPolicy: config.accessPolicy,
        active: config.active,
        release: config.release,
        revision: nextRevision,
        updatedAt: config.updatedAt,
      }
    );
    if (result.affected !== 1) {
      throw new ConflictException(
        'Configuration changed elsewhere. Reload the latest revision before retrying.'
      );
    }

    config.revision = nextRevision;
    return config;
  }

  private createConfigurationEntity(
    createDto: CreateAppConfigDto,
    context: AppConfigRequestContext
  ): AppConfigurationEntity {
    const entity = new AppConfigurationEntity();
    entity.name = createDto.name;
    entity.workspaceId = context.workspaceId;
    entity.appInstanceId = context.appInstanceId;
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
    entity.accessPolicy = createDto.accessPolicy ?? 'public';
    entity.active = createDto.active ?? true;
    entity.revision = 1;
    entity.release = this.createInitialReleaseState(entity);
    return entity;
  }

  private seedConfigurationChanges(
    seedDto: CreateAppConfigDto
  ): Record<string, unknown> {
    return {
      name: seedDto.name,
      description: seedDto.description || '',
      domain: seedDto.domain,
      landingPage: seedDto.landingPage as any,
      routes: seedDto.routes as any,
      features: seedDto.features as any,
      theme: seedDto.theme as any,
      manifest: seedDto.manifest,
      accessPolicy: seedDto.accessPolicy ?? 'public',
      active: seedDto.active ?? true,
    };
  }

  private configurationChanges(
    updateDto: UpdateAppConfigDto
  ): Record<string, unknown> {
    const changes: Record<string, unknown> = {};
    const fields = [
      'name',
      'description',
      'domain',
      'landingPage',
      'routes',
      'features',
      'theme',
      'manifest',
      'accessPolicy',
      'active',
    ] as const;

    for (const field of fields) {
      if (Object.prototype.hasOwnProperty.call(updateDto, field)) {
        changes[field] = updateDto[field];
      }
    }

    return changes;
  }

  private async insertIgnoringConflicts(
    repository: Repository<any>,
    entityType: new () => any,
    entity: any
  ): Promise<void> {
    await repository
      .createQueryBuilder()
      .insert()
      .into(entityType)
      .values(entity)
      .orIgnore()
      .execute();
  }

  private async findConfiguration(
    repository: Repository<AppConfigurationEntity>,
    id: string,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity | null> {
    return await repository.findOne({
      where: { id, ...this.configurationScope(context) },
    });
  }

  private async findRequiredConfiguration(
    repository: Repository<AppConfigurationEntity>,
    id: string,
    context: AppConfigRequestContext
  ): Promise<AppConfigurationEntity> {
    const config = await this.findConfiguration(repository, id, context);
    if (!config) {
      throw new NotFoundException(`Configuration with ID ${id} not found`);
    }
    return config;
  }

  private assertConfigurationEquivalent(
    existing: AppConfigurationEntity,
    requested: AppConfigurationEntity
  ): void {
    if (this.configurationMatchesSeed(existing, requested)) {
      return;
    }

    throw new ConflictException(
      `Configuration ${requested.name} already exists with different values`
    );
  }

  private configurationMatchesSeed(
    existing: AppConfigurationEntity,
    requested: AppConfigurationEntity
  ): boolean {
    const fields: Array<keyof AppConfigurationEntity> = [
      'name',
      'workspaceId',
      'appInstanceId',
      'ownerUserId',
      'ownerProfileId',
      'appScope',
      'description',
      'domain',
      'landingPage',
      'routes',
      'features',
      'theme',
      'manifest',
      'accessPolicy',
      'active',
    ];
    return !fields.some(
      (field) =>
        JSON.stringify(
          field === 'accessPolicy'
            ? existing[field] ?? 'public'
            : existing[field] ?? null
        ) !==
        JSON.stringify(
          field === 'accessPolicy'
            ? requested[field] ?? 'public'
            : requested[field] ?? null
        )
    );
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    );
  }

  private assertExpectedRevision(
    expectedRevision: unknown
  ): asserts expectedRevision is number {
    if (
      !Number.isInteger(expectedRevision) ||
      (expectedRevision as number) < 1
    ) {
      throw new BadRequestException(
        'expectedRevision must be a positive integer'
      );
    }
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
      accessPolicy: config.accessPolicy ?? 'public',
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
    if (manifest === undefined) {
      return;
    }

    if (!isConfigurablePluginManifest(manifest)) {
      throw new BadRequestException(
        'manifest must use the supported configurable manifest schema'
      );
    }

    const errors = validateConfigurableCapabilityManifest(manifest);
    if (errors.length) {
      throw new BadRequestException(errors.join('; '));
    }
  }

  /**
   * Serialize claims for a domain within the transaction and reject any
   * confirmed claim owned by another configuration. The advisory lock keeps
   * concurrent publishers from both observing the domain as available.
   */
  private async assertCommittedDomainAvailable(
    configRepository: Repository<AppConfigurationEntity>,
    configurationId: string,
    snapshot: AppConfigurationSnapshot
  ): Promise<void> {
    const domain = this.normalizeCommittedDomain(snapshot.domain);
    if (!domain) return;

    await configRepository.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [domain]
    );
    const configurations = await configRepository.find();
    const conflict = configurations.find((candidate) => {
      const committed = candidate.release?.publishedSnapshot;
      return (
        candidate.id !== configurationId &&
        this.hasConfirmedPublication(candidate.release) &&
        committed?.active === true &&
        this.normalizeCommittedDomain(committed.domain) === domain
      );
    });
    if (conflict) {
      throw new ConflictException(
        `The committed domain ${snapshot.domain} is already claimed by another published configuration`
      );
    }
  }

  private normalizeCommittedDomain(domain: unknown): string | undefined {
    if (typeof domain !== 'string') return undefined;
    const normalized = domain.trim().toLowerCase().replace(/\.+$/, '');
    return normalized || undefined;
  }

  private assertPublishableConfiguration(config: AppConfigurationEntity): void {
    const errors: string[] = [];
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value);
    const requiredString = (value: unknown, field: string) => {
      if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${field} must be a non-empty string`);
      }
    };

    requiredString(config.name, 'name');
    if (
      config.domain !== undefined &&
      config.domain !== null &&
      typeof config.domain !== 'string'
    ) {
      errors.push('domain must be a string when supplied');
    }

    const landingPage = config.landingPage as unknown;
    if (!isRecord(landingPage)) {
      errors.push('landingPage must be an object');
    } else {
      if (
        landingPage['layout'] !== 'single-column' &&
        landingPage['layout'] !== 'sidebar' &&
        landingPage['layout'] !== 'wide'
      ) {
        errors.push('landingPage.layout is unsupported');
      }
      if (!Array.isArray(landingPage['sections'])) {
        errors.push('landingPage.sections must be an array');
      } else {
        const sectionTypes = new Set([
          'hero',
          'features',
          'content',
          'grid',
          'cta',
          'footer',
        ]);
        landingPage['sections'].forEach((section, index) => {
          if (!isRecord(section)) {
            errors.push(`landingPage.sections[${index}] must be an object`);
            return;
          }
          requiredString(section['id'], `landingPage.sections[${index}].id`);
          const sectionType = section['type'];
          if (
            typeof sectionType !== 'string' ||
            !sectionTypes.has(sectionType)
          ) {
            errors.push(`landingPage.sections[${index}].type is unsupported`);
          }
          if (
            !Number.isInteger(section['order']) ||
            (section['order'] as number) < 0
          ) {
            errors.push(
              `landingPage.sections[${index}].order must be non-negative`
            );
          }
          if (typeof section['visible'] !== 'boolean') {
            errors.push(
              `landingPage.sections[${index}].visible must be boolean`
            );
          }
        });
      }
    }

    if (!Array.isArray(config.routes)) {
      errors.push('routes must be an array');
    } else {
      config.routes.forEach((route, index) => {
        if (!isRecord(route)) {
          errors.push(`routes[${index}] must be an object`);
          return;
        }
        for (const field of ['id', 'path', 'name'] as const) {
          requiredString(route[field], `routes[${index}].${field}`);
        }
        if (
          route['componentType'] !== 'custom' &&
          route['componentType'] !== 'feature' &&
          route['componentType'] !== 'landing'
        ) {
          errors.push(`routes[${index}].componentType is unsupported`);
        }
        if (
          !Number.isInteger(route['order']) ||
          (route['order'] as number) < 0
        ) {
          errors.push(`routes[${index}].order must be non-negative`);
        }
        if (typeof route['showInNav'] !== 'boolean') {
          errors.push(`routes[${index}].showInNav must be boolean`);
        }
      });
    }

    if (!isRecord(config.features)) errors.push('features must be an object');
    if (!isRecord(config.theme)) errors.push('theme must be an object');
    if (
      config.accessPolicy !== undefined &&
      !APP_ACCESS_POLICIES.includes(config.accessPolicy as AppAccessPolicy)
    ) {
      errors.push('accessPolicy is unsupported');
    }
    if (typeof config.active !== 'boolean')
      errors.push('active must be boolean');
    this.assertManifest(config.manifest);

    if (errors.length) {
      throw new BadRequestException(
        `Configuration draft is not publishable: ${errors.join('; ')}`
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
