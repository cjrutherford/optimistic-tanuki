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
import { StorageAdapter } from './storage-adapter.interface';

// Rename S3StorageOptions to S3NetworkOptions to avoid confusion with S3ServiceOptions
export type S3NetworkOptions = S3ServiceOptions;

@Injectable()
export class NetworkStorageAdapter implements StorageAdapter {
  constructor(
    private readonly l: Logger,
    private readonly s3Service: S3Service, // Inject the S3Service
    private readonly encryption: EnvelopeEncryptionService = new EnvelopeEncryptionService(),
    private readonly classifier: TaxDocumentClassifierService = new TaxDocumentClassifierService()
  ) {
    this.l.log(`NetworkStorageAdapter initialized with S3Service`);
  }

  async create(data: CreateAssetDto): Promise<AssetDto> {
    this.l.log(
      `NetworkStorageAdapter (S3): Creating asset with data:`,
      data.name
    );

    const newAssetId = uuidv4();
    const s3Key = `assets/${data.profileId}/${newAssetId}-${Date.now()}/${
      data.name
    }`; // Example S3 key structure

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

  async remove(data: AssetDto): Promise<void> {
    this.l.log(
      `NetworkStorageAdapter (S3): Removing asset with data:`,
      data.storagePath
    );

    try {
      const s3Key = this.s3Service.getKeyFromPath(data.storagePath); // Use S3Service helper
      await this.s3Service.deleteObject(s3Key); // Use S3Service
    } catch (error: any) {
      this.l.error(
        `NetworkStorageAdapter (S3): Failed to remove asset at ${data.storagePath}: ${error.message}`
      );
      throw error;
    }
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
}

function toAsciiMetadataValue(value: string): string {
  const ascii = value.replace(/[^\x20-\x7e]/g, '_');
  return Buffer.from(ascii, 'utf8').toString('base64');
}
