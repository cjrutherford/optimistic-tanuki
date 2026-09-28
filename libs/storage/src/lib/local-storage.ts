import {
  AssetDto,
  CreateAssetDto,
  AssetType,
  StorageStrategy,
} from '@optimistic-tanuki/models';
import {
  Injectable,
  Logger,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

import { mimeTypeFromFileName, mimeTypeForAssetType } from './file-mime';
import { EnvelopeEncryptionService } from './envelope-encryption.service';
import { TaxDocumentClassifierService } from './tax-document-classifier.service';
import { ZfsStorageReport, ZfsStorageService } from './zfs-storage.service';
import { StorageAdapter } from './storage-adapter.interface';

export const TAX_DOCUMENT_FILE_MODE = 0o600;
export const TAX_DOCUMENT_DIR_MODE = 0o700;
export const STANDARD_FILE_MODE = 0o640;
export const STANDARD_DIR_MODE = 0o750;

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private zfsReport?: Promise<ZfsStorageReport>;

  constructor(
    private readonly l: Logger,
    private readonly basePath: string,
    private readonly encryption: EnvelopeEncryptionService = new EnvelopeEncryptionService(),
    private readonly classifier: TaxDocumentClassifierService = new TaxDocumentClassifierService(),
    private readonly zfs: ZfsStorageService = new ZfsStorageService()
  ) {
    this.l.log(
      `LocalStorageAdapter initialized with basePath: ${this.basePath}`
    );
    this.ensureBasePathExists();
  }

  private ensureBasePathExists(): void {
    if (!existsSync(this.basePath)) {
      mkdirSync(path.join(this.basePath), { recursive: true });
      this.l.log(`LocalStorageAdapter: Created basePath at ${this.basePath}`);
    }
  }

  async create(data: CreateAssetDto): Promise<AssetDto> {
    data.name = data.name.replace(/\s+/g, '_');
    await this.ensureBasePathExists();
    this.l.log(
      `LocalStorageAdapter: Creating asset with data:`,
      data.name,
      data.profileId,
      data.type,
      data.content?.length
    );
    const assetId = uuidv4();
    // Create a unique path for the file within the base path
    const relativePath = path.join('assets', assetId, data.name);
    const absolutePath = path.join(this.basePath, relativePath);

    try {
      const buffer = data.sourcePath
        ? await fs.readFile(data.sourcePath)
        : this.resolveInlineContent(data);

      const classification = this.classifier.assertStorable({
        filename: data.name,
        content: buffer,
        type: data.type,
      });

      const zfsReport = await this.assertZfsExpectation();

      const dirMode = classification.isTaxDocument
        ? TAX_DOCUMENT_DIR_MODE
        : STANDARD_DIR_MODE;
      const fileMode = classification.isTaxDocument
        ? TAX_DOCUMENT_FILE_MODE
        : STANDARD_FILE_MODE;

      await fs.mkdir(path.dirname(absolutePath), {
        recursive: true,
        mode: dirMode,
      });
      await fs.chmod(path.dirname(absolutePath), dirMode);

      const envelope = this.encryption.encrypt(
        buffer,
        JSON.stringify({
          formType: classification.formType,
          handling: classification.handling,
          originalName: data.name,
        })
      );
      await this.writeAtomic(absolutePath, envelope, fileMode);

      const createdAsset: AssetDto = {
        id: assetId,
        name: data.name,
        storagePath: relativePath, // Store the relative path
        type: data.type, // Assuming type is in CreateAssetDto
        storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
        profileId: data.profileId, // Assuming profileId is in CreateAssetDto
      };

      this.l.log(
        `LocalStorageAdapter: Asset created at ${absolutePath} (classification=${
          classification.handling
        }${
          classification.formType ? `:${classification.formType}` : ''
        }, mode=${fileMode.toString(8)}, dataset=${
          zfsReport.dataset ??
          `none (${zfsReport.filesystemType ?? 'unknown filesystem'})`
        })`
      );
      return createdAsset;
    } catch (error: any) {
      this.l.error(
        `LocalStorageAdapter: Failed to create asset: ${error.message}`
      );
      throw error; // Re-throw the error
    }
  }

  async remove(data: AssetDto): Promise<void> {
    this.ensureBasePathExists();
    this.l.log(`LocalStorageAdapter: Removing asset with data:`, data);
    const absolutePath = path.join(this.basePath, data.storagePath);

    try {
      // Remove the file
      await fs.unlink(absolutePath);
      this.l.log(`LocalStorageAdapter: Asset removed from ${absolutePath}`);

      // Optional: Clean up empty directories
      // This can be complex, so might be done by a separate process or less aggressively
      // For simplicity, we won't add directory cleanup here.
    } catch (error: any) {
      // Ignore error if file doesn't exist
      if (error.code === 'ENOENT') {
        this.l.warn(
          `LocalStorageAdapter: Attempted to remove non-existent asset at ${absolutePath}`
        );
      } else {
        this.l.error(
          `LocalStorageAdapter: Failed to remove asset at ${absolutePath}: ${error.message}`
        );
        throw error; // Re-throw other errors
      }
    }
  }

  async retrieve(data: AssetDto): Promise<AssetDto> {
    this.ensureBasePathExists();
    this.l.log(`LocalStorageAdapter: Retrieving asset with data:`, data);
    throw new NotImplementedException(
      'Local asset metadata retrieval is not implemented.'
    );
  }

  async read(data: AssetDto): Promise<string> {
    this.ensureBasePathExists();
    this.l.log(
      `LocalStorageAdapter: Reading asset with data:`,
      Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    );
    const absolutePath = path.join(this.basePath, data.storagePath);

    try {
      // Read the file content
      const stored = await fs.readFile(absolutePath);
      const fileContent = this.encryption.decrypt(stored);
      this.l.log(
        `LocalStorageAdapter: Asset content decrypted from ${absolutePath}: ${fileContent.length}`
      );
      const mime = this.getMimeType(data.name, data.type);
      const base64Content = `data:${mime};base64,${fileContent.toString(
        'base64'
      )}`;
      return base64Content;
    } catch (error: any) {
      this.l.error(
        `LocalStorageAdapter: Failed to read asset content from ${absolutePath}: ${error.message}`
      );
      throw error; // Re-throw the error
    }
  }

  async getZfsReport(): Promise<ZfsStorageReport> {
    if (!this.zfsReport) {
      this.zfsReport = this.zfs.detect(this.basePath).then((report) => {
        this.l.log(
          `LocalStorageAdapter: storage target ${report.targetPath} is ${
            report.isZfs
              ? `ZFS dataset ${report.dataset ?? 'unknown'}`
              : `not ZFS (filesystem type ${
                  report.filesystemType ?? 'unknown'
                })`
          }. ${report.detail}`
        );
        return report;
      });
    }
    return this.zfsReport;
  }

  private async assertZfsExpectation(): Promise<ZfsStorageReport> {
    const report = await this.getZfsReport();
    if (this.zfs.isZfsRequired() && !report.isZfs) {
      throw new ServiceUnavailableException(
        `VAULT_STORAGE_ZFS_REQUIRED is set but ${report.targetPath} is not a ZFS dataset: ${report.detail}`
      );
    }
    return report;
  }

  private resolveInlineContent(data: CreateAssetDto): Buffer {
    if (!data.content) {
      throw new Error('File content is missing in CreateAssetDto');
    }
    if (typeof data.content === 'string' && data.content.startsWith('data:')) {
      const base64Data = data.content.split(',')[1];
      return Buffer.from(base64Data, 'base64');
    }
    if (Buffer.isBuffer(data.content)) {
      return data.content;
    }
    throw new Error('Invalid content type in CreateAssetDto');
  }

  private async writeAtomic(
    absolutePath: string,
    payload: Buffer,
    mode: number
  ): Promise<void> {
    const directory = path.dirname(absolutePath);
    const tempPath = path.join(
      directory,
      `.${path.basename(absolutePath)}.${crypto
        .randomBytes(8)
        .toString('hex')}.tmp`
    );

    const handle = await fs.open(tempPath, 'wx', mode);
    try {
      await handle.writeFile(payload);
      await handle.sync();
    } finally {
      await handle.close();
    }

    try {
      await fs.chmod(tempPath, mode);
      await fs.rename(tempPath, absolutePath);
    } catch (error) {
      await fs.rm(tempPath, { force: true });
      throw error;
    }

    try {
      const directoryHandle = await fs.open(directory, 'r');
      try {
        await directoryHandle.sync();
      } finally {
        await directoryHandle.close();
      }
    } catch (error) {
      this.l.error(
        `LocalStorageAdapter: Directory fsync failed for ${directory}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }
  }

  private getMimeType(name: string, type: AssetType): string {
    return mimeTypeFromFileName(name) ?? mimeTypeForAssetType(type);
  }
}
