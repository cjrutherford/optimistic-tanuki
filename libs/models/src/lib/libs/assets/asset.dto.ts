export interface CreateAssetDto {
    id?: string;
    name: string;
    profileId: string;
    type: 'image' | 'video' | 'audio' | 'document';
    content?: Buffer; // Optional content for in-memory operations
}

export declare type AssetDto = {
    id: string;
    name: string;
    type: 'image' | 'video' | 'audio' | 'document';
    storageStrategy: 'local_block_storage' | 'remote_block_storage' | 'database_storage';
    storagePath: string;
    profileId: string;
    content?: Buffer; // Optional content for in-memory operations
}

export interface AssetHandle {
    id: string;
    profileId?: string;
}