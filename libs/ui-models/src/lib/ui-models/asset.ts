/**
 * Data transfer object for creating a new asset.
 */
export interface CreateAssetDto {
    /**
     * The name of the asset.
     */
    name: string;
    /**
     * The ID of the profile associated with the asset.
     */
    profileId: string;
    /**
     * The type of the asset (image, video, audio, or document).
     */
    type: 'image' | 'video' | 'audio' | 'document';
    /**
     * Optional content for in-memory operations.
     */
    content?: string; // Optional content for in-memory operations
    /**
     * Optional file extension for in-memory operations.
     */
    fileExtension?: string; // Optional file extension for in-memory operations
}

/**
 * Data transfer object for an asset.
 */
export declare type AssetDto = {
    /**
     * The unique identifier of the asset.
     */
    id: string;
    /**
     * The name of the asset.
     */
    name: string;
    /**
     * The type of the asset (image, video, audio, or document).
     */
    type: 'image' | 'video' | 'audio' | 'document';
    /**
     * The storage strategy used for the asset.
     */
    storageStrategy: 'local_block_storage' | 'remote_block_storage' | 'database_storage';
    /**
     * The path where the asset is stored.
     */
    storagePath: string;
    /**
     * The ID of the profile associated with the asset.
     */
    profileId: string;
    /**
     * Optional content for in-memory operations.
     */
    content?: string; // Optional content for in-memory operations
}