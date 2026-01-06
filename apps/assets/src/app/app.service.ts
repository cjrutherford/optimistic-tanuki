import { Inject, Injectable, Logger, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import AssetEntity, { StorageStrategy } from '../entities/asset.entity';
import { AssetHandle, CreateAssetDto } from '@optimistic-tanuki/models';
import { RpcException } from '@nestjs/microservices';
import { STORAGE_ADAPTERS, StorageAdapter, FileValidationService, VirusScanService } from '@optimistic-tanuki/storage';

@Injectable()
export class AppService {
  constructor(
    private readonly l: Logger,
    @Inject(getRepositoryToken(AssetEntity))
    private readonly assetRepo: Repository<AssetEntity>,
    @Inject(STORAGE_ADAPTERS)
    private readonly storageAdapter: StorageAdapter,
    private readonly fileValidationService: FileValidationService,
    private readonly virusScanService: VirusScanService,
  ) {}

  async createAsset(data: CreateAssetDto): Promise<AssetEntity> {
    try{
      // Sanitize filename
      data.name = data.name.replace(/\s+/g, '_');
      
      this.l.log('Creating asset with data:', data.name, data.profileId, data.type, data.content?.length || 0);
      
      // If content is provided, validate the file
      if (data.content) {
        const contentBuffer = Buffer.isBuffer(data.content) 
          ? data.content 
          : Buffer.from(data.content, 'base64');
        
        // Determine MIME type from file extension
        const mimeType = this.getMimeTypeFromExtension(data.fileExtension || 'png');
        
        // Validate file
        const validation = this.fileValidationService.validateFile(
          data.name,
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
        
        // Use sanitized filename if provided
        if (validation.sanitizedFilename) {
          data.name = validation.sanitizedFilename;
        }
        
        // Scan for viruses
        const scanResult = await this.virusScanService.scanFile(contentBuffer, data.name);
        
        if (!scanResult.isClean) {
          this.l.error('Virus scan failed:', scanResult.threats);
          throw new RpcException({
            statusCode: 400,
            message: 'File failed virus scan',
            threats: scanResult.threats,
          });
        }
        
        this.l.log(`File validated and scanned: ${data.name} (${scanResult.scanner})`);
      }
      
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
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException('Failed to create asset');
    }
  }
  
  private getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      // Images
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      // Documents
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'txt': 'text/plain',
      'md': 'text/markdown',
      // Video
      'mp4': 'video/mp4',
      'mpeg': 'video/mpeg',
      'mov': 'video/quicktime',
      'webm': 'video/webm',
      // Audio
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
    };
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
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
    this.l.log('Retrieving asset with data:', data);
    const asset = await this.assetRepo.findOneBy({ id: data.id });
    if (!asset) {
      this.l.error(`Asset with id ${data.id} not found`);
      throw new RpcException(`Asset with id ${data.id} not found`);
    }
    return asset;
  }

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
