import { localCustodyProbe, CustodyProbeMode } from './local-custody-identity';
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
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import * as fs from 'fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

import { mimeTypeFromFileName, mimeTypeForAssetType } from './file-mime';
import { EnvelopeEncryptionService } from './envelope-encryption.service';
import { TaxDocumentClassifierService } from './tax-document-classifier.service';
import { ZfsStorageReport, ZfsStorageService } from './zfs-storage.service';
import {
  AuthenticatedMediaReadOptions,
  StorageAdapter,
} from './storage-adapter.interface';
import { VerifiedMediaSpoolService } from './verified-media-spool.service';

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
    private readonly zfs: ZfsStorageService = new ZfsStorageService(),
    private readonly mediaSpool: VerifiedMediaSpoolService = new VerifiedMediaSpoolService(
      encryption
    )
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

  custodyProbe(nonce: string, mode: CustodyProbeMode): Promise<string> {
    return localCustodyProbe(this.basePath, nonce, mode);
  }

  async create(data: CreateAssetDto): Promise<AssetDto> {
    data.name = this.normalizeSafeFilename(data.name);
    await this.ensureBasePathExists();
    this.l.log(
      `LocalStorageAdapter: Creating asset with data:`,
      data.name,
      data.profileId,
      data.type,
      data.content?.length
    );
    if (data.id && !isUuid(data.id))
      throw new Error('Reserved asset id must be a UUID');
    const assetId = data.id ?? uuidv4();
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

  reservationPath(data: CreateAssetDto): string {
    if (!data.id || !isUuid(data.id))
      throw new Error('Reserved asset id must be a UUID');
    return path.join('assets', data.id, this.normalizeSafeFilename(data.name));
  }

  async remove(data: AssetDto): Promise<void> {
    this.ensureBasePathExists();
    this.l.log(`LocalStorageAdapter: Removing asset with data:`, data);
    const absolutePath = this.resolveStoragePath(data.storagePath);

    try {
      const assetDirectory = path.dirname(absolutePath);
      const relative = path
        .relative(path.resolve(this.basePath), absolutePath)
        .split(path.sep);
      if (
        relative.length === 3 &&
        relative[0] === 'assets' &&
        relative[1] === data.id &&
        isUuid(relative[1])
      ) {
        await fs.rm(assetDirectory, { recursive: true, force: true });
      } else {
        await fs.unlink(absolutePath);
      }
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

  async purgeOwnedAsset(data: AssetDto): Promise<{ verifiedAbsent: true }> {
    const assetDirectory = this.assertOwnedAssetPath(data);
    const root = path.resolve(this.basePath);
    const assetsDirectory = path.join(root, 'assets');
    await this.assertTrustedDirectory(root);
    await this.assertTrustedDirectory(assetsDirectory, true);
    await this.assertTrustedDirectory(assetDirectory, true);
    try {
      await this.assertBoundedTree(assetDirectory, 0, { count: 0 });
      await fs.rm(assetDirectory, { recursive: true, force: true });
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      const stat = await fs.lstat(assetDirectory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('Owned asset directory remains after purge');
      }
      throw new Error('Owned asset directory remains after purge');
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
    return { verifiedAbsent: true };
  }

  private assertOwnedAssetPath(data: AssetDto): string {
    if (
      !data ||
      !isUuid(data.id) ||
      data.storageStrategy !== StorageStrategy.LOCAL_BLOCK_STORAGE ||
      typeof data.name !== 'string'
    ) {
      throw new Error('Asset custody cannot be proven');
    }
    let expected: string;
    try {
      expected = this.reservationPath({
        id: data.id,
        name: data.name,
      } as CreateAssetDto);
    } catch {
      throw new Error('Asset custody cannot be proven');
    }
    if (data.storagePath !== expected)
      throw new Error('Asset custody cannot be proven');
    return path.join(path.resolve(this.basePath), 'assets', data.id);
  }

  private async assertTrustedDirectory(
    directory: string,
    missingOk = false
  ): Promise<void> {
    try {
      const stat = await fs.lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new Error('Unsafe storage directory');
    } catch (error: any) {
      if (missingOk && error.code === 'ENOENT') return;
      throw error;
    }
  }

  private async assertBoundedTree(
    directory: string,
    depth: number,
    state: { count: number }
  ): Promise<void> {
    if (depth > 8) throw new Error('Owned asset tree exceeds the depth limit');
    const handle = await fs.opendir(directory);
    // The async iterator closes its directory handle on completion or error.
    for await (const entry of handle) {
      state.count += 1;
      if (state.count > 1000)
        throw new Error('Owned asset tree exceeds the entry limit');
      const entryPath = path.join(directory, entry.name);
      const stat = await fs.lstat(entryPath);
      if (stat.isSymbolicLink()) throw new Error('Symlink in owned asset tree');
      if (stat.isFile()) {
        if (stat.nlink !== 1)
          throw new Error('Hard-linked file in owned asset tree');
      } else if (stat.isDirectory()) {
        await this.assertBoundedTree(entryPath, depth + 1, state);
      } else {
        throw new Error('Unsupported entry in owned asset tree');
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
    const fileContent = await this.readBuffer(data);
    const mime = this.getMimeType(data.name, data.type);
    return `data:${mime};base64,${fileContent.toString('base64')}`;
  }

  async readBuffer(data: AssetDto, maxStoredBytes?: number): Promise<Buffer> {
    this.ensureBasePathExists();
    this.l.log(
      `LocalStorageAdapter: Reading asset with data:`,
      Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    );
    const absolutePath = this.resolveStoragePath(data.storagePath);

    try {
      // Media serving sets a strict bound and reads from one non-following
      // descriptor so a path swap or concurrent growth cannot bypass it.
      const stored =
        maxStoredBytes === undefined
          ? await fs.readFile(absolutePath)
          : await this.readBoundedFile(absolutePath, maxStoredBytes);
      const fileContent = this.encryption.decrypt(stored);
      if (maxStoredBytes !== undefined && fileContent.length > maxStoredBytes) {
        throw new PayloadTooLargeException(
          'Decrypted asset exceeds the supported retrieval size.'
        );
      }
      this.l.log(
        `LocalStorageAdapter: Asset content decrypted from ${absolutePath}: ${fileContent.length}`
      );
      return fileContent;
    } catch (error: any) {
      this.l.error(
        `LocalStorageAdapter: Failed to read asset content from ${absolutePath}: ${error.message}`
      );
      throw error; // Re-throw the error
    }
  }

  async openAuthenticatedMedia(
    data: AssetDto,
    options: AuthenticatedMediaReadOptions
  ) {
    const absolutePath = this.resolveStoragePath(data.storagePath);
    return this.mediaSpool.create(async (signal) => {
      if (signal?.aborted) {
        const error = new Error('Media read was cancelled.');
        error.name = 'AbortError';
        throw error;
      }
      const handle = await fs.open(
        absolutePath,
        fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
      );
      try {
        const sourceStats = await handle.stat();
        if (!sourceStats.isFile()) {
          throw new ServiceUnavailableException(
            'Stored asset is not a regular file.'
          );
        }
        if (sourceStats.size > options.maxPlaintextBytes + 64 * 1024) {
          throw new PayloadTooLargeException(
            'Stored media exceeds the authenticated retrieval limit.'
          );
        }
        return handle.createReadStream({
          autoClose: true,
          highWaterMark: 64 * 1024,
        });
      } catch (error) {
        await handle.close().catch(() => undefined);
        throw error;
      }
    }, options);
  }

  private resolveStoragePath(storagePath: string): string {
    const root = path.resolve(this.basePath);
    const resolved = path.resolve(root, storagePath);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new ServiceUnavailableException(
        'Stored asset path is outside local storage.'
      );
    }
    return resolved;
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
      path.basename(safeName) !== safeName ||
      containsUnsafeCharacter
    ) {
      throw new Error('Asset filename is invalid');
    }
    return safeName;
  }

  private async readBoundedFile(
    filePath: string,
    maxStoredBytes: number
  ): Promise<Buffer> {
    const handle = await fs.open(
      filePath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
    );
    try {
      const initial = await handle.stat();
      if (!initial.isFile()) {
        throw new ServiceUnavailableException(
          'Stored asset is not a regular file.'
        );
      }
      if (initial.size > maxStoredBytes) {
        throw new PayloadTooLargeException(
          'Stored asset exceeds the supported retrieval size.'
        );
      }

      const stored = Buffer.alloc(initial.size + 1);
      let offset = 0;
      while (offset < initial.size) {
        const { bytesRead } = await handle.read(
          stored,
          offset,
          initial.size - offset,
          offset
        );
        if (bytesRead === 0) break;
        offset += bytesRead;
      }
      if (offset !== initial.size) {
        throw new ServiceUnavailableException(
          'Stored asset changed while being read.'
        );
      }
      const { bytesRead: extraBytes } = await handle.read(
        stored,
        initial.size,
        1,
        initial.size
      );
      const final = await handle.stat();
      if (
        extraBytes !== 0 ||
        final.size !== initial.size ||
        final.mtimeMs !== initial.mtimeMs
      ) {
        throw new ServiceUnavailableException(
          'Stored asset changed while being read.'
        );
      }
      return stored.subarray(0, initial.size);
    } finally {
      await handle.close();
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

    try {
      const handle = await fs.open(tempPath, 'wx', mode);
      try {
        await handle.writeFile(payload);
        await handle.sync();
      } finally {
        await handle.close();
      }
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
