import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * Defines the storage strategies for assets.
 */
export enum StorageStrategy {
    /**
     * Asset is stored in local block storage.
     */
    LOCAL_BLOCK_STORAGE = 'local_block_storage',
    /**
     * Asset is stored in remote block storage.
     */
    REMOTE_BLOCK_STORAGE = 'remote_block_storage',
    /**
     * Asset is stored directly in the database.
     */
    DATABASE_STORAGE = 'database_storage',
}

/**
 * Represents an asset entity in the database.
 */
@Entity()
export default class AssetEntity {
    /**
     * The unique identifier of the asset.
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * The name of the asset.
     */
    @Column()
    name: string;

    /**
     * The type of the asset (image, video, audio, or document).
     */
    @Column({ type: 'enum', enum: ['image', 'video', 'audio', 'document'], default: 'image' })
    type: 'image' | 'video' | 'audio' | 'document';

    /**
     * The storage strategy used for the asset.
     */
    @Column({ type: 'enum', enum: StorageStrategy, default: StorageStrategy.LOCAL_BLOCK_STORAGE })
    storageStrategy: StorageStrategy;

    /**
     * The path where the asset is stored.
     */
    @Column()
    storagePath: string;

    /**
     * The ID of the profile associated with the asset.
     */
    @Column()
    profileId: string;
}