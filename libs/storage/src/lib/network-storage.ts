import { Injectable, Logger } from '@nestjs/common';
import { StorageAdapter } from './storage-adapter.interface';
import { AssetDto, CreateAssetDto } from '@optimistic-tanuki/models';
import { S3Service, S3ServiceOptions } from './s3.service'; // Import S3Service and its options
import { v4 as uuidv4 } from 'uuid'; // Import UUID for generating unique IDs

// Rename S3StorageOptions to S3NetworkOptions to avoid confusion with S3ServiceOptions
export type S3NetworkOptions = S3ServiceOptions


@Injectable()
export class NetworkStorageAdapter implements StorageAdapter {

  constructor(
    private readonly l: Logger,
    private readonly s3Service: S3Service, // Inject the S3Service
  ) {
    this.l.log(`NetworkStorageAdapter initialized with S3Service`);
  }

  async create(data: CreateAssetDto): Promise<AssetDto> {
    this.l.log(`NetworkStorageAdapter (S3): Creating asset with data:`, data.name);

    const s3Key = `assets/${data.profileId}/${data.id || Date.now()}/${data.name}`; // Example S3 key structure

    if (!data.content) {
        throw new Error('File content is missing in CreateAssetDto');
    }

    try {
        await this.s3Service.uploadObject(s3Key, data.content, data.type); // Use S3Service

        const createdAsset: AssetDto = {
            id: uuidv4(), // Use provided ID or generate one if needed
            name: data.name,
            storagePath: `s3://${this.s3Service['bucketName']}/${s3Key}`, // Construct S3 path using service's bucketName
            type: data.type,
            storageStrategy: 'remote_block_storage',
            profileId: data.profileId,
        };
        return createdAsset;

    } catch (error: any) {
        this.l.error(`NetworkStorageAdapter (S3): Failed to create asset ${data.name}: ${error.message}`);
        throw error;
    }
  }

  async remove(data: AssetDto): Promise<void> {
    this.l.log(`NetworkStorageAdapter (S3): Removing asset with data:`, data.storagePath);

    try {
        const s3Key = this.s3Service.getKeyFromPath(data.storagePath); // Use S3Service helper
        await this.s3Service.deleteObject(s3Key); // Use S3Service
    } catch (error: any) {
        this.l.error(`NetworkStorageAdapter (S3): Failed to remove asset at ${data.storagePath}: ${error.message}`);
        throw error;
    }
  }

  async retrieve(data: AssetDto): Promise<AssetDto> {
    this.l.log(`NetworkStorageAdapter (S3): Retrieving asset metadata with data:`, data.storagePath);
    // Metadata retrieval remains the same, just return the DTO
    return data;
  }

  async read(data: AssetDto): Promise<Buffer> {
    this.l.log(`NetworkStorageAdapter (S3): Reading asset content with data:`, data.storagePath);

    try {
        const s3Key = this.s3Service.getKeyFromPath(data.storagePath); // Use S3Service helper
        const fileContent = await this.s3Service.getObject(s3Key); // Use S3Service
        return fileContent;
    } catch (error) {
        this.l.error(`NetworkStorageAdapter (S3): Failed to read asset content from ${data.storagePath}: ${error.message}`);
        throw error;
    }
  }
}