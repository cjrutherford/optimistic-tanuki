import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import AssetEntity, { StorageStrategy } from '../entities/asset.entity';
import { AssetHandle, CreateAssetDto } from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';
import { STORAGE_ADAPTERS, StorageAdapter } from '@optimistic-tanuki/storage';

/**
 * Service for managing assets.
 */
@Injectable()
export class AppService {
  /**
   * Creates an instance of AppService.
   * @param l The logger instance.
   * @param assetRepo The repository for AssetEntity.
   * @param storageAdapter The storage adapter for handling asset storage.
   */
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(AssetEntity))
    private readonly assetRepo: Repository<AssetEntity>,
    @Inject(STORAGE_ADAPTERS)
    private readonly storageAdapter: StorageAdapter,
  ) {}

  /**
   * Creates a new asset.
   * @param data The data for creating the asset.
   * @returns The created AssetEntity.
   * @throws RpcException if asset creation fails.
   */
  async createAsset(data: CreateAssetDto): Promise<AssetEntity> {
    try{
      data.name = data.name.replace(/\s+/g, '_');
      this.l.log('Creating asset with data:', data.name, data.profileId, data.type, data.content.length);
      const entityAsset: Partial<AssetEntity> = {
        name: `${data.name}.${data.fileExtension || 'png'}`,
        profileId: data.profileId,
        type: data.type,
        storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
      };
      const asset = this.assetRepo.create(entityAsset);
      data.id = asset.id; // Ensure the ID is set for the storage adapter
      const persistedAsset = await this.storageAdapter.create(data);
      const newAsset = await this.assetRepo.save({...asset, ...persistedAsset} as AssetEntity);
      return newAsset;
    } catch (error) {
      console.error('Error creating asset:', error);
      this.l.error('Error creating asset:', error);
      throw new RpcException('Failed to create asset');
    }
  }

  /**
   * Removes an asset.
   * @param data The handle of the asset to remove.
   * @returns The removed AssetEntity.
   * @throws RpcException if the asset is not found.
   */
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

  /**
   * Retrieves an asset.
   * @param data The handle of the asset to retrieve.
   * @returns The retrieved AssetEntity.
   * @throws RpcException if the asset is not found.
   */
  async retrieveAsset(data: AssetHandle): Promise<AssetEntity> {
    this.l.log('Retrieving asset with data:', data);
    const asset = await this.assetRepo.findOneBy({ id: data.id });
    if (!asset) {
      this.l.error(`Asset with id ${data.id} not found`);
      throw new RpcException(`Asset with id ${data.id} not found`);
    }
    return asset;
  }

  /**
   * Reads the content of an asset.
   * @param data The handle of the asset to read.
   * @returns The content of the asset as a string.
   * @throws RpcException if the asset content cannot be read.
   */
  async readAsset(data: AssetHandle): Promise<string> {
    this.l.log('Reading asset with data:', data);
    const asset = await this.retrieveAsset(data);
    this.l.log('Retrieved asset:', asset);
    const assetBuffer  = await this.storageAdapter.read(asset);
    if (!assetBuffer) {
      this.l.error(`Failed to read asset with id ${data.id}`);
      throw new RpcException(`Failed to read asset with id ${data.id}`);
    }
    this.l.log('Read asset content length:', assetBuffer.length);
    return assetBuffer as string;
  }
}
