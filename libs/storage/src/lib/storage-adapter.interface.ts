import { AssetDto, CreateAssetDto } from '@optimistic-tanuki/models';

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
    read(data: AssetDto): Promise<Buffer>; 
}