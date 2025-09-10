export interface CreateAssetDto {
    name: string;
    profileId: string;
    type: 'image' | 'video' | 'audio' | 'document';
    content?: string; // Optional content for in-memory operations
    fileExtension?: string; // Optional file extension for in-memory operations
}

export declare type AssetDto = {
    id: string;
    name: string;
    type: 'image' | 'video' | 'audio' | 'document';
    storageStrategy: 'local_block_storage' | 'remote_block_storage' | 'database_storage';
    storagePath: string;
    profileId: string;
    content?: string; // Optional content for in-memory operations
}