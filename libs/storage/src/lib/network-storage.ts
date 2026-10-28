import {
  AssetDto,
  CreateAssetDto,
  AssetType,
  StorageStrategy,
} from '@optimistic-tanuki/models';
import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { S3Service, S3ServiceOptions } from './s3.service'; // Import S3Service and its options
import { EnvelopeEncryptionService } from './envelope-encryption.service';
import { TaxDocumentClassifierService } from './tax-document-classifier.service';
import {
  AuthenticatedMediaReadOptions,
  StorageAdapter,
} from './storage-adapter.interface';
import { VerifiedMediaSpoolService } from './verified-media-spool.service';

// Rename S3StorageOptions to S3NetworkOptions to avoid confusion with S3ServiceOptions
export type S3NetworkOptions = S3ServiceOptions;

@Injectable()
export class NetworkStorageAdapter implements StorageAdapter {
  constructor(
    private readonly l: Logger,
    private readonly s3Service: S3Service, // Inject the S3Service
    private readonly encryption: EnvelopeEncryptionService = new EnvelopeEncryptionService(),
    private readonly classifier: TaxDocumentClassifierService = new TaxDocumentClassifierService(),
    private readonly mediaSpool: VerifiedMediaSpoolService = new VerifiedMediaSpoolService(
      encryption
    )
  ) {
    this.l.log(`NetworkStorageAdapter initialized with S3Service`);
  }

  custodyProbe(
    nonce: string,
    mode: 'write' | 'read' | 'remove'
  ): Promise<string> {
    return this.s3Service.custodyProbe(nonce, mode);
  }

  async create(data: CreateAssetDto): Promise<AssetDto> {
    data.name = this.normalizeSafeFilename(data.name);
    this.l.log(
      `NetworkStorageAdapter (S3): Creating asset with data:`,
      data.name
    );

    if (data.id && !isUuid(data.id))
      throw new Error('Reserved asset id must be a UUID');
    const newAssetId = data.id ?? uuidv4();
    const s3Key = data.id
      ? `assets/${data.profileId}/${newAssetId}/${data.name}`
      : `assets/${data.profileId}/${newAssetId}-${Date.now()}/${data.name}`;

    if (!data.content) {
      throw new Error('File content is missing in CreateAssetDto');
    }

    if (!Buffer.isBuffer(data.content)) {
      throw new Error('File content must be a Buffer before upload');
    }

    try {
      const classification = this.classifier.assertStorable({
        filename: data.name,
        content: data.content,
        type: data.type,
      });

      const envelope = this.encryption.encrypt(
        data.content,
        JSON.stringify({
          formType: classification.formType,
          handling: classification.handling,
          originalName: data.name,
        })
      );

      await this.s3Service.uploadObject(s3Key, envelope, data.type, {
        metadata: this.buildMetadata(data, classification),
      });

      const createdAsset: AssetDto = {
        id: newAssetId, // Use provided ID or generate one if needed
        name: data.name,
        storagePath: `s3://${this.s3Service['bucketName']}/${s3Key}`, // Construct S3 path using service's bucketName
        type: data.type,
        storageStrategy: StorageStrategy.REMOTE_BLOCK_STORAGE,
        profileId: data.profileId,
      };
      return createdAsset;
    } catch (error: any) {
      this.l.error(
        `NetworkStorageAdapter (S3): Failed to create asset ${data.name}: ${error.message}`
      );
      throw error;
    }
  }

  reservationPath(data: CreateAssetDto): string {
    if (!data.id || !isUuid(data.id))
      throw new Error('Reserved asset id must be a UUID');
    return `s3://${this.s3Service['bucketName']}/assets/${data.profileId}/${
      data.id
    }/${this.normalizeSafeFilename(data.name)}`;
  }

  async remove(data: AssetDto): Promise<void> {
    this.l.log(
      `NetworkStorageAdapter (S3): Removing asset with data:`,
      data.storagePath
    );

    try {
      const s3Key = this.s3Service.getKeyFromPath(data.storagePath); // Use S3Service helper
      await this.s3Service.purgeObjectVersions(s3Key);
    } catch (error: any) {
      this.l.error(
        `NetworkStorageAdapter (S3): Failed to remove asset at ${data.storagePath}: ${error.message}`
      );
      throw error;
    }
  }

  async purgeOwnedAsset(data: AssetDto): Promise<{ verifiedAbsent: true }> {
    if (
      !data ||
      !isUuid(data.id) ||
      !isUuid(data.profileId) ||
      data.storageStrategy !== StorageStrategy.REMOTE_BLOCK_STORAGE ||
      typeof data.name !== 'string'
    ) {
      throw new Error('Asset custody cannot be proven');
    }
    let expected: string;
    try {
      expected = this.reservationPath({
        id: data.id,
        profileId: data.profileId,
        name: data.name,
      } as CreateAssetDto);
    } catch {
      throw new Error('Asset custody cannot be proven');
    }
    if (data.storagePath !== expected)
      throw new Error('Asset custody cannot be proven');
    const key = this.s3Service.getKeyFromPath(expected);
    await this.s3Service.purgeObjectVersions(key);
    return { verifiedAbsent: true };
  }

  async retrieve(data: AssetDto): Promise<AssetDto> {
    this.l.log(
      `NetworkStorageAdapter (S3): Retrieving asset metadata with data:`,
      data.storagePath
    );
    // Metadata retrieval remains the same, just return the DTO
    return data;
  }

  async read(data: AssetDto): Promise<Buffer> {
    this.l.log(
      `NetworkStorageAdapter (S3): Reading asset content with data:`,
      data.storagePath
    );

    try {
      const s3Key = this.s3Service.getKeyFromPath(data.storagePath); // Use S3Service helper
      const stored = await this.s3Service.getObject(s3Key); // Use S3Service
      return this.encryption.decrypt(stored);
    } catch (error) {
      this.l.error(
        `NetworkStorageAdapter (S3): Failed to read asset content at ${
          data.storagePath
        }: ${(error as any).message}`
      );
      throw error;
    }
  }

  async openAuthenticatedMedia(
    data: AssetDto,
    options: AuthenticatedMediaReadOptions
  ) {
    const s3Key = this.s3Service.getKeyFromPath(data.storagePath);
    return this.mediaSpool.create(
      (signal) => this.s3Service.getObjectStream(s3Key, signal),
      options
    );
  }

  private buildMetadata(
    data: CreateAssetDto,
    classification: {
      isTaxDocument: boolean;
      formType: string | null;
      handling: string;
    }
  ): Record<string, string> {
    return {
      'vault-original-name': toAsciiMetadataValue(data.name),
      'vault-tax-document': String(classification.isTaxDocument),
      'vault-form-type': classification.formType ?? 'NONE',
      'vault-handling': classification.handling,
      'vault-encryption': 'AES-256-GCM-ENVELOPE-V1',
      'vault-original-bytes': String(data.content?.length ?? 0),
    };
  }

  private normalizeSafeFilename(name: string): string {
    const safeName = name.replace(/\s+/g, '_');
    const containsUnsafeCharacter =
      /[\\/]/.test(safeName) ||
      Array.from(safeName).some((character) => character.charCodeAt(0) <= 0x1f);
    if (
      !safeName ||
      safeName === '.' ||
      safeName === '..' ||
      containsUnsafeCharacter
    ) {
      throw new Error('Asset filename is invalid');
    }
    return safeName;
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function toAsciiMetadataValue(value: string): string {
  const ascii = value.replace(/[^\x20-\x7e]/g, '_');
  return Buffer.from(ascii, 'utf8').toString('base64');
}
