import { AssetDto, CreateAssetDto } from '@optimistic-tanuki/models';
import { VerifiedMediaSpoolHandle } from './verified-media-spool.service';

export interface AuthenticatedMediaReadOptions {
  maxPlaintextBytes: number;
  signal?: AbortSignal;
}

export interface StorageAdapter {
  /***
   * Creates a new asset in the storage system.
   * @param data - The asset data to be created.
   * @return A promise that resolves to the created asset data.
   */
  create(data: CreateAssetDto): Promise<AssetDto>;

  /***
   * Removes an asset from the storage system.
   * @param data - The asset data to be removed.
   * @return A promise that resolves when the asset is successfully removed.
   */
  remove(data: AssetDto): Promise<void>;

  /***
   * Retrieves an asset from the storage system.
   * @param data - The asset data to be retrieved.
   * @return A promise that resolves to the retrieved asset data.
   */
  retrieve(data: AssetDto): Promise<AssetDto>;

  /***
   * Reads the content of an asset from the storage system.
   * @param data - The asset data containing information like path.
   * @return A promise that resolves to the asset's content as a Buffer.
   */
  read(data: AssetDto): Promise<Buffer | string>;

  /** Returns authenticated plaintext bytes without data-URL/base64 expansion. */
  readBuffer?(data: AssetDto, maxStoredBytes?: number): Promise<Buffer>;

  /**
   * Opens an authenticated plaintext spool only after the complete envelope
   * tag has verified. Adapters that cannot provide this must not stream media.
   */
  openAuthenticatedMedia?(
    data: AssetDto,
    options: AuthenticatedMediaReadOptions
  ): Promise<VerifiedMediaSpoolHandle>;
}
