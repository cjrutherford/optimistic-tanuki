import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import AssetEntity from '../entities/asset.entity';
import {
  AssetHandle,
  AssetListQuery,
  CreateAssetDto,
  StorageStrategy,
  AssetType,
  AssetAudienceRestriction,
} from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';
import {
  GuardianAssetAuthorizationService,
  GuardianAssetActor,
} from './guardian-asset-authorization.service';
import { GuardianAssetActivity } from '../entities/guardian-asset-activity.entity';
import { LessThan, IsNull } from 'typeorm';
import { OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import {
  STORAGE_ADAPTERS,
  StorageAdapter,
  FileValidationService,
  VirusScanService,
  AuthenticatedMediaReadOptions,
} from '@optimistic-tanuki/storage';
import * as fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { randomUUID } from 'node:crypto';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private cleanupTimer?: NodeJS.Timeout;
  private auditCleanupTimer?: NodeJS.Timeout;
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(AssetEntity))
    private readonly assetRepo: Repository<AssetEntity>,
    @Inject(STORAGE_ADAPTERS)
    private readonly storageAdapter: StorageAdapter,
    private readonly fileValidationService: FileValidationService,
    private readonly virusScanService: VirusScanService,
    @Optional()
    private readonly guardianAssetAuthorization?: GuardianAssetAuthorizationService
  ) {}

  onModuleInit(): void {
    this.cleanupTimer = setInterval(
      () =>
        void this.cleanupPendingAssets().catch(() =>
          this.l.error('Asset lifecycle cleanup failed')
        ),
      60_000
    );
    void this.cleanupExpiredGuardianActivity().catch(() =>
      this.l.error('Guardian asset audit cleanup failed')
    );
    this.auditCleanupTimer = setInterval(
      () =>
        void this.cleanupExpiredGuardianActivity().catch(() =>
          this.l.error('Guardian asset audit cleanup failed')
        ),
      24 * 60 * 60 * 1000
    );
    this.auditCleanupTimer.unref?.();
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.auditCleanupTimer) clearInterval(this.auditCleanupTimer);
  }

  async createGuardianAsset(
    input: GuardianAssetActor & { asset: CreateAssetDto }
  ): Promise<AssetEntity> {
    const { asset: rawAsset } = input;
    const profile = await this.assertGuardianAccess(input, 'content.manage');
    if (
      !rawAsset ||
      rawAsset.profileId !== input.targetProfileId ||
      rawAsset.sourcePath ||
      rawAsset.content === undefined ||
      rawAsset.content === null ||
      rawAsset.content === '' ||
      (Buffer.isBuffer(rawAsset.content) && rawAsset.content.length === 0)
    ) {
      throw this.guardianDenied('Invalid guardian asset upload');
    }
    const stagedRestriction: AssetAudienceRestriction = {
      type: 'guardian-staged',
      profileId: input.targetProfileId,
      appId: input.appId,
    };
    let data = {
      ...rawAsset,
      audienceRestrictions: [stagedRestriction],
    } as CreateAssetDto;
    data.name = data.name.replace(/\s+/g, '_');
    const prepared = await this.prepareAssetPayload(data);
    data = prepared.data;
    if (prepared.validation.sanitizedFilename)
      data.name = prepared.validation.sanitizedFilename;
    if (!prepared.scanResult.isClean)
      throw new RpcException({
        statusCode: 400,
        message: 'File failed virus scan',
      });

    const reservedId = randomUUID();
    data.name = this.buildPersistedFilename(data.name, data.fileExtension);
    data.id = reservedId;
    const reservationPath = this.storageAdapter.reservationPath?.(data);
    if (!reservationPath)
      throw new RpcException({
        statusCode: 503,
        message: 'Storage adapter cannot reserve asset paths',
      });
    const asset = this.assetRepo.create({
      id: reservedId,
      name: data.name,
      storagePath: reservationPath,
      profileId: input.targetProfileId,
      type: data.type,
      storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
      audienceCommunityIds: [],
      audienceRestrictions: [stagedRestriction],
      originKind: 'guardian-staged',
      originProfileId: input.targetProfileId,
      originAppId: input.appId,
      lifecycleState: 'pending-upload',
      lifecycleLeaseUntil: new Date(Date.now() + 15 * 60_000),
    } as Partial<AssetEntity>);
    const reserved = await this.assetRepo.save(asset);
    let stored: AssetEntity | undefined;
    try {
      return await this.assetRepo.manager.transaction(async (manager) => {
        const repo = manager.getRepository(AssetEntity);
        const current = await repo.findOne({
          where: { id: reserved.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !current ||
          current.lifecycleState !== 'pending-upload' ||
          !current.lifecycleLeaseUntil ||
          current.lifecycleLeaseUntil <= new Date()
        )
          throw this.guardianDenied('Guardian upload is no longer active');
        // Hold the reservation row lock during the bounded storage write. The
        // cleanup worker uses SKIP LOCKED, so it cannot delete an in-flight
        // upload and a late writer cannot recreate bytes after cleanup.
        data.id = reserved.id;
        stored = (await this.storageAdapter.create(data)) as AssetEntity;
        if (
          !current.lifecycleLeaseUntil ||
          current.lifecycleLeaseUntil <= new Date()
        ) {
          throw this.guardianDenied(
            'Guardian upload reservation expired during storage write'
          );
        }
        await this.assertGuardianAccess(input, 'content.manage');
        Object.assign(current, stored, {
          lifecycleState: 'active',
          lifecycleLeaseUntil: null,
          audienceRestrictions: [stagedRestriction],
          originKind: 'guardian-staged',
          originProfileId: input.targetProfileId,
          originAppId: input.appId,
        });
        const active = await repo.save(current);
        await manager
          .getRepository(GuardianAssetActivity)
          .save(this.audit(input, active, 'upload', profile.userId));
        return active;
      });
    } catch (error) {
      if (stored) {
        try {
          await this.storageAdapter.remove(stored);
          await this.assetRepo.delete({
            id: reserved.id,
            lifecycleState: 'pending-upload',
          });
        } catch {
          // The inaccessible reservation is retained for the lifecycle worker.
        }
      }
      throw error;
    }
  }

  async listGuardianAssets(
    input: GuardianAssetActor & { type?: AssetType }
  ): Promise<AssetEntity[]> {
    return this.assetRepo.manager.transaction(async (manager) => {
      const profile = await this.assertGuardianAccess(input, 'content.view');
      const rows = await manager.getRepository(AssetEntity).find({
        where: {
          profileId: input.targetProfileId,
          lifecycleState: 'active',
          ...(input.type ? { type: input.type } : {}),
        },
        order: { id: 'DESC' },
        take: 48,
      });
      await this.assertGuardianAccess(input, 'content.view');
      await manager
        .getRepository(GuardianAssetActivity)
        .save(
          this.audit(input, { id: '*' } as AssetEntity, 'list', profile.userId)
        );
      return rows;
    });
  }

  async deleteGuardianAsset(
    input: GuardianAssetActor & { id: string }
  ): Promise<AssetEntity> {
    const initial = await this.retrieveAsset({ id: input.id });
    if (
      initial.profileId !== input.targetProfileId ||
      initial.lifecycleState !== 'active'
    )
      throw this.guardianDenied('Asset not found');
    await this.assetRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AssetEntity);
      const current = await repo.findOne({
        where: { id: input.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !current ||
        current.profileId !== input.targetProfileId ||
        current.lifecycleState !== 'active'
      )
        throw this.guardianDenied('Asset not found');
      const profile = await this.assertGuardianAccess(input, 'content.manage');
      current.lifecycleState = 'pending-delete';
      current.lifecycleLeaseUntil = null;
      await repo.save(current);
      await manager
        .getRepository(GuardianAssetActivity)
        .save(this.audit(input, current, 'delete', profile.userId));
    });
    await this.finishPendingDelete(input.id);
    return initial;
  }

  async authorizeGuardianRead(
    input: GuardianAssetActor & { id: string }
  ): Promise<void> {
    await this.assetRepo.manager.transaction(async (manager) => {
      const asset = await manager
        .getRepository(AssetEntity)
        .findOne({ where: { id: input.id, lifecycleState: 'active' } });
      if (!asset || asset.profileId !== input.targetProfileId)
        throw this.guardianDenied('Asset not found');
      const profile = await this.assertGuardianAccess(input, 'content.view');
      await manager
        .getRepository(GuardianAssetActivity)
        .save(this.audit(input, asset, 'read', profile.userId));
    });
  }

  async cleanupExpiredGuardianActivity(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const result = await this.assetRepo.manager
      .getRepository(GuardianAssetActivity)
      .delete({ createdAt: LessThan(cutoff) });
    return result.affected ?? 0;
  }

  async cleanupPendingAssets(): Promise<number> {
    let completed = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      let failedId: string | undefined;
      let failedState: AssetEntity['lifecycleState'] | undefined;
      try {
        const removed = await this.assetRepo.manager.transaction(
          async (manager) => {
            const repo = manager.getRepository(AssetEntity);
            const candidate = await repo
              .createQueryBuilder('asset')
              .setLock('pessimistic_write')
              .setOnLocked('skip_locked')
              .where(
                "(asset.lifecycleState = 'pending-delete' AND (asset.lifecycleRetryAfter IS NULL OR asset.lifecycleRetryAfter <= :now)) OR (asset.lifecycleState = 'pending-upload' AND asset.lifecycleLeaseUntil < :now)",
                { now: new Date() }
              )
              .orderBy('asset.lifecycleRetryAfter', 'ASC', 'NULLS FIRST')
              .getOne();
            if (!candidate) return false;
            failedId = candidate.id;
            failedState = candidate.lifecycleState;
            if (candidate.lifecycleState === 'pending-upload') {
              candidate.lifecycleState = 'pending-delete';
              candidate.lifecycleLeaseUntil = null;
              await repo.save(candidate);
            }
            await this.removeStoredFileIdempotently(candidate);
            await repo.delete({
              id: candidate.id,
              lifecycleState: 'pending-delete',
            });
            return true;
          }
        );
        if (!removed) break;
        completed++;
      } catch {
        if (failedId) {
          const patch: Partial<AssetEntity> =
            failedState === 'pending-upload'
              ? {
                  lifecycleState: 'pending-delete',
                  lifecycleLeaseUntil: null,
                  lifecycleRetryAfter: new Date(Date.now() + 15 * 60_000),
                }
              : { lifecycleRetryAfter: new Date(Date.now() + 15 * 60_000) };
          const criteria = { id: failedId, lifecycleState: failedState };
          const backedOff = await this.assetRepo
            .update(criteria, patch)
            .catch(() => undefined);
          if (!backedOff?.affected) break;
        } else {
          break;
        }
        this.l.error('Pending asset cleanup will retry');
      }
    }
    return completed;
  }

  private async finishPendingDelete(id: string): Promise<boolean> {
    return this.assetRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(AssetEntity);
      const asset = await repo.findOne({
        where: { id, lifecycleState: 'pending-delete' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!asset) return false;
      await this.removeStoredFileIdempotently(asset);
      await repo.delete({ id: asset.id, lifecycleState: 'pending-delete' });
      return true;
    });
  }

  private async removeStoredFileIdempotently(
    asset: AssetEntity
  ): Promise<void> {
    try {
      await this.storageAdapter.remove(asset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    }
  }

  private async assertGuardianAccess(
    input: GuardianAssetActor,
    operation: 'content.view' | 'content.manage'
  ) {
    if (!this.guardianAssetAuthorization)
      throw new RpcException({
        statusCode: 503,
        message: 'Guardian asset authorization unavailable',
      });
    return this.guardianAssetAuthorization.assertAccess({
      ...input,
      operation,
    });
  }

  private audit(
    input: GuardianAssetActor,
    asset: AssetEntity,
    operation: 'upload' | 'list' | 'read' | 'delete',
    dependentUserId?: string
  ): Partial<GuardianAssetActivity> {
    return {
      actorUserId: input.actorUserId,
      dependentUserId: dependentUserId ?? '',
      profileId: input.targetProfileId,
      assetId: asset.id,
      appId: input.appId,
      operation,
      changedFieldNames: [],
    };
  }

  private guardianDenied(message: string): RpcException {
    return new RpcException({
      statusCode: 403,
      code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
      message,
    });
  }

  async createAsset(data: CreateAssetDto): Promise<AssetEntity> {
    try {
      this.assertGenericAssetInput(data);
      // Asset IDs are server-owned. Assign one before storage so the database
      // row and encrypted bytes share an immutable identifier.
      data = { ...data, id: randomUUID() };
      // Sanitize filename
      data.name = data.name.replace(/\s+/g, '_');

      this.l.log('Creating asset:', data.name, data.type);

      if (data.content || data.sourcePath) {
        const prepared = await this.prepareAssetPayload(data);
        data = prepared.data;

        if (prepared.validation.sanitizedFilename) {
          data.name = prepared.validation.sanitizedFilename;
        }

        if (!prepared.scanResult.isClean) {
          this.l.error('Virus scan failed:', prepared.scanResult.threats);
          throw new RpcException({
            statusCode: 400,
            message: 'File failed virus scan',
            threats: prepared.scanResult.threats,
          });
        }

        this.l.log(
          `File validated and scanned: ${data.name} (${prepared.scanResult.scanner})`
        );
      }

      const persistedName = this.buildPersistedFilename(
        data.name,
        data.fileExtension
      );
      const entityAsset: Partial<AssetEntity> = {
        id: data.id,
        name: persistedName,
        profileId: data.profileId,
        type: data.type,
        storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
        audienceCommunityIds: data.communityId ? [data.communityId] : [],
        audienceRestrictions: data.audienceRestrictions ?? [],
        originKind: 'ordinary',
        originProfileId: null,
        originAppId: null,
      };
      const asset = this.assetRepo.create(entityAsset);
      const persistedAsset = await this.storageAdapter.create(data);
      const newAsset = await this.assetRepo.save({
        ...asset,
        ...persistedAsset,
      } as AssetEntity);
      return newAsset;
    } catch (error) {
      this.l.error('Error creating asset:', error);
      if (error instanceof RpcException) {
        throw error;
      }
      if (error instanceof PayloadTooLargeException) {
        throw new RpcException({ statusCode: 413, message: error.message });
      }
      if (error instanceof BadRequestException) {
        throw new RpcException({ statusCode: 400, message: error.message });
      }
      throw new RpcException('Failed to create asset');
    }
  }

  private assertGenericAssetInput(data: CreateAssetDto): void {
    const reserved = new Set([
      'originKind',
      'originProfileId',
      'originAppId',
      'guardianStaged',
      'publicationGrant',
      'resourceType',
      'resourceId',
    ]);
    if (
      !data ||
      Object.keys(data as object).some((key) => reserved.has(key)) ||
      !Array.isArray(data.audienceRestrictions ?? []) ||
      data.audienceRestrictions?.some(
        (restriction) => !this.isGenericRestrictionValid(restriction, reserved)
      )
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Reserved guardian asset metadata is not accepted',
      });
    }
  }

  private async prepareAssetPayload(data: CreateAssetDto): Promise<{
    data: CreateAssetDto;
    validation: ReturnType<FileValidationService['validateFile']>;
    scanResult: Awaited<ReturnType<VirusScanService['scanFile']>>;
  }> {
    const maxBytes = this.fileValidationService.getMaxSizeBytes(data.type);
    const contentBuffer =
      data.content !== undefined
        ? this.normalizeContentBuffer(data.content, maxBytes)
        : await this.readSourceFile(data.sourcePath, maxBytes);
    data.content = contentBuffer;
    data.sourcePath = undefined;

    const mimeType = this.getMimeTypeFromExtension(data.fileExtension || 'png');
    const validationFilename = this.buildPersistedFilename(
      data.name,
      data.fileExtension
    );
    const validation = this.fileValidationService.validateFile(
      validationFilename,
      mimeType,
      contentBuffer.length,
      data.type
    );

    if (!validation.isValid) {
      this.l.error('File validation failed:', validation.errors);
      throw new RpcException({
        statusCode: 400,
        message: 'File validation failed',
        errors: validation.errors,
      });
    }

    const scanResult = await this.virusScanService.scanFile(
      contentBuffer,
      validationFilename
    );

    return {
      data,
      validation,
      scanResult,
    };
  }

  private async readSourceFile(
    sourcePath: string | undefined,
    maxBytes: number
  ): Promise<Buffer> {
    if (!sourcePath) {
      throw new BadRequestException('Asset content or sourcePath is required');
    }
    const handle = await fs.open(
      sourcePath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
    );
    try {
      const initial = await handle.stat();
      if (!initial.isFile()) {
        throw new BadRequestException('Upload source must be a regular file');
      }
      if (initial.size > maxBytes) {
        throw new PayloadTooLargeException(
          `Upload exceeds the ${Math.floor(
            maxBytes / (1024 * 1024)
          )} MiB supported limit.`
        );
      }
      const stream = handle.createReadStream({
        autoClose: false,
        highWaterMark: 64 * 1024,
      });
      const chunks: Buffer[] = [];
      let total = 0;
      for await (const rawChunk of stream) {
        const chunk = Buffer.isBuffer(rawChunk)
          ? rawChunk
          : Buffer.from(rawChunk as Uint8Array);
        total += chunk.length;
        if (total > maxBytes) {
          stream.destroy();
          throw new PayloadTooLargeException(
            `Upload exceeds the ${Math.floor(
              maxBytes / (1024 * 1024)
            )} MiB supported limit.`
          );
        }
        chunks.push(chunk);
      }
      const final = await handle.stat();
      if (
        total !== initial.size ||
        final.size !== initial.size ||
        final.mtimeMs !== initial.mtimeMs
      ) {
        throw new BadRequestException('Upload source changed while being read');
      }
      return Buffer.concat(chunks, total);
    } finally {
      await handle.close();
    }
  }

  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      // Documents
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      txt: 'text/plain',
      md: 'text/markdown',
      // Video
      mp4: 'video/mp4',
      mpeg: 'video/mpeg',
      mov: 'video/quicktime',
      webm: 'video/webm',
      mkv: 'video/x-matroska',
      avi: 'video/x-msvideo',
      wmv: 'video/x-ms-wmv',
      flv: 'video/x-flv',
      m4v: 'video/mp4',
      ts: 'video/mp2t',
      m3u8: 'application/vnd.apple.mpegurl',
      // Audio
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg',
    };

    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  private normalizeContentBuffer(
    content: Buffer | string | unknown,
    maxBytes: number
  ): Buffer {
    if (Buffer.isBuffer(content)) {
      this.assertBufferLimit(content.length, maxBytes);
      return content;
    }

    if (
      typeof content === 'object' &&
      content !== null &&
      'type' in content &&
      'data' in content &&
      (content as { type?: unknown }).type === 'Buffer' &&
      Array.isArray((content as { data?: unknown }).data)
    ) {
      this.assertBufferLimit(
        (content as { data: number[] }).data.length,
        maxBytes
      );
      return Buffer.from((content as { data: number[] }).data);
    }

    if (typeof content === 'string') {
      const comma = content.startsWith('data:') ? content.indexOf(',') : -1;
      const base64Data = comma >= 0 ? content.slice(comma + 1) : content;
      const estimatedBytes =
        Math.floor((base64Data.length * 3) / 4) -
        (base64Data.endsWith('==') ? 2 : base64Data.endsWith('=') ? 1 : 0);
      this.assertBufferLimit(estimatedBytes, maxBytes);
      const buffer = Buffer.from(base64Data, 'base64');
      this.assertBufferLimit(buffer.length, maxBytes);
      return buffer;
    }

    throw new BadRequestException('Invalid asset content payload');
  }

  private assertBufferLimit(actualBytes: number, maxBytes: number): void {
    if (actualBytes > maxBytes) {
      throw new PayloadTooLargeException(
        `Upload exceeds the ${Math.floor(
          maxBytes / (1024 * 1024)
        )} MiB supported limit.`
      );
    }
  }

  private buildPersistedFilename(name: string, fileExtension?: string): string {
    if (!fileExtension) {
      return name;
    }

    const normalizedExtension = fileExtension.startsWith('.')
      ? fileExtension.slice(1)
      : fileExtension;

    return name.toLowerCase().endsWith(`.${normalizedExtension.toLowerCase()}`)
      ? name
      : `${name}.${normalizedExtension}`;
  }

  async removeAsset(data: AssetHandle): Promise<AssetEntity> {
    this.l.log('Removing asset with data:', data);
    const asset = await this.assetRepo.findOneBy({
      id: data.id,
      lifecycleState: 'active',
    });
    if (!asset) {
      this.l.error(`Asset with id ${data.id} not found`);
      throw new RpcException(`Asset with id ${data.id} not found`);
    }
    await this.storageAdapter.remove(asset);
    return await this.assetRepo.remove(asset);
  }

  async retrieveAsset(data: AssetHandle): Promise<AssetEntity> {
    const asset = await this.assetRepo.findOneBy({
      id: data.id,
      lifecycleState: 'active',
    });
    if (!asset) {
      this.l.error(`Asset with id ${data.id} not found`);
      throw new RpcException({ statusCode: 404, message: 'Asset not found' });
    }
    return asset;
  }

  async addCommunityAudience(data: {
    id: string;
    communityId: string;
  }): Promise<AssetEntity> {
    const updated = (await this.assetRepo.query(
      `UPDATE "asset_entity"
       SET "audienceCommunityIds" = CASE
         WHEN "audienceCommunityIds" @> $1::jsonb THEN "audienceCommunityIds"
         ELSE "audienceCommunityIds" || $1::jsonb
       END
       WHERE "id" = $2
       RETURNING *`,
      [JSON.stringify([data.communityId]), data.id]
    )) as AssetEntity[];
    if (!updated.length) {
      throw new RpcException(`Asset with id ${data.id} not found`);
    }
    return updated[0];
  }

  async addAudienceRestrictions(data: {
    id: string;
    restrictions: AssetAudienceRestriction[];
  }): Promise<AssetEntity> {
    if (
      !data ||
      Object.keys(data as object).some(
        (key) => key !== 'id' && key !== 'restrictions'
      ) ||
      !Array.isArray(data?.restrictions) ||
      data.restrictions.some(
        (restriction) =>
          !this.isGenericRestrictionValid(
            restriction,
            new Set([
              'originKind',
              'originProfileId',
              'originAppId',
              'guardianStaged',
              'publicationGrant',
              'resourceType',
              'resourceId',
            ])
          )
      )
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Guardian stage restrictions are reserved',
      });
    }
    const updated = (await this.assetRepo.query(
      `UPDATE "asset_entity"
       SET "audienceRestrictions" = (
         SELECT COALESCE(jsonb_agg(DISTINCT restriction), '[]'::jsonb)
         FROM jsonb_array_elements("audienceRestrictions" || $1::jsonb) restriction
       )
       WHERE "id" = $2
       RETURNING *`,
      [JSON.stringify(data.restrictions), data.id]
    )) as AssetEntity[];
    if (!updated.length) {
      throw new RpcException(`Asset with id ${data.id} not found`);
    }
    return updated[0];
  }

  private isGenericRestrictionValid(
    restriction: unknown,
    reserved: Set<string>
  ): boolean {
    if (
      !restriction ||
      typeof restriction !== 'object' ||
      Array.isArray(restriction)
    )
      return false;
    const value = restriction as {
      type?: unknown;
      profileId?: unknown;
      communityId?: unknown;
    };
    const keys = Object.keys(restriction);
    return (
      !keys.some(
        (key) =>
          reserved.has(key) ||
          !['type', 'profileId', 'communityId'].includes(key)
      ) &&
      typeof value.profileId === 'string' &&
      value.profileId.length > 0 &&
      (value.type === 'owner' || value.type === 'followers'
        ? value.communityId == null
        : value.type === 'community' &&
          typeof value.communityId === 'string' &&
          value.communityId.length > 0)
    );
  }

  async listAssets(data: AssetListQuery): Promise<AssetEntity[]> {
    return this.assetRepo.find({
      where: {
        profileId: data.profileId,
        lifecycleState: 'active',
        ...(data.type ? { type: data.type } : {}),
      },
      order: {
        id: 'DESC',
      },
      take: 48,
    });
  }

  async readAsset(data: AssetHandle): Promise<string> {
    const asset = await this.retrieveAsset(data);
    if (
      asset.audienceCommunityIds?.length ||
      asset.audienceRestrictions?.length
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'Community assets must use the authorized media delivery path',
      });
    }
    const assetBuffer = await this.storageAdapter.read(asset);
    if (!assetBuffer) {
      this.l.error(`Failed to read asset with id ${data.id}`);
      throw new RpcException(`Failed to read asset with id ${data.id}`);
    }
    return assetBuffer as string;
  }

  async readAssetContent(
    data: AssetHandle,
    maxStoredBytes?: number
  ): Promise<Buffer> {
    const asset = await this.retrieveAsset(data);
    if (this.storageAdapter.readBuffer) {
      return this.storageAdapter.readBuffer(asset, maxStoredBytes);
    }
    if (maxStoredBytes !== undefined) {
      throw new Error(
        'Storage adapter cannot perform a bounded authenticated read'
      );
    }

    const content = await this.storageAdapter.read(asset);
    if (Buffer.isBuffer(content)) return content;
    const dataUrl = /^data:[^;,]+;base64,([\s\S]*)$/.exec(content);
    if (!dataUrl) {
      throw new Error(
        'Storage adapter did not return binary or base64 asset content'
      );
    }
    return Buffer.from(dataUrl[1], 'base64');
  }

  async openAuthenticatedMedia(
    asset: AssetEntity,
    options: AuthenticatedMediaReadOptions
  ) {
    if (!this.storageAdapter.openAuthenticatedMedia) {
      throw new Error(
        'Configured storage adapter cannot safely stream authenticated media.'
      );
    }
    return this.storageAdapter.openAuthenticatedMedia(asset, options);
  }
}
