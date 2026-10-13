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
  STORAGE_ADAPTERS,
  StorageAdapter,
  FileValidationService,
  VirusScanService,
  AuthenticatedMediaReadOptions,
} from '@optimistic-tanuki/storage';
import * as fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';

@Injectable()
export class AppService {
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(AssetEntity))
    private readonly assetRepo: Repository<AssetEntity>,
    @Inject(STORAGE_ADAPTERS)
    private readonly storageAdapter: StorageAdapter,
    private readonly fileValidationService: FileValidationService,
    private readonly virusScanService: VirusScanService
  ) {}

  async createAsset(data: CreateAssetDto): Promise<AssetEntity> {
    try {
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
        name: persistedName,
        profileId: data.profileId,
        type: data.type,
        storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
        audienceCommunityIds: data.communityId ? [data.communityId] : [],
        audienceRestrictions: data.audienceRestrictions ?? [],
      };
      const asset = this.assetRepo.create(entityAsset);
      data.id = asset.id; // Ensure the ID is set for the storage adapter
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
    const asset = await this.assetRepo.findOneBy({ id: data.id });
    if (!asset) {
      this.l.error(`Asset with id ${data.id} not found`);
      throw new RpcException(`Asset with id ${data.id} not found`);
    }
    await this.storageAdapter.remove(asset);
    return await this.assetRepo.remove(asset);
  }

  async retrieveAsset(data: AssetHandle): Promise<AssetEntity> {
    const asset = await this.assetRepo.findOneBy({ id: data.id });
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

  async listAssets(data: AssetListQuery): Promise<AssetEntity[]> {
    return this.assetRepo.find({
      where: {
        profileId: data.profileId,
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
